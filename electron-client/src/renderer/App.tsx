import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import { AuthContext } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

interface AuthState {
  isAuthenticated: boolean;
  extension?: string;
  agentName?: string;
  token?: string;
}

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({ isAuthenticated: false });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check initial auth state
    checkAuthState();

    // Listen for auth events
    window.electronAPI.on('auth-success', handleAuthSuccess);
    window.electronAPI.on('navigate', handleNavigate);

    return () => {
      window.electronAPI.removeListener('auth-success', handleAuthSuccess);
      window.electronAPI.removeListener('navigate', handleNavigate);
    };
  }, []);

  const checkAuthState = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      if (config.extension) {
        setAuthState({
          isAuthenticated: true,
          extension: config.extension,
          agentName: config.agentName
        });
      }
    } catch (error) {
      console.error('Failed to check auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (data: any) => {
    setAuthState({
      isAuthenticated: true,
      extension: data.extension,
      agentName: data.agentName,
      token: data.token
    });
    navigate('/dashboard');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const login = async (extension: string, agentName?: string) => {
    const result = await window.electronAPI.login({ extension, agentName });
    if (result.success) {
      setAuthState({
        isAuthenticated: true,
        extension,
        agentName,
        token: result.token
      });
      return true;
    }
    throw new Error(result.error || 'Login failed');
  };

  const logout = async () => {
    await window.electronAPI.logout();
    setAuthState({ isAuthenticated: false });
    navigate('/login');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      <NotificationProvider>
        <Routes>
          <Route path="/login" element={
            authState.isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />
          } />
          
          <Route element={
            authState.isAuthenticated ? <Layout /> : <Navigate to="/login" />
          }>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          
          <Route path="/" element={
            <Navigate to={authState.isAuthenticated ? "/dashboard" : "/login"} />
          } />
        </Routes>
      </NotificationProvider>
    </AuthContext.Provider>
  );
};

export default App;