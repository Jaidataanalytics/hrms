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

// API fetch wrapper with automatic JSON parsing
export const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });
  
  const data = await safeJsonParse(response);
  
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
};
