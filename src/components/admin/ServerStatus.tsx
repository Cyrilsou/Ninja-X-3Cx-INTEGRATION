import React, { useState, useEffect } from 'react';
import { 
  ServerIcon, 
  CpuChipIcon, 
  CircleStackIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Line } from 'recharts';
import { 
  LineChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

interface ServerStatusProps {
  systemHealth?: any;
}

export const ServerStatus: React.FC<ServerStatusProps> = ({ systemHealth: initialHealth }) => {
  const [health, setHealth] = useState(initialHealth);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialHealth);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Collect metrics history
    if (health) {
      setMetrics(prev => {
        const newMetrics = [...prev, {
          time: new Date().toLocaleTimeString(),
          cpu: health.cpu,
          memory: health.memory,
          connections: health.activeConnections
        }];
        // Keep last 20 data points
        return newMetrics.slice(-20);
      });
    }
  }, [health]);

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/admin/health', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch health:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const services = [
    {
      name: 'Serveur principal',
      status: health?.server?.status || 'unknown',
      uptime: health?.server?.uptime || 0,
      icon: ServerIcon
    },
    {
      name: 'Redis',
      status: health?.redis?.connected ? 'healthy' : 'error',
      info: health?.redis?.info || 'Non connecté',
      icon: CircleStackIcon
    },
    {
      name: 'Whisper',
      status: health?.whisper?.ready ? 'healthy' : 'error',
      model: health?.whisper?.model || 'Non chargé',
      icon: CpuChipIcon
    },
    {
      name: 'File de transcription',
      status: health?.queue?.active > 10 ? 'warning' : 'healthy',
      active: health?.queue?.active || 0,
      waiting: health?.queue?.waiting || 0,
      icon: ClockIcon
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}j ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">État du système</h2>
        <button
          onClick={fetchHealth}
          className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Actualiser
        </button>
      </div>

      {/* Service Status Grid */}
      <div className="grid grid-cols-2 gap-4">
        {services.map((service) => (
          <div key={service.name} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <service.icon className="h-5 w-5 text-gray-400 mr-2" />
                <h3 className="font-medium text-gray-900">{service.name}</h3>
              </div>
              {getStatusIcon(service.status)}
            </div>
            <div className="text-sm text-gray-600">
              {service.uptime && (
                <p>Uptime: {formatUptime(service.uptime)}</p>
              )}
              {service.info && (
                <p>{service.info}</p>
              )}
              {service.model && (
                <p>Modèle: {service.model}</p>
              )}
              {service.active !== undefined && (
                <p>Actif: {service.active} | En attente: {service.waiting}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Métriques de performance</h3>
        
        {/* CPU Usage */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Utilisation CPU</h4>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="cpu" 
                stroke="#3B82F6" 
                fill="#93BBFC" 
                name="CPU %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Memory Usage */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Utilisation mémoire</h4>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="memory" 
                stroke="#10B981" 
                fill="#86EFAC" 
                name="RAM (MB)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Informations système</h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-600">Version Node.js</dt>
            <dd className="font-medium">{health?.nodeVersion || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Environnement</dt>
            <dd className="font-medium">{health?.environment || 'production'}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Connexions actives</dt>
            <dd className="font-medium">{health?.activeConnections || 0}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Dernière mise à jour</dt>
            <dd className="font-medium">{new Date().toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="flex space-x-4">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Redémarrer les services
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
          Exporter les logs
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
          Nettoyer le cache
        </button>
      </div>
    </div>
  );
};