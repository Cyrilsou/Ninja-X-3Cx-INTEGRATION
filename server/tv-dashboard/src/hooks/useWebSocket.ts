'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { WebSocketMessage } from '@/types'

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void
  reconnectInterval?: number
}

export default function useWebSocket({
  onMessage,
  reconnectInterval = 5000,
}: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    try {
      // Get WebSocket URL from environment or use default
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3003/tv'
      
      // Request TV token first (in production, this would be authenticated)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        
        // Send initial authentication/registration
        ws.send(JSON.stringify({
          type: 'register',
          clientType: 'tv'
        }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage
          setLastMessage(message)
          onMessage?.(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        wsRef.current = null
        
        // Schedule reconnection
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      
      // Schedule reconnection
      reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval)
    }
  }, [onMessage, reconnectInterval])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  return {
    isConnected,
    lastMessage,
    sendMessage,
  }
}