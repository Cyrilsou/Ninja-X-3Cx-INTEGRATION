import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tab } from '@headlessui/react';
import {
  CogIcon,
  UserGroupIcon,
  ServerIcon,
  ChartBarIcon,
  CloudArrowDownIcon,
  ShieldCheckIcon,
  BellIcon,
  KeyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { SystemConfig } from '../components/admin/SystemConfig';
import { AgentManagement } from '../components/admin/AgentManagement';
import { ServerStatus } from '../components/admin/ServerStatus';
import { WebhookConfig } from '../components/admin/WebhookConfig';
import { AgentDownload } from '../components/admin/AgentDownload';
import { SecuritySettings } from '../components/admin/SecuritySettings';
import { NotificationSettings } from '../components/admin/NotificationSettings';
import { useAuth } from '../hooks/useAuth';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, checkAdminAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    const verifyAdmin = async () => {
      const authorized = await checkAdminAuth();
      if (!authorized) {
        navigate('/login');
      } else {
        setLoading(false);
        fetchSystemHealth();
      }
    };
    verifyAdmin();
  }, []);

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/admin/health', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSystemHealth(data);
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const categories = [
    {
      name: 'Vue d\'ensemble',
      icon: ChartBarIcon,
      component: <ServerStatus systemHealth={systemHealth} />
    },
    {
      name: 'Configuration système',
      icon: CogIcon,
      component: <SystemConfig />
    },
    {
      name: 'Gestion des agents',
      icon: UserGroupIcon,
      component: <AgentManagement />
    },
    {
      name: 'Webhooks 3CX',
      icon: ServerIcon,
      component: <WebhookConfig />
    },
    {
      name: 'Téléchargement agent',
      icon: CloudArrowDownIcon,
      component: <AgentDownload />
    },
    {
      name: 'Sécurité',
      icon: ShieldCheckIcon,
      component: <SecuritySettings />
    },
    {
      name: 'Notifications',
      icon: BellIcon,
      component: <NotificationSettings />
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">
                Administration 3CX-Ninja
              </h1>
              {systemHealth && (
                <div className="ml-4 flex items-center space-x-2">
                  {systemHealth.allServicesHealthy ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  ) : (
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
                  )}
                  <span className="text-sm text-gray-600">
                    {systemHealth.allServicesHealthy ? 'Tous les services sont opérationnels' : 'Certains services nécessitent votre attention'}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700"
            >
              Retour au dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tab.Group>
          <div className="flex space-x-8">
            {/* Sidebar */}
            <div className="w-64">
              <Tab.List className="space-y-1">
                {categories.map((category) => (
                  <Tab
                    key={category.name}
                    className={({ selected }) =>
                      classNames(
                        'w-full flex items-center px-3 py-2 text-sm font-medium rounded-md',
                        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                        selected
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )
                    }
                  >
                    <category.icon className="mr-3 h-5 w-5" />
                    {category.name}
                  </Tab>
                ))}
              </Tab.List>

              {/* Quick Actions */}
              <div className="mt-8 p-4 bg-gray-100 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Actions rapides</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-white hover:text-gray-900 rounded"
                  >
                    Rafraîchir
                  </button>
                  <button
                    onClick={fetchSystemHealth}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-white hover:text-gray-900 rounded"
                  >
                    Vérifier l'état
                  </button>
                  <button
                    onClick={() => navigate('/logs')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-white hover:text-gray-900 rounded"
                  >
                    Voir les logs
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              <Tab.Panels>
                {categories.map((category, idx) => (
                  <Tab.Panel
                    key={idx}
                    className="bg-white rounded-lg shadow p-6"
                  >
                    {category.component}
                  </Tab.Panel>
                ))}
              </Tab.Panels>
            </div>
          </div>
        </Tab.Group>
      </div>
    </div>
  );
};