import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  SignalIcon,
  ServerIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { ConnectionManager, ConnectionStatus as IConnectionStatus } from '../services/connection-manager';

interface ConnectionStatusProps {
  connectionManager: ConnectionManager;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connectionManager }) => {
  const [status, setStatus] = useState<IConnectionStatus>(connectionManager.getStatus);
  const [showDetails, setShowDetails] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const updateStatus = () => {
      setStatus(connectionManager.getStatus);
      setLastUpdate(new Date());
    };

    // Listeners pour les événements de connexion
    connectionManager.on('connected', updateStatus);
    connectionManager.on('disconnected', updateStatus);
    connectionManager.on('authenticated', updateStatus);
    connectionManager.on('reconnecting', updateStatus);
    connectionManager.on('latency', updateStatus);

    // Mise à jour périodique
    const interval = setInterval(updateStatus, 5000);

    return () => {
      connectionManager.off('connected', updateStatus);
      connectionManager.off('disconnected', updateStatus);
      connectionManager.off('authenticated', updateStatus);
      connectionManager.off('reconnecting', updateStatus);
      connectionManager.off('latency', updateStatus);
      clearInterval(interval);
    };
  }, [connectionManager]);

  const getStatusIcon = () => {
    if (status.connected && status.authenticated) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    } else if (status.connected && !status.authenticated) {
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    } else if (status.reconnectAttempts > 0) {
      return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
    } else {
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusText = () => {
    if (status.connected && status.authenticated) {
      return 'Connecté';
    } else if (status.connected && !status.authenticated) {
      return 'Authentification...';
    } else if (status.reconnectAttempts > 0) {
      return `Reconnexion (${status.reconnectAttempts})`;
    } else {
      return 'Déconnecté';
    }
  };

  const getStatusColor = () => {
    if (status.connected && status.authenticated) {
      return 'bg-green-50 border-green-200 text-green-700';
    } else if (status.connected && !status.authenticated) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    } else if (status.reconnectAttempts > 0) {
      return 'bg-blue-50 border-blue-200 text-blue-700';
    } else {
      return 'bg-red-50 border-red-200 text-red-700';
    }
  };

  const getLatencyColor = () => {
    if (!status.latency) return 'text-gray-400';
    if (status.latency < 100) return 'text-green-500';
    if (status.latency < 300) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getLatencyBars = () => {
    if (!status.latency) return 0;
    if (status.latency < 50) return 4;
    if (status.latency < 100) return 3;
    if (status.latency < 200) return 2;
    return 1;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="relative">
      {/* Status Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border cursor-pointer ${getStatusColor()}`}
        onClick={() => setShowDetails(!showDetails)}
      >
        <motion.div
          animate={status.reconnectAttempts > 0 ? { rotate: 360 } : {}}
          transition={{ duration: 1, repeat: status.reconnectAttempts > 0 ? Infinity : 0 }}
        >
          {getStatusIcon()}
        </motion.div>
        <span className="text-sm font-medium">{getStatusText()}</span>
        
        {/* Latency indicator */}
        {status.connected && status.latency && (
          <div className="flex items-center space-x-1">
            <div className="flex space-x-0.5">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={`w-1 h-3 rounded-sm ${
                    bar <= getLatencyBars() ? getLatencyColor() : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <span className={`text-xs ${getLatencyColor()}`}>
              {status.latency}ms
            </span>
          </div>
        )}
      </motion.div>

      {/* Details Panel */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  État de la connexion
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {/* Connection Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <WifiIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Connexion</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {status.connected ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {status.connected ? 'Connecté' : 'Déconnecté'}
                    </span>
                  </div>
                </div>

                {/* Authentication Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ServerIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Authentification</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {status.authenticated ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {status.authenticated ? 'Authentifié' : 'Non authentifié'}
                    </span>
                  </div>
                </div>

                {/* Latency */}
                {status.latency && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <SignalIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Latence</span>
                    </div>
                    <span className={`text-sm font-medium ${getLatencyColor()}`}>
                      {status.latency}ms
                    </span>
                  </div>
                )}

                {/* Last Heartbeat */}
                {status.lastHeartbeat && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Dernier heartbeat</span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatTime(status.lastHeartbeat)}
                    </span>
                  </div>
                )}

                {/* Server Version */}
                {status.serverVersion && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ServerIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Version serveur</span>
                    </div>
                    <span className="text-sm font-medium">
                      {status.serverVersion}
                    </span>
                  </div>
                )}

                {/* Reconnection Attempts */}
                {status.reconnectAttempts > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ArrowPathIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Tentatives</span>
                    </div>
                    <span className="text-sm font-medium">
                      {status.reconnectAttempts}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t flex space-x-2">
                <button
                  onClick={() => connectionManager.testConnection()}
                  className="flex-1 px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                >
                  Test connexion
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-3 py-2 text-xs bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                >
                  Redémarrer
                </button>
              </div>

              {/* Last Update */}
              <div className="mt-2 text-xs text-gray-500 text-center">
                Mis à jour à {formatTime(lastUpdate)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};