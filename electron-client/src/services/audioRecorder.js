const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');

/**
 * Enregistreur audio pour Windows
 * Utilise l'API Windows pour capturer l'audio du système et du microphone
 */
class AudioRecorder extends EventEmitter {
  constructor() {
    super();
    this.isRecording = false;
    this.currentRecording = null;
    this.recordingsDir = path.join(app.getPath('userData'), 'recordings');
    
    // Créer le dossier des enregistrements
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  async startRecording(filename) {
    if (this.isRecording) {
      log.warn('Enregistrement déjà en cours');
      return;
    }

    try {
      log.info('Démarrage de l\'enregistrement:', filename);
      
      const filepath = path.join(this.recordingsDir, filename);
      
      // Méthode 1: Utiliser sox (Sound eXchange) pour Windows
      const { spawn } = require('child_process');
      
      // Enregistrer depuis le périphérique audio par défaut
      // sox -t waveaudio -d output.wav
      this.recordingProcess = spawn('sox', [
        '-t', 'waveaudio',  // Type d'entrée Windows
        '-d',               // Périphérique par défaut
        '-r', '16000',      // Taux d'échantillonnage 16kHz
        '-c', '1',          // Mono
        '-b', '16',         // 16 bits
        filepath
      ]);

      this.recordingProcess.on('error', (error) => {
        log.error('Erreur Sox:', error);
        // Fallback sur une autre méthode
        this.startRecordingFallback(filepath);
      });

      this.recordingProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          log.error('Sox terminé avec code:', code);
        }
      });

      this.isRecording = true;
      this.currentRecording = {
        filepath,
        startTime: new Date()
      };

      this.emit('recordingStarted', filepath);

    } catch (error) {
      log.error('Erreur au démarrage de l\'enregistrement:', error);
      // Essayer la méthode alternative
      this.startRecordingFallback(filename);
    }
  }

  async startRecordingFallback(filepath) {
    try {
      // Méthode 2: Utiliser l'API Windows directement via PowerShell
      const { exec } = require('child_process');
      
      const psScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.IO;
        using System.Threading;
        using NAudio.Wave;
        
        public class AudioRecorder {
            private WaveInEvent waveIn;
            private WaveFileWriter writer;
            
            public void StartRecording(string outputPath) {
                waveIn = new WaveInEvent();
                waveIn.WaveFormat = new WaveFormat(16000, 16, 1);
                
                writer = new WaveFileWriter(outputPath, waveIn.WaveFormat);
                
                waveIn.DataAvailable += (s, e) => {
                    writer.Write(e.Buffer, 0, e.BytesRecorded);
                };
                
                waveIn.StartRecording();
            }
            
            public void StopRecording() {
                waveIn?.StopRecording();
                writer?.Dispose();
                waveIn?.Dispose();
            }
        }
"@ -ReferencedAssemblies System.dll, System.Core.dll
        
        $recorder = New-Object AudioRecorder
        $recorder.StartRecording("${filepath}")
        
        # Garder le script en cours d'exécution
        while ($true) { Start-Sleep -Seconds 1 }
      `;

      this.recordingProcess = exec(`powershell -ExecutionPolicy Bypass -Command "${psScript}"`, 
        (error) => {
          if (error) {
            log.error('Erreur PowerShell:', error);
            // Dernière méthode de fallback
            this.startRecordingNative(filepath);
          }
        }
      );

      this.isRecording = true;
      this.currentRecording = {
        filepath,
        startTime: new Date()
      };

    } catch (error) {
      log.error('Erreur fallback recording:', error);
      this.startRecordingNative(filepath);
    }
  }

  async startRecordingNative(filepath) {
    // Méthode 3: Utiliser l'enregistreur Windows natif
    const { exec } = require('child_process');
    
    try {
      // Utiliser l'API Windows Media Foundation
      const command = `powershell -Command "
        [System.Reflection.Assembly]::LoadWithPartialName('System.Speech') | Out-Null
        
        # Créer un enregistreur audio
        $source = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, 16, 1)
        $stream = [System.IO.File]::Create('${filepath}')
        $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
        
        # Démarrer l'enregistrement
        $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
        $rec.SetInputToDefaultAudioDevice()
        
        Write-Host 'Recording started'
        
        # Maintenir l'enregistrement actif
        while ($true) { Start-Sleep -Milliseconds 100 }
      "`;

      this.recordingProcess = exec(command);
      
      this.isRecording = true;
      this.currentRecording = {
        filepath,
        startTime: new Date(),
        fallback: true
      };

      log.info('Enregistrement démarré avec méthode native');

    } catch (error) {
      log.error('Toutes les méthodes d\'enregistrement ont échoué:', error);
      this.emit('recordingError', error);
    }
  }

  async stopRecording() {
    if (!this.isRecording || !this.currentRecording) {
      log.warn('Aucun enregistrement en cours');
      return null;
    }

    try {
      log.info('Arrêt de l\'enregistrement');

      // Arrêter le processus d'enregistrement
      if (this.recordingProcess) {
        if (this.recordingProcess.kill) {
          this.recordingProcess.kill();
        } else if (this.recordingProcess.pid) {
          process.kill(this.recordingProcess.pid);
        }
      }

      const recording = this.currentRecording;
      this.isRecording = false;
      this.currentRecording = null;

      // Vérifier que le fichier existe
      if (fs.existsSync(recording.filepath)) {
        const stats = fs.statSync(recording.filepath);
        
        if (stats.size > 0) {
          log.info('Enregistrement sauvegardé:', recording.filepath, 'Taille:', stats.size);
          this.emit('recordingStopped', recording.filepath);
          return recording.filepath;
        } else {
          log.warn('Fichier audio vide');
          fs.unlinkSync(recording.filepath);
        }
      }

      return null;

    } catch (error) {
      log.error('Erreur à l\'arrêt de l\'enregistrement:', error);
      return null;
    }
  }

  cleanup() {
    // Nettoyer les vieux enregistrements (plus de 7 jours)
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours

    fs.readdir(this.recordingsDir, (err, files) => {
      if (err) return;

      files.forEach(file => {
        const filepath = path.join(this.recordingsDir, file);
        fs.stat(filepath, (err, stats) => {
          if (err) return;

          if (now - stats.mtimeMs > maxAge) {
            fs.unlink(filepath, (err) => {
              if (!err) {
                log.info('Ancien enregistrement supprimé:', file);
              }
            });
          }
        });
      });
    });
  }

  // Méthode alternative utilisant le microphone via WebRTC
  async startWebRTCRecording(filepath) {
    try {
      const recorder = require('node-record-lpcm16');
      const wav = require('wav');

      const fileStream = fs.createWriteStream(filepath);
      const wavWriter = new wav.Writer({
        channels: 1,
        sampleRate: 16000,
        bitDepth: 16
      });

      wavWriter.pipe(fileStream);

      this.recording = recorder.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'wav',
        recorder: 'sox' // ou 'rec' sur Windows
      });

      this.recording.stream()
        .on('error', (err) => {
          log.error('Erreur stream:', err);
        })
        .pipe(wavWriter);

      this.isRecording = true;
      this.currentRecording = {
        filepath,
        startTime: new Date(),
        recorder: this.recording,
        writer: wavWriter
      };

      log.info('Enregistrement WebRTC démarré');

    } catch (error) {
      log.error('Erreur WebRTC recording:', error);
      throw error;
    }
  }

  async stopWebRTCRecording() {
    if (!this.currentRecording || !this.currentRecording.recorder) {
      return null;
    }

    try {
      this.currentRecording.recorder.stop();
      this.currentRecording.writer.end();
      
      const filepath = this.currentRecording.filepath;
      this.isRecording = false;
      this.currentRecording = null;

      return filepath;

    } catch (error) {
      log.error('Erreur arrêt WebRTC:', error);
      return null;
    }
  }
}

module.exports = { AudioRecorder };