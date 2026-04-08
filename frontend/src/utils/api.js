// Universal API client
// With CapacitorHttp enabled in capacitor.config.json, Capacitor patches
// window.fetch to use native HTTP automatically. So we just use fetch
// everywhere — no direct CapacitorHttp calls, no dynamic imports.

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
    // fetch threw — genuine network error
    console.error('[apiRequest] fetch error:', err?.message || err);
    throw new Error('Cannot reach server. Check your internet connection.');
  }

  // Parse response body — try text first (most reliable), then json
  let data = null;
  try {
    const text = await response.text();
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = null; } // Response was not JSON (e.g. HTML)
    }
  } catch {
    // text() failed — try json() as fallback
    try { data = await response.json(); }
    catch { data = null; }
  }

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    data,
  };
}
