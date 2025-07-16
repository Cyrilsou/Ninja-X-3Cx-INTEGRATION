import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from './hooks/useSocket';
import { CallGrid } from './components/CallGrid';
import { AgentStatus } from './components/AgentStatus';
import { TicketQueue } from './components/TicketQueue';
import { SystemHealth } from './components/SystemHealth';
import { LiveTranscription } from './components/LiveTranscription';
import { 
  Agent, 
  Call3CX, 
  SystemHealth as SystemHealthType,
  TranscriptionSegment 
} from '@3cx-ninja/shared';

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeCalls, setActiveCalls] = useState<Call3CX[]>([]);
  const [recentCalls, setRecentCalls] = useState<Call3CX[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthType | null>(null);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [transcriptions, setTranscriptions] = useState<Record<string, TranscriptionSegment[]>>({});
  
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    // S'identifier comme dashboard
    socket.emit('dashboard:connect');

    // Écouter les mises à jour
    socket.on('agent:status', (data) => {
      setAgents(data.agents);
    });

    socket.on('call:update', (call: Call3CX) => {
      if (call.status === 'active' || call.status === 'ringing') {
        setActiveCalls(prev => {
          const existing = prev.find(c => c.callId === call.callId);
          if (existing) {
            return prev.map(c => c.callId === call.callId ? call : c);
          }
          return [...prev, call];
        });
      } else {
        setActiveCalls(prev => prev.filter(c => c.callId !== call.callId));
        setRecentCalls(prev => [call, ...prev].slice(0, 10));
      }
    });

    socket.on('system:health', (health: SystemHealthType) => {
      setSystemHealth(health);
    });

    socket.on('transcription:partial', (data) => {
      setTranscriptions(prev => ({
        ...prev,
        [data.callId]: [...(prev[data.callId] || []), data.segment]
      }));
    });

    return () => {
      socket.off('agent:status');
      socket.off('call:update');
      socket.off('system:health');
      socket.off('transcription:partial');
    };
  }, [socket]);

  const stats = {
    totalAgents: agents.length,
    onlineAgents: agents.filter(a => a.status === 'online').length,
    busyAgents: agents.filter(a => a.status === 'busy').length,
    activeCalls: activeCalls.length,
    completedToday: recentCalls.length
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Centre de contrôle 3CX-NinjaOne</h1>
              <p className="text-gray-400 mt-2">
                {format(new Date(), 'EEEE d MMMM yyyy HH:mm', { locale: fr })}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                isConnected ? 'bg-green-900/50' : 'bg-red-900/50'
              }`}>
                <div className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`} />
                <span>{isConnected ? 'En ligne' : 'Hors ligne'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-6 mb-8">
          <StatsCard
            title="Agents total"
            value={stats.totalAgents}
            color="blue"
          />
          <StatsCard
            title="Agents en ligne"
            value={stats.onlineAgents}
            color="green"
          />
          <StatsCard
            title="Agents occupés"
            value={stats.busyAgents}
            color="orange"
          />
          <StatsCard
            title="Appels actifs"
            value={stats.activeCalls}
            color="red"
            pulse={stats.activeCalls > 0}
          />
          <StatsCard
            title="Appels terminés"
            value={stats.completedToday}
            color="purple"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Calls */}
          <div className="col-span-2 space-y-6">
            <CallGrid
              activeCalls={activeCalls}
              recentCalls={recentCalls}
              onSelectCall={setSelectedCall}
              selectedCall={selectedCall}
            />
            
            {selectedCall && transcriptions[selectedCall] && (
              <LiveTranscription
                callId={selectedCall}
                segments={transcriptions[selectedCall]}
                onClose={() => setSelectedCall(null)}
              />
            )}
          </div>

          {/* Right Column - Status & Info */}
          <div className="space-y-6">
            <AgentStatus agents={agents} />
            <TicketQueue />
            {systemHealth && <SystemHealth health={systemHealth} />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  pulse?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, color, pulse }) => {
  const colorClasses = {
    blue: 'bg-blue-900/50 border-blue-700',
    green: 'bg-green-900/50 border-green-700',
    orange: 'bg-orange-900/50 border-orange-700',
    red: 'bg-red-900/50 border-red-700',
    purple: 'bg-purple-900/50 border-purple-700'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 rounded-lg border ${colorClasses[color]}`}
    >
      <h3 className="text-sm text-gray-400 mb-2">{title}</h3>
      <div className="flex items-baseline space-x-2">
        <span className="text-3xl font-bold">{value}</span>
        {pulse && (
          <div className={`w-2 h-2 rounded-full bg-${color}-400 animate-pulse`} />
        )}
      </div>
    </motion.div>
  );
};

export default App;