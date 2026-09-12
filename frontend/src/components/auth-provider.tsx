import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { api, ApiError, UNAUTHORIZED_EVENT } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import type { AuthUser, UserRole } from "@/types";

// Session state for the app. The server owns the session (HttpOnly cookie);
// this just asks "who am I?" on load and reacts to 401s from any request.

type AuthStatus = "loading" | "setup" | "anonymous" | "authenticated" | "offline";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  setup: (data: { fullName: string; username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const resolveAnonymous = useCallback(async () => {
    setUser(null);
    try {
      const { needsSetup } = await api.auth.status();
      setStatus(needsSetup ? "setup" : "anonymous");
    } catch {
      setStatus("offline");
    }
  }, []);

  const check = useCallback(async () => {
    setStatus("loading");
    try {
      setUser(await api.auth.me());
      setStatus("authenticated");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) await resolveAnonymous();
      else setStatus("offline");
    }
  }, [resolveAnonymous]);

  useEffect(() => {
    check();
  }, [check]);

  // Any API call that comes back 401 (expired session, user deactivated) signs out locally.
  useEffect(() => {
    const onUnauthorized = () => {
      if (status === "authenticated") resolveAnonymous();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [status, resolveAnonymous]);

  const value: AuthContextValue = {
    status,
    user,
    login: async (username, password) => {
      setUser(await api.auth.login(username, password));
      setStatus("authenticated");
    },
    setup: async (data) => {
      setUser(await api.auth.setup(data));
      setStatus("authenticated");
    },
    logout: async () => {
      await api.auth.logout().catch(() => {});
      await resolveAnonymous();
    },
    retry: check,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function FullScreenStatus({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <BrandLogo className="h-16" />
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/** Gate for the ERP routes: sends anonymous visitors to /login and back afterwards. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { status, user, retry } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <FullScreenStatus>
        <LoaderCircle className="size-5 animate-spin" />
      </FullScreenStatus>
    );
  }
  if (status === "offline") {
    return (
      <FullScreenStatus>
        <p>ارتباط با سرور برقرار نشد.</p>
        <button type="button" onClick={retry} className="font-medium text-primary underline-offset-4 hover:underline">
          تلاش دوباره
        </button>
      </FullScreenStatus>
    );
  }
  if (status !== "authenticated" || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <FullScreenStatus>
        <p className="text-base font-medium text-foreground">به این بخش دسترسی ندارید.</p>
        <p>این صفحه فقط برای نقش‌های مجاز باز است. اگر لازم دارید، از مدیر سیستم بخواهید.</p>
        <a href="/" className="font-medium text-primary underline-offset-4 hover:underline">
          بازگشت به داشبورد
        </a>
      </FullScreenStatus>
    );
  }
  return <>{children}</>;
}
