import { Component, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Mabaso AI render error', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[var(--page-bg)] px-5 py-8 text-slate-100">
          <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/70">Mabaso AI</p>
            <h1 className="mt-3 text-2xl font-semibold">Something went wrong while opening this page.</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">Please refresh and try again. If it continues, sign in again from the home page.</p>
            <button type="button" onClick={() => window.location.assign('/')} className="mt-5 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950">
              Return home
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/notification-sw.js').catch(() => {
      // Notification clicks still fall back to the in-page experience if registration fails.
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-[var(--page-bg)] px-6 py-8 text-slate-100">Loading Mabaso AI...</div>}>
        <App />
      </Suspense>
    </RootErrorBoundary>
  </StrictMode>,
)
