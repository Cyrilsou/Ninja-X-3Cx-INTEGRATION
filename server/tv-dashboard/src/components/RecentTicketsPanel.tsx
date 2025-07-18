import { Paper, Typography, Box, Chip, Stack } from '@mui/material'
import { ConfirmationNumber, AccessTime } from '@mui/icons-material'
import { Ticket } from '@/types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface RecentTicketsPanelProps {
  tickets: Ticket[]
}

export default function RecentTicketsPanel({ tickets }: RecentTicketsPanelProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'error'
      case 'HIGH':
        return 'warning'
      case 'NORMAL':
        return 'info'
      default:
        return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'primary'
      case 'IN_PROGRESS':
        return 'warning'
      case 'RESOLVED':
        return 'success'
      default:
        return 'default'
    }
  }

  return (
    <Paper sx={{ height: '100%', p: 3, overflow: 'hidden' }}>
      <Box display="flex" alignItems="center" mb={3}>
        <ConfirmationNumber sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4">Recent Tickets</Typography>
      </Box>

      <Box sx={{ overflow: 'auto', height: 'calc(100% - 80px)' }}>
        {tickets.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100%"
            sx={{ opacity: 0.5 }}
          >
            <ConfirmationNumber sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h6">No recent tickets</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {tickets.map((ticket) => (
              <Paper
                key={ticket.id}
                elevation={2}
                sx={{
                  p: 2,
                  background: 'linear-gradient(135deg, rgba(255,64,129,0.1) 0%, rgba(0,0,0,0) 100%)',
                  border: '1px solid rgba(255,64,129,0.3)',
                }}
              >
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" color="primary">
                    #{ticket.ticketNumber}
                  </Typography>
                  <Chip
                    label={ticket.priority}
                    size="small"
                    color={getPriorityColor(ticket.priority) as any}
                  />
                </Box>

                <Typography variant="body1" fontWeight="medium" gutterBottom>
                  {ticket.title}
                </Typography>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {ticket.agentName || 'Unassigned'}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AccessTime sx={{ fontSize: 14 }} />
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(ticket.createdAt).fromNow()}
                    </Typography>
                  </Box>
                </Box>

                {ticket.callDuration && (
                  <Typography variant="caption" color="text.secondary">
                    Call duration: {Math.floor(ticket.callDuration / 60)}m
                  </Typography>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </Box>
    </Paper>
  )
}