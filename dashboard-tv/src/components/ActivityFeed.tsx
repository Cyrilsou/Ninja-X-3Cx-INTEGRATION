import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  PhoneIcon,
  UserIcon,
  MicrophoneIcon,
  TicketIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { Activity } from '../types';

interface ActivityFeedProps {
  activities: Activity[];
}

const getActivityIcon = (type: Activity['type']) => {
  const icons = {
    call: PhoneIcon,
    agent: UserIcon,
    transcription: MicrophoneIcon,
    ticket: TicketIcon,
    system: CogIcon,
  };
  const Icon = icons[type] || CogIcon;
  return <Icon className="h-5 w-5" />;
};

const getActivityColor = (type: Activity['type']) => {
  const colors = {
    call: 'bg-blue-500',
    agent: 'bg-green-500',
    transcription: 'bg-yellow-500',
    ticket: 'bg-purple-500',
    system: 'bg-gray-500',
  };
  return colors[type] || 'bg-gray-500';
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  return (
    <div className="card h-full flex flex-col">
      <h2 className="card-header">Activité en temps réel</h2>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        <AnimatePresence initial={false}>
          {activities.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Aucune activité récente
            </div>
          ) : (
            activities.map((activity, index) => (
              <motion.div
                key={`${activity.type}-${activity.time.getTime()}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg"
              >
                <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-200">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(activity.time, {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ActivityFeed;