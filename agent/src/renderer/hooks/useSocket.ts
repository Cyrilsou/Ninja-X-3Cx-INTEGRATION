import { useState, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async (config: any) => {
    if (socket?.connected) {
      socket.disconnect();
    }

    const newSocket = io(config.server.url, {
      auth: {
        apiKey: config.server.apiKey
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      
      // S'identifier comme agent
      newSocket.emit('agent:connect', {
        agentId: config.agent.id || config.agent.email,
        email: config.agent.email,
        extension: config.agent.extension
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  return { socket, isConnected, connect, disconnect };
};