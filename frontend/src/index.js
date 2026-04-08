import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// --- Global Fetch Patch ---
// Needed ONLY on the Emergent web platform where emergent-main.js can consume
// response bodies. In Capacitor mobile, there is no interceptor, so skip entirely.
(function patchFetch() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return;
  } catch { /* not in Capacitor */ }

  const _nativeFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _nativeFetch.apply(this, args);
    try {
      const clone = response.clone();
      return new Proxy(response, {
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
    } catch {
      return response;
    }
  };
})();

// Suppress benign ResizeObserver loop errors (Radix UI)
const reObs = /ResizeObserver loop/;
const _err = console.error;
console.error = (...a) => { if (typeof a[0] === 'string' && reObs.test(a[0])) return; _err.apply(console, a); };
window.addEventListener('error', (e) => { if (e.message && reObs.test(e.message)) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
