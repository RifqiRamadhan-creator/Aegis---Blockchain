import { Component } from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-page">
          <div className="error-boundary-card">
            <span className="error-boundary-icon">💥</span>
            <h1><span className="gradient-text">Something Went Wrong</span></h1>
            <p className="text-muted" style={{ marginBottom: "1.5rem", maxWidth: 440, lineHeight: 1.7 }}>
              An unexpected error occurred. This might be a temporary issue — try refreshing the page or going back to the homepage.
            </p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Error Details</summary>
                <pre>{this.state.error.toString()}</pre>
              </details>
            )}
            <div className="flex" style={{ gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-shimmer" onClick={() => window.location.href = "/"}>
                ← Go Home
              </button>
              <button className="btn-secondary" onClick={() => window.location.reload()}>
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
