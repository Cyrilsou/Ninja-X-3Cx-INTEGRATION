import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComputerDesktopIcon,
  ServerIcon,
  WifiIcon,
  ShieldCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { ConnectionManager } from '../services/connection-manager';

interface ConnectionDiagnosticsProps {
  connectionManager: ConnectionManager | null;
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticTest {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: 'idle' | 'running' | 'passed' | 'failed';
  result?: any;
  error?: string;
  duration?: number;
}

export const ConnectionDiagnostics: React.FC<ConnectionDiagnosticsProps> = ({
  connectionManager,
  isOpen,
  onClose
}) => {
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');

  useEffect(() => {
    if (isOpen) {
      initializeTests();
    }
  }, [isOpen]);

  const initializeTests = () => {
    const initialTests: DiagnosticTest[] = [
      {
        id: 'network',
        name: 'Connectivité réseau',
        description: 'Test de connectivité Internet basique',
        icon: WifiIcon,
        status: 'idle'
      },
      {
        id: 'server',
        name: 'Accessibilité serveur',
        description: 'Test d\'accessibilité du serveur 3CX-Ninja',
        icon: ServerIcon,
        status: 'idle'
      },
      {
        id: 'websocket',
        name: 'Connexion WebSocket',
        description: 'Test de connexion WebSocket temps réel',
        icon: ComputerDesktopIcon,
        status: 'idle'
      },
      {
        id: 'auth',
        name: 'Authentification',
        description: 'Test d\'authentification avec la clé API',
        icon: ShieldCheckIcon,
        status: 'idle'
      },
      {
        id: 'latency',
        name: 'Latence',
        description: 'Mesure de la latence réseau',
        icon: ClockIcon,
        status: 'idle'
      },
      {
        id: 'performance',
        name: 'Performance',
        description: 'Test de performance de la connexion',
        icon: ChartBarIcon,
        status: 'idle'
      }
    ];

    setTests(initialTests);
    setOverallStatus('idle');
  };

  const runAllTests = async () => {
    if (!connectionManager) return;

    setIsRunning(true);
    setOverallStatus('running');

    let allPassed = true;

    for (const test of tests) {
      await runTest(test.id);
      // Attendre un peu entre chaque test
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Déterminer le statut global
    const finalTests = tests.slice();
    const failedTests = finalTests.filter(t => t.status === 'failed');
    
    if (failedTests.length === 0) {
      setOverallStatus('passed');
    } else {
      setOverallStatus('failed');
      allPassed = false;
    }

    setIsRunning(false);
  };

  const runTest = async (testId: string) => {
    if (!connectionManager) return;

    setTests(prev => prev.map(t => 
      t.id === testId ? { ...t, status: 'running' as const } : t
    ));

    const startTime = Date.now();

    try {
      let result: any;
      let success = false;

      switch (testId) {
        case 'network':
          result = await testNetworkConnectivity();
          success = result.success;
          break;

        case 'server':
          result = await testServerAccessibility();
          success = result.success;
          break;

        case 'websocket':
          result = await testWebSocketConnection();
          success = result.success;
          break;

        case 'auth':
          result = await testAuthentication();
          success = result.success;
          break;

        case 'latency':
          result = await testLatency();
          success = result.success;
          break;

        case 'performance':
          result = await testPerformance();
          success = result.success;
          break;

        default:
          throw new Error(`Unknown test: ${testId}`);
      }

      const duration = Date.now() - startTime;

      setTests(prev => prev.map(t =>
        t.id === testId ? {
          ...t,
          status: success ? 'passed' : 'failed',
          result,
          duration,
          error: success ? undefined : result.error
        } : t
      ));

    } catch (error) {
      const duration = Date.now() - startTime;

      setTests(prev => prev.map(t =>
        t.id === testId ? {
          ...t,
          status: 'failed',
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        } : t
      ));
    }
  };

  // Tests individuels
  const testNetworkConnectivity = async () => {
    try {
      const response = await fetch('https://8.8.8.8', { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return { success: true, message: 'Connectivité Internet OK' };
    } catch (error) {
      return { success: false, error: 'Pas de connectivité Internet' };
    }
  };

  const testServerAccessibility = async () => {
    try {
      const config = connectionManager?.getConnectionStats()?.config;
      if (!config?.serverUrl) {
        return { success: false, error: 'URL du serveur non configurée' };
      }

      const response = await fetch(`${config.serverUrl}/health`, {
        method: 'GET',
        cache: 'no-cache'
      });

      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          message: 'Serveur accessible',
          serverInfo: data
        };
      } else {
        return { success: false, error: `Serveur inaccessible (${response.status})` };
      }
    } catch (error) {
      return { success: false, error: 'Impossible de contacter le serveur' };
    }
  };

  const testWebSocketConnection = async () => {
    try {
      const isConnected = await connectionManager?.testConnection();
      
      if (isConnected) {
        return { success: true, message: 'WebSocket connecté' };
      } else {
        return { success: false, error: 'WebSocket non connecté' };
      }
    } catch (error) {
      return { success: false, error: 'Erreur WebSocket' };
    }
  };

  const testAuthentication = async () => {
    try {
      const status = connectionManager?.getStatus;
      
      if (status?.authenticated) {
        return { 
          success: true, 
          message: 'Authentification réussie',
          serverVersion: status.serverVersion
        };
      } else {
        return { success: false, error: 'Authentification échouée' };
      }
    } catch (error) {
      return { success: false, error: 'Erreur d\'authentification' };
    }
  };

  const testLatency = async () => {
    try {
      const status = connectionManager?.getStatus;
      const latency = status?.latency;
      
      if (latency !== undefined) {
        let quality = 'Excellente';
        if (latency > 100) quality = 'Bonne';
        if (latency > 200) quality = 'Moyenne';
        if (latency > 500) quality = 'Mauvaise';
        
        return { 
          success: latency < 1000, 
          message: `Latence: ${latency}ms (${quality})`,
          latency
        };
      } else {
        return { success: false, error: 'Latence non mesurable' };
      }
    } catch (error) {
      return { success: false, error: 'Erreur de mesure de latence' };
    }
  };

  const testPerformance = async () => {
    try {
      const stats = connectionManager?.getConnectionStats();
      
      if (stats?.socket) {
        return { 
          success: true, 
          message: `Transport: ${stats.socket.transport}`,
          transport: stats.socket.transport
        };
      } else {
        return { success: false, error: 'Statistiques non disponibles' };
      }
    } catch (error) {
      return { success: false, error: 'Erreur de test de performance' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'running':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <div className="h-5 w-5 bg-gray-200 rounded-full" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Diagnostic de connexion
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Overall Status */}
          <div className="mb-6">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(overallStatus)}
                <span className="text-lg font-medium">
                  {overallStatus === 'passed' && 'Tous les tests sont passés'}
                  {overallStatus === 'failed' && 'Certains tests ont échoué'}
                  {overallStatus === 'running' && 'Tests en cours...'}
                  {overallStatus === 'idle' && 'Prêt à tester'}
                </span>
              </div>
            </div>
          </div>

          {/* Tests List */}
          <div className="space-y-4">
            {tests.map((test) => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <test.icon className="h-6 w-6 text-gray-400 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">{test.name}</h3>
                        {test.duration && (
                          <span className="text-xs text-gray-500">
                            ({test.duration}ms)
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {test.description}
                      </p>
                      
                      {/* Results */}
                      {test.result && (
                        <div className="mt-2 text-sm">
                          {test.status === 'passed' ? (
                            <span className="text-green-600">
                              {test.result.message}
                            </span>
                          ) : (
                            <span className="text-red-600">
                              {test.error}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(test.status)}
                    <button
                      onClick={() => runTest(test.id)}
                      disabled={test.status === 'running' || isRunning}
                      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      Tester
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={initializeTests}
              disabled={isRunning}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Réinitialiser
            </button>
            <button
              onClick={runAllTests}
              disabled={isRunning || !connectionManager}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunning ? 'Tests en cours...' : 'Lancer tous les tests'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};