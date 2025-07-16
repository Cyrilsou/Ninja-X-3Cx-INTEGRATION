import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TranscriptionSegment, CallAnalysis } from '@3cx-ninja/shared';
import { MicrophoneIcon, UserIcon, PhoneIcon } from '@heroicons/react/24/outline';

interface RealtimeTranscriptionProps {
  segments: TranscriptionSegment[];
  analysis?: CallAnalysis;
  isLive: boolean;
  callDuration: string;
}

export const RealtimeTranscription: React.FC<RealtimeTranscriptionProps> = ({
  segments,
  analysis,
  isLive,
  callDuration
}) => {
  const transcriptionRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && transcriptionRef.current) {
      transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight;
    }
  }, [segments, autoScroll]);

  const getSpeakerIcon = (speaker: string) => {
    return speaker === 'agent' ? <PhoneIcon className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />;
  };

  const getSpeakerColor = (speaker: string) => {
    return speaker === 'agent' ? 'text-blue-600' : 'text-green-600';
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 ${isLive ? 'text-red-600' : 'text-gray-600'}`}>
            <MicrophoneIcon className={`w-5 h-5 ${isLive ? 'animate-pulse' : ''}`} />
            <span className="font-medium">
              {isLive ? 'Transcription en direct' : 'Transcription terminée'}
            </span>
          </div>
          <span className="text-sm text-gray-500">{callDuration}</span>
        </div>

        <label className="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          <span>Défilement auto</span>
        </label>
      </div>

      {/* Analysis Summary (if available) */}
      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-blue-50 rounded-lg"
        >
          <h4 className="font-medium text-blue-900 mb-2">Analyse de l'appel</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Catégorie:</span>
              <span className="font-medium">{analysis.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Priorité:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                analysis.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                analysis.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                analysis.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {analysis.priority}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Sentiment:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getSentimentColor(analysis.customerSentiment)}`}>
                {analysis.customerSentiment}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Transcription */}
      <div
        ref={transcriptionRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2"
        onScroll={(e) => {
          const element = e.currentTarget;
          const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
          if (!isAtBottom && autoScroll) {
            setAutoScroll(false);
          }
        }}
      >
        <AnimatePresence initial={false}>
          {segments.map((segment, index) => (
            <motion.div
              key={segment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className={`flex items-start space-x-3 p-3 rounded-lg ${
                segment.speaker === 'agent' ? 'bg-blue-50' : 'bg-green-50'
              }`}
            >
              <div className={`mt-1 ${getSpeakerColor(segment.speaker)}`}>
                {getSpeakerIcon(segment.speaker)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${getSpeakerColor(segment.speaker)}`}>
                    {segment.speaker === 'agent' ? 'Agent' : 'Client'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(segment.timestamp).toLocaleTimeString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm text-gray-800">{segment.text}</p>
                {segment.confidence && (
                  <div className="mt-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Confiance:</span>
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${segment.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round(segment.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {segments.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>En attente de la transcription...</p>
          </div>
        )}
      </div>

      {/* Actions rapides */}
      {analysis && analysis.actionItems.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Actions suggérées:</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.actionItems.slice(0, 3).map((action, index) => (
              <button
                key={index}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                onClick={() => {
                  // Copier l'action dans le presse-papier
                  navigator.clipboard.writeText(action);
                }}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};