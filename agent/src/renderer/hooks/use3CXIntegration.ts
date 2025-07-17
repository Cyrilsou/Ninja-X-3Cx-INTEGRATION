import { useState, useCallback, useEffect } from 'react';
import { Call3CX } from '@3cx-ninja/shared';

// Simple Logger pour le navigateur
class Logger {
  constructor(private service: string) {}

  info(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.service}] INFO:`, message, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[${new Date().toISOString()}] [${this.service}] ERROR:`, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${new Date().toISOString()}] [${this.service}] WARN:`, message, ...args);
  }

  debug(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.service}] DEBUG:`, message, ...args);
  }
}

interface Use3CXIntegrationProps {
  extension: string;
  onCallStart?: (call: Call3CX) => void;
  onCallEnd?: (call: Call3CX) => void;
}

export const use3CXIntegration = ({
  extension,
  onCallStart,
  onCallEnd
}: Use3CXIntegrationProps) => {
  const [isListening, setIsListening] = useState(false);
  const [currentCall, setCurrentCall] = useState<Call3CX | null>(null);
  const [callHistory, setCallHistory] = useState<Call3CX[]>([]);
  const logger = new Logger('3CXIntegration');

  const startListening = useCallback(() => {
    if (!extension) {
      logger.warn('Cannot start listening without extension');
      return;
    }

    logger.info(`Starting 3CX listening for extension ${extension}`);
    setIsListening(true);

    // Simulation d'écoute 3CX - dans un vrai cas, ceci serait connecté à l'API 3CX
    // Pour l'instant, on simule juste l'état
  }, [extension, logger]);

  const stopListening = useCallback(() => {
    logger.info('Stopping 3CX listening');
    setIsListening(false);
  }, [logger]);

  // Simuler des appels pour les tests
  useEffect(() => {
    if (!isListening) return;

    // Simulation d'un appel entrant après 10 secondes (pour les tests)
    const timeout = setTimeout(() => {
      const mockCall: Call3CX = {
        id: `mock-${Date.now()}`,
        callId: `call-${Date.now()}`,
        extension,
        agentEmail: '',
        caller: '+33123456789',
        callee: extension,
        direction: 'inbound',
        startTime: new Date(),
        status: 'ringing'
      };

      setCurrentCall(mockCall);
      setCallHistory(prev => [mockCall, ...prev.slice(0, 9)]); // Garder 10 derniers appels
      
      if (onCallStart) {
        onCallStart(mockCall);
      }

      // Simuler la fin d'appel après 30 secondes
      setTimeout(() => {
        const endedCall = {
          ...mockCall,
          endTime: new Date(),
          duration: 30,
          status: 'completed' as const
        };

        setCurrentCall(null);
        setCallHistory(prev => 
          prev.map(call => 
            call.id === mockCall.id ? endedCall : call
          )
        );

        if (onCallEnd) {
          onCallEnd(endedCall);
        }
      }, 30000);

    }, 10000);

    return () => clearTimeout(timeout);
  }, [isListening, extension, onCallStart, onCallEnd]);

  return {
    isListening,
    currentCall,
    callHistory,
    startListening,
    stopListening
  };
};