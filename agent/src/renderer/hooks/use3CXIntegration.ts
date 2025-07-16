import { useState, useCallback } from 'react';
import { Call3CX } from '@3cx-ninja/shared';

function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const use3CXIntegration = () => {
  const [lastCallState, setLastCallState] = useState<string>('idle');

  const checkCallStatus = useCallback(async (): Promise<Call3CX | null> => {
    try {
      const config = await window.electron.store.get('agentConfig');
      if (!config?.threeСX?.pbxUrl) return null;

      // Appeler l'API 3CX pour vérifier l'état
      const response = await fetch(`${config.threeСX.pbxUrl}/api/CallStatus/${config.agent.extension}`, {
        headers: {
          'Authorization': `Basic ${btoa(`${config.threeСX.username}:${config.threeСX.password}`)}`
        }
      });

      if (!response.ok) {
        // Fallback: utiliser l'API ActiveCalls
        const activeResponse = await fetch(`${config.threeСX.pbxUrl}/api/ActiveCalls`, {
          headers: {
            'Authorization': `Basic ${btoa(`${config.threeСX.username}:${config.threeСX.password}`)}`
          }
        });

        if (activeResponse.ok) {
          const activeCalls = await activeResponse.json();
          const myCall = activeCalls.find((call: any) => 
            call.extension === config.agent.extension
          );

          if (myCall) {
            return {
              id: generateCallId(),
              callId: myCall.id || generateCallId(),
              extension: config.agent.extension,
              agentEmail: config.agent.email,
              caller: myCall.callerNumber || 'Unknown',
              callee: myCall.calleeNumber || config.agent.extension,
              direction: myCall.direction === 'Inbound' ? 'inbound' : 'outbound',
              startTime: new Date(),
              status: 'active'
            };
          }
        }
        return null;
      }

      const callData = await response.json();
      
      if (callData.state === 'Connected' || callData.state === 'Ringing') {
        setLastCallState(callData.state);
        
        return {
          id: generateCallId(),
          callId: callData.callId || generateCallId(),
          extension: config.agent.extension,
          agentEmail: config.agent.email,
          caller: callData.callerNumber || 'Unknown',
          callee: callData.calleeNumber || config.agent.extension,
          direction: callData.direction === 'Inbound' ? 'inbound' : 'outbound',
          startTime: new Date(),
          status: callData.state === 'Connected' ? 'active' : 'ringing'
        };
      }

      setLastCallState('idle');
      return null;
    } catch (error) {
      console.error('3CX integration error:', error);
      return null;
    }
  }, []);

  return { checkCallStatus, lastCallState };
};