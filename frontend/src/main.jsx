import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/notification-sw.js').catch(() => {
      // Notification clicks still fall back to the in-page experience if registration fails.
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-[var(--page-bg)] px-6 py-8 text-slate-100">Loading Mabaso AI...</div>}>
      <App />
    </Suspense>
  </StrictMode>,
)
