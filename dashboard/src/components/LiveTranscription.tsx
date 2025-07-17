import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { TranscriptionSegment } from '@3cx-ninja/shared';

interface LiveTranscriptionProps {
  callId: string;
  segments: TranscriptionSegment[];
  onClose: () => void;
}

export const LiveTranscription: React.FC<LiveTranscriptionProps> = ({
  callId,
  segments,
  onClose
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new segments arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments]);

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-gray-800 rounded-lg p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <MicrophoneIcon className="w-6 h-6 text-red-400" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse" />
          </div>
          <h3 className="text-lg font-bold">Transcription en direct</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="text-sm text-gray-400 mb-4">
        Appel: {callId}
      </div>

      <div
        ref={scrollRef}
        className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto space-y-3"
      >
        <AnimatePresence initial={false}>
          {segments.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              En attente de transcription...
            </div>
          ) : (
            segments.map((segment, index) => (
              <motion.div
                key={`${segment.timestamp}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start space-x-3"
              >
                <span className="text-xs text-gray-500 mt-1 min-w-[50px]">
                  {formatTime(segment.timestamp)}
                </span>
                <div className="flex-1">
                  <p className={`text-sm ${
                    segment.isFinal ? 'text-gray-200' : 'text-gray-400 italic'
                  }`}>
                    {segment.text}
                  </p>
                  {segment.confidence && (
                    <div className="mt-1">
                      <div className="flex items-center space-x-2">
                        <div className="text-xs text-gray-500">
                          Confiance: {(segment.confidence * 100).toFixed(0)}%
                        </div>
                        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${segment.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {segments.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
          <span>{segments.length} segments</span>
          <span>
            {segments.filter(s => s.isFinal).length} finalisés
          </span>
        </div>
      )}
    </motion.div>
  );
};