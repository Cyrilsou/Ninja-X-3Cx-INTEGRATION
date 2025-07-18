'use client'

import { useEffect, useState } from 'react'
import { Box, Grid, Typography, Paper, Chip } from '@mui/material'
import ActiveCallsPanel from '@/components/ActiveCallsPanel'
import RecentTicketsPanel from '@/components/RecentTicketsPanel'
import StatsPanel from '@/components/StatsPanel'
import ConnectionStatus from '@/components/ConnectionStatus'
import useWebSocket from '@/hooks/useWebSocket'
import { Call, Ticket, Stats } from '@/types'

export default function Dashboard() {
  const [activeCalls, setActiveCalls] = useState<Call[]>([])
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<Stats>({
    totalCallsToday: 0,
    averageCallDuration: 0,
    ticketsCreated: 0,
    pendingDrafts: 0,
  })

  const { isConnected, lastMessage } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'tvUpdate':
          handleTvUpdate(message.data)
          break
        case 'activeConnections':
          // Handle active connections update
          break
        default:
          console.log('Unknown message type:', message.type)
      }
    },
  })

  const handleTvUpdate = (data: any) => {
    if (data.activeCalls) {
      setActiveCalls(data.activeCalls)
    }
    if (data.recentTickets) {
      setRecentTickets(data.recentTickets)
    }
    if (data.stats) {
      setStats(data.stats)
    }
  }

  // Simulate data for demo
  useEffect(() => {
    const demoInterval = setInterval(() => {
      // Add random active call
      if (Math.random() > 0.7 && activeCalls.length < 5) {
        const newCall: Call = {
          id: `call-${Date.now()}`,
          extension: `10${Math.floor(Math.random() * 100)}`,
          agentName: ['John Doe', 'Jane Smith', 'Bob Wilson'][Math.floor(Math.random() * 3)],
          callerNumber: `+1555${Math.floor(Math.random() * 10000000)}`,
          direction: Math.random() > 0.5 ? 'Inbound' : 'Outbound',
          duration: 0,
          startTime: new Date().toISOString(),
        }
        setActiveCalls(prev => [...prev, newCall])
      }

      // Update call durations
      setActiveCalls(prev => prev.map(call => ({
        ...call,
        duration: call.duration + 1
      })))

      // Remove old calls
      setActiveCalls(prev => prev.filter(call => call.duration < 300))

      // Update stats
      setStats(prev => ({
        ...prev,
        totalCallsToday: prev.totalCallsToday + (Math.random() > 0.9 ? 1 : 0),
        averageCallDuration: Math.floor(180 + Math.random() * 120),
      }))
    }, 1000)

    return () => clearInterval(demoInterval)
  }, [activeCalls.length])

  return (
    <Box sx={{ height: '100vh', p: 3, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h3" component="h1" fontWeight="bold" className="burn-in-protection">
          Call Center Dashboard
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Typography variant="h5" color="text.secondary">
            {new Date().toLocaleTimeString()}
          </Typography>
          <ConnectionStatus isConnected={isConnected} />
        </Box>
      </Box>

      {/* Main Grid */}
      <Grid container spacing={3} sx={{ height: 'calc(100% - 80px)' }}>
        {/* Left Column - Active Calls */}
        <Grid item xs={12} md={5}>
          <ActiveCallsPanel calls={activeCalls} />
        </Grid>

        {/* Middle Column - Stats */}
        <Grid item xs={12} md={3}>
          <StatsPanel stats={stats} />
        </Grid>

        {/* Right Column - Recent Tickets */}
        <Grid item xs={12} md={4}>
          <RecentTicketsPanel tickets={recentTickets} />
        </Grid>
      </Grid>
    </Box>
  )
}