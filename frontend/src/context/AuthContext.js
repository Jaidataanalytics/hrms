import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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

// Safe JSON parse helper
const safeParseJson = async (response) => {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs to prevent race conditions
  const authCheckInProgress = useRef(false);
  const initialCheckDone = useRef(false);

  // Check authentication status
  const checkAuth = useCallback(async (forceCheck = false) => {
    // Skip if already checking or already done initial check (unless forced)
    if (authCheckInProgress.current || (initialCheckDone.current && !forceCheck)) {
      return;
    }

    const publicPaths = ['/', '/login', '/register'];
    const isPublicPath = publicPaths.includes(location.pathname);
    
    // Skip if on public path and we already have user state determined
    if (isPublicPath && initialCheckDone.current) {
      setLoading(false);
      return;
    }

    authCheckInProgress.current = true;

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await safeParseJson(response);
        if (userData) {
          setUser(userData);
        }
      } else {
        setUser(null);
        if (!isPublicPath) {
          navigate('/login');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      if (!isPublicPath) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
      authCheckInProgress.current = false;
      initialCheckDone.current = true;
    }
  }, [location.pathname, navigate]);

  // Initial auth check on mount
  useEffect(() => {
    // Handle session_id in hash (Google OAuth callback)
    if (location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }

    // Handle user passed from AuthCallback
    if (location.state?.user) {
      setUser(location.state.user);
      setLoading(false);
      initialCheckDone.current = true;
      return;
    }

    checkAuth();
  }, []);

  // Login with email/password
  const login = async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await safeParseJson(response);

    if (!response.ok) {
      throw new Error(data?.detail || 'Login failed');
    }

    if (data?.user) {
      setUser(data.user);
    }
    if (data?.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    initialCheckDone.current = true;

    return data;
  };

  // Register new user
  const register = async (name, email, password) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });

    const data = await safeParseJson(response);

    if (!response.ok) {
      throw new Error(data?.detail || 'Registration failed');
    }

    if (data?.user) {
      setUser(data.user);
    }
    if (data?.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    initialCheckDone.current = true;

    return data;
  };

  // Process Google OAuth session
  const processGoogleSession = async (sessionId) => {
    const response = await fetch(`${API_URL}/auth/google-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId }),
    });

    const data = await safeParseJson(response);

    if (!response.ok) {
      throw new Error(data?.detail || 'Google authentication failed');
    }

    if (data) {
      setUser(data);
    }
    initialCheckDone.current = true;

    return data;
  };

  // Initiate Google login
  const loginWithGoogle = () => {
    window.location.href = `${API_URL}/auth/google`;
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
      initialCheckDone.current = false;
      navigate('/login');
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    loginWithGoogle,
    processGoogleSession,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
