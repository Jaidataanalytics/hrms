// Universal API client — works in ALL environments
// Capacitor native: Uses CapacitorHttp directly (native Android HTTP, no WebView, no CORS, no Cloudflare issues)
// Web browser: Uses standard fetch with robust response parsing

let _isNative = false;
try { _isNative = !!window.Capacitor?.isNativePlatform?.(); } catch {}
export const isNative = _isNative;

// Get auth headers from stored token — used across all pages
export const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Normalize response to { ok, status, data }
export async function apiRequest(url, options = {}) {
  const token = localStorage.getItem('access_token');
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (isNative) {
    return nativeRequest(url, method, headers, options.body);
  } else {
    return webRequest(url, { ...options, method, headers });
  }
}

// ── Capacitor Native HTTP ──
// Calls Android's native HTTP client directly via CapacitorHttp
// No fetch, no Response object, no clone, no WebView quirks
async function nativeRequest(url, method, headers, body) {
  const { CapacitorHttp } = await import('@capacitor/core');

  let data = undefined;
  if (body) {
    try { data = typeof body === 'string' ? JSON.parse(body) : body; }
    catch { data = body; }
  }

  try {
    const res = await CapacitorHttp.request({ url, method, headers, data });
    // res.data is already parsed by CapacitorHttp (JSON → object, text → string)
    // res.status is the HTTP status code
    let parsedData = res.data;
    // If data came back as string, try parsing as JSON
    if (typeof parsedData === 'string') {
      try { parsedData = JSON.parse(parsedData); } catch {}
    }
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      data: parsedData,
    };
  } catch (err) {
    console.error('[apiRequest:native] Error:', err);
    throw new Error('Cannot reach server. Check your internet connection.');
  }
}

// ── Web Fetch ──
// Standard fetch with robust response parsing for web platform
async function webRequest(url, options) {
  const response = await fetch(url, options);
  let data = null;

  // Try parsing response body
  try {
    data = await response.clone().text();
    data = data ? JSON.parse(data) : null;
  } catch {
    try { data = await response.json(); }
    catch { data = null; }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
