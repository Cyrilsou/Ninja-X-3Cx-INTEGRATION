import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import CallsCard from './components/CallsCard';
import AgentsCard from './components/AgentsCard';
import TranscriptionsCard from './components/TranscriptionsCard';
import TicketsCard from './components/TicketsCard';
import ActivityFeed from './components/ActivityFeed';
import SystemStats from './components/SystemStats';
import Header from './components/Header';
import { DashboardData } from './types';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activities, setActivities] = useState<any[]>([]);
  const [lastData, setLastData] = useState<DashboardData | null>(null);

  // Mettre à jour l'heure toutes les secondes
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Récupérer les données du dashboard
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/dashboard/stats`);
      return response.data;
    },
  });

  // Détecter les changements et ajouter des activités
  useEffect(() => {
    if (!data || !lastData) {
      setLastData(data || null);
      return;
    }

    const newActivities: any[] = [];

    // Nouveaux appels
    if (data.calls.inProgress > lastData.calls.inProgress) {
      newActivities.push({
        type: 'call',
        message: 'Nouvel appel en cours',
        time: new Date(),
      });
    }

    // Changements d'agents
    if (data.agents.online > lastData.agents.online) {
      newActivities.push({
        type: 'agent',
        message: 'Un agent s\'est connecté',
        time: new Date(),
      });
    } else if (data.agents.online < lastData.agents.online) {
      newActivities.push({
        type: 'agent',
        message: 'Un agent s\'est déconnecté',
        time: new Date(),
      });
    }

    // Nouvelles transcriptions
    if (data.transcriptions.completed > lastData.transcriptions.completed) {
      newActivities.push({
        type: 'transcription',
        message: 'Transcription terminée',
        time: new Date(),
      });
    }

    // Nouveaux tickets
    if (data.analysis.ticketsCreated > lastData.analysis.ticketsCreated) {
      newActivities.push({
        type: 'ticket',
        message: 'Nouveau ticket créé',
        time: new Date(),
      });
    }

    if (newActivities.length > 0) {
      setActivities(prev => [...newActivities, ...prev].slice(0, 20));
    }

    setLastData(data);
  }, [data, lastData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-500 text-2xl">Erreur de connexion</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <Header currentTime={currentTime} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
        <CallsCard data={data?.calls} agents={data?.agents.online || 0} />
        <AgentsCard data={data?.agents} />
        <TranscriptionsCard data={data?.transcriptions} />
        <TicketsCard data={data?.analysis} />
        <div className="xl:col-span-2">
          <ActivityFeed activities={activities} />
        </div>
        <SystemStats data={data?.system} />
      </div>
    </div>
  );
}

export default App;