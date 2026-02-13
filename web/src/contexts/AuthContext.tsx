import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'aca_tokens';

function loadTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

function saveTokens(tokens: AuthTokens): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(loadTokens);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: string }).error ?? `Login failed (${res.status})`;
      setError(msg);
      throw new Error(msg);
    }

    const body = (await res.json()) as { accessToken: string; refreshToken: string };
    const newTokens: AuthTokens = {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
    saveTokens(newTokens);
    setTokens(newTokens);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setTokens(null);
  }, []);

  // Expose error for potential use by login page
  useEffect(() => {
    if (error) {
      // Error is consumed by the login function throw; clear after brief delay
      const timer = setTimeout(() => setError(null), 100);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const value: AuthContextValue = {
    isAuthenticated: tokens !== null,
    token: tokens?.accessToken ?? null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
