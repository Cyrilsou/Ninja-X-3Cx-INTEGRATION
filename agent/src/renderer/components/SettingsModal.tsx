import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AgentConfig } from '@3cx-ninja/shared';

interface SettingsModalProps {
  config: AgentConfig;
  onSave: (config: AgentConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onSave, onClose }) => {
  const [formData, setFormData] = useState<AgentConfig>(config);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.server.url) {
      newErrors.serverUrl = 'URL du serveur requise';
    } else if (!formData.server.url.startsWith('http')) {
      newErrors.serverUrl = 'URL invalide (doit commencer par http:// ou https://)';
    }

    if (!formData.server.apiKey) {
      newErrors.apiKey = 'Clé API requise';
    }

    if (!formData.agent.email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(formData.agent.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.agent.extension) {
      newErrors.extension = 'Extension requise';
    }

    if (!formData.agent.name) {
      newErrors.name = 'Nom requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  const updateConfig = (path: string, value: any) => {
    const keys = path.split('.');
    setFormData(prev => {
      const newConfig = { ...prev };
      let current: any = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Paramètres de l'agent</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Connexion au serveur */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Connexion au serveur</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="serverUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  URL du serveur
                </label>
                <input
                  type="url"
                  id="serverUrl"
                  value={formData.server.url}
                  onChange={(e) => updateConfig('server.url', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    errors.serverUrl ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="http://localhost:3000"
                />
                {errors.serverUrl && (
                  <p className="mt-1 text-sm text-red-600">{errors.serverUrl}</p>
                )}
              </div>

              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  Clé API
                </label>
                <input
                  type="password"
                  id="apiKey"
                  value={formData.server.apiKey}
                  onChange={(e) => updateConfig('server.apiKey', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    errors.apiKey ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="sk-..."
                />
                {errors.apiKey && (
                  <p className="mt-1 text-sm text-red-600">{errors.apiKey}</p>
                )}
              </div>
            </div>
          </div>

          {/* Informations de l'agent */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informations de l'agent</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.agent.email}
                  onChange={(e) => updateConfig('agent.email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="agent@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.agent.name}
                  onChange={(e) => updateConfig('agent.name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="John Doe"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="extension" className="block text-sm font-medium text-gray-700 mb-1">
                  Extension 3CX
                </label>
                <input
                  type="text"
                  id="extension"
                  value={formData.agent.extension}
                  onChange={(e) => updateConfig('agent.extension', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    errors.extension ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="1001"
                />
                {errors.extension && (
                  <p className="mt-1 text-sm text-red-600">{errors.extension}</p>
                )}
              </div>
            </div>
          </div>

          {/* Paramètres audio */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres audio</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sampleRate" className="block text-sm font-medium text-gray-700 mb-1">
                  Taux d'échantillonnage
                </label>
                <select
                  id="sampleRate"
                  value={formData.audio.sampleRate}
                  onChange={(e) => updateConfig('audio.sampleRate', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="16000">16 kHz</option>
                  <option value="44100">44.1 kHz</option>
                  <option value="48000">48 kHz</option>
                </select>
              </div>

              <div>
                <label htmlFor="channels" className="block text-sm font-medium text-gray-700 mb-1">
                  Canaux
                </label>
                <select
                  id="channels"
                  value={formData.audio.channels}
                  onChange={(e) => updateConfig('audio.channels', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="1">Mono</option>
                  <option value="2">Stéréo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interface utilisateur */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Interface utilisateur</h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoPopup"
                  checked={formData.ui.autoPopup}
                  onChange={(e) => updateConfig('ui.autoPopup', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autoPopup" className="ml-2 block text-sm text-gray-700">
                  Afficher automatiquement les tickets suggérés
                </label>
              </div>

              <div>
                <label htmlFor="theme" className="block text-sm font-medium text-gray-700 mb-1">
                  Thème
                </label>
                <select
                  id="theme"
                  value={formData.ui.theme}
                  onChange={(e) => updateConfig('ui.theme', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="light">Clair</option>
                  <option value="dark">Sombre</option>
                </select>
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                  Position de la fenêtre
                </label>
                <select
                  id="position"
                  value={formData.ui.position}
                  onChange={(e) => updateConfig('ui.position', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="top-right">En haut à droite</option>
                  <option value="top-left">En haut à gauche</option>
                  <option value="bottom-right">En bas à droite</option>
                  <option value="bottom-left">En bas à gauche</option>
                </select>
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-4 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Enregistrer
          </button>
        </div>
      </motion.div>
    </div>
  );
};