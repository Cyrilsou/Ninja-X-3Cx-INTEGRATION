import React from 'react';
import { PhoneIcon, PhoneArrowDownLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Call3CX } from '@3cx-ninja/shared';

interface CallInterfaceProps {
  currentCall: Call3CX | null;
  callHistory: Call3CX[];
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
}

export const CallInterface: React.FC<CallInterfaceProps> = ({
  currentCall,
  callHistory,
  isListening,
  onStartListening,
  onStopListening
}) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* État d'écoute */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">État de l'agent</h2>
          <button
            onClick={isListening ? onStopListening : onStartListening}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isListening
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isListening ? 'Écoute active' : 'Démarrer l\'écoute'}
          </button>
        </div>
        
        {isListening && (
          <div className="flex items-center space-x-2 text-sm text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>En attente d'appels...</span>
          </div>
        )}
      </div>

      {/* Appel en cours */}
      {currentCall && (
        <div className="mb-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-full">
                <PhoneIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Appel en cours</h3>
                <p className="text-sm text-gray-600">
                  {currentCall.direction === 'inbound' ? 'Entrant' : 'Sortant'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-gray-900">
                {formatDuration(currentCall.duration || 0)}
              </div>
              <div className="text-sm text-gray-500">
                Depuis {formatTime(currentCall.startTime)}
              </div>
            </div>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Appelant:</span>
              <span className="font-medium text-gray-900">{currentCall.caller}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Appelé:</span>
              <span className="font-medium text-gray-900">{currentCall.callee}</span>
            </div>
            {currentCall.transcription && (
              <div className="mt-4 p-3 bg-white rounded border border-blue-100">
                <p className="text-xs text-gray-500 mb-1">Transcription en cours:</p>
                <p className="text-sm text-gray-700">{currentCall.transcription}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historique des appels */}
      <div className="flex-1 overflow-hidden">
        <h3 className="font-semibold text-gray-900 mb-3">Appels récents</h3>
        
        {callHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <PhoneArrowDownLeftIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Aucun appel pour le moment</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-full">
            {callHistory.map((call) => (
              <div
                key={call.callId}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      call.direction === 'inbound' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {call.direction === 'inbound' ? (
                        <PhoneArrowDownLeftIcon className="h-4 w-4" />
                      ) : (
                        <PhoneIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {call.direction === 'inbound' ? call.caller : call.callee}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatTime(call.startTime)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDuration(call.duration || 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {call.status === 'completed' ? 'Terminé' : 'En cours'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};