import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

interface QueuedTicket {
  id: string;
  callId: string;
  caller: string;
  category: string;
  sentiment: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export const TicketQueue: React.FC = () => {
  const [tickets, setTickets] = useState<QueuedTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get('/api/dashboard/ticket-queue', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_API_KEY || 'change-this-in-production-12345'}`
        }
      });
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Error fetching ticket queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: QueuedTicket['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400';
      case 'processing':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: QueuedTicket['status']) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'processing':
        return 'Traitement...';
      case 'completed':
        return 'Créé';
      case 'failed':
        return 'Échec';
      default:
        return 'Inconnu';
    }
  };

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😠';
      case 'neutral':
        return '😐';
      default:
        return '🤔';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">File de tickets</h2>
        <div className="flex items-center space-x-2">
          <TicketIcon className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-400">
            {tickets.filter(t => t.status === 'pending').length} en attente
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">
          Chargement...
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          Aucun ticket en attente
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {tickets.map((ticket) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="bg-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{ticket.caller}</span>
                      <span className="text-lg">{getSentimentEmoji(ticket.sentiment)}</span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {ticket.category}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${getStatusColor(ticket.status)}`}>
                    {getStatusText(ticket.status)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="w-3 h-3" />
                    <span>
                      {new Date(ticket.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {ticket.status === 'completed' && (
                    <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  )}
                </div>

                {ticket.status === 'processing' && (
                  <div className="mt-2">
                    <div className="h-1 bg-gray-600 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-400"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Stats */}
      {tickets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-green-400">
                {tickets.filter(t => t.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-400">Créés aujourd'hui</div>
            </div>
            <div>
              <div className="text-xl font-bold text-yellow-400">
                {tickets.filter(t => t.status === 'pending' || t.status === 'processing').length}
              </div>
              <div className="text-xs text-gray-400">En cours</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};