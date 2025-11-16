// Suppress React Router v7 deprecation warnings
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = function(...args: any[]) {
    const message = args[0]?.toString() || '';
    if (
      message.includes('React Router Future Flag Warning') ||
      message.includes('v7_startTransition') ||
      message.includes('v7_relativeSplatPath')
    ) {
      return; // Suppress these warnings
    }
    originalWarn.apply(console, args);
  };
  
  // Also catch errors that might be logged as warnings
  console.error = function(...args: any[]) {
    const message = args[0]?.toString() || '';
    if (
      message.includes('React Router Future Flag Warning') ||
      message.includes('v7_startTransition') ||
      message.includes('v7_relativeSplatPath')
    ) {
      return; // Suppress these
    }
    originalError.apply(console, args);
  };
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)






