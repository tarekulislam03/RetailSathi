import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { APP_DISPLAY_VERSION } from "../../../constants/version";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await login(username, password);
      if (res.success && res.user) {
        navigate("/billing", { replace: true });
      } else {
        setErrorMsg(res.error || "Invalid username or password.");
      }
    } catch (err: any) {
      setErrorMsg("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-screen-wrapper">
      <div className="login-window">
        {/* Title Bar */}
        <div className="login-titlebar">
          <div className="login-titlebar-text">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Retail Sathi — User Authentication</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="login-body">
          <div className="login-header-section">
            <img
              src="/Retail Sathi.png"
              alt="Retail Sathi"
              className="login-logo"
            />
            <div>
              <h1 className="login-app-title">Retail Sathi</h1>
              <p className="login-app-subtitle">
                Inventory, POS & Store Management
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="login-error-banner" role="alert">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form-group">
              <label htmlFor="login-username" className="login-label">
                Username
              </label>
              <div className="login-input-wrapper">
                <input
                  id="login-username"
                  type="text"
                  className="login-input"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                  autoComplete="username"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="login-form-group">
              <label htmlFor="login-password" className="login-label">
                Password
              </label>
              <div className="login-input-wrapper password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="login-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="login-eye-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    /* Eye Off SVG */
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Eye On SVG */
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-footer">
              <button
                type="submit"
                className="login-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="spin-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    <span>Log In</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="login-support-note" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Offline database enabled. Cross-counter sync active.</span>
            <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600, background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
              {APP_DISPLAY_VERSION}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
