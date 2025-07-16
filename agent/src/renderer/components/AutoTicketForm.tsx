import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CallAnalysis, NinjaTicket } from '@3cx-ninja/shared';
import { 
  DocumentTextIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowPathIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface AutoTicketFormProps {
  analysis: CallAnalysis;
  transcription: string;
  onCreateTicket: (ticket: NinjaTicket) => Promise<void>;
  onDismiss: () => void;
  autoSubmitDelay?: number; // Délai en secondes avant soumission auto
}

export const AutoTicketForm: React.FC<AutoTicketFormProps> = ({
  analysis,
  transcription,
  onCreateTicket,
  onDismiss,
  autoSubmitDelay = 10
}) => {
  const [ticket, setTicket] = useState<NinjaTicket>({
    boardId: 5,
    statusId: 1,
    priorityId: getPriorityId(analysis.priority),
    title: analysis.suggestedTitle,
    description: formatDescription(analysis, transcription),
    customFields: {
      sentiment: analysis.customerSentiment,
      category: analysis.category,
      keywords: analysis.keywords.join(', ')
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [countdown, setCountdown] = useState(autoSubmitDelay);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaused, setPaused] = useState(false);

  useEffect(() => {
    if (!isEditing && !isPaused && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !isSubmitting) {
      handleSubmit();
    }
  }, [countdown, isEditing, isPaused]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onCreateTicket(ticket);
    } catch (error) {
      console.error('Error creating ticket:', error);
      setIsSubmitting(false);
      setPaused(true);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setPaused(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    setCountdown(5); // Reset countdown après édition
    setPaused(false);
  };

  const getSentimentIcon = () => {
    switch (analysis.customerSentiment) {
      case 'positive': return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'negative': return <XCircleIcon className="w-5 h-5 text-red-600" />;
      default: return <ArrowPathIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200"
    >
      {/* Header avec countdown */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DocumentTextIcon className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Ticket automatique</h3>
          </div>
          <div className="flex items-center space-x-2">
            {!isSubmitting && countdown > 0 && (
              <motion.div
                key={countdown}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className={`text-sm font-medium ${
                  countdown <= 3 ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                {countdown}s
              </motion.div>
            )}
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {/* Analyse rapide */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-600">Sentiment:</span>
            <div className="flex items-center space-x-1">
              {getSentimentIcon()}
              <span className="font-medium">{analysis.customerSentiment}</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-600">Priorité:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              analysis.priority === 'urgent' ? 'bg-red-100 text-red-800' :
              analysis.priority === 'high' ? 'bg-orange-100 text-orange-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {analysis.priority}
            </span>
          </div>
        </div>

        {/* Formulaire */}
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titre
              </label>
              <input
                type="text"
                value={ticket.title}
                onChange={(e) => setTicket({ ...ticket, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={ticket.description}
                onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Titre</h4>
              <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {ticket.title}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Résumé</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {analysis.summary}
              </p>
            </div>
            {analysis.actionItems.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Actions</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {analysis.actionItems.map((action, index) => (
                    <li key={index}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
        {isEditing ? (
          <>
            <button
              onClick={() => {
                setIsEditing(false);
                setPaused(false);
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Enregistrer
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleEdit}
              disabled={isSubmitting}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              <PencilIcon className="w-4 h-4" />
              <span>Modifier</span>
            </button>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPaused(!isPaused)}
                disabled={isSubmitting}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                {isPaused ? 'Reprendre' : 'Pause'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span>Création...</span>
                  </>
                ) : (
                  <span>Créer maintenant</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      {!isEditing && !isPaused && countdown > 0 && (
        <div className="h-1 bg-gray-200">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: autoSubmitDelay, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
};

function getPriorityId(priority: string): number {
  switch (priority) {
    case 'urgent': return 4;
    case 'high': return 3;
    case 'normal': return 2;
    case 'low': return 1;
    default: return 2;
  }
}

function formatDescription(analysis: CallAnalysis, transcription: string): string {
  return `## Résumé
${analysis.summary}

## Problème principal
${analysis.mainIssue}

## Actions à effectuer
${analysis.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

## Analyse
- Catégorie: ${analysis.category}
- Sentiment: ${analysis.customerSentiment}
- Mots-clés: ${analysis.keywords.join(', ')}
${analysis.recordingUrl ? `\n## Enregistrement\n[Écouter l'enregistrement](${analysis.recordingUrl})` : ''}

## Transcription complète
<details>
<summary>Voir la transcription</summary>

${transcription}

</details>`;
}