import { Chip } from '@mui/material'
import { Circle } from '@mui/icons-material'

interface ConnectionStatusProps {
  isConnected: boolean
}

export default function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  return (
    <Chip
      icon={<Circle sx={{ fontSize: 12 }} />}
      label={isConnected ? 'Connected' : 'Disconnected'}
      color={isConnected ? 'success' : 'error'}
      size="medium"
      variant="outlined"
      sx={{
        animation: !isConnected ? 'pulse 2s infinite' : 'none',
        '@keyframes pulse': {
          '0%': { opacity: 1 },
          '50%': { opacity: 0.5 },
          '100%': { opacity: 1 },
        },
      }}
    />
  )
}