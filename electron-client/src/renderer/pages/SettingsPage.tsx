import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Grid,
  Divider,
  Alert
} from '@mui/material';
import { Save, Restore } from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';

interface Settings {
  serverUrl: string;
  autoLaunch: boolean;
  minimizeToTray: boolean;
  notifications: boolean;
}

const SettingsPage: React.FC = () => {
  const { showNotification } = useNotification();
  const [settings, setSettings] = useState<Settings>({
    serverUrl: '',
    autoLaunch: true,
    minimizeToTray: true,
    notifications: true
  });
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const config = await window.electronAPI.getConfig();
    setSettings({
      serverUrl: config.serverUrl || 'http://localhost:3002',
      autoLaunch: config.autoLaunch ?? true,
      minimizeToTray: config.minimizeToTray ?? true,
      notifications: config.notifications ?? true
    });
  };

  const handleChange = (field: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await window.electronAPI.saveConfig(settings);
      showNotification('Settings saved successfully', 'success');
      setHasChanges(false);
    } catch (error) {
      showNotification('Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    loadSettings();
    setHasChanges(false);
    showNotification('Settings reset', 'info');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Connection Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <TextField
              fullWidth
              label="Server URL"
              value={settings.serverUrl}
              onChange={(e) => handleChange('serverUrl', e.target.value)}
              helperText="The URL of the orchestrator server"
              sx={{ mb: 3 }}
            />

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Application Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoLaunch}
                  onChange={(e) => handleChange('autoLaunch', e.target.checked)}
                />
              }
              label="Launch on system startup"
              sx={{ mb: 2, display: 'block' }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.minimizeToTray}
                  onChange={(e) => handleChange('minimizeToTray', e.target.checked)}
                />
              }
              label="Minimize to system tray"
              sx={{ mb: 2, display: 'block' }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications}
                  onChange={(e) => handleChange('notifications', e.target.checked)}
                />
              }
              label="Show desktop notifications"
              sx={{ mb: 2, display: 'block' }}
            />

            <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={loading || !hasChanges}
                startIcon={<Save />}
              >
                Save Settings
              </Button>
              
              <Button
                variant="outlined"
                onClick={handleReset}
                disabled={loading || !hasChanges}
                startIcon={<Restore />}
              >
                Reset
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              About
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" paragraph>
              <strong>3CX NinjaOne Agent</strong><br />
              Version 1.0.0
            </Typography>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              This application receives call drafts from the 3CX system and allows
              agents to review and create tickets in NinjaOne.
            </Typography>
            
            <Alert severity="info" sx={{ mt: 2 }}>
              The application will automatically check for updates on startup.
            </Alert>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SettingsPage;