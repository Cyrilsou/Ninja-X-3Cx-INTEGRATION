import React from 'react';
import { motion } from 'framer-motion';
import { UserCircleIcon, PhoneIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Agent } from '@3cx-ninja/shared';

interface AgentStatusProps {
  agents: Agent[];
}

export const AgentStatus: React.FC<AgentStatusProps> = ({ agents }) => {
  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
        return 'bg-orange-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: Agent['status']) => {
    switch (status) {
      case 'online':
        return 'En ligne';
      case 'busy':
        return 'Occupé';
      case 'offline':
        return 'Hors ligne';
      default:
        return 'Inconnu';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">État des agents</h2>
      
      {agents.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          Aucun agent connecté
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <UserCircleIcon className="w-10 h-10 text-gray-400" />
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${getStatusColor(
                      agent.status
                    )} ring-2 ring-gray-700`}
                  />
                </div>
                <div>
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-gray-400">
                    {getStatusText(agent.status)}
                  </div>
                </div>
              </div>

              {agent.status === 'busy' && agent.currentCallId && (
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <PhoneIcon className="w-4 h-4" />
                  <span>En appel</span>
                </div>
              )}

              {agent.lastActivity && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <ClockIcon className="w-3 h-3" />
                  <span>
                    {new Date(agent.lastActivity).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold text-green-400">
              {agents.filter((a) => a.status === 'online').length}
            </div>
            <div className="text-xs text-gray-400">En ligne</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-400">
              {agents.filter((a) => a.status === 'busy').length}
            </div>
            <div className="text-xs text-gray-400">Occupés</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-400">
              {agents.filter((a) => a.status === 'offline').length}
            </div>
            <div className="text-xs text-gray-400">Hors ligne</div>
          </div>
        </div>
      </div>
    </div>
  );
};