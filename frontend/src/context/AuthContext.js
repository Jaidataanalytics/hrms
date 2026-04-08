import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// Robust response parser — works in all environments:
// - Capacitor with CapacitorHttp (native HTTP, standard-like Response)
// - Web with fetch Proxy (clone-based access to body)
// - Web with interceptor (body may be pre-consumed)
async function parseRes(response) {
  let rawText = '';
  // Strategy 1: direct json — simplest, works with CapacitorHttp and standard fetch
  try {
    return await response.json();
  } catch { /* fall through */ }
  // Strategy 2: clone + text (works through web Proxy — creates fresh clone from original)
  try {
    rawText = await response.clone().text();
    if (rawText) return JSON.parse(rawText);
  } catch { /* fall through */ }
  // Strategy 3: direct text
  try {
    rawText = await response.text();
    if (rawText) return JSON.parse(rawText);
  } catch { /* fall through */ }
  // All strategies failed — log for debugging (visible in Android Studio logcat)
  console.warn('[parseRes] Failed to parse response. Status:', response.status, 'Raw:', rawText?.substring(0, 200));
  return null;
}

// Get auth headers from stored token
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
    // Google OAuth callback — skip auth check, AuthCallback handles it
    if (location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    // User passed from AuthCallback via navigation state
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
    // Validate stored token
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await parseRes(res);
          if (data && data.email) { setUser(data); }
          else { localStorage.removeItem('access_token'); }
        } else {
          localStorage.removeItem('access_token');
        }
      } catch {
        // Network error — keep token (mobile may have intermittent connectivity)
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
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await parseRes(res);
          if (data?.access_token) localStorage.setItem('access_token', data.access_token);
        }
        // Never log out on refresh failure — stale tokens are caught by /auth/me on next page load
      } catch { /* network error — retry next cycle */ }
    }, REFRESH_INTERVAL);
    return () => clearInterval(refreshRef.current);
  }, [user]);

  // ─── Login ───
  const login = async (email, password) => {
    let res;
    try {
      res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (networkErr) {
      console.error('[login] Network error:', networkErr);
      throw new Error('Cannot reach server. Check your internet connection.');
    }
    const data = await parseRes(res);
    if (!res.ok) throw new Error(data?.detail || 'Login failed');
    if (!data?.access_token) {
      console.error('[login] Missing access_token. Status:', res.status, 'Data:', data);
      throw new Error('Unexpected server response. Please try again.');
    }

    localStorage.setItem('access_token', data.access_token);
    if (data.user && !data.must_change_password) {
      setUser(data.user);
    }
    return data;
  };

  // ─── Register ───
  const register = async (name, email, password) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await parseRes(res);
    if (!res.ok) throw new Error(data?.detail || 'Registration failed');
    if (data?.user) setUser(data.user);
    if (data?.access_token) localStorage.setItem('access_token', data.access_token);
    return data;
  };

  // ─── Google OAuth ───
  const processGoogleSession = async (sessionId) => {
    const res = await fetch(`${API_URL}/auth/google-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await parseRes(res);
    if (!res.ok) throw new Error(data?.detail || 'Google authentication failed');
    if (data) setUser(data);
    return data;
  };

  const loginWithGoogle = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  // ─── Check auth (callable from components) ───
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await parseRes(res);
        if (data) { setUser(data); return; }
      }
      setUser(null);
      localStorage.removeItem('access_token');
    } catch { /* keep current state on network error */ }
  }, []);

  // ─── Manual refresh (callable from components) ───
  const refreshToken = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await parseRes(res);
        if (data?.access_token) localStorage.setItem('access_token', data.access_token);
      }
    } catch { /* silent */ }
  }, []);

  // ─── Logout ───
  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: getAuthHeaders() });
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
