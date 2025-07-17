import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline';
import { Call3CX } from '@3cx-ninja/shared';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CallGridProps {
  activeCalls: Call3CX[];
  recentCalls: Call3CX[];
  onSelectCall: (callId: string) => void;
  selectedCall: string | null;
}

export const CallGrid: React.FC<CallGridProps> = ({
  activeCalls,
  recentCalls,
  onSelectCall,
  selectedCall
}) => {
  return (
    <div className="space-y-6">
      {/* Active Calls */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Appels actifs</h2>
        {activeCalls.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            Aucun appel actif
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence>
              {activeCalls.map((call) => (
                <CallCard
                  key={call.callId}
                  call={call}
                  isActive
                  isSelected={selectedCall === call.callId}
                  onClick={() => onSelectCall(call.callId)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Recent Calls */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Appels récents</h2>
        <div className="space-y-2">
          {recentCalls.map((call) => (
            <RecentCallItem
              key={call.callId}
              call={call}
              onClick={() => onSelectCall(call.callId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface CallCardProps {
  call: Call3CX;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}

const CallCard: React.FC<CallCardProps> = ({ call, isActive, isSelected, onClick }) => {
  const duration = call.startTime
    ? formatDistanceToNow(new Date(call.startTime), { locale: fr })
    : 'En attente';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onClick}
      className={`
        bg-gray-800 rounded-lg p-6 cursor-pointer transition-all
        ${isActive ? 'border-2 border-green-500' : 'border-2 border-gray-700'}
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
        hover:bg-gray-700
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <PhoneIcon className="w-5 h-5 text-green-400" />
          <span className="text-sm font-medium text-green-400">
            {call.status === 'active' ? 'En cours' : 'Sonnerie'}
          </span>
        </div>
        {isActive && (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">{duration}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <UserIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm">{call.caller || 'Inconnu'}</span>
        </div>
        <div className="text-xs text-gray-400">
          Agent: {call.agentId || 'Non assigné'}
        </div>
        {call.extension && (
          <div className="text-xs text-gray-500">
            Extension: {call.extension}
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface RecentCallItemProps {
  call: Call3CX;
  onClick: () => void;
}

const RecentCallItem: React.FC<RecentCallItemProps> = ({ call, onClick }) => {
  const endTime = call.endTime ? new Date(call.endTime) : new Date();
  const duration = call.startTime && call.endTime
    ? Math.floor((new Date(call.endTime).getTime() - new Date(call.startTime).getTime()) / 1000)
    : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="
        bg-gray-800 rounded-lg p-4 cursor-pointer
        hover:bg-gray-700 transition-colors
        flex items-center justify-between
      "
    >
      <div className="flex items-center space-x-4">
        <PhoneIcon className="w-5 h-5 text-gray-400" />
        <div>
          <div className="font-medium">{call.caller || 'Inconnu'}</div>
          <div className="text-xs text-gray-400">
            {formatDistanceToNow(endTime, { locale: fr, addSuffix: true })}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-4 text-sm text-gray-400">
        <div className="flex items-center space-x-1">
          <ClockIcon className="w-4 h-4" />
          <span>{formatDuration(duration)}</span>
        </div>
        <span>{call.agentId || 'Non assigné'}</span>
      </div>
    </motion.div>
  );
};