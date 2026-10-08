import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Retail Sathi] Uncaught Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f8fafc",
            color: "#1e293b",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              maxWidth: "600px",
              width: "100%",
              background: "#ffffff",
              padding: "32px",
              borderRadius: "12px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: "bold",
                }}
              >
                !
              </div>
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0, color: "#0f172a" }}>
                  Retail Sathi Encountered an Issue
                </h1>
                <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
                  An unexpected error occurred while running the application.
                </p>
              </div>
            </div>

            <div
              style={{
                background: "#f1f5f9",
                borderRadius: "8px",
                padding: "12px 16px",
                fontSize: "13px",
                fontFamily: "monospace",
                color: "#dc2626",
                maxHeight: "180px",
                overflowY: "auto",
                wordBreak: "break-word",
                marginBottom: "20px",
              }}
            >
              {this.state.error?.toString() || "Unknown error"}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Clear Cache & Restart
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
