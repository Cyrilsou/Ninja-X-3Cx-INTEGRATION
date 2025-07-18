import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  CircularProgress,
  Alert
} from '@mui/material';
import { Phone, Person } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [extension, setExtension] = useState('');
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!extension) {
      setError('Extension is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(extension, agentName);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography component="h1" variant="h4" gutterBottom>
              3CX NinjaOne Agent
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Login with your extension to start receiving call drafts
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="extension"
              label="Extension Number"
              name="extension"
              autoComplete="tel"
              autoFocus
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: <Phone sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
            
            <TextField
              margin="normal"
              fullWidth
              id="agentName"
              label="Agent Name (Optional)"
              name="agentName"
              autoComplete="name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading || !extension}
            >
              {loading ? <CircularProgress size={24} /> : 'Login'}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
            Your extension will be used to route call drafts to you
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;