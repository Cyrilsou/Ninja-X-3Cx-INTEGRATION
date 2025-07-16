import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CogIcon, 
  ServerIcon, 
  KeyIcon, 
  PhoneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';

interface AgentSettingsProps {
  onSave?: (config: any) => void;
  onCancel?: () => void;
}

export const AgentSettings: React.FC<AgentSettingsProps> = ({ onSave, onCancel }) => {
  const [config, setConfig] = useState({
    agent: {
      id: '',
      email: '',
      extension: '',
      name: ''
    },
    server: {
      url: 'http://localhost:3000',
      apiKey: ''
    },
    threeСX: {
      pbxUrl: '',
      username: '',
      password: ''
    },
    ninja: {
      clientId: '',
      clientSecret: '',
      refreshToken: ''
    },
    audio: {
      device: 'default',
      sampleRate: 16000,
      channels: 1
    }
  });

  const [activeTab, setActiveTab] = useState('agent');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>({});

  useEffect(() => {
    // Charger la config existante
    window.electron?.store.get('agentConfig').then((savedConfig) => {
      if (savedConfig) {
        setConfig({ ...config, ...savedConfig });
      }
    });
  }, []);

  const handleSave = async () => {
    await window.electron?.store.set('agentConfig', config);
    onSave?.(config);
  };

  const testConnection = async (service: string) => {
    setTesting(true);
    setTestResults({ ...testResults, [service]: { status: 'testing' } });

    try {
      switch (service) {
        case 'server':
          const serverResponse = await fetch(`${config.server.url}/health`, {
            headers: {
              'Authorization': `Bearer ${config.server.apiKey}`
            }
          });
          setTestResults({
            ...testResults,
            server: {
              status: serverResponse.ok ? 'success' : 'error',
              message: serverResponse.ok ? 'Connexion réussie' : 'Erreur de connexion'
            }
          });
          break;

        case '3cx':
          // Test 3CX connection
          const threeCXResponse = await fetch(`${config.threeСX.pbxUrl}/api/SystemStatus`, {
            headers: {
              'Authorization': `Basic ${btoa(`${config.threeСX.username}:${config.threeСX.password}`)}`
            }
          });
          setTestResults({
            ...testResults,
            '3cx': {
              status: threeCXResponse.ok ? 'success' : 'error',
              message: threeCXResponse.ok ? 'Connexion 3CX réussie' : 'Vérifiez les credentials 3CX'
            }
          });
          break;
      }
    } catch (error) {
      setTestResults({
        ...testResults,
        [service]: {
          status: 'error',
          message: `Erreur: ${error.message}`
        }
      });
    } finally {
      setTesting(false);
    }
  };

  const tabs = [
    { id: 'agent', label: 'Agent', icon: PhoneIcon },
    { id: 'server', label: 'Serveur', icon: ServerIcon },
    { id: '3cx', label: '3CX', icon: PhoneIcon },
    { id: 'ninja', label: 'NinjaOne', icon: KeyIcon },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
        <div className="flex items-center space-x-3">
          <CogIcon className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-bold">Configuration Agent 3CX-Ninja</h2>
            <p className="text-blue-100">Configurez vos paramètres de connexion</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 240px)' }}>
        {/* Agent Tab */}
        {activeTab === 'agent' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email de l'agent
              </label>
              <input
                type="email"
                value={config.agent.email}
                onChange={(e) => setConfig({
                  ...config,
                  agent: { ...config.agent, email: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="agent@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Extension 3CX
              </label>
              <input
                type="text"
                value={config.agent.extension}
                onChange={(e) => setConfig({
                  ...config,
                  agent: { ...config.agent, extension: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="201"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet
              </label>
              <input
                type="text"
                value={config.agent.name}
                onChange={(e) => setConfig({
                  ...config,
                  agent: { ...config.agent, name: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Jean Dupont"
              />
            </div>
          </div>
        )}

        {/* Server Tab */}
        {activeTab === 'server' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL du serveur
              </label>
              <input
                type="url"
                value={config.server.url}
                onChange={(e) => setConfig({
                  ...config,
                  server: { ...config.server, url: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://192.168.1.100:3000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clé API
              </label>
              <input
                type="password"
                value={config.server.apiKey}
                onChange={(e) => setConfig({
                  ...config,
                  server: { ...config.server, apiKey: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Clé API fournie par l'administrateur"
              />
            </div>

            <button
              onClick={() => testConnection('server')}
              disabled={testing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <span>Tester la connexion</span>
            </button>

            {testResults.server && (
              <div className={`flex items-center space-x-2 p-3 rounded-md ${
                testResults.server.status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {testResults.server.status === 'success' ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  <ExclamationCircleIcon className="w-5 h-5" />
                )}
                <span>{testResults.server.message}</span>
              </div>
            )}
          </div>
        )}

        {/* 3CX Tab */}
        {activeTab === '3cx' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL du PBX 3CX
              </label>
              <input
                type="url"
                value={config.threeСX.pbxUrl}
                onChange={(e) => setConfig({
                  ...config,
                  threeСX: { ...config.threeСX, pbxUrl: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://pbx.company.com:5001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom d'utilisateur 3CX
              </label>
              <input
                type="text"
                value={config.threeСX.username}
                onChange={(e) => setConfig({
                  ...config,
                  threeСX: { ...config.threeСX, username: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Extension ou username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe 3CX
              </label>
              <input
                type="password"
                value={config.threeСX.password}
                onChange={(e) => setConfig({
                  ...config,
                  threeСX: { ...config.threeСX, password: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => testConnection('3cx')}
              disabled={testing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <span>Tester la connexion 3CX</span>
            </button>

            {testResults['3cx'] && (
              <div className={`flex items-center space-x-2 p-3 rounded-md ${
                testResults['3cx'].status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {testResults['3cx'].status === 'success' ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  <ExclamationCircleIcon className="w-5 h-5" />
                )}
                <span>{testResults['3cx'].message}</span>
              </div>
            )}
          </div>
        )}

        {/* NinjaOne Tab */}
        {activeTab === 'ninja' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                Ces paramètres sont optionnels. S'ils sont configurés, ils permettront à l'agent
                de créer des tickets directement sans passer par le serveur.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID NinjaOne
              </label>
              <input
                type="text"
                value={config.ninja.clientId}
                onChange={(e) => setConfig({
                  ...config,
                  ninja: { ...config.ninja, clientId: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optionnel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                value={config.ninja.clientSecret}
                onChange={(e) => setConfig({
                  ...config,
                  ninja: { ...config.ninja, clientSecret: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optionnel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Refresh Token
              </label>
              <textarea
                value={config.ninja.refreshToken}
                onChange={(e) => setConfig({
                  ...config,
                  ninja: { ...config.ninja, refreshToken: e.target.value }
                })}
                rows={3}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optionnel"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-4 bg-gray-50 flex justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Annuler
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Sauvegarder
        </button>
      </div>
    </motion.div>
  );
};