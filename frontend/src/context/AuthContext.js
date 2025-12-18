import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Check authentication status on mount
  useEffect(() => {
    // Skip auth check if we're on public routes or processing session_id
    const publicPaths = ['/', '/login', '/register'];
    const isPublicPath = publicPaths.includes(location.pathname);
    const hasSessionId = location.hash?.includes('session_id=');
    
    if (hasSessionId) {
      setLoading(false);
      return;
    }

    // If user data was passed from AuthCallback, use it
    if (location.state?.user) {
      setUser(location.state.user);
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
          if (!isPublicPath) {
            navigate('/login');
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
        if (!isPublicPath) {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [location.pathname]);

  // Login with email/password
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      setUser(data.user);
      
      // Store token for API calls
      localStorage.setItem('access_token', data.access_token);
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Register new user
  const register = async (name, email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('access_token', data.access_token);
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Process Google OAuth session
  const processGoogleSession = async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/auth/google-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Google authentication failed');
      }

      const userData = await response.json();
      setUser(userData);
      
      return userData;
    } catch (error) {
      throw error;
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('access_token');
      navigate('/login');
    }
  };

  // Start Google OAuth flow
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const loginWithGoogle = () => {
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const value = {
    user,
    setUser,
    loading,
    login,
    register,
    logout,
    loginWithGoogle,
    processGoogleSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
