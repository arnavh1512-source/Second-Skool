'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logError } from '../lib/log'

interface Props { children: ReactNode }
interface EState { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, EState> {
  state: EState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Structured, like every other error in the app, and carrying the component
    // stack — "App error: undefined is not an object" with no stack told whoever
    // read the console nothing about which screen had died.
    logError('client.render_crash', {
      message: error.message,
      name: error.name,
      component: (info.componentStack ?? '').split('\n')[1]?.trim() ?? null,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f4f6fb] p-6">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-[20px] bg-[#fdecea] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="0.5" fill="#e8553c"/></svg>
            </div>
            <div className="text-lg font-extrabold text-[#1a2332] mb-2">Something went wrong</div>
            {/* Not error.message: a React internals string ("Cannot read
                properties of undefined") tells a parent nothing and reads as if
                the app has broken for good. The detail goes to the log. */}
            <div className="text-sm text-[#6b7689] mb-5 leading-relaxed">This screen failed to load. Your data is safe — try again, and if it keeps happening, close and reopen the app.</div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-[#2a6fdb] text-white text-sm font-bold py-3 px-8 rounded-2xl border-none cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
