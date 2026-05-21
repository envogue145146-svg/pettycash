import React, { PropsWithChildren, createContext, useContext, useEffect, useState } from "react";
import { backendMode } from "../lib/backend";
import { getSession, onAuthStateChange } from "../services/expenseService";
import { AppSession, BackendMode } from "../types";

type SessionContextValue = {
  session: AppSession | null;
  loading: boolean;
  backendMode: BackendMode;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function isSameSessionUser(left: AppSession | null, right: AppSession | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.user.id === right.user.id &&
    (left.user.email ?? "") === (right.user.email ?? "") &&
    (left.user.user_metadata?.full_name ?? "") === (right.user.user_metadata?.full_name ?? "") &&
    (left.user.user_metadata?.role ?? "") === (right.user.user_metadata?.role ?? "")
  );
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((nextSession) => {
        setSession((currentSession) => (isSameSessionUser(currentSession, nextSession) ? currentSession : nextSession));
      })
      .finally(() => {
        setLoading(false);
      });

    const unsubscribe = onAuthStateChange((nextSession) => {
      setSession((currentSession) => (isSameSessionUser(currentSession, nextSession) ? currentSession : nextSession));
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={{ session, loading, backendMode }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}
