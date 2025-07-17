import React from 'react';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface CallsCardProps {
  data?: {
    total: number;
    today: number;
    inProgress: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  agents: number;
}

const CallsCard: React.FC<CallsCardProps> = ({ data, agents }) => {
  if (!data) return null;

  const progressPercentage = agents > 0 ? (data.inProgress / agents) * 100 : 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="card-header flex items-center gap-2">
          <PhoneIcon className="h-6 w-6 text-blue-500" />
          Appels
        </h2>
        {data.inProgress > 0 && (
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="stat-value text-blue-500">{data.inProgress}</div>
          <div className="stat-label">En cours</div>
        </div>
        <div className="text-center">
          <div className="stat-value text-green-500">{data.today}</div>
          <div className="stat-label">Aujourd'hui</div>
        </div>
        <div className="text-center">
          <div className="stat-value text-gray-400">
            {Math.round(data.avgDuration / 60)}m
          </div>
          <div className="stat-label">Durée moy.</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Charge agents</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
};

export default CallsCard;