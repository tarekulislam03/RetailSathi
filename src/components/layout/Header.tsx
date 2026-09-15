import React, { useEffect, useState } from "react";
import {
  fetchSystemNotifications,
  AppNotification,
  getClearedNotificationIds,
  addClearedNotificationId,
  addClearedNotificationIds,
} from "../../services/notificationService";
import { NotificationModal } from "./NotificationModal";

export const Header: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set(getClearedNotificationIds())
  );
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadNotifications() {
    try {
      const list = await fetchSystemNotifications();
      setNotifications(list);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeNotifications = notifications.filter(
    (n) => !dismissedIds.has(n.id)
  );

  function handleDismiss(id: string) {
    addClearedNotificationId(id);
    setDismissedIds((prev) => new Set(prev).add(id));
  }

  function handleClearAll() {
    const allIds = notifications.map((n) => n.id);
    addClearedNotificationIds(allIds);
    setDismissedIds((prev) => {
      const updated = new Set(prev);
      allIds.forEach((id) => updated.add(id));
      return updated;
    });
  }

  return (
    <>
      <header className="header">
        <div className="logo-title">
          <img src="/Retail Sathi.png" alt="Retail Sathi" className="app-logo" />
          <div>
            <h1>Retail Sathi</h1>
            <p className="subtitle">Inventory & Store Management</p>
          </div>
        </div>

        <div className="header-support-notice">
          If you faced any issue or problem, please send me the image of the problem along with a voice message to this number <strong>8101402916</strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Notification Bell Button beside time */}
          <button
            type="button"
            className="notification-bell-btn"
            onClick={() => {
              loadNotifications();
              setIsNotificationOpen(true);
            }}
            title="View Store Notifications & Alerts"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {activeNotifications.length > 0 && (
              <span className="notification-badge">
                {activeNotifications.length}
              </span>
            )}
          </button>

          {/* Clock */}
          <div className="header-clock">
            <div className="clock-time">
              {currentTime.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </div>
            <div className="clock-date">
              {currentTime.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </header>

      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={activeNotifications}
        onRefresh={loadNotifications}
        onDismissNotification={handleDismiss}
        onClearAll={handleClearAll}
      />
    </>
  );
};
