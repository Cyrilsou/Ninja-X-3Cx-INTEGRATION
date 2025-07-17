import { Router } from 'express';
import { threeCXAuth } from '../services/threecx-auth';
import { ninjaAuth } from '../services/ninja-auth';
import { Logger } from '@3cx-ninja/shared';

const router = Router();
const logger = new Logger('AuthRoutes');

/**
 * POST /api/auth/3cx/login
 * Authentification 3CX avec support 2FA
 */
router.post('/3cx/login', async (req, res) => {
  try {
    const { username, password, twoFactorCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    const token = await threeCXAuth.authenticate({
      username,
      password,
      twoFactorCode
    });

    res.json({
      success: true,
      token: token.access_token,
      expiresIn: token.expires_in
    });

  } catch (error: any) {
    if (error.message === '2FA_REQUIRED') {
      return res.status(428).json({
        error: '2FA required',
        message: 'Please provide your 2FA code'
      });
    }

    logger.error('3CX login error:', error);
    res.status(401).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/auth/3cx/logout
 * Déconnexion 3CX
 */
router.post('/3cx/logout', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (username) {
      await threeCXAuth.logout(username);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('3CX logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/ninja/init
 * Initialise NinjaOne avec un refresh token
 */
router.post('/ninja/init', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Refresh token is required' 
      });
    }

    const token = await ninjaAuth.initializeWithRefreshToken(refreshToken);

    res.json({
      success: true,
      message: 'NinjaOne authentication initialized',
      expiresIn: token.expires_in
    });

  } catch (error: any) {
    logger.error('NinjaOne init error:', error);
    res.status(401).json({ 
      error: 'NinjaOne authentication failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/auth/ninja/status
 * Vérifie le statut de l'authentification NinjaOne
 */
router.get('/ninja/status', async (req, res) => {
  try {
    const token = await ninjaAuth.getValidToken();
    
    res.json({
      authenticated: !!token,
      expiresAt: token ? new Date(Date.now() + ((token.expires_in || 0) * 1000)) : null
    });

  } catch (error) {
    logger.error('NinjaOne status error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

/**
 * POST /api/auth/validate
 * Valide la clé API du serveur
 */
router.post('/validate', (req, res) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  const serverApiKey = process.env.API_KEY;

  if (!apiKey || apiKey !== serverApiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  res.json({ 
    success: true,
    message: 'API key is valid' 
  });
});

export default router;