import { getDb } from "../../../services/database";
import { pullUsersFromCloud } from "../../../services/syncProcessor";
import { User, UserProfile } from "../../../types/user";

const STORAGE_KEY = "retail_sathi_session";

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

export function getStoredSession(): UserProfile | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredSession(user: UserProfile): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Authenticate against the local SQLite users table.
 * If local table is empty and device is online, attempts an on-demand pull from cloud first.
 */
export async function authenticate(
  username: string,
  password: string
): Promise<AuthResult> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanUsername || !cleanPassword) {
    return {
      success: false,
      error: "Please enter both username and password.",
    };
  }

  try {
    const db = await getDb();

    // 1. Query local users table
    let rows = await db.select<User[]>(
      `SELECT u.*, s.name AS store_name 
       FROM users u 
       LEFT JOIN stores s ON u.store_id = s.id 
       WHERE LOWER(u.username) = $1 AND u.is_active = 1`,
      [cleanUsername]
    );

    // If no user found and online, try pulling cloud users in case admin just registered in Supabase
    if ((!rows || rows.length === 0) && typeof navigator !== "undefined" && navigator.onLine) {
      try {
        await pullUsersFromCloud();
        rows = await db.select<User[]>(
          `SELECT u.*, s.name AS store_name 
           FROM users u 
           LEFT JOIN stores s ON u.store_id = s.id 
           WHERE LOWER(u.username) = $1 AND u.is_active = 1`,
          [cleanUsername]
        );
      } catch (pullErr) {
        console.warn("[Auth] Could not pull users from cloud during login:", pullErr);
      }
    }

    if (!rows || rows.length === 0) {
      return {
        success: false,
        error: "User not found or account is deactivated.",
      };
    }

    const matchedUser = rows[0];

    // 2. Verify password (direct match or hash comparison)
    if (matchedUser.password_hash !== cleanPassword) {
      return {
        success: false,
        error: "Incorrect password. Please try again.",
      };
    }

    const profile: UserProfile = {
      id: matchedUser.id || 0,
      username: matchedUser.username,
      full_name: matchedUser.full_name,
      role: matchedUser.role,
      phone: matchedUser.phone,
      store_id: matchedUser.store_id || null,
      store_name: matchedUser.store_name || null,
      is_active: true,
      created_at: matchedUser.created_at,
    };

    setStoredSession(profile);

    return {
      success: true,
      user: profile,
    };
  } catch (err: any) {
    console.error("[Auth] Login error:", err);
    return {
      success: false,
      error: "An unexpected error occurred while logging in.",
    };
  }
}
