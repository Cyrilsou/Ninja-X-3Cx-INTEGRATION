import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PhoneIcon, 
  CogIcon, 
  ChartBarIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import { Agent } from '@3cx-ninja/shared';
import { useConnectionManager } from './hooks/useConnectionManager';
import { OfflineManager } from './services/offline-manager';
import { ConnectionStatus } from './components/ConnectionStatus';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ConnectionDiagnostics } from './components/ConnectionDiagnostics';
import { AutoTicketForm } from './components/AutoTicketForm';
import { CallInterface } from './components/CallInterface';
import { SettingsModal } from './components/SettingsModal';
import { use3CXIntegration } from './hooks/use3CXIntegration';

// Configuration par défaut
const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:3000',
  apiKey: '',
  agent: {
    id: 'agent-' + Date.now(),
    email: '',
    name: '',
    extension: '',
    status: 'offline' as const
  }
};

export const App: React.FC = () => {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('agent-config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [offlineManager] = useState(() => new OfflineManager());
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);

  // Hook de gestion de connexion
  const {
    connectionManager,
    status: connectionStatus,
    connect,
    disconnect,
    isConnected,
    isAuthenticated,
    lastError
  } = useConnectionManager(
    {
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      agentInfo: config.agent
    },
    {
      autoConnect: isConfigured,
      onConnectionChange: (status) => {
        console.log('Connection status changed:', status);
      },
      onError: (error) => {
        console.error('Connection error:', error);
        
        // Sauvegarder en offline si nécessaire
        if (currentCall) {
          offlineManager.addToQueue('call', currentCall);
        }
      }
    }
  );

  // Hook d'intégration 3CX
  const {
    isListening,
    currentCall: call3CX,
    startListening,
    stopListening,
    callHistory
  } = use3CXIntegration({
    extension: config.agent.extension,
    onCallStart: (call) => {
      setCurrentCall(call);
      
      // Envoyer au serveur si connecté
      if (isConnected && connectionManager) {
        connectionManager.emit('call:start', { call });
      } else {
        // Sauvegarder en offline
        offlineManager.addToQueue('call', call);
      }
    },
    onCallEnd: (call) => {
      setCurrentCall(null);
      
      // Envoyer au serveur si connecté
      if (isConnected && connectionManager) {
        connectionManager.emit('call:end', { callId: call.callId });
      } else {
        // Sauvegarder en offline
        offlineManager.addToQueue('call', { ...call, ended: true });
      }
    }
  });

  // Vérifier la configuration au démarrage
  useEffect(() => {
    const isValid = config.serverUrl && 
                   config.apiKey && 
                   config.agent.email && 
                   config.agent.extension;
    
    setIsConfigured(!!isValid);
    
    if (!isValid) {
      setShowSettings(true);
    }
  }, [config]);

  // Sauvegarder la configuration
  useEffect(() => {
    localStorage.setItem('agent-config', JSON.stringify(config));
  }, [config]);

  // Démarrer l'écoute 3CX quand l'agent est connecté
  useEffect(() => {
    if (isAuthenticated && config.agent.extension && !isListening) {
      startListening();
    }
  }, [isAuthenticated, config.agent.extension, isListening, startListening]);

  // Gérer les événements de transcription
  useEffect(() => {
    if (!connectionManager) return;

    const handleTranscriptionFinal = (data: any) => {
      console.log('Transcription finale reçue:', data);
      // Déclencher l'analyse et la création de ticket
      setTicketData(data);
      setShowTicketForm(true);
    };

    connectionManager.on('transcription:final', handleTranscriptionFinal);
    
    return () => {
      connectionManager.off('transcription:final', handleTranscriptionFinal);
    };
  }, [connectionManager]);

  // Créer un ticket
  const handleCreateTicket = async (ticket: any) => {
    try {
      if (isConnected && connectionManager) {
        // Envoyer directement au serveur
        const response = await fetch(`${config.serverUrl}/api/tickets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            ...ticket,
            agentEmail: config.agent.email
          })
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la création du ticket');
        }

        const result = await response.json();
        console.log('Ticket créé:', result);
        
      } else {
        // Sauvegarder en offline
        await offlineManager.addToQueue('ticket', {
          ...ticket,
          agentEmail: config.agent.email
        });
      }
      
      setShowTicketForm(false);
      setTicketData(null);
      
    } catch (error) {
      console.error('Erreur création ticket:', error);
      
      // Fallback en offline
      await offlineManager.addToQueue('ticket', {
        ...ticket,
        agentEmail: config.agent.email
      });
    }
  };

  // Interface principale
  const renderMainInterface = () => {
    if (!isConfigured) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Configuration requise
            </h2>
            <p className="text-gray-600 mb-6">
              Configurez votre agent pour commencer
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Configurer
            </button>
          </div>
        </div>
      );
    }

    if (lastError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Erreur de connexion
            </h2>
            <p className="text-gray-600 mb-6">
              {lastError.message}
            </p>
            <div className="space-x-4">
              <button
                onClick={() => setShowDiagnostics(true)}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Diagnostic
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Interface d'appel */}
        <div className="flex-1">
          <CallInterface
            currentCall={currentCall}
            callHistory={callHistory}
            isListening={isListening}
            onStartListening={startListening}
            onStopListening={stopListening}
          />
        </div>

        {/* Statistiques */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Appels aujourd'hui: {callHistory.length}</span>
            <span>Status: {config.agent.extension}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PhoneIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                3CX-Ninja Agent
              </h1>
              <p className="text-sm text-gray-500">
                {config.agent.name || config.agent.email}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Indicateur offline */}
            <OfflineIndicator offlineManager={offlineManager} />
            
            {/* Status de connexion */}
            {connectionManager && (
              <ConnectionStatus connectionManager={connectionManager} />
            )}
            
            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowDiagnostics(true)}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Diagnostic"
              >
                <WrenchScrewdriverIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Paramètres"
              >
                <CogIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={isConfigured ? 'configured' : 'not-configured'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {renderMainInterface()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            config={config}
            onSave={(newConfig) => {
              setConfig(newConfig);
              setShowSettings(false);
            }}
            onClose={() => setShowSettings(false)}
          />
        )}
        
        {showDiagnostics && (
          <ConnectionDiagnostics
            connectionManager={connectionManager}
            isOpen={showDiagnostics}
            onClose={() => setShowDiagnostics(false)}
          />
        )}
        
        {showTicketForm && ticketData && (
          <AutoTicketForm
            analysis={ticketData.analysis}
            transcription={ticketData.transcription}
            onCreateTicket={handleCreateTicket}
            onDismiss={() => {
              setShowTicketForm(false);
              setTicketData(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};