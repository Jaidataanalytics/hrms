import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { API_URL } from '../config';
const REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// Get auth headers (for pages that still use raw fetch)
const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const refreshRef = useRef(null);

  // ─── Initial auth check on mount ───
  useEffect(() => {
    // Google OAuth callback — skip auth check
    if (location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    // User passed from AuthCallback
    if (location.state?.user) {
      setUser(location.state.user);
      setLoading(false);
      return;
    }
    // No stored token — not logged in
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    // Validate stored token via /auth/me
    (async () => {
      try {
        const { ok, data } = await apiRequest(`${API_URL}/auth/me`);
        if (ok && data && data.email) {
          setUser(data);
        } else {
          localStorage.removeItem('access_token');
        }
      } catch {
        // Network error — keep token, mobile may reconnect
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Token refresh interval ───
  useEffect(() => {
    if (!user) return;
    refreshRef.current = setInterval(async () => {
      try {
        const { ok, data } = await apiRequest(`${API_URL}/auth/refresh`, { method: 'POST' });
        if (ok && data?.access_token) {
          localStorage.setItem('access_token', data.access_token);
        }
      } catch { /* retry next cycle */ }
    }, REFRESH_INTERVAL);
    return () => clearInterval(refreshRef.current);
  }, [user]);

  // ─── Login ───
  const login = async (email, password) => {
    const { ok, status, data } = await apiRequest(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!ok) {
      // Show the exact error from backend (e.g. "Invalid email or password", "Account is deactivated")
      throw new Error(data?.detail || `Login failed (${status})`);
    }
    if (!data?.access_token) {
      // This means we got 200 but no token — log full details for debugging
      const preview = typeof data === 'string' ? data.substring(0, 100) : JSON.stringify(data)?.substring(0, 100);
      console.error('[login] No access_token in response. Status:', status, 'Preview:', preview);
      throw new Error('Invalid response from server. Check app version.');
    }

    localStorage.setItem('access_token', data.access_token);
    if (data.user && !data.must_change_password) {
      setUser(data.user);
    }
    return data;
  };

  // ─── Register ───
  const register = async (name, email, password) => {
    const { ok, data } = await apiRequest(`${API_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (!ok) throw new Error(data?.detail || 'Registration failed');
    if (data?.user) setUser(data.user);
    if (data?.access_token) localStorage.setItem('access_token', data.access_token);
    return data;
  };

  // ─── Google OAuth ───
  const processGoogleSession = async (sessionId) => {
    const { ok, data } = await apiRequest(`${API_URL}/auth/google-session`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!ok) throw new Error(data?.detail || 'Google authentication failed');
    if (data) setUser(data);
    return data;
  };

  const loginWithGoogle = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  // ─── Check auth (callable from components) ───
  const checkAuth = useCallback(async () => {
    try {
      const { ok, data } = await apiRequest(`${API_URL}/auth/me`);
      if (ok && data && data.email) {
        setUser(data);
        return;
      }
      setUser(null);
      localStorage.removeItem('access_token');
    } catch { /* keep current state */ }
  }, []);

  // ─── Manual refresh (callable from components) ───
  const refreshToken = useCallback(async () => {
    try {
      const { ok, data } = await apiRequest(`${API_URL}/auth/refresh`, { method: 'POST' });
      if (ok && data?.access_token) {
        localStorage.setItem('access_token', data.access_token);
      }
    } catch { /* silent */ }
  }, []);

  // ─── Logout ───
  const logout = async () => {
    try {
      await apiRequest(`${API_URL}/auth/logout`, { method: 'POST' });
    } catch { /* ignore */ }
    setUser(null);
    localStorage.removeItem('access_token');
    clearInterval(refreshRef.current);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithGoogle, processGoogleSession, checkAuth, refreshToken, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};
