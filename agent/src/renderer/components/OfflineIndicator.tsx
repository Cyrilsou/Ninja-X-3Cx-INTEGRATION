import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { OfflineManager } from '../services/offline-manager';

interface OfflineIndicatorProps {
  offlineManager: OfflineManager;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ offlineManager }) => {
  const [isOnline, setIsOnline] = useState(offlineManager.online);
  const [stats, setStats] = useState(offlineManager.getStats());
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      setStats(offlineManager.getStats());
    };

    const handleOnline = () => {
      setIsOnline(true);
      updateStats();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateStats();
    };

    const handleProcessing = () => {
      setIsProcessing(true);
      updateStats();
    };

    const handleProcessed = () => {
      setIsProcessing(false);
      updateStats();
    };

    // Listeners
    offlineManager.on('online', handleOnline);
    offlineManager.on('offline', handleOffline);
    offlineManager.on('item:added', updateStats);
    offlineManager.on('item:processed', handleProcessed);
    offlineManager.on('item:failed', updateStats);
    offlineManager.on('queue:cleared', updateStats);

    // Mise à jour périodique
    const interval = setInterval(updateStats, 5000);

    return () => {
      offlineManager.off('online', handleOnline);
      offlineManager.off('offline', handleOffline);
      offlineManager.off('item:added', updateStats);
      offlineManager.off('item:processed', handleProcessed);
      offlineManager.off('item:failed', updateStats);
      offlineManager.off('queue:cleared', updateStats);
      clearInterval(interval);
    };
  }, [offlineManager]);

  const getIndicatorIcon = () => {
    if (isProcessing) {
      return <ArrowPathIcon className="h-4 w-4 animate-spin" />;
    }
    
    if (!isOnline) {
      return <ExclamationTriangleIcon className="h-4 w-4" />;
    }
    
    if (stats.queueSize > 0) {
      return <CloudArrowUpIcon className="h-4 w-4" />;
    }
    
    return <CheckCircleIcon className="h-4 w-4" />;
  };

  const getIndicatorColor = () => {
    if (isProcessing) {
      return 'bg-blue-100 border-blue-300 text-blue-700';
    }
    
    if (!isOnline) {
      return 'bg-red-100 border-red-300 text-red-700';
    }
    
    if (stats.queueSize > 0) {
      return 'bg-yellow-100 border-yellow-300 text-yellow-700';
    }
    
    return 'bg-green-100 border-green-300 text-green-700';
  };

  const getIndicatorText = () => {
    if (isProcessing) {
      return 'Synchronisation...';
    }
    
    if (!isOnline) {
      return 'Hors ligne';
    }
    
    if (stats.queueSize > 0) {
      return `${stats.queueSize} en attente`;
    }
    
    return 'Synchronisé';
  };

  const formatStorageSize = (sizeInMB: number): string => {
    if (sizeInMB < 1) {
      return `${(sizeInMB * 1024).toFixed(1)} KB`;
    }
    return `${sizeInMB.toFixed(1)} MB`;
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays}j`;
  };

  // Ne pas afficher si tout est OK
  if (isOnline && stats.queueSize === 0 && !isProcessing) {
    return null;
  }

  return (
    <div className="relative">
      {/* Indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-sm cursor-pointer ${getIndicatorColor()}`}
        onClick={() => setShowDetails(!showDetails)}
      >
        {getIndicatorIcon()}
        <span className="font-medium">{getIndicatorText()}</span>
        {stats.queueSize > 0 && (
          <span className="px-2 py-0.5 text-xs bg-white bg-opacity-50 rounded-full">
            {stats.queueSize}
          </span>
        )}
      </motion.div>

      {/* Details Panel */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Synchronisation hors ligne
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              {/* Status */}
              <div className="mb-4">
                <div className="flex items-center space-x-2">
                  {getIndicatorIcon()}
                  <span className="text-sm font-medium">{getIndicatorText()}</span>
                </div>
                {!isOnline && (
                  <p className="text-xs text-gray-500 mt-1">
                    Les données sont sauvegardées localement et seront synchronisées lors du retour de la connexion.
                  </p>
                )}
              </div>

              {/* Queue Stats */}
              {stats.queueSize > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    File d'attente
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Éléments en attente</span>
                      <span className="font-medium">{stats.queueSize}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taille stockage</span>
                      <span className="font-medium">{formatStorageSize(stats.storageSize)}</span>
                    </div>
                    {stats.oldestItem && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Plus ancien</span>
                        <span className="font-medium">{formatTimeAgo(stats.oldestItem)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* By Type */}
              {Object.keys(stats.byType).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Par type
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{type}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                {isOnline && stats.queueSize > 0 && (
                  <button
                    onClick={() => offlineManager.forceProcess()}
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                  >
                    <ArrowPathIcon className="h-3 w-3 inline mr-1" />
                    Synchroniser
                  </button>
                )}
                {stats.queueSize > 0 && (
                  <button
                    onClick={() => offlineManager.clearQueue()}
                    className="flex-1 px-3 py-2 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    Vider
                  </button>
                )}
              </div>

              {/* Help */}
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-gray-500">
                  Les données sont automatiquement sauvegardées en local et synchronisées 
                  quand la connexion est rétablie.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};