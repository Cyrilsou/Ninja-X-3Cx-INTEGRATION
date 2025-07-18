import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Chip,
  Avatar
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Settings,
  Logout,
  Circle
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { extension, agentName, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    // Listen for WebSocket status
    window.electronAPI.on('ws-connected', () => setWsConnected(true));
    window.electronAPI.on('ws-disconnected', () => setWsConnected(false));
    
    return () => {
      window.electronAPI.removeListener('ws-connected', () => {});
      window.electronAPI.removeListener('ws-disconnected', () => {});
    };
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Settings', icon: <Settings />, path: '/settings' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed">
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            3CX NinjaOne Agent
          </Typography>
          
          <Chip
            icon={<Circle sx={{ fontSize: 12 }} />}
            label={wsConnected ? 'Connected' : 'Disconnected'}
            color={wsConnected ? 'success' : 'error'}
            size="small"
            sx={{ mr: 2 }}
          />
          
          <Typography variant="body2" sx={{ mr: 2 }}>
            {agentName || extension}
          </Typography>
          
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
            {(agentName || extension || 'A')[0].toUpperCase()}
          </Avatar>
        </Toolbar>
      </AppBar>
      
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 250 }} role="presentation">
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">Agent Menu</Typography>
            <Typography variant="body2" color="text.secondary">
              Ext: {extension}
            </Typography>
          </Box>
          
          <Divider />
          
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => {
                    navigate(item.path);
                    setDrawerOpen(false);
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          
          <Divider />
          
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon><Logout /></ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;