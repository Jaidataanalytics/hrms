import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Token refresh interval (every 25 minutes - before typical 30 min server timeout)
const TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000;
// Activity check interval (every 5 minutes)
const ACTIVITY_CHECK_INTERVAL = 5 * 60 * 1000;

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

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs to prevent race conditions
  const authCheckInProgress = useRef(false);
  const initialCheckDone = useRef(false);
  const refreshIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isRefreshing = useRef(false);

  // Track user activity
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Add activity listeners
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));
    
    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [updateActivity]);

  // Refresh token to extend session
  const refreshToken = useCallback(async () => {
    // Skip if no user or already refreshing
    if (!user || isRefreshing.current) return;
    
    // Only refresh if there was recent activity (within last 30 mins)
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    if (timeSinceActivity > 30 * 60 * 1000) {
      console.log('No recent activity, skipping token refresh');
      return;
    }
    
    isRefreshing.current = true;
    
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await safeParseJson(response);
        if (data?.access_token) {
          localStorage.setItem('access_token', data.access_token);
          console.log('Token refreshed successfully');
        }
      } else if (response.status === 401) {
        // Session expired, redirect to login
        console.log('Session expired during refresh');
        setUser(null);
        localStorage.removeItem('access_token');
        navigate('/login');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, [user, navigate]);

  // Set up automatic token refresh
  useEffect(() => {
    if (user) {
      // Refresh immediately when user logs in
      refreshToken();
      
      // Set up interval for periodic refresh
      refreshIntervalRef.current = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [user, refreshToken]);

  // Handle visibility change (tab focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Tab became visible, check if we need to refresh
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        if (timeSinceActivity > 5 * 60 * 1000) { // More than 5 mins
          refreshToken();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, refreshToken]);

  // Check authentication status
  const checkAuth = useCallback(async (forceCheck = false) => {
    // Skip if already checking
    if (authCheckInProgress.current) {
      return;
    }
    
    // Skip if already done initial check (unless forced)
    if (initialCheckDone.current && !forceCheck) {
      return;
    }

    const publicPaths = ['/', '/login', '/register', '/auth/callback'];
    const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));
    
    authCheckInProgress.current = true;

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await safeParseJson(response);
        if (userData) {
          setUser(userData);
          lastActivityRef.current = Date.now();
        }
      } else {
        setUser(null);
        localStorage.removeItem('access_token');
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
      lastActivityRef.current = Date.now();
      return;
    }

    checkAuth();
  }, []); // Only run on mount

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
      lastActivityRef.current = Date.now();
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
      lastActivityRef.current = Date.now();
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
      lastActivityRef.current = Date.now();
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
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
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
    refreshToken, // Expose this so components can manually refresh if needed
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
