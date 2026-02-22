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

// Initialize log collector early to capture all logs
import './utils/logCollector'

// Load Eruda dynamically for mobile debugging
// Only loads if ?eruda=true is in URL, or on localhost/network IP
if (typeof window !== 'undefined') {
  const shouldLoadEruda =
    window.location.search.includes('eruda=true') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname.includes('192.168.') ||
    window.location.hostname.includes('127.0.0.1')

  if (shouldLoadEruda) {
    // Initialize Eruda immediately with inline script to capture early logs
    const initEruda = () => {
      if ((window as any).eruda) {
        (window as any).eruda.init()
        console.log('✅ Eruda console initialized')
        // Force Eruda to refresh its log display after a short delay
        setTimeout(() => {
          try {
            if ((window as any).eruda?._console) {
              (window as any).eruda._console._refresh()
            }
            // Also try to show Eruda if it's hidden
            if ((window as any).eruda?._tool) {
              (window as any).eruda._tool.show()
            }
          } catch (e) {
            // Ignore errors
          }
        }, 200)
      }
    }
    
    // Check if Eruda is already loaded
    if ((window as any).eruda) {
      initEruda()
    } else {
      // Dynamically load Eruda from CDN
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/eruda'
      script.onload = initEruda
      script.onerror = () => {
        console.error('❌ Failed to load Eruda')
      }
      document.head.appendChild(script)
    }
  }
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






