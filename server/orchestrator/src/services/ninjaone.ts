import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import pLimit from 'p-limit';
import { config, derivedConfig } from '../config';
import { logger } from '../utils/logger';
import {
  NinjaOneToken,
  NinjaOneContact,
  NinjaOneTicket,
  NinjaOneUser,
  NinjaOneBoard,
  NinjaOneError
} from '../types/ninjaone.types';

export class NinjaOneService {
  private static instance: NinjaOneService;
  private axiosInstance: AxiosInstance;
  private tokenCache: NodeCache;
  private contactCache: NodeCache;
  private userCache: NodeCache;
  private rateLimiter: any;
  private token: NinjaOneToken | null = null;
  private tokenExpiresAt: Date | null = null;

  private constructor() {
    this.tokenCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
    this.contactCache = new NodeCache({ stdTTL: 600 }); // 10 minutes
    this.userCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
    
    // Rate limiter
    this.rateLimiter = pLimit(config.NINJAONE_RATE_LIMIT);

    // Configure axios instance
    this.axiosInstance = axios.create({
      baseURL: derivedConfig.ninjaone.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      async (request) => {
        if (!request.url?.includes('/oauth/token')) {
          const token = await this.getAccessToken();
          request.headers.Authorization = `Bearer ${token}`;
        }
        return request;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          await this.refreshToken();
          return this.axiosInstance(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  static getInstance(): NinjaOneService {
    if (!this.instance) {
      this.instance = new NinjaOneService();
    }
    return this.instance;
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.token.access_token;
    }

    await this.refreshToken();
    return this.token!.access_token;
  }

  private async refreshToken(): Promise<void> {
    try {
      logger.info('Refreshing NinjaOne access token');

      const response = await axios.post(
        derivedConfig.ninjaone.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.NINJAONE_CLIENT_ID,
          client_secret: config.NINJAONE_CLIENT_SECRET,
          scope: 'monitoring management'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.token = response.data;
      this.tokenExpiresAt = new Date(Date.now() + (this.token!.expires_in - 60) * 1000);
      
      logger.info('NinjaOne token refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh NinjaOne token', error);
      throw error;
    }
  }

  async searchContacts(phone: string): Promise<NinjaOneContact[]> {
    const cacheKey = `contact_phone_${phone}`;
    const cached = this.contactCache.get<NinjaOneContact[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.rateLimiter(() =>
        this.axiosInstance.get('/ticketing/contacts', {
          params: { phone }
        })
      );

      const contacts = response.data.data || [];
      this.contactCache.set(cacheKey, contacts);
      return contacts;
    } catch (error) {
      logger.error('Failed to search contacts', { phone, error });
      return [];
    }
  }

  async getContactById(contactId: number): Promise<NinjaOneContact | null> {
    const cacheKey = `contact_${contactId}`;
    const cached = this.contactCache.get<NinjaOneContact>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.rateLimiter(() =>
        this.axiosInstance.get(`/ticketing/contact/${contactId}`)
      );

      const contact = response.data;
      this.contactCache.set(cacheKey, contact);
      return contact;
    } catch (error) {
      logger.error('Failed to get contact', { contactId, error });
      return null;
    }
  }

  async createContact(contactData: Partial<NinjaOneContact>): Promise<NinjaOneContact | null> {
    try {
      const response = await this.rateLimiter(() =>
        this.axiosInstance.post('/ticketing/contact', contactData)
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to create contact', { contactData, error });
      return null;
    }
  }

  async searchUserByExtension(extension: string): Promise<NinjaOneUser | null> {
    const cacheKey = `user_ext_${extension}`;
    const cached = this.userCache.get<NinjaOneUser>(cacheKey);
    if (cached) return cached;

    try {
      // Search in custom field or phone field
      const response = await this.rateLimiter(() =>
        this.axiosInstance.get('/users', {
          params: { q: extension }
        })
      );

      const users = response.data.data || [];
      const user = users.find((u: NinjaOneUser) => 
        u.extension === extension || u.phone?.includes(extension)
      );

      if (user) {
        this.userCache.set(cacheKey, user);
      }

      return user || null;
    } catch (error) {
      logger.error('Failed to search user by extension', { extension, error });
      return null;
    }
  }

  async getBoards(): Promise<NinjaOneBoard[]> {
    const cacheKey = 'boards';
    const cached = this.tokenCache.get<NinjaOneBoard[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.rateLimiter(() =>
        this.axiosInstance.get('/ticketing/boards')
      );

      const boards = response.data.data || [];
      this.tokenCache.set(cacheKey, boards);
      return boards;
    } catch (error) {
      logger.error('Failed to get boards', error);
      return [];
    }
  }

  async getDefaultBoard(): Promise<NinjaOneBoard | null> {
    const boards = await this.getBoards();
    return boards.find(b => b.isDefault) || boards[0] || null;
  }

  async createTicket(ticketData: NinjaOneTicket): Promise<NinjaOneTicket | null> {
    try {
      // Ensure we have a board ID
      if (!ticketData.boardId) {
        const defaultBoard = await this.getDefaultBoard();
        if (!defaultBoard) {
          throw new Error('No board available for ticket creation');
        }
        ticketData.boardId = defaultBoard.id;
      }

      const response = await this.rateLimiter(() =>
        this.axiosInstance.post('/ticketing/ticket', ticketData)
      );

      logger.info('Ticket created successfully', {
        ticketId: response.data.id,
        ticketNumber: response.data.ticketNumber
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create ticket', { ticketData, error });
      
      if (axios.isAxiosError(error)) {
        const ninjaError = error.response?.data as NinjaOneError;
        logger.error('NinjaOne API error', ninjaError);
      }
      
      return null;
    }
  }

  async updateTicket(ticketId: number, updates: Partial<NinjaOneTicket>): Promise<NinjaOneTicket | null> {
    try {
      const response = await this.rateLimiter(() =>
        this.axiosInstance.patch(`/ticketing/ticket/${ticketId}`, updates)
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to update ticket', { ticketId, updates, error });
      return null;
    }
  }

  async addTicketComment(ticketId: number, comment: string, internal: boolean = false): Promise<void> {
    try {
      await this.rateLimiter(() =>
        this.axiosInstance.post(`/ticketing/ticket/${ticketId}/comment`, {
          comment,
          internal
        })
      );
    } catch (error) {
      logger.error('Failed to add ticket comment', { ticketId, error });
    }
  }

  async uploadAttachment(ticketId: number, fileName: string, content: Buffer): Promise<void> {
    try {
      const attachment = {
        fileName,
        contentType: 'application/octet-stream',
        content: content.toString('base64')
      };

      await this.rateLimiter(() =>
        this.axiosInstance.post(`/ticketing/ticket/${ticketId}/attachment`, attachment)
      );
    } catch (error) {
      logger.error('Failed to upload attachment', { ticketId, fileName, error });
    }
  }
}