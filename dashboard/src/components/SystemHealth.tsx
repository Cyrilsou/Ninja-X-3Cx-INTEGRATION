import React from 'react';
import { motion } from 'framer-motion';
import { 
  CpuChipIcon, 
  ServerIcon, 
  CircleStackIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import { SystemHealth as SystemHealthType } from '@3cx-ninja/shared';

interface SystemHealthProps {
  health: SystemHealthType;
}

export const SystemHealth: React.FC<SystemHealthProps> = ({ health }) => {
  const getHealthColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-400';
    if (value >= thresholds.warning) return 'text-yellow-400';
    return 'text-green-400';
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const cpuColor = getHealthColor(health.cpu, { warning: 70, critical: 90 });
  const memoryPercent = (health.memory.used / health.memory.total) * 100;
  const memoryColor = getHealthColor(memoryPercent, { warning: 70, critical: 90 });

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Santé du système</h2>

      <div className="space-y-4">
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <CpuChipIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium">CPU</span>
            </div>
            <span className={`text-sm font-bold ${cpuColor}`}>
              {health.cpu.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                health.cpu >= 90 ? 'bg-red-500' :
                health.cpu >= 70 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${health.cpu}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <ServerIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium">Mémoire</span>
            </div>
            <span className={`text-sm font-bold ${memoryColor}`}>
              {memoryPercent.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                memoryPercent >= 90 ? 'bg-red-500' :
                memoryPercent >= 70 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${memoryPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatBytes(health.memory.used)}</span>
            <span>{formatBytes(health.memory.total)}</span>
          </div>
        </div>

        {/* Disk */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <CircleStackIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium">Disque</span>
            </div>
            <span className="text-sm text-gray-400">
              {formatBytes(health.disk.free)} libre
            </span>
          </div>
        </div>

        {/* Network Status */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <SignalIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium">Réseau</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                health.uptime > 0 ? 'bg-green-400' : 'bg-red-400'
              } animate-pulse`} />
              <span className="text-sm text-gray-400">
                {health.uptime > 0 ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="pt-4 border-t border-gray-700">
          <div className="text-center">
            <div className="text-xs text-gray-500">Temps de fonctionnement</div>
            <div className="text-lg font-bold text-gray-300">
              {formatUptime(health.uptime)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}j ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}