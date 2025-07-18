import axios from 'axios';
import Store from 'electron-store';

export class AuthService {
  private store: Store;
  private baseUrl: string;

  constructor(store: Store) {
    this.store = store;
    this.baseUrl = this.store.get('serverUrl') as string || 'http://localhost:3002';
  }

  async login(extension: string, agentName?: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/agent/login`, {
        extension,
        agentName
      });

      if (response.data.token) {
        return response.data.token;
      }

      throw new Error('No token received');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || error.message);
      }
      throw error;
    }
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data.valid === true;
    } catch (error) {
      return false;
    }
  }
}