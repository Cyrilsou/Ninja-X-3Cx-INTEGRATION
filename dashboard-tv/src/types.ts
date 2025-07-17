export interface DashboardData {
  timestamp: string;
  calls: {
    total: number;
    today: number;
    inProgress: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  agents: {
    total: number;
    online: number;
    busy: number;
    available: number;
  };
  transcriptions: {
    total: number;
    today: number;
    inQueue: number;
    processing: number;
    completed: number;
    failed: number;
  };
  analysis: {
    ticketsCreated: number;
    ticketsToday: number;
    avgSentiment: number;
    topCategories: Array<{
      category: string;
      count: number;
    }>;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

export interface Activity {
  type: 'call' | 'agent' | 'transcription' | 'ticket' | 'system';
  message: string;
  time: Date;
}