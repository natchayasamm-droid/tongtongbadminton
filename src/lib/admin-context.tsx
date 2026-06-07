import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyAdminPin } from "./admin.functions";

type Ctx = {
  isAdmin: boolean;
  pin: string | null;
  login: (pin: string) => Promise<void>;
  logout: () => void;
};

const AdminCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "bm_admin_pin";

export function AdminProvider({ children }: { children: ReactNode }) {
  const [pin, setPin] = useState<string | null>(null);
  const verify = useServerFn(verifyAdminPin);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (saved) setPin(saved);
  }, []);

  const login = useCallback(
    async (newPin: string) => {
      await verify({ data: { pin: newPin } });
      sessionStorage.setItem(STORAGE_KEY, newPin);
      setPin(newPin);
    },
    [verify],
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPin(null);
  }, []);

  return (
    <AdminCtx.Provider value={{ isAdmin: !!pin, pin, login, logout }}>{children}</AdminCtx.Provider>
  );
}

export function useAdmin() {
  const v = useContext(AdminCtx);
  if (!v) throw new Error("useAdmin must be inside AdminProvider");
  return v;
}
