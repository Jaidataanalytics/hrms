import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

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
