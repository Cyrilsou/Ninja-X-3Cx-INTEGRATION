import { useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export const useAudioCapture = (socket: Socket | null) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProcess, setCaptureProcess] = useState<any>(null);

  const startCapture = useCallback(async (callId: string) => {
    if (!socket || isCapturing) return;

    try {
      // En Electron, on utilise l'IPC pour démarrer la capture côté main process
      const result = await window.electron.audio.startCapture(callId);
      
      if (result.success) {
        setIsCapturing(true);
        setCaptureProcess(result.processId);
      }
    } catch (error) {
      console.error('Failed to start audio capture:', error);
    }
  }, [socket, isCapturing]);

  const stopCapture = useCallback(async () => {
    if (!isCapturing) return;

    try {
      await window.electron.audio.stopCapture();
      setIsCapturing(false);
      setCaptureProcess(null);
    } catch (error) {
      console.error('Failed to stop audio capture:', error);
    }
  }, [isCapturing]);

  return { startCapture, stopCapture, isCapturing };
};