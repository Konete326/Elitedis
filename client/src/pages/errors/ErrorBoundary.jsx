import { Component } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected interface error occurred.',
    };
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center p-4 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
          <div className="w-full max-w-md rounded-xl border bg-[var(--bg-surface)] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-[var(--status-danger)]">
                <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">
                  Screen failed to load
                </h1>
                <p className="text-xs text-[var(--text-muted)]">
                  ELITE DIST recovery view
                </p>
              </div>
            </div>

            <p className="mb-5 rounded-lg border bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-secondary)] break-words">
              {this.state.errorMessage}
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] theme-transition"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
                Reload Screen
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] theme-transition"
              >
                <Home className="h-4 w-4" strokeWidth={1.75} />
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
