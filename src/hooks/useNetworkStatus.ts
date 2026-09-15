import { useState, useEffect, useCallback, useRef } from "react";

export interface NetworkState {
  isOnline: boolean;
  signalLevel: number; // 0 = offline, 1 = weak, 2 = fair, 3 = good, 4 = excellent
  statusColor: string;
  statusLabel: string;
  downlink: number | null; // in Mbps
  rtt: number | null; // in ms
  effectiveType: string | null; // 'slow-2g' | '2g' | '3g' | '4g'
  latency: number | null; // measured ping in ms
  isChecking: boolean;
  lastChecked: Date | null;
  checkConnection: () => Promise<void>;
}

function getNetworkConnection(): any {
  if (typeof navigator === "undefined") return null;
  return (
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection ||
    null
  );
}

const PING_ENDPOINTS = [
  import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`
    : null,
  "https://www.google.com/favicon.ico",
  "https://1.1.1.1/cdn-cgi/trace",
].filter(Boolean) as string[];

async function measurePing(): Promise<{ success: boolean; latency: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { success: false, latency: 0 };
  }

  for (const endpoint of PING_ENDPOINTS) {
    try {
      const start = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}_t=${Date.now()}`;

      await fetch(url, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latency = Math.max(1, Math.round(performance.now() - start));
      return { success: true, latency };
    } catch {
      // Continue to next endpoint fallback
      continue;
    }
  }

  return { success: false, latency: 0 };
}

export function calculateSignalStatus({
  isOnline,
  downlink,
  latency,
}: {
  isOnline: boolean;
  downlink: number | null;
  latency: number | null;
}): {
  signalLevel: number;
  statusColor: string;
  statusLabel: string;
} {
  if (!isOnline) {
    return {
      signalLevel: 0,
      statusColor: "#dc2626", // Red (Offline)
      statusLabel: "Offline",
    };
  }

  if (downlink !== null && downlink > 0) {
    if (downlink >= 5) {
      return {
        signalLevel: 4,
        statusColor: "#16a34a", // Green (Stable & Fast)
        statusLabel: "Stable & Fast",
      };
    } else if (downlink >= 2) {
      return {
        signalLevel: 3,
        statusColor: "#16a34a", // Green (Stable)
        statusLabel: "Stable",
      };
    } else if (downlink >= 0.8) {
      return {
        signalLevel: 2,
        statusColor: "#f59e0b", // Amber (Fair)
        statusLabel: "Fair",
      };
    } else {
      return {
        signalLevel: 1,
        statusColor: "#f97316", // Orange (Slow)
        statusLabel: "Slow",
      };
    }
  }

  if (latency !== null && latency > 0) {
    if (latency < 120) {
      return {
        signalLevel: 4,
        statusColor: "#16a34a", // Green (Stable & Fast)
        statusLabel: "Stable & Fast",
      };
    } else if (latency < 280) {
      return {
        signalLevel: 3,
        statusColor: "#16a34a", // Green (Stable)
        statusLabel: "Stable",
      };
    } else if (latency < 600) {
      return {
        signalLevel: 2,
        statusColor: "#f59e0b", // Amber (Fair)
        statusLabel: "Fair",
      };
    } else {
      return {
        signalLevel: 1,
        statusColor: "#f97316", // Orange (Slow)
        statusLabel: "Slow",
      };
    }
  }

  // Default online fallback
  return {
    signalLevel: 4,
    statusColor: "#16a34a",
    statusLabel: "Stable",
  };
}

export function useNetworkStatus(): NetworkState {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [downlink, setDownlink] = useState<number | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [effectiveType, setEffectiveType] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const isCheckingRef = useRef(false);

  const updateConnectionInfo = useCallback(() => {
    const conn = getNetworkConnection();
    if (conn) {
      if (typeof conn.downlink === "number") setDownlink(conn.downlink);
      if (typeof conn.rtt === "number") setRtt(conn.rtt);
      if (typeof conn.effectiveType === "string") setEffectiveType(conn.effectiveType);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      updateConnectionInfo();

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        setLatency(null);
        setLastChecked(new Date());
        return;
      }

      const { success, latency: measuredLatency } = await measurePing();

      if (success) {
        setIsOnline(true);
        setLatency(measuredLatency);
      } else {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setIsOnline(false);
          setLatency(null);
        } else {
          setIsOnline(false);
          setLatency(null);
        }
      }
      setLastChecked(new Date());
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [updateConnectionInfo]);

  useEffect(() => {
    updateConnectionInfo();
    checkConnection();

    const handleOnline = () => {
      setIsOnline(true);
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLatency(null);
      setLastChecked(new Date());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const conn = getNetworkConnection();
    const handleConnectionChange = () => {
      updateConnectionInfo();
      checkConnection();
    };

    if (conn && conn.addEventListener) {
      conn.addEventListener("change", handleConnectionChange);
    }

    const interval = setInterval(() => {
      checkConnection();
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener("change", handleConnectionChange);
      }
      clearInterval(interval);
    };
  }, [checkConnection, updateConnectionInfo]);

  const { signalLevel, statusColor, statusLabel } = calculateSignalStatus({
    isOnline,
    downlink,
    latency,
  });

  return {
    isOnline,
    signalLevel,
    statusColor,
    statusLabel,
    downlink,
    rtt,
    effectiveType,
    latency,
    isChecking,
    lastChecked,
    checkConnection,
  };
}
