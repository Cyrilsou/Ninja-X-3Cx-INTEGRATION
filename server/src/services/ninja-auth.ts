import axios from 'axios';
import { Logger } from '@3cx-ninja/shared';
import { cache } from './cache';

interface NinjaAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export class NinjaAuth {
  private logger = new Logger('NinjaAuth');
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private tokenKey = 'ninja:auth:token';
  private refreshCheckInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.baseUrl = process.env.NINJA_API_URL || 'https://api.ninjarmm.com';
    this.clientId = process.env.NINJA_CLIENT_ID || '';
    this.clientSecret = process.env.NINJA_CLIENT_SECRET || '';
    
    // Démarrer la vérification automatique des tokens
    this.startTokenRefreshCheck();
  }

  /**
   * Initialise l'authentification avec un refresh token
   */
  async initializeWithRefreshToken(refreshToken: string): Promise<NinjaAuthToken> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/oauth/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const token = response.data as NinjaAuthToken;
      await this.saveToken(token);
      
      this.logger.info('NinjaOne authenticated successfully');
      return token;

    } catch (error: any) {
      this.logger.error('NinjaOne authentication failed:', error);
      throw new Error(`NinjaOne authentication failed: ${error.message}`);
    }
  }

  /**
   * Récupère le token actuel ou le rafraîchit si nécessaire
   */
  async getValidToken(): Promise<NinjaAuthToken | null> {
    const tokenData = await cache.get(this.tokenKey);
    if (!tokenData) {
      this.logger.warn('No NinjaOne token found');
      return null;
    }

    // Vérifier l'expiration (avec 5 minutes de marge)
    const expiresAt = tokenData.expires_at || 0;
    const now = Date.now();
    
    if (expiresAt - now < 5 * 60 * 1000) {
      // Token expiré ou sur le point d'expirer
      return await this.refreshToken();
    }

    return tokenData;
  }

  /**
   * Rafraîchit le token
   */
  private async refreshToken(): Promise<NinjaAuthToken | null> {
    try {
      const currentToken = await cache.get(this.tokenKey);
      if (!currentToken || !currentToken.refresh_token) {
        this.logger.error('No refresh token available');
        return null;
      }

      const response = await axios.post(
        `${this.baseUrl}/oauth/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: currentToken.refresh_token,
          client_id: this.clientId,
          client_secret: this.clientSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const newToken = response.data as NinjaAuthToken;
      await this.saveToken(newToken);
      
      this.logger.info('NinjaOne token refreshed successfully');
      return newToken;

    } catch (error: any) {
      this.logger.error('Token refresh failed:', error);
      
      // Si le refresh échoue, supprimer le token invalide
      await cache.delete(this.tokenKey);
      
      // Notifier les administrateurs
      this.logger.error('CRITICAL: NinjaOne token refresh failed - manual intervention required');
      
      return null;
    }
  }

  /**
   * Sauvegarde le token en cache
   */
  private async saveToken(token: NinjaAuthToken): Promise<void> {
    const tokenData = {
      ...token,
      expires_at: Date.now() + (token.expires_in * 1000)
    };

    // Sauvegarder avec expiration Redis
    await cache.set(
      this.tokenKey,
      tokenData,
      token.expires_in
    );
  }

  /**
   * Démarre la vérification automatique des tokens
   */
  private startTokenRefreshCheck(): void {
    // Vérifier toutes les 30 minutes
    this.refreshCheckInterval = setInterval(async () => {
      try {
        const token = await this.getValidToken();
        if (!token) {
          this.logger.warn('Token refresh check: No valid token');
        }
      } catch (error) {
        this.logger.error('Token refresh check failed:', error);
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Arrête la vérification automatique
   */
  stopTokenRefreshCheck(): void {
    if (this.refreshCheckInterval) {
      clearInterval(this.refreshCheckInterval);
      this.refreshCheckInterval = null;
    }
  }

  /**
   * Effectue une requête authentifiée vers l'API NinjaOne
   */
  async request(config: any): Promise<any> {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('No valid NinjaOne token available');
    }

    try {
      const response = await axios({
        ...config,
        baseURL: this.baseUrl,
        headers: {
          ...config.headers,
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;

    } catch (error: any) {
      // Si erreur 401, essayer de rafraîchir le token
      if (error.response?.status === 401) {
        const newToken = await this.refreshToken();
        if (newToken) {
          // Réessayer la requête avec le nouveau token
          return await axios({
            ...config,
            baseURL: this.baseUrl,
            headers: {
              ...config.headers,
              'Authorization': `Bearer ${newToken.access_token}`,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      
      throw error;
    }
  }
}

export const ninjaAuth = new NinjaAuth();