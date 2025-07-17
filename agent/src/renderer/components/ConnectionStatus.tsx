import React from 'react';
import { WifiIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ConnectionManager } from '../services/connection-manager';

interface ConnectionStatusProps {
  connectionManager: ConnectionManager;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connectionManager }) => {
  const status = connectionManager.getStatus();

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'disconnected':
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connecté';
      case 'connecting':
        return 'Connexion...';
      case 'disconnected':
        return 'Déconnecté';
      case 'error':
        return 'Erreur';
      default:
        return 'Inconnu';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${getStatusColor()}`}>
      {status === 'error' ? (
        <ExclamationTriangleIcon className="h-5 w-5" />
      ) : (
        <WifiIcon className="h-5 w-5" />
      )}
      <span className="text-sm font-medium">{getStatusText()}</span>
    </div>
  );
};