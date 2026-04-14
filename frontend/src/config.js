// Central config — single source of truth for the backend URL.
// CRA embeds REACT_APP_* vars at build time from .env / .env.production.
// In Capacitor, if the env var is missing, fall back to production.

let _isNative = false;
try { _isNative = !!window.Capacitor?.isNativePlatform?.(); } catch {}

const PRODUCTION_URL = 'https://sharda-hr-system.emergent.host';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (_isNative ? PRODUCTION_URL : '');

export const API_URL = BACKEND_URL + '/api';
export const BACKEND_BASE = BACKEND_URL;
export const isNative = _isNative;
