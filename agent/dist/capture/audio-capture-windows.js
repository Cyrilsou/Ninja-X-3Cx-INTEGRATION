"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioCaptureWindows = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
const shared_1 = require("@3cx-ninja/shared");
class AudioCaptureWindows extends events_1.EventEmitter {
    config;
    logger = new shared_1.Logger('AudioCapture');
    captureProcess = null;
    isCapturing = false;
    currentCallId = null;
    sequenceNumber = 0;
    chunkBuffer = [];
    constructor(config) {
        super();
        this.config = config;
        this.setupChunkInterval();
    }
    setupChunkInterval() {
        setInterval(() => {
            if (this.chunkBuffer.length > 0 && this.currentCallId) {
                const chunk = Buffer.concat(this.chunkBuffer);
                this.chunkBuffer = [];
                this.emit('audioChunk', {
                    callId: this.currentCallId,
                    agentId: this.config.agent.id,
                    data: chunk,
                    timestamp: Date.now(),
                    sequence: this.sequenceNumber++
                });
            }
        }, 250); // 250ms chunks
    }
    async startCapture(callId) {
        if (this.isCapturing) {
            await this.stopCapture();
        }
        this.currentCallId = callId;
        this.sequenceNumber = 0;
        this.isCapturing = true;
        try {
            // Utiliser SoX pour Windows (doit être installé)
            const soxPath = process.env.SOX_PATH || 'C:\\Program Files (x86)\\sox-14-4-2\\sox.exe';
            // Arguments pour capturer depuis le périphérique audio Windows
            const args = [
                '-t', 'waveaudio', this.config.audio.device || 'default',
                '-r', this.config.audio.sampleRate.toString(),
                '-c', '1',
                '-b', '16',
                '-e', 'signed-integer',
                '-t', 'raw',
                '-'
            ];
            this.captureProcess = (0, child_process_1.spawn)(soxPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: true
            });
            this.captureProcess.stdout?.on('data', (data) => {
                if (this.isCapturing) {
                    this.chunkBuffer.push(data);
                }
            });
            this.captureProcess.stderr?.on('data', (data) => {
                const error = data.toString();
                if (error.includes('error') || error.includes('Error')) {
                    this.logger.error('SoX error:', error);
                }
            });
            this.captureProcess.on('error', (error) => {
                this.logger.error('Failed to start SoX:', error);
                this.emit('error', new Error('Audio capture failed. Is SoX installed?'));
            });
            this.captureProcess.on('exit', (code) => {
                if (code !== 0 && this.isCapturing) {
                    this.logger.error(`SoX exited with code ${code}`);
                    this.emit('error', new Error(`Audio capture stopped unexpectedly`));
                }
            });
            this.logger.info(`Started audio capture for call: ${callId}`);
            this.emit('captureStarted', { callId });
        }
        catch (error) {
            this.logger.error('Failed to start audio capture:', error);
            this.isCapturing = false;
            throw error;
        }
    }
    async stopCapture() {
        if (!this.isCapturing)
            return;
        this.isCapturing = false;
        // Envoyer les derniers chunks
        if (this.chunkBuffer.length > 0 && this.currentCallId) {
            const finalChunk = Buffer.concat(this.chunkBuffer);
            this.emit('audioChunk', {
                callId: this.currentCallId,
                agentId: this.config.agent.id,
                data: finalChunk,
                timestamp: Date.now(),
                sequence: this.sequenceNumber++
            });
        }
        // Terminer le processus SoX
        if (this.captureProcess) {
            this.captureProcess.kill('SIGTERM');
            this.captureProcess = null;
        }
        const callId = this.currentCallId;
        this.currentCallId = null;
        this.chunkBuffer = [];
        this.sequenceNumber = 0;
        this.logger.info(`Stopped audio capture for call: ${callId}`);
        this.emit('captureStopped', { callId });
    }
    isCapturingAudio() {
        return this.isCapturing;
    }
    // Méthode alternative utilisant PowerShell pour lister les périphériques
    static async listAudioDevices() {
        return new Promise((resolve, reject) => {
            const script = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Collections.Generic;
        using System.Runtime.InteropServices;
        using System.Text;
        
        public class AudioDevices {
            [DllImport("winmm.dll", SetLastError = true)]
            static extern uint waveInGetNumDevs();
            
            [DllImport("winmm.dll", SetLastError = true, CharSet = CharSet.Auto)]
            static extern uint waveInGetDevCaps(uint uDeviceID, ref WAVEINCAPS pwic, uint cbwic);
            
            [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
            public struct WAVEINCAPS {
                public ushort wMid;
                public ushort wPid;
                public uint vDriverVersion;
                [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
                public string szPname;
                public uint dwFormats;
                public ushort wChannels;
                public ushort wReserved1;
            }
            
            public static List<string> GetDevices() {
                var devices = new List<string>();
                uint numDevs = waveInGetNumDevs();
                for (uint i = 0; i < numDevs; i++) {
                    WAVEINCAPS caps = new WAVEINCAPS();
                    if (waveInGetDevCaps(i, ref caps, (uint)Marshal.SizeOf(caps)) == 0) {
                        devices.Add(caps.szPname);
                    }
                }
                return devices;
            }
        }
"@
        [AudioDevices]::GetDevices() | ConvertTo-Json
      `;
            const ps = (0, child_process_1.spawn)('powershell.exe', ['-Command', script]);
            let output = '';
            ps.stdout.on('data', (data) => {
                output += data.toString();
            });
            ps.on('close', (code) => {
                if (code === 0) {
                    try {
                        const devices = JSON.parse(output);
                        resolve(devices);
                    }
                    catch {
                        resolve([]);
                    }
                }
                else {
                    reject(new Error('Failed to list audio devices'));
                }
            });
        });
    }
}
exports.AudioCaptureWindows = AudioCaptureWindows;
exports.default = AudioCaptureWindows;
