import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const AuthContext = createContext(null);
const AUTH_DEVICE_ID_KEY = "mabaso-device-id";
const SESSION_CHECK_TIMEOUT_MS = 6500;
const SESSION_RETRY_DELAYS_MS = Object.freeze([800, 1600, 3000, 5000, 5000]);

let startupSessionPromise = null;
let startupSessionResult = null;

function resolveApiBaseUrl() {
  const configuredUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    const host = window.location.hostname || "";
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (isLocalHost) return "http://127.0.0.1:8000";
  }
  return "https://mabaso-ai-api.onrender.com";
}

function getOrCreateDeviceId() {
  try {
    const existing = window.localStorage.getItem(AUTH_DEVICE_ID_KEY);
    if (existing) return existing;
    const nextId = `web-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    window.localStorage.setItem(AUTH_DEVICE_ID_KEY, nextId);
    return nextId;
  } catch {
    return `web-${Date.now()}`;
  }
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function requestSession() {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "X-Mabaso-Device-Id": getOrCreateDeviceId(),
      },
      signal: controller.signal,
    });
    const data = await parseJsonSafe(response);
    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info("[MABASO auth timing]", {
      totalMs: elapsedMs,
      backendAuthMs: Number(response.headers.get("X-Auth-Time-Ms") || 0),
      backendCache: response.headers.get("X-Auth-Cache") || "none",
      status: response.status,
    });
    if (response.status === 401 || response.status === 403) {
      return { status: "unauthenticated", session: null, error: "" };
    }
    if (!response.ok || !String(data.email || "").trim()) {
      throw new Error(data.detail || "We could not verify your session.");
    }
    return { status: "authenticated", session: data, error: "" };
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "We could not verify your session. Check your connection and try again."
      : error?.message || "We could not verify your session. Check your connection and try again.";
    return { status: "error", session: null, error: message };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getSessionSingleFlight({ force = false } = {}) {
  if (!force && startupSessionResult && startupSessionResult.status !== "error") return Promise.resolve(startupSessionResult);
  if (startupSessionPromise) return startupSessionPromise;
  if (force) startupSessionResult = null;
  startupSessionPromise = requestSession().then((result) => {
    if (result.status !== "error") startupSessionResult = result;
    return result;
  }).finally(() => {
    startupSessionPromise = null;
  });
  return startupSessionPromise;
}

export function AuthProvider({ children }) {
  const retryAttemptRef = useRef(0);
  const [authState, setAuthState] = useState(() => startupSessionResult || {
    status: "checking",
    session: null,
    error: "",
  });

  const checkSession = useCallback(async ({ force = false, background = false } = {}) => {
    if (!background) {
      setAuthState((current) => ({ ...current, status: "checking", error: "" }));
    }
    const result = await getSessionSingleFlight({ force });
    if (result.status === "error") {
      setAuthState((current) => (
        current.status === "authenticated"
          ? { ...current, error: result.error }
          : { status: "checking", session: null, error: result.error }
      ));
      return result;
    }
    retryAttemptRef.current = 0;
    if (!background || result.status !== "error") setAuthState(result);
    return result;
  }, []);

  const acceptSession = useCallback((session) => {
    const nextState = { status: "authenticated", session, error: "" };
    startupSessionResult = nextState;
    setAuthState(nextState);
  }, []);

  const clearSession = useCallback(() => {
    const nextState = { status: "unauthenticated", session: null, error: "" };
    startupSessionResult = nextState;
    setAuthState(nextState);
  }, []);

  useEffect(() => {
    if (startupSessionResult) return;
    let active = true;
    void getSessionSingleFlight().then((result) => {
      if (!active) return;
      if (result.status === "error") {
        setAuthState({ status: "checking", session: null, error: result.error });
      } else {
        retryAttemptRef.current = 0;
        setAuthState(result);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authState.status !== "checking" || !authState.error) return undefined;
    const delay = SESSION_RETRY_DELAYS_MS[Math.min(retryAttemptRef.current, SESSION_RETRY_DELAYS_MS.length - 1)];
    const timer = window.setTimeout(() => {
      retryAttemptRef.current += 1;
      void getSessionSingleFlight({ force: true }).then((result) => {
        if (result.status === "error") {
          setAuthState({ status: "checking", session: null, error: result.error });
          return;
        }
        retryAttemptRef.current = 0;
        setAuthState(result);
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [authState.error, authState.status]);

  const value = useMemo(() => ({
    ...authState,
    checkSession,
    acceptSession,
    clearSession,
  }), [acceptSession, authState, checkSession, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
