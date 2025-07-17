import React from 'react';
import { ServerIcon } from '@heroicons/react/24/outline';

interface SystemStatsProps {
  data?: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const SystemStats: React.FC<SystemStatsProps> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="card">
      <h2 className="card-header flex items-center gap-2">
        <ServerIcon className="h-6 w-6 text-gray-400" />
        Système
      </h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <span className="text-sm text-gray-400">Uptime</span>
          <span className="text-lg font-medium text-green-500">
            {formatUptime(data.uptime)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <span className="text-sm text-gray-400">Mémoire</span>
          <span className="text-lg font-medium text-blue-500">
            {data.memoryUsage} MB
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <span className="text-sm text-gray-400">CPU</span>
          <span className="text-lg font-medium text-yellow-500">
            {data.cpuUsage}s
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
          <span className="text-sm text-gray-400">Connexions actives</span>
          <span className="text-lg font-medium text-purple-500">
            {data.activeConnections}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SystemStats;