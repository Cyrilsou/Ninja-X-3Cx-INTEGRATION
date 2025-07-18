import { Paper, Typography, Box, Grid } from '@mui/material'
import {
  Phone,
  Timer,
  ConfirmationNumber,
  PendingActions,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material'
import { Stats } from '@/types'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

interface StatsPanelProps {
  stats: Stats
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  trend?: number
}

function StatCard({ title, value, icon, color, trend }: StatCardProps) {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        height: '100%',
        background: `linear-gradient(135deg, ${color}22 0%, rgba(0,0,0,0) 100%)`,
        border: `1px solid ${color}44`,
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
        <Box sx={{ color }}>{icon}</Box>
        {trend !== undefined && (
          <Box display="flex" alignItems="center">
            {trend > 0 ? (
              <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
            )}
            <Typography variant="caption" color={trend > 0 ? 'success.main' : 'error.main'}>
              {Math.abs(trend)}%
            </Typography>
          </Box>
        )}
      </Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Paper>
  )
}

// Generate mock data for the chart
const generateChartData = () => {
  const data = []
  const now = new Date()
  for (let i = 23; i >= 0; i--) {
    data.push({
      time: `${(now.getHours() - i + 24) % 24}:00`,
      calls: Math.floor(Math.random() * 50) + 20,
      tickets: Math.floor(Math.random() * 30) + 10,
    })
  }
  return data
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  const chartData = generateChartData()

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <StatCard
            title="Total Calls Today"
            value={stats.totalCallsToday}
            icon={<Phone />}
            color="#00bcd4"
            trend={12}
          />
        </Grid>
        <Grid item xs={12}>
          <StatCard
            title="Avg Call Duration"
            value={formatDuration(stats.averageCallDuration)}
            icon={<Timer />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12}>
          <StatCard
            title="Tickets Created"
            value={stats.ticketsCreated}
            icon={<ConfirmationNumber />}
            color="#ff4081"
            trend={-5}
          />
        </Grid>
        <Grid item xs={12}>
          <StatCard
            title="Pending Drafts"
            value={stats.pendingDrafts}
            icon={<PendingActions />}
            color="#ff9800"
          />
        </Grid>
      </Grid>

      {/* Activity Chart */}
      <Paper sx={{ p: 2, flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          24h Activity
        </Typography>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 4,
              }}
            />
            <Line
              type="monotone"
              dataKey="calls"
              stroke="#00bcd4"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="tickets"
              stroke="#ff4081"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>
    </Box>
  )
}