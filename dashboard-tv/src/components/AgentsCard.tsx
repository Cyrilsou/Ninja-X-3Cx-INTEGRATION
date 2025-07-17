import React from 'react';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface AgentsCardProps {
  data?: {
    total: number;
    online: number;
    busy: number;
    available: number;
  };
}

const AgentsCard: React.FC<AgentsCardProps> = ({ data }) => {
  if (!data) return null;

  const agents = Array.from({ length: data.total }, (_, i) => {
    if (i < data.busy) return 'busy';
    if (i < data.online) return 'available';
    return 'offline';
  });

  return (
    <div className="card">
      <h2 className="card-header flex items-center gap-2">
        <UserGroupIcon className="h-6 w-6 text-green-500" />
        Agents
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="stat-value text-green-500">{data.online}</div>
          <div className="stat-label">En ligne</div>
        </div>
        <div className="text-center">
          <div className="stat-value text-yellow-500">{data.busy}</div>
          <div className="stat-label">Occupés</div>
        </div>
        <div className="text-center">
          <div className="stat-value text-blue-500">{data.available}</div>
          <div className="stat-label">Disponibles</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-400 mb-2">Statut des agents</div>
        <div className="flex flex-wrap gap-1">
          {agents.map((status, index) => (
            <div
              key={index}
              className={clsx(
                'w-8 h-8 rounded-full transition-all duration-300',
                {
                  'bg-green-500': status === 'available',
                  'bg-yellow-500 animate-pulse-slow': status === 'busy',
                  'bg-gray-600': status === 'offline',
                }
              )}
              title={status}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AgentsCard;