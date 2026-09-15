import React, { useState, useEffect } from "react";
import { AppNotification } from "../../services/notificationService";
import { Pagination } from "../common/Pagination";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onRefresh: () => void;
  onDismissNotification: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onRefresh,
  onDismissNotification,
  onClearAll,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setCurrentPage(1);
  }, [notifications.length]);

  if (!isOpen) return null;

  const totalItems = notifications.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedNotifications = notifications.slice(
    startIndex,
    startIndex + pageSize
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "580px", width: "95%" }}
      >
        <div className="modal-header">
          <div>
            <h2>Store Notifications & Alerts</h2>
            <div className="hint-text">
              Real-time inventory thresholds and customer due alerts
            </div>
          </div>
          <button className="close-btn" onClick={onClose} type="button">
            X
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "12px 0 8px",
          }}
        >
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#1c3d5a",
            }}
          >
            Active Notifications ({notifications.length})
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn secondary-btn"
              style={{ padding: "3px 10px", fontSize: "0.78rem" }}
              onClick={onRefresh}
            >
              Refresh
            </button>
            {notifications.length > 0 && (
              <button
                type="button"
                className="btn secondary-btn"
                style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                onClick={onClearAll}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            maxHeight: "360px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            paddingRight: "4px",
          }}
        >
          {notifications.length === 0 ? (
            <div
              className="empty-state"
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "#137333",
                backgroundColor: "#e8f4ea",
                border: "1px solid #a8dab5",
                borderRadius: "3px",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                All clear! No active alerts or warnings.
              </div>
              <div style={{ fontSize: "0.8rem", color: "#555", marginTop: "4px" }}>
                Stock levels and customer dues are currently in normal status.
              </div>
            </div>
          ) : (
            paginatedNotifications.map((n) => {
              const isDanger = n.type === "danger";
              const bgColor = isDanger ? "#fff1f0" : "#fffbe6";
              const borderColor = isDanger ? "#ffccc7" : "#ffe58f";
              const tagColor = isDanger ? "#cf1322" : "#d48806";
              const tagBg = isDanger ? "#ffa39e" : "#fff1b8";

              return (
                <div
                  key={n.id}
                  style={{
                    backgroundColor: bgColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: "3px",
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: tagBg,
                          color: tagColor,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "2px",
                          textTransform: "uppercase",
                        }}
                      >
                        {n.category}
                      </span>
                      <strong
                        style={{
                          fontSize: "0.88rem",
                          color: "#1c3d5a",
                        }}
                      >
                        {n.title}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#666",
                          marginLeft: "auto",
                        }}
                      >
                        {n.timestamp}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: "#333",
                        lineHeight: 1.35,
                      }}
                    >
                      {n.message}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDismissNotification(n.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#999",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      padding: "2px 4px",
                    }}
                    title="Dismiss alert"
                  >
                    X
                  </button>
                </div>
              );
            })
          )}
        </div>

        {totalItems > 0 && (
          <div style={{ marginTop: "8px" }}>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20]}
            />
          </div>
        )}

        <div
          className="form-actions"
          style={{ justifyContent: "flex-end", marginTop: "14px" }}
        >
          <button type="button" className="btn secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
