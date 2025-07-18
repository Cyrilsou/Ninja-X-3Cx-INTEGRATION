import React, { createContext, useContext } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  extension?: string;
  agentName?: string;
  token?: string;
  login: (extension: string, agentName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};