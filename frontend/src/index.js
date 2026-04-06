import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// --- Global Fetch Patch ---
// The Emergent platform injects emergent-main.js which wraps window.fetch and may
// consume response bodies for analytics. This causes "body stream already read" errors
// when app code calls response.json(). This patch ensures every fetch response has
// a readable body by caching it upfront.
// SKIP in Capacitor mobile — no emergent-main.js in the APK, and the Proxy
// breaks response.clone() in some Android WebView implementations.
(function patchFetch() {
  if (window.Capacitor?.isNativePlatform?.()) return;

  const _nativeFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _nativeFetch.apply(this, args);
    try {
      const clone = response.clone();
      const patched = new Proxy(response, {
        get(target, prop) {
          if (prop === 'json') return () => clone.json();
          if (prop === 'text') return () => clone.text();
          if (prop === 'blob') return () => clone.blob();
          if (prop === 'arrayBuffer') return () => clone.arrayBuffer();
          if (prop === 'clone') return () => target.clone();
          const val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
      return patched;
    } catch {
      return response;
    }
  };
})();

// Suppress ResizeObserver loop error - this is a benign error from Radix UI components
// It doesn't affect functionality and is caused by the way ResizeObserver handles rapid resizes
const resizeObserverError = /ResizeObserver loop/;

// Suppress in console.error
const originalError = console.error;
console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && resizeObserverError.test(args[0])) {
    return;
  }
  originalError.apply(console, args);
};

// Suppress in window error handler - must use capture phase to intercept before React
window.addEventListener('error', (event) => {
  if (event.message && resizeObserverError.test(event.message)) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return false;
  }
}, true);

// Also suppress unhandled rejection for ResizeObserver
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && resizeObserverError.test(event.reason.message)) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return false;
  }
}, true);

// Patch ResizeObserver to prevent the loop error entirely
const OriginalResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
  constructor(callback) {
    super((entries, observer) => {
      // Use requestAnimationFrame to prevent loop errors
      window.requestAnimationFrame(() => {
        try {
          callback(entries, observer);
        } catch (e) {
          // Silently ignore ResizeObserver errors
        }
      });
    });
  }
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <App />
);
