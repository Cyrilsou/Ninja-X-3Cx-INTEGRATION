import React from 'react';
import { PhoneIcon, WifiIcon } from '@heroicons/react/24/outline';
import { Call3CX } from '@3cx-ninja/shared';

interface CallStatusProps {
  isConnected: boolean;
  currentCall: Call3CX | null;
  isCapturing: boolean;
}

export const CallStatus: React.FC<CallStatusProps> = ({ 
  isConnected, 
  currentCall, 
  isCapturing 
}) => {
  return (
    <div className="flex items-center space-x-4">
      {/* Connection Status */}
      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
        isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        <WifiIcon className="w-4 h-4" />
        <span className="text-sm font-medium">
          {isConnected ? 'Connecté' : 'Déconnecté'}
        </span>
      </div>

      {/* Call Status */}
      {currentCall && (
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
          currentCall.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        }`}>
          <PhoneIcon className={`w-4 h-4 ${currentCall.status === 'active' ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium">
            {currentCall.status === 'active' ? 'Appel en cours' : 'En attente'}
          </span>
        </div>
      )}

      {/* Capture Status */}
      {isCapturing && (
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-red-100 text-red-800">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          <span className="text-sm font-medium">Enregistrement</span>
        </div>
      )}
    </div>
  );
};