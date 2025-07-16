import React, { useState, useEffect } from 'react';
import { 
  UserIcon, 
  PhoneIcon, 
  ComputerDesktopIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface Agent {
  id: string;
  email: string;
  name: string;
  extension: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen: Date;
  version?: string;
  ipAddress?: string;
  totalCalls?: number;
  activeCall?: any;
}

export const AgentManagement: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState('');

  useEffect(() => {
    fetchAgents();
    generateDeploymentUrl();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/admin/agents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setLoading(false);
    }
  };

  const generateDeploymentUrl = () => {
    const baseUrl = window.location.origin;
    const apiKey = localStorage.getItem('apiKey') || 'YOUR_API_KEY';
    setDeploymentUrl(`${baseUrl}/download/agent-installer.exe?key=${apiKey}`);
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet agent?')) {
      try {
        const response = await fetch(`/api/admin/agents/${agentId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        });
        if (response.ok) {
          fetchAgents();
        }
      } catch (error) {
        console.error('Failed to delete agent:', error);
      }
    }
  };

  const handleSaveAgent = async (agent: Partial<Agent>) => {
    try {
      const method = agent.id ? 'PUT' : 'POST';
      const url = agent.id ? `/api/admin/agents/${agent.id}` : '/api/admin/agents';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(agent)
      });
      
      if (response.ok) {
        fetchAgents();
        setShowAddModal(false);
        setEditingAgent(null);
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'busy':
        return <PhoneIcon className="h-5 w-5 text-orange-500" />;
      case 'offline':
        return <XCircleIcon className="h-5 w-5 text-gray-400" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'En ligne';
      case 'busy': return 'En appel';
      case 'offline': return 'Hors ligne';
      default: return 'Inconnu';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Gestion des agents</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Ajouter un agent
        </button>
      </div>

      {/* Deployment Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          Déploiement rapide des agents
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          Partagez ce lien avec les agents pour installer automatiquement le client :
        </p>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={deploymentUrl}
            readOnly
            className="flex-1 px-3 py-2 border border-blue-300 rounded-md bg-white text-sm"
          />
          <button
            onClick={() => navigator.clipboard.writeText(deploymentUrl)}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Copier
          </button>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {agents.map((agent) => (
            <li key={agent.id} className="hover:bg-gray-50">
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getStatusIcon(agent.status)}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium text-gray-900">
                          {agent.name || agent.email}
                        </h3>
                        <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Ext. {agent.extension}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <UserIcon className="h-4 w-4 mr-1" />
                          {agent.email}
                        </span>
                        {agent.ipAddress && (
                          <span className="flex items-center">
                            <ComputerDesktopIcon className="h-4 w-4 mr-1" />
                            {agent.ipAddress}
                          </span>
                        )}
                        {agent.version && (
                          <span>v{agent.version}</span>
                        )}
                      </div>
                      {agent.activeCall && (
                        <div className="mt-1 text-sm text-orange-600">
                          En appel avec {agent.activeCall.caller}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      agent.status === 'online' ? 'bg-green-100 text-green-800' :
                      agent.status === 'busy' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusLabel(agent.status)}
                    </span>
                    <button
                      onClick={() => setEditingAgent(agent)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  <p>Dernière connexion: {new Date(agent.lastSeen).toLocaleString()}</p>
                  {agent.totalCalls !== undefined && (
                    <p>Total appels: {agent.totalCalls}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingAgent) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">
              {editingAgent ? 'Modifier l\'agent' : 'Ajouter un agent'}
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleSaveAgent({
                id: editingAgent?.id,
                email: formData.get('email') as string,
                name: formData.get('name') as string,
                extension: formData.get('extension') as string
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingAgent?.email}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nom</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingAgent?.name}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Extension</label>
                  <input
                    type="text"
                    name="extension"
                    defaultValue={editingAgent?.extension}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingAgent(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingAgent ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {agents.filter(a => a.status === 'online').length}
          </div>
          <div className="text-sm text-gray-600">Agents en ligne</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {agents.filter(a => a.status === 'busy').length}
          </div>
          <div className="text-sm text-gray-600">En appel</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {agents.length}
          </div>
          <div className="text-sm text-gray-600">Total agents</div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex space-x-4">
        <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
          <ArrowDownTrayIcon className="h-4 w-4 inline mr-2" />
          Exporter la liste
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
          Envoyer une notification à tous
        </button>
      </div>
    </div>
  );
};