import React, { useState, useEffect } from 'react';
import { 
  CloudArrowDownIcon,
  ComputerDesktopIcon,
  CommandLineIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

interface DownloadOption {
  platform: string;
  icon: any;
  filename: string;
  size: string;
  description: string;
  command?: string;
}

export const AgentDownload: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    // Get server URL and API key
    setServerUrl(window.location.origin);
    setApiKey(localStorage.getItem('apiKey') || 'YOUR_API_KEY');
  }, []);

  const downloadOptions: DownloadOption[] = [
    {
      platform: 'Windows',
      icon: ComputerDesktopIcon,
      filename: '3cx-ninja-agent-setup.exe',
      size: '45 MB',
      description: 'Installateur Windows avec configuration automatique'
    },
    {
      platform: 'Windows (Portable)',
      icon: ComputerDesktopIcon,
      filename: '3cx-ninja-agent-portable.zip',
      size: '42 MB',
      description: 'Version portable sans installation'
    },
    {
      platform: 'macOS',
      icon: ComputerDesktopIcon,
      filename: '3cx-ninja-agent.dmg',
      size: '48 MB',
      description: 'Application macOS universelle (Intel + Apple Silicon)'
    },
    {
      platform: 'Linux',
      icon: CommandLineIcon,
      filename: '3cx-ninja-agent.AppImage',
      size: '50 MB',
      description: 'AppImage universelle pour toutes les distributions'
    }
  ];

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateInstallCommand = (platform: string) => {
    const baseCommand = `curl -sSL ${serverUrl}/install-agent.sh | bash -s -- --server ${serverUrl} --key ${apiKey}`;
    
    switch (platform) {
      case 'Windows':
        return `powershell -c "irm ${serverUrl}/install-agent.ps1 | iex"`;
      case 'macOS':
      case 'Linux':
        return baseCommand;
      default:
        return baseCommand;
    }
  };

  const generateConfigFile = () => {
    return JSON.stringify({
      serverUrl,
      apiKey,
      autoStart: true,
      minimizeToTray: true,
      language: 'fr'
    }, null, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Téléchargement et installation des agents
        </h2>
        <p className="text-gray-600">
          Distribuez le client 3CX-Ninja aux agents pour qu'ils puissent se connecter au serveur.
        </p>
      </div>

      {/* Quick Setup */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          Installation rapide (recommandé)
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          Utilisez cette commande pour installer automatiquement l'agent avec la configuration :
        </p>
        <div className="bg-white rounded p-3 font-mono text-sm">
          <div className="flex items-start justify-between">
            <code className="text-gray-800 break-all">
              {generateInstallCommand('Windows')}
            </code>
            <button
              onClick={() => copyToClipboard(generateInstallCommand('Windows'), 'command')}
              className="ml-2 p-1 text-gray-400 hover:text-gray-600"
            >
              {copied === 'command' ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Download Options */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Téléchargements disponibles
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {downloadOptions.map((option) => (
            <div key={option.platform} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300">
              <div className="flex items-start">
                <option.icon className="h-8 w-8 text-gray-400 mt-1" />
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {option.platform}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {option.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{option.size}</span>
                    <a
                      href={`/download/agent/${option.filename}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Télécharger
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Configuration */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Configuration manuelle
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL du serveur
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={serverUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              />
              <button
                onClick={() => copyToClipboard(serverUrl, 'url')}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                {copied === 'url' ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clé API
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={apiKey}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono"
              />
              <button
                onClick={() => copyToClipboard(apiKey, 'apikey')}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                {copied === 'apikey' ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fichier de configuration (config.json)
            </label>
            <div className="bg-gray-50 rounded p-3 font-mono text-sm">
              <pre className="text-gray-800">{generateConfigFile()}</pre>
              <button
                onClick={() => copyToClipboard(generateConfigFile(), 'config')}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                {copied === 'config' ? 'Copié!' : 'Copier la configuration'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">
          Instructions d'installation
        </h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          <li>Téléchargez l'installateur correspondant au système de l'agent</li>
          <li>Exécutez l'installateur sur le poste de l'agent</li>
          <li>Lors de la configuration, entrez l'URL du serveur et la clé API</li>
          <li>L'agent se connectera automatiquement au démarrage</li>
          <li>Vérifiez la connexion dans la section "Gestion des agents"</li>
        </ol>
      </div>

      {/* Documentation Link */}
      <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
        <div className="flex items-center">
          <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-sm text-gray-700">
            Documentation complète d'installation
          </span>
        </div>
        <a
          href="/docs/agent-installation"
          target="_blank"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Consulter
        </a>
      </div>
    </div>
  );
};