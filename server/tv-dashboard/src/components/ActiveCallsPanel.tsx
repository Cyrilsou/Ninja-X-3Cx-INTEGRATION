import { Paper, Typography, Box, Chip, Avatar } from '@mui/material'
import { Phone, PhoneForwarded, Timer } from '@mui/icons-material'
import { Call } from '@/types'

interface ActiveCallsPanelProps {
  calls: Call[]
}

export default function ActiveCallsPanel({ calls }: ActiveCallsPanelProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Paper sx={{ height: '100%', p: 3, overflow: 'hidden' }}>
      <Box display="flex" alignItems="center" mb={3}>
        <Phone sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4">Active Calls</Typography>
        <Chip
          label={calls.length}
          color="primary"
          sx={{ ml: 2 }}
          size="medium"
        />
      </Box>

      <Box sx={{ overflow: 'auto', height: 'calc(100% - 80px)' }}>
        {calls.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100%"
            sx={{ opacity: 0.5 }}
          >
            <Phone sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h6">No active calls</Typography>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={2}>
            {calls.map((call) => (
              <Paper
                key={call.id}
                elevation={3}
                sx={{
                  p: 2,
                  background: 'linear-gradient(135deg, rgba(0,188,212,0.1) 0%, rgba(0,0,0,0) 100%)',
                  border: '1px solid rgba(0,188,212,0.3)',
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {call.agentName?.[0] || call.extension[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight="medium">
                        {call.agentName || `Agent ${call.extension}`}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        {call.direction === 'Inbound' ? (
                          <Phone sx={{ fontSize: 16 }} />
                        ) : (
                          <PhoneForwarded sx={{ fontSize: 16 }} />
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {call.callerNumber}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    <Timer />
                    <Typography variant="h6" fontWeight="medium" color="primary">
                      {formatDuration(call.duration)}
                    </Typography>
                  </Box>
                </Box>

                {call.queueTime && call.queueTime > 0 && (
                  <Box mt={1}>
                    <Typography variant="caption" color="text.secondary">
                      Queue time: {formatDuration(call.queueTime)}
                    </Typography>
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  )
}