import React, { createContext, useContext, useState, useEffect } from "react";
import {
  UserProfile,
} from "../../../types/user";
import {
  getStoredSession,
  clearStoredSession,
  authenticate,
  AuthResult,
} from "../services/authService";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(() => getStoredSession());

  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      setUser(session);
    }
  }, []);

  async function login(username: string, password: string): Promise<AuthResult> {
    const result = await authenticate(username, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  }

  function logout() {
    clearStoredSession();
    setUser(null);
  }

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isCashier = user?.role === "cashier";

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isCashier,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
