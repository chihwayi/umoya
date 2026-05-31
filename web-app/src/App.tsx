import React, { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { authAPI } from './services/api';
import { NotificationProvider } from './contexts/NotificationContext';
import { startSessionGuard, stopSessionGuard } from './utils/sessionGuard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const authed = authAPI.isAuthenticated();
    setIsAuthenticated(authed);
    if (authed) startSessionGuard();
    setLoading(false);
    return () => stopSessionGuard();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    startSessionGuard();
  };

  const handleLogout = () => {
    stopSessionGuard();
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <div className="App">
        {isAuthenticated ? (
          <Dashboard onLogout={handleLogout} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </div>
    </NotificationProvider>
  );
}

export default App;