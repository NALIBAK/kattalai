import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-col flex-center h-full p-32 text-center">
          <div style={{ fontSize: '4rem', marginBottom: 24 }}>🛕</div>
          <h2 className="mb-16">Something went wrong.</h2>
          <p className="text-2 mb-24">The application encountered an unexpected error. Please try refreshing the page.</p>
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.reload()}
          >
            🔄 Refresh App
          </button>
        </div>
      );
    }

    return this.children;
  }
}
