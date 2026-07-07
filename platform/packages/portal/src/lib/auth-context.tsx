"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "./api";

interface User {
  email: string;
  name: string;
  role: string;
}

interface MfaChallenge {
  mfaChallengeToken: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<MfaChallenge | void>;
  verifyMfa: (challengeToken: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const USER_COOKIE = "bf_portal_user";

function getUserFromCookie(): User | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)bf_portal_user=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function setUserCookie(user: User) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${USER_COOKIE}=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=900; SameSite=Strict${secure}`;
}

function clearUserCookie() {
  document.cookie = `${USER_COOKIE}=; path=/; max-age=0`;
}

const DEV_BYPASS =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

const DEV_STUB_USER: User = {
  email: "dev@blackfyre.local",
  name: "Acme Corp",
  role: "admin",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEV_BYPASS ? DEV_STUB_USER : null);

  useEffect(() => {
    if (DEV_BYPASS) return;
    const token = api.getToken();
    const savedUser = getUserFromCookie();
    if (token && savedUser) {
      setUser(savedUser);
    }
  }, []);

  const login = async (email: string, password: string): Promise<MfaChallenge | void> => {
    const res = await api.login(email, password);
    if (res.data?.mfaRequired || res.mfaRequired) {
      return { mfaChallengeToken: res.data?.mfaChallengeToken || res.mfaChallengeToken };
    }
    api.setTokens(res.accessToken, res.refreshToken);
    const userData: User = {
      email: res.user?.email ?? email,
      name: res.user?.name ?? email.split("@")[0],
      role: res.user?.role ?? "viewer",
    };
    setUserCookie(userData);
    setUser(userData);
  };

  const verifyMfa = async (challengeToken: string, code: string) => {
    const res = await api.verifyMfa(challengeToken, code);
    api.setTokens(res.accessToken, res.refreshToken);
    const userData: User = {
      email: res.user?.email || "",
      name: res.user?.name || "",
      role: res.user?.role || "viewer",
    };
    setUserCookie(userData);
    setUser(userData);
  };

  const logout = () => {
    api.clearTokens();
    clearUserCookie();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!user, user, login, verifyMfa, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
