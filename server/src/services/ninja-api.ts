import axios, { AxiosInstance } from 'axios';
import config from 'config';
import { NinjaTicket, Logger } from '@3cx-ninja/shared';
import { RedisService } from './redis-service';

export class NinjaAPI {
  private client: AxiosInstance;
  private logger = new Logger('NinjaAPI');
  private accessToken: string | null = null;
  private redis: RedisService;

  constructor() {
    this.redis = new RedisService();
    this.client = axios.create({
      baseURL: config.get('ninja.apiUrl'),
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Intercepteur pour ajouter le token
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // Intercepteur pour gérer l'expiration du token
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          this.logger.warn('Token expired, refreshing...');
          this.accessToken = null;
          await this.getAccessToken();
          return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  private async getAccessToken(): Promise<string> {
    // Vérifier le cache
    const cachedToken = await this.redis.client.get('ninja:access_token');
    if (cachedToken) {
      return cachedToken;
    }

    try {
      const response = await axios.post(
        'https://app.ninjarmm.com/ws/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: process.env.NINJA_REFRESH_TOKEN!,
          client_id: process.env.NINJA_CLIENT_ID!,
          client_secret: process.env.NINJA_CLIENT_SECRET!
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      this.accessToken = response.data.access_token;
      
      // Mettre en cache pour 55 minutes (le token expire après 1h)
      await this.redis.client.setEx('ninja:access_token', 3300, this.accessToken);
      
      this.logger.info('NinjaOne token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Failed to refresh NinjaOne token:', error);
      throw error;
    }
  }

  async createTicket(ticket: NinjaTicket): Promise<number> {
    const retryService = require('./retry-service').default;
    
    return retryService.withRetry(async () => {
      // Ajouter le boardId par défaut si non spécifié
      if (!ticket.boardId) {
        ticket.boardId = config.get('ninja.boardId');
      }

      const response = await this.client.post('/ticketing/ticket', ticket);
      this.logger.info(`Ticket created with ID: ${response.data.id}`);
      return response.data.id;
    }, {
      maxRetries: 3,
      initialDelay: 2000,
      onRetry: (error, attempt) => {
        this.logger.warn(`Retry ${attempt} for NinjaOne ticket creation: ${error.message}`);
      }
    });
  }

  async searchContactByPhone(phoneNumber: string): Promise<any> {
    try {
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      
      // Recherche exacte
      let response = await this.client.get('/ticketing/contacts', {
        params: { phone: cleanedPhone }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }

      // Recherche partielle (derniers 8 chiffres)
      if (cleanedPhone.length > 8) {
        const partialPhone = cleanedPhone.slice(-8);
        response = await this.client.get('/ticketing/contacts', {
          params: { phone: partialPhone }
        });

        if (response.data && response.data.length > 0) {
          return response.data[0];
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error searching contact:', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<number | null> {
    try {
      const response = await this.client.get('/users', {
        params: { email }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0].id;
      }

      return null;
    } catch (error) {
      this.logger.error('Error fetching user by email:', error);
      return null;
    }
  }

  async getTicket(ticketId: number): Promise<any> {
    try {
      const response = await this.client.get(`/ticketing/ticket/${ticketId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching ticket:', error);
      throw error;
    }
  }

  async updateTicket(ticketId: number, updates: Partial<NinjaTicket>): Promise<void> {
    try {
      await this.client.patch(`/ticketing/ticket/${ticketId}`, updates);
      this.logger.info(`Ticket ${ticketId} updated`);
    } catch (error) {
      this.logger.error('Error updating ticket:', error);
      throw error;
    }
  }
}

export default new NinjaAPI();