import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);

// Configuration du serveur
const getServerConfig = () => {
    return {
        serverUrl: `http://${process.env.SERVER_IP || 'localhost'}:${process.env.PORT || 3000}`,
        apiKey: process.env.API_KEY,
        serverName: process.env.DISCOVERY_NAME || '3CX-Ninja-Server',
        version: '2.0.0',
        discoveryPort: parseInt(process.env.DISCOVERY_PORT || '53434')
    };
};

// Générer le script d'installation Windows PowerShell
router.get('/install-agent.ps1', async (req: Request, res: Response) => {
    try {
        const config = getServerConfig();
        
        // Lire le template PowerShell
        const templatePath = path.join(__dirname, '../../templates/install-agent.ps1');
        let script = '';
        
        try {
            script = await fs.readFile(templatePath, 'utf8');
        } catch {
            // Si le template n'existe pas, utiliser le script intégré
            script = await fs.readFile(path.join(process.cwd(), 'install-agent-auto.ps1'), 'utf8');
        }
        
        // Remplacer les variables
        script = script
            .replace(/\$ServerUrl = ".*"/, `$ServerUrl = "${config.serverUrl}"`)
            .replace(/\$ApiKey = ".*"/, `$ApiKey = "${config.apiKey}"`)
            .replace(/\$DiscoveryPort = \d+/, `$DiscoveryPort = ${config.discoveryPort}`);
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="install-agent.ps1"');
        res.send(script);
        
    } catch (error) {
        console.error('Erreur génération script PowerShell:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du script' });
    }
});

// Générer le script d'installation Linux/macOS
router.get('/install-agent.sh', async (req: Request, res: Response) => {
    try {
        const config = getServerConfig();
        
        // Lire le template Shell
        const templatePath = path.join(__dirname, '../../templates/install-agent.sh');
        let script = '';
        
        try {
            script = await fs.readFile(templatePath, 'utf8');
        } catch {
            // Si le template n'existe pas, utiliser le script intégré
            script = await fs.readFile(path.join(process.cwd(), 'install-agent-auto.sh'), 'utf8');
        }
        
        // Remplacer les variables
        script = script
            .replace(/SERVER_URL=".*"/, `SERVER_URL="${config.serverUrl}"`)
            .replace(/API_KEY=".*"/, `API_KEY="${config.apiKey}"`)
            .replace(/DISCOVERY_PORT=\d+/, `DISCOVERY_PORT=${config.discoveryPort}`);
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="install-agent.sh"');
        res.send(script);
        
    } catch (error) {
        console.error('Erreur génération script Shell:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du script' });
    }
});

// API de découverte pour les agents
router.get('/discover', (req: Request, res: Response) => {
    try {
        const config = getServerConfig();
        
        res.json({
            type: 'SERVER_DISCOVERY_RESPONSE',
            server: config,
            discoveredAt: Date.now(),
            capabilities: {
                transcription: true,
                ticketing: true,
                realTime: true,
                offline: true
            }
        });
        
    } catch (error) {
        console.error('Erreur API découverte:', error);
        res.status(500).json({ error: 'Erreur lors de la découverte' });
    }
});

// Installation rapide en une ligne
router.get('/quick-install', (req: Request, res: Response) => {
    try {
        const config = getServerConfig();
        const { platform } = req.query;
        
        let command = '';
        
        switch (platform) {
            case 'windows':
                command = `powershell -c "irm ${config.serverUrl}/api/install/install-agent.ps1 | iex"`;
                break;
            case 'linux':
            case 'macos':
                command = `curl -sSL ${config.serverUrl}/api/install/install-agent.sh | bash`;
                break;
            default:
                // Détection automatique
                const commandObj = {
                    windows: `powershell -c "irm ${config.serverUrl}/api/install/install-agent.ps1 | iex"`,
                    linux: `curl -sSL ${config.serverUrl}/api/install/install-agent.sh | bash`,
                    macos: `curl -sSL ${config.serverUrl}/api/install/install-agent.sh | bash`
                };
                command = commandObj;
        }
        
        res.json({
            serverUrl: config.serverUrl,
            commands: typeof command === 'string' ? { [platform?.toString() || 'auto']: command } : command,
            instructions: {
                windows: 'Exécuter en tant qu\'administrateur dans PowerShell',
                linux: 'Exécuter en tant qu\'utilisateur normal',
                macos: 'Exécuter en tant qu\'utilisateur normal'
            }
        });
        
    } catch (error) {
        console.error('Erreur quick install:', error);
        res.status(500).json({ error: 'Erreur lors de la génération des commandes' });
    }
});

// Téléchargement des binaires d'agents
router.get('/agent/:platform/:arch?', async (req: Request, res: Response) => {
    try {
        const { platform, arch = 'x64' } = req.params;
        
        // Chemins des binaires
        const binariesPath = path.join(process.cwd(), 'binaries');
        const agentPath = path.join(binariesPath, platform, arch, '3cx-ninja-agent');
        
        // Extensions par plateforme
        const extensions = {
            windows: '.exe',
            linux: '',
            macos: '.app'
        };
        
        const fullPath = agentPath + (extensions[platform as keyof typeof extensions] || '');
        
        try {
            await fs.access(fullPath);
            
            // Définir les headers appropriés
            const mimeTypes = {
                windows: 'application/vnd.microsoft.portable-executable',
                linux: 'application/x-executable',
                macos: 'application/x-executable'
            };
            
            res.setHeader('Content-Type', mimeTypes[platform as keyof typeof mimeTypes] || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="3cx-ninja-agent${extensions[platform as keyof typeof extensions] || ''}"`);
            
            // Envoyer le fichier
            res.sendFile(fullPath);
            
        } catch {
            // Si le binaire n'existe pas, retourner des instructions de build
            res.status(404).json({
                error: 'Binary not found',
                message: `Agent binary for ${platform}/${arch} not available`,
                buildInstructions: {
                    command: 'npm run build:agent',
                    platforms: ['windows', 'linux', 'macos'],
                    architectures: ['x64', 'arm64'],
                    note: 'Binaries must be built separately for each platform'
                },
                fallback: {
                    windows: `${getServerConfig().serverUrl}/api/install/install-agent.ps1`,
                    linux: `${getServerConfig().serverUrl}/api/install/install-agent.sh`,
                    macos: `${getServerConfig().serverUrl}/api/install/install-agent.sh`
                }
            });
        }
        
    } catch (error) {
        console.error('Erreur téléchargement binaire:', error);
        res.status(500).json({ error: 'Erreur lors du téléchargement' });
    }
});

// Générer un package d'installation complet
router.get('/package/:platform', async (req: Request, res: Response) => {
    try {
        const { platform } = req.params;
        const config = getServerConfig();
        
        // Créer un package temporaire
        const tempDir = path.join(os.tmpdir(), `3cx-ninja-package-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
        
        try {
            // Copier les fichiers nécessaires
            const packageFiles = [];
            
            // Script d'installation
            const scriptExtension = platform === 'windows' ? '.ps1' : '.sh';
            const scriptName = `install-agent${scriptExtension}`;
            const scriptPath = path.join(tempDir, scriptName);
            
            let script = '';
            if (platform === 'windows') {
                script = await fs.readFile(path.join(process.cwd(), 'install-agent-auto.ps1'), 'utf8');
            } else {
                script = await fs.readFile(path.join(process.cwd(), 'install-agent-auto.sh'), 'utf8');
            }
            
            // Personnaliser le script
            script = script
                .replace(/SERVER_URL=".*"/, `SERVER_URL="${config.serverUrl}"`)
                .replace(/API_KEY=".*"/, `API_KEY="${config.apiKey}"`)
                .replace(/\$ServerUrl = ".*"/, `$ServerUrl = "${config.serverUrl}"`)
                .replace(/\$ApiKey = ".*"/, `$ApiKey = "${config.apiKey}"`);
            
            await fs.writeFile(scriptPath, script);
            packageFiles.push(scriptPath);
            
            // Fichier de configuration
            const configPath = path.join(tempDir, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                serverUrl: config.serverUrl,
                apiKey: config.apiKey,
                serverName: config.serverName,
                version: config.version
            }, null, 2));
            packageFiles.push(configPath);
            
            // README
            const readmePath = path.join(tempDir, 'README.md');
            const readme = `# 3CX-Ninja Agent Installation Package

## Installation

### ${platform === 'windows' ? 'Windows' : 'Linux/macOS'}

${platform === 'windows' 
    ? `1. Exécutez PowerShell en tant qu'administrateur
2. Naviguez vers ce dossier
3. Exécutez: .\\${scriptName}` 
    : `1. Ouvrez un terminal
2. Naviguez vers ce dossier
3. Exécutez: chmod +x ${scriptName} && ./${scriptName}`
}

## Configuration

Le serveur sera automatiquement découvert à l'adresse: ${config.serverUrl}

## Support

En cas de problème, consultez les logs ou contactez l'administrateur.
`;
            await fs.writeFile(readmePath, readme);
            packageFiles.push(readmePath);
            
            // Créer une archive ZIP
            const archiver = require('archiver');
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="3cx-ninja-agent-${platform}.zip"`);
            
            archive.pipe(res);
            
            // Ajouter les fichiers à l'archive
            for (const file of packageFiles) {
                archive.file(file, { name: path.basename(file) });
            }
            
            await archive.finalize();
            
        } finally {
            // Nettoyer les fichiers temporaires
            setTimeout(async () => {
                try {
                    await fs.rm(tempDir, { recursive: true, force: true });
                } catch (error) {
                    console.error('Erreur nettoyage:', error);
                }
            }, 5000);
        }
        
    } catch (error) {
        console.error('Erreur génération package:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du package' });
    }
});

// Statistiques d'installation
router.get('/stats', (req: Request, res: Response) => {
    try {
        // TODO: Implémenter les statistiques réelles depuis la base de données
        res.json({
            totalInstalls: 0,
            activeAgents: 0,
            platforms: {
                windows: 0,
                linux: 0,
                macos: 0
            },
            versions: {
                '2.0.0': 0
            },
            lastInstall: null
        });
        
    } catch (error) {
        console.error('Erreur statistiques:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

// Validation d'installation
router.post('/validate', async (req: Request, res: Response) => {
    try {
        const { agentId, platform, version } = req.body;
        
        // Valider les paramètres
        if (!agentId || !platform || !version) {
            return res.status(400).json({ error: 'Paramètres manquants' });
        }
        
        // TODO: Enregistrer l'installation dans la base de données
        
        res.json({
            success: true,
            message: 'Installation validée',
            agentId,
            registeredAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Erreur validation installation:', error);
        res.status(500).json({ error: 'Erreur lors de la validation' });
    }
});

// Désinstallation
router.get('/uninstall.sh', async (req: Request, res: Response) => {
    try {
        const uninstallScript = `#!/bin/bash

# 3CX-Ninja Agent - Script de désinstallation
set -e

log() {
    echo -e "\\033[0;32m[$(date '+%H:%M:%S')] $1\\033[0m"
}

warn() {
    echo -e "\\033[1;33m[$(date '+%H:%M:%S')] WARNING: $1\\033[0m"
}

error() {
    echo -e "\\033[0;31m[$(date '+%H:%M:%S')] ERROR: $1\\033[0m"
    exit 1
}

# Variables
AGENT_DIR="$HOME/.3cx-ninja-agent"
SERVICE_NAME="3cx-ninja-agent"

log "Désinstallation de l'agent 3CX-Ninja..."

# Arrêter le service
if systemctl --user is-active --quiet $SERVICE_NAME 2>/dev/null; then
    log "Arrêt du service..."
    systemctl --user stop $SERVICE_NAME
    systemctl --user disable $SERVICE_NAME
fi

# Supprimer le service
if [[ -f "$HOME/.config/systemd/user/$SERVICE_NAME.service" ]]; then
    log "Suppression du service..."
    rm -f "$HOME/.config/systemd/user/$SERVICE_NAME.service"
    systemctl --user daemon-reload
fi

# Supprimer les fichiers
if [[ -d "$AGENT_DIR" ]]; then
    log "Suppression des fichiers..."
    rm -rf "$AGENT_DIR"
fi

log "Désinstallation terminée!"
`;
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="uninstall.sh"');
        res.send(uninstallScript);
        
    } catch (error) {
        console.error('Erreur script désinstallation:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du script' });
    }
});

router.get('/uninstall.ps1', async (req: Request, res: Response) => {
    try {
        const uninstallScript = `# 3CX-Ninja Agent - Script de désinstallation Windows

param(
    [switch]$Force = $false
)

function Write-Log {
    param([string]$Message, [string]$Color = "Green")
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

function Write-Error-Log {
    param([string]$Message)
    Write-Log "ERROR: $Message" "Red"
    if (!$Force) { exit 1 }
}

Write-Log "Désinstallation de l'agent 3CX-Ninja..."

# Variables
$AgentDir = "$env:APPDATA\\3cx-ninja-agent"
$ServiceName = "3CXNinjaAgent"
$TaskName = "3CX-Ninja Agent"

try {
    # Arrêter et supprimer le service
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Log "Arrêt du service..."
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        & sc.exe delete $ServiceName
    }
    
    # Supprimer la tâche planifiée
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        Write-Log "Suppression de la tâche planifiée..."
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    
    # Supprimer les fichiers
    if (Test-Path $AgentDir) {
        Write-Log "Suppression des fichiers..."
        Remove-Item -Path $AgentDir -Recurse -Force
    }
    
    Write-Log "Désinstallation terminée!" "Green"
    
} catch {
    Write-Error-Log "Erreur durant la désinstallation: $_"
}
`;
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="uninstall.ps1"');
        res.send(uninstallScript);
        
    } catch (error) {
        console.error('Erreur script désinstallation Windows:', error);
        res.status(500).json({ error: 'Erreur lors de la génération du script' });
    }
});

export default router;