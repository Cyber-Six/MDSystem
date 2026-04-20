import React from 'react';

/**
 * Error Boundary component to catch React rendering errors
 * and display a user-friendly fallback instead of crashing the app.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Auto-reload on chunk load failures caused by stale deployments.
    // Guard against infinite reload loops with sessionStorage.
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('Loading chunk');
    if (isChunkError) {
      const reloadKey = 'chunk_reload_attempted';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    sessionStorage.removeItem('chunk_reload_attempted');
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showDevError = import.meta.env.DEV && this.state.error?.message;

      return (
        <div className="relative min-h-screen overflow-hidden bg-white dark:bg-dark-bg-primary">
          <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-primary-200/50 blur-3xl dark:bg-primary-700/25" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-error-400/30 blur-3xl dark:bg-error-700/25" />

          <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
            <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl sm:p-8 dark:border-dark-border-secondary dark:bg-dark-bg-secondary">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-error-100 ring-1 ring-error-500/75 dark:bg-error-900/30 dark:ring-error-500/80">
                <svg className="h-8 w-8 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-semibold text-secondary-900 dark:text-dark-text-primary">
                  Something went wrong
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-secondary-600 sm:text-base dark:text-dark-text-secondary">
                  An unexpected error occurred. Please try again.
                </p>

                {showDevError && (
                  <pre className="mt-4 max-h-28 overflow-auto rounded-lg border border-error-400 bg-error-50 p-3 text-left text-xs text-error-700 dark:border-error-700 dark:bg-error-900/30 dark:text-error-200">
                    {this.state.error.message}
                  </pre>
                )}

                <button
                  onClick={this.handleReset}
                  className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary-500 px-6 py-2.5 font-semibold text-secondary-900 shadow-md transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-dark-bg-secondary"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
