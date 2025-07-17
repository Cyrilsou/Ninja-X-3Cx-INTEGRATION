import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface TranscriptionsCardProps {
  data?: {
    total: number;
    today: number;
    inQueue: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

const TranscriptionsCard: React.FC<TranscriptionsCardProps> = ({ data }) => {
  if (!data) return null;

  const queueItems = Array.from({ length: Math.min(data.inQueue + data.processing, 10) }, (_, i) => {
    return i < data.processing ? 'processing' : 'waiting';
  });

  return (
    <div className="card">
      <h2 className="card-header flex items-center gap-2">
        <MicrophoneIcon className="h-6 w-6 text-yellow-500" />
        Transcriptions
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="stat-value text-yellow-500">{data.inQueue}</div>
          <div className="stat-label">En attente</div>
        </div>
        <div className="text-center">
          <div className="stat-value text-blue-500">{data.processing}</div>
          <div className="stat-label">En cours</div>
        </div>
        <div className="text-center">
          <div className="stat-value text-green-500">{data.completed}</div>
          <div className="stat-label">Terminées</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-400 mb-2">File d'attente</div>
        <div className="flex gap-2 flex-wrap">
          {queueItems.map((status, index) => (
            <motion.div
              key={index}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${
                status === 'processing'
                  ? 'bg-yellow-500 text-gray-900'
                  : 'bg-gray-700 text-gray-400'
              }`}
              animate={status === 'processing' ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {index + 1}
            </motion.div>
          ))}
          {data.inQueue + data.processing > 10 && (
            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-sm text-gray-400">
              +{data.inQueue + data.processing - 10}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionsCard;