// État de l'application
let currentCall = null;
let callTimer = null;
let calls = [];

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    setupEventListeners();
    updateStatus('offline');
});

// Chargement de la configuration
async function loadConfig() {
    const config = await window.api.getConfig();
    if (config) {
        document.getElementById('serverUrl').value = config.serverUrl || '';
        document.getElementById('extension').value = config.extension || '';
        document.getElementById('agentName').value = config.agentName || '';
        document.getElementById('autoStart').checked = config.autoStart !== false;
    }
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Formulaire de configuration
    document.getElementById('configForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveConfig();
    });

    // Écoute des événements IPC
    window.api.onCallStarted((callInfo) => {
        handleCallStart(callInfo);
    });

    window.api.onCallEnded((callInfo) => {
        handleCallEnd(callInfo);
    });

    window.api.onTranscriptionReady((data) => {
        handleTranscription(data);
    });

    window.api.onStatusChange((status) => {
        updateStatus(status);
    });

    window.api.onOpenConfig(() => {
        document.getElementById('configSection').classList.add('active');
    });
}

// Gestion du début d'appel
function handleCallStart(callInfo) {
    currentCall = callInfo;
    
    // Afficher l'alerte d'appel en cours
    const alert = document.getElementById('currentCallAlert');
    alert.classList.remove('d-none');
    
    document.getElementById('currentCallInfo').textContent = 
        `${callInfo.direction === 'inbound' ? 'De' : 'Vers'}: ${callInfo.remoteNumber}`;
    
    // Afficher l'indicateur d'enregistrement
    document.getElementById('recordingIndicator').style.display = 'block';
    
    // Démarrer le timer
    let duration = 0;
    callTimer = setInterval(() => {
        duration++;
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        document.getElementById('callDuration').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
    
    updateStatus('recording');
}

// Gestion de la fin d'appel
function handleCallEnd(callInfo) {
    currentCall = null;
    
    // Masquer l'alerte
    document.getElementById('currentCallAlert').classList.add('d-none');
    document.getElementById('recordingIndicator').style.display = 'none';
    
    // Arrêter le timer
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    
    // Ajouter à la liste des appels
    calls.unshift({
        ...callInfo,
        timestamp: new Date(),
        status: 'uploading'
    });
    
    updateCallsList();
    updateStatistics();
    updateStatus('online');
}

// Gestion de la transcription reçue
function handleTranscription(data) {
    const call = calls.find(c => c.callId === data.callId);
    if (call) {
        call.transcription = data.transcription;
        call.summary = data.summary;
        call.status = 'completed';
        updateCallsList();
        
        // Afficher une notification
        new Notification('Transcription prête', {
            body: `Appel avec ${call.remoteNumber}`,
            icon: '../assets/icon.png'
        });
    }
}

// Mise à jour de l'affichage de la liste des appels
function updateCallsList() {
    const container = document.getElementById('callsList');
    
    if (calls.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Aucun appel enregistré</p>';
        return;
    }
    
    const html = calls.map((call, index) => `
        <div class="card call-item mb-3" data-call-index="${index}">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-3">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-telephone-${call.direction === 'inbound' ? 'inbound' : 'outbound'} me-2"></i>
                            <div>
                                <strong>${call.remoteNumber}</strong>
                                <br>
                                <small class="text-muted">${formatTime(call.timestamp)}</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <small>Durée: ${formatDuration(call.duration)}</small>
                    </div>
                    <div class="col-md-5">
                        ${call.transcription ? `
                            <div class="transcription-preview">
                                ${call.summary || call.transcription.substring(0, 100) + '...'}
                            </div>
                        ` : `
                            <span class="badge bg-${getStatusBadgeClass(call.status)}">
                                ${getStatusText(call.status)}
                            </span>
                        `}
                    </div>
                    <div class="col-md-2 text-end">
                        ${call.transcription ? `
                            <button class="btn btn-sm btn-primary" onclick="showTranscription(${index})">
                                <i class="bi bi-eye"></i> Voir
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Afficher la modal de transcription
function showTranscription(index) {
    const call = calls[index];
    if (!call || !call.transcription) return;
    
    document.getElementById('modalCallDetails').innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <i class="bi bi-telephone"></i> ${call.remoteNumber}<br>
                <i class="bi bi-clock"></i> ${formatTime(call.timestamp)}
            </div>
            <div class="col-md-6">
                <i class="bi bi-arrow-${call.direction === 'inbound' ? 'down' : 'up'}-circle"></i> 
                ${call.direction === 'inbound' ? 'Appel entrant' : 'Appel sortant'}<br>
                <i class="bi bi-hourglass"></i> ${formatDuration(call.duration)}
            </div>
        </div>
    `;
    
    document.getElementById('modalTranscription').textContent = call.transcription;
    document.getElementById('modalSummary').textContent = call.summary || 'Pas de résumé disponible';
    
    window.currentModalCall = call;
    
    const modal = new bootstrap.Modal(document.getElementById('transcriptionModal'));
    modal.show();
}

// Mise à jour des statistiques
function updateStatistics() {
    const today = new Date().toDateString();
    const todayCalls = calls.filter(c => c.timestamp.toDateString() === today);
    
    document.getElementById('callsToday').textContent = todayCalls.length;
    document.getElementById('transcriptionsCompleted').textContent = 
        calls.filter(c => c.status === 'completed').length;
    document.getElementById('pendingUploads').textContent = 
        calls.filter(c => c.status === 'uploading').length;
    
    const totalDuration = calls.reduce((sum, call) => sum + (call.duration || 0), 0);
    document.getElementById('totalDuration').textContent = formatDuration(totalDuration);
}

// Mise à jour du statut
function updateStatus(status) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    indicator.className = 'status-indicator';
    
    switch (status) {
        case 'online':
            indicator.classList.add('status-online');
            text.textContent = 'En ligne';
            break;
        case 'recording':
            indicator.classList.add('status-recording');
            text.textContent = 'En enregistrement';
            break;
        default:
            indicator.classList.add('status-offline');
            text.textContent = 'Hors ligne';
    }
}

// Afficher/masquer la configuration
function toggleConfig() {
    const section = document.getElementById('configSection');
    section.classList.toggle('active');
}

// Sauvegarder la configuration
async function saveConfig() {
    const config = {
        serverUrl: document.getElementById('serverUrl').value,
        extension: document.getElementById('extension').value,
        agentName: document.getElementById('agentName').value,
        autoStart: document.getElementById('autoStart').checked
    };
    
    const result = await window.api.saveConfig(config);
    
    if (result.success) {
        alert('Configuration enregistrée avec succès');
        toggleConfig();
    } else {
        alert('Erreur lors de l\'enregistrement');
    }
}

// Tester la connexion
async function testConnection() {
    const config = {
        serverUrl: document.getElementById('serverUrl').value,
        extension: document.getElementById('extension').value
    };
    
    const result = await window.api.testConnection(config);
    
    if (result.success) {
        alert('Connexion réussie !');
    } else {
        alert(`Erreur de connexion: ${result.error}`);
    }
}

// Créer un ticket
async function createTicket() {
    if (!window.currentModalCall) return;
    
    // Envoyer au serveur pour création du ticket
    alert('Création du ticket en cours...');
    
    // TODO: Implémenter l'envoi au serveur
}

// Utilitaires
function formatTime(date) {
    return new Date(date).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatDuration(seconds) {
    if (!seconds) return '0s';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'uploading': return 'warning';
        case 'transcribing': return 'info';
        case 'completed': return 'success';
        default: return 'secondary';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'uploading': return 'Envoi en cours...';
        case 'transcribing': return 'Transcription...';
        case 'completed': return 'Terminé';
        default: return 'En attente';
    }
}