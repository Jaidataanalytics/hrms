// Safe API response handler to prevent "body stream already read" errors
export const safeJsonParse = async (response) => {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse response:', error);
    return null;
  }
};

// Get authentication headers from localStorage
export const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// API fetch wrapper with automatic JSON parsing and auth headers
export const apiFetch = async (url, options = {}) => {
  const authHeaders = getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
  
  const data = await safeJsonParse(response);
  
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
};

// Make authenticated fetch with headers (returns raw response)
export const authFetch = async (url, options = {}) => {
  const authHeaders = getAuthHeaders();
  
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
};

