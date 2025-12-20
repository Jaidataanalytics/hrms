import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  const abortControllerRef = useRef(null);

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

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
          signal: abortControllerRef.current.signal
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
        // Ignore abort errors
        if (error.name === 'AbortError') {
          return;
        }
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

    // Cleanup function to abort pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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

      // Read body once
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      setUser(data.user);
      
      // Store token for API calls
      localStorage.setItem('access_token', data.access_token);
      
      return data;
    } catch (error) {
      // Handle network errors or JSON parse errors
      if (error.name === 'SyntaxError') {
        throw new Error('Server error - please try again');
      }
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

      // Read body once
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      setUser(data.user);
      localStorage.setItem('access_token', data.access_token);
      
      return data;
    } catch (error) {
      if (error.name === 'SyntaxError') {
        throw new Error('Server error - please try again');
      }
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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Google authentication failed');
      }

      setUser(data);
      
      return data;
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
