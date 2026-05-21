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

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((nextSession) => {
        setSession(nextSession);
      })
      .finally(() => {
        setLoading(false);
      });

    const unsubscribe = onAuthStateChange((nextSession) => {
      setSession(nextSession);
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
