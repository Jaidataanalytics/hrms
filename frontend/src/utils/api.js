// Universal API client — uses standard fetch everywhere.
// In Capacitor (CapacitorHttp disabled): WebView's native fetch handles CORS + cookies.
// On web (with Proxy in index.js): Proxy handles body-already-read from platform interceptor.

// Get auth headers from stored token — used across all pages
export const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

let _isNative = false;
try { _isNative = !!window.Capacitor?.isNativePlatform?.(); } catch {}
export const isNative = _isNative;

export async function apiRequest(url, options = {}) {
  const token = localStorage.getItem('access_token');
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(url, { ...options, method, headers });
  } catch (err) {
    throw new Error('Cannot reach server. Check your internet connection.');
  }

  // Parse response body
  let data = null;
  try {
    // Use json() directly — simplest and most reliable
    data = await response.json();
  } catch {
    // json() failed — response might not be JSON
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
