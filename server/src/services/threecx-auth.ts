import axios from 'axios';
import { Logger } from '@3cx-ninja/shared';
import { cache } from './cache';

interface ThreeCXAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface ThreeCXCredentials {
  username: string;
  password: string;
  twoFactorCode?: string;
}

export class ThreeCXAuth {
  private logger = new Logger('3CXAuth');
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private tokenKey = '3cx:auth:token';
  
  constructor() {
    this.baseUrl = process.env.PBX_URL || '';
    this.clientId = process.env.CX_CLIENT_ID || '';
    this.clientSecret = process.env.CX_CLIENT_SECRET || '';
  }

  /**
   * Authentifie un utilisateur 3CX avec support 2FA
   */
  async authenticate(credentials: ThreeCXCredentials): Promise<ThreeCXAuthToken> {
    try {
      // Vérifier si on a un token valide en cache
      const cachedToken = await this.getValidToken(credentials.username);
      if (cachedToken) {
        return cachedToken;
      }

      // Première tentative d'authentification
      const authData = {
        grant_type: 'password',
        username: credentials.username,
        password: credentials.password,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'calls recordings'
      };

      // Si 2FA est fourni, l'ajouter
      if (credentials.twoFactorCode) {
        Object.assign(authData, { totp_code: credentials.twoFactorCode });
      }

      const response = await axios.post(
        `${this.baseUrl}/api/oauth/token`,
        authData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const token = response.data as ThreeCXAuthToken;
      
      // Sauvegarder le token en cache
      await this.saveToken(credentials.username, token);
      
      this.logger.info(`User ${credentials.username} authenticated successfully`);
      return token;

    } catch (error: any) {
      // Gérer l'erreur 2FA
      if (error.response?.status === 428) {
        throw new Error('2FA_REQUIRED');
      }
      
      this.logger.error('Authentication failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Rafraîchit un token expiré
   */
  async refreshToken(username: string): Promise<ThreeCXAuthToken | null> {
    try {
      const tokenData = await cache.get(`${this.tokenKey}:${username}`);
      if (!tokenData || !tokenData.refresh_token) {
        return null;
      }

      const response = await axios.post(
        `${this.baseUrl}/api/oauth/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
          client_id: this.clientId,
          client_secret: this.clientSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const newToken = response.data as ThreeCXAuthToken;
      await this.saveToken(username, newToken);
      
      this.logger.info(`Token refreshed for user ${username}`);
      return newToken;

    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      await cache.del(`${this.tokenKey}:${username}`);
      return null;
    }
  }

  /**
   * Récupère un token valide depuis le cache
   */
  private async getValidToken(username: string): Promise<ThreeCXAuthToken | null> {
    const tokenData = await cache.get(`${this.tokenKey}:${username}`);
    if (!tokenData) return null;

    // Vérifier l'expiration (avec 5 minutes de marge)
    const expiresAt = tokenData.expires_at || 0;
    const now = Date.now();
    
    if (expiresAt - now < 5 * 60 * 1000) {
      // Token expiré ou sur le point d'expirer, essayer de le rafraîchir
      return await this.refreshToken(username);
    }

    return tokenData;
  }

  /**
   * Sauvegarde un token en cache
   */
  private async saveToken(username: string, token: ThreeCXAuthToken): Promise<void> {
    const tokenData = {
      ...token,
      expires_at: Date.now() + (token.expires_in * 1000)
    };

    // Sauvegarder avec expiration
    await cache.setex(
      `${this.tokenKey}:${username}`,
      token.expires_in,
      tokenData
    );
  }

  /**
   * Déconnecte un utilisateur
   */
  async logout(username: string): Promise<void> {
    await cache.del(`${this.tokenKey}:${username}`);
    this.logger.info(`User ${username} logged out`);
  }

  /**
   * Middleware Express pour vérifier l'authentification
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        
        // Vérifier le token dans le cache
        const keys = await cache.keys(`${this.tokenKey}:*`);
        for (const key of keys) {
          const tokenData = await cache.get(key);
          if (tokenData && tokenData.access_token === token) {
            req.user = {
              username: key.split(':').pop(),
              token: tokenData
            };
            return next();
          }
        }

        res.status(401).json({ error: 'Invalid token' });
      } catch (error) {
        res.status(500).json({ error: 'Authentication error' });
      }
    };
  }
}

export const threeCXAuth = new ThreeCXAuth();