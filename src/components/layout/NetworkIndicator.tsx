import React, { useState, useRef, useEffect } from "react";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

export const NetworkIndicator: React.FC = () => {
  const {
    isOnline,
    signalLevel,
    statusColor,
    statusLabel,
    downlink,
    effectiveType,
    latency,
    isChecking,
    checkConnection,
  } = useNetworkStatus();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Construct a concise tooltip
  const tooltipText = isOnline
    ? `Internet: ${statusLabel}${
        downlink ? ` • ${downlink} Mbps` : ""
      }${latency ? ` • ${latency}ms ping` : ""} (Click for details)`
    : "Internet: Offline - No Connection (Click for details)";

  return (
    <div className="network-indicator-container" ref={containerRef}>
      <button
        type="button"
        className={`network-indicator-btn ${
          !isOnline ? "is-offline" : signalLevel >= 3 ? "is-stable" : "is-slow"
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={tooltipText}
        aria-label="Network Status Indicator"
      >
        {!isOnline ? (
          /* Offline Wifi Icon with Slash (Red) */
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dc2626"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="network-wifi-svg"
          >
            <line x1="2" y1="2" x2="22" y2="22" stroke="#dc2626" strokeWidth="2.4" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" opacity={0.35} />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" opacity={0.35} />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" opacity={0.35} />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" opacity={0.35} />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" opacity={0.35} />
            <circle cx="12" cy="20" r="1.5" fill="#dc2626" stroke="none" />
          </svg>
        ) : (
          /* Online Wifi Icon with Dynamic Signal Arcs based on net speed */
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={statusColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="network-wifi-svg"
          >
            {/* Outer Arc (Level 4: Fast / High Speed) */}
            <path
              d="M1.42 9a16 16 0 0 1 21.16 0"
              opacity={signalLevel >= 4 ? 1 : 0.22}
            />
            {/* Middle Arc (Level 3: Good Speed) */}
            <path
              d="M5 12.55a11 11 0 0 1 14 0"
              opacity={signalLevel >= 3 ? 1 : 0.22}
            />
            {/* Inner Arc (Level 2: Fair Speed) */}
            <path
              d="M8.53 16.11a6 6 0 0 1 6.95 0"
              opacity={signalLevel >= 2 ? 1 : 0.22}
            />
            {/* Base Dot (Level 1: Slow / Weak) */}
            <circle
              cx="12"
              cy="20"
              r="1.5"
              fill={statusColor}
              stroke="none"
              opacity={signalLevel >= 1 ? 1 : 0.22}
            />
          </svg>
        )}

        {/* Small speed badge or status dot */}
        <span
          className={`network-status-dot ${
            !isOnline ? "dot-red" : signalLevel >= 3 ? "dot-green" : "dot-amber"
          }`}
        />
      </button>

      {/* Network Details Popover */}
      {isOpen && (
        <div className="network-popover">
          <div className="network-popover-header">
            <div className="network-popover-title">
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
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Network & Internet</span>
            </div>
            <button
              type="button"
              className="network-popover-close"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="network-popover-body">
            {/* Status Banner */}
            <div
              className={`network-status-banner ${
                !isOnline
                  ? "banner-offline"
                  : signalLevel >= 3
                  ? "banner-stable"
                  : "banner-slow"
              }`}
            >
              <div className="status-pill-indicator">
                <span
                  className={`status-circle ${
                    !isOnline ? "bg-red" : signalLevel >= 3 ? "bg-green" : "bg-amber"
                  }`}
                />
                <span className="status-text">
                  {!isOnline ? "Offline - No Internet" : `Connected (${statusLabel})`}
                </span>
              </div>
              <span className="signal-bars-count">
                {!isOnline ? "0 / 4 Bars" : `${signalLevel} / 4 Bars`}
              </span>
            </div>

            {/* Metrics List */}
            <div className="network-metrics-grid">
              <div className="metric-row">
                <span className="metric-label">Signal Quality</span>
                <span
                  className="metric-value font-semibold"
                  style={{ color: statusColor }}
                >
                  {!isOnline
                    ? "Disconnected"
                    : signalLevel === 4
                    ? "Excellent (Stable & Fast)"
                    : signalLevel === 3
                    ? "Good (Stable)"
                    : signalLevel === 2
                    ? "Fair (Moderate Speed)"
                    : "Weak (Slow)"}
                </span>
              </div>

              {downlink !== null && (
                <div className="metric-row">
                  <span className="metric-label">Download Speed</span>
                  <span className="metric-value">{downlink} Mbps</span>
                </div>
              )}

              <div className="metric-row">
                <span className="metric-label">Latency / Ping</span>
                <span className="metric-value">
                  {latency !== null ? `${latency} ms` : isOnline ? "Testing..." : "—"}
                </span>
              </div>

              <div className="metric-row">
                <span className="metric-label">Connection Type</span>
                <span className="metric-value">
                  {effectiveType ? effectiveType.toUpperCase() : isOnline ? "Wi-Fi / LAN" : "Disconnected"}
                </span>
              </div>

              <div className="metric-row">
                <span className="metric-label">Cloud Sync</span>
                <span className="metric-value">
                  {isOnline ? "🟢 Active & Ready" : "🔴 Offline (Queued locally)"}
                </span>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="network-popover-footer">
              <button
                type="button"
                className="network-test-btn"
                onClick={() => checkConnection()}
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <svg
                      className="spin-icon"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    <span>Test Connection & Ping</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
