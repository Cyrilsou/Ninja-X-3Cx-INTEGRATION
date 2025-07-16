import { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectionManager, ConnectionConfig, ConnectionStatus } from '../services/connection-manager';
import { Agent } from '@3cx-ninja/shared';

export interface UseConnectionManagerOptions {
  autoConnect?: boolean;
  retryOnFail?: boolean;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

export interface UseConnectionManagerReturn {
  connectionManager: ConnectionManager | null;
  status: ConnectionStatus;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  isConnected: boolean;
  isAuthenticated: boolean;
  lastError: Error | null;
  connectionStats: any;
}

export const useConnectionManager = (
  config: ConnectionConfig,
  options: UseConnectionManagerOptions = {}
): UseConnectionManagerReturn => {
  const {
    autoConnect = true,
    retryOnFail = true,
    onConnectionChange,
    onError
  } = options;

  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    authenticated: false,
    reconnectAttempts: 0
  });
  const [lastError, setLastError] = useState<Error | null>(null);
  const [connectionStats, setConnectionStats] = useState<any>(null);
  
  const isInitialized = useRef(false);
  const retryTimer = useRef<NodeJS.Timeout>();

  // Initialisation du ConnectionManager
  useEffect(() => {
    if (isInitialized.current) return;
    
    const manager = new ConnectionManager(config);
    setConnectionManager(manager);
    isInitialized.current = true;

    // Cleanup
    return () => {
      manager.destroy();
    };
  }, [config]);

  // Configuration des listeners
  useEffect(() => {
    if (!connectionManager) return;

    const updateStatus = () => {
      const newStatus = connectionManager.getStatus;
      setStatus(newStatus);
      setConnectionStats(connectionManager.getConnectionStats());
      onConnectionChange?.(newStatus);
    };

    const handleError = (error: Error) => {
      setLastError(error);
      onError?.(error);
    };

    // Listeners pour les événements de connexion
    connectionManager.on('connected', updateStatus);
    connectionManager.on('disconnected', updateStatus);
    connectionManager.on('authenticated', updateStatus);
    connectionManager.on('reconnecting', updateStatus);
    connectionManager.on('auth:failed', handleError);
    connectionManager.on('connection:error', handleError);
    connectionManager.on('reconnect:error', handleError);
    
    // Listeners pour les notifications
    connectionManager.on('notification', (notification) => {
      // Gérer les notifications du serveur
      console.log('Server notification:', notification);
    });

    connectionManager.on('server:update', (update) => {
      // Gérer les mises à jour du serveur
      console.log('Server update:', update);
    });

    // Nettoyage
    return () => {
      connectionManager.off('connected', updateStatus);
      connectionManager.off('disconnected', updateStatus);
      connectionManager.off('authenticated', updateStatus);
      connectionManager.off('reconnecting', updateStatus);
      connectionManager.off('auth:failed', handleError);
      connectionManager.off('connection:error', handleError);
      connectionManager.off('reconnect:error', handleError);
    };
  }, [connectionManager, onConnectionChange, onError]);

  // Connexion automatique
  useEffect(() => {
    if (connectionManager && autoConnect && !status.connected) {
      connect();
    }
  }, [connectionManager, autoConnect]);

  // Fonction de connexion
  const connect = useCallback(async () => {
    if (!connectionManager) {
      throw new Error('ConnectionManager not initialized');
    }

    try {
      setLastError(null);
      await connectionManager.connect();
    } catch (error) {
      const err = error as Error;
      setLastError(err);
      
      if (retryOnFail) {
        // Retry après un délai
        retryTimer.current = setTimeout(() => {
          connect();
        }, 5000);
      }
      
      throw err;
    }
  }, [connectionManager, retryOnFail]);

  // Fonction de déconnexion
  const disconnect = useCallback(async () => {
    if (!connectionManager) return;

    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = undefined;
    }

    await connectionManager.disconnect();
  }, [connectionManager]);

  // Fonction de reconnexion
  const reconnect = useCallback(async () => {
    if (!connectionManager) return;

    await disconnect();
    await connect();
  }, [connectionManager, disconnect, connect]);

  // Nettoyage des timers
  useEffect(() => {
    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
    };
  }, []);

  return {
    connectionManager,
    status,
    connect,
    disconnect,
    reconnect,
    isConnected: status.connected,
    isAuthenticated: status.authenticated,
    lastError,
    connectionStats
  };
};