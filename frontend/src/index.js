import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver loop error - this is a benign error from Radix UI components
// It doesn't affect functionality and is caused by the way ResizeObserver handles rapid resizes
const resizeObserverError = /ResizeObserver loop/;
const originalError = console.error;
console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && resizeObserverError.test(args[0])) {
    return;
  }
  originalError.apply(console, args);
};

// Also suppress in window error handler
window.addEventListener('error', (event) => {
  if (event.message && resizeObserverError.test(event.message)) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return false;
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <App />
);
