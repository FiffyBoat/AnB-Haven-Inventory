import { createContext, useContext, useEffect, useState } from "react";
import { localStore } from "@/api/localStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    localStore.auth.me().then(setUser).finally(() => setIsLoadingAuth(false));
    const onStorage = (event) => {
      if (event.key === "anb-inventory-local-data-v1") localStore.auth.me().then(setUser);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const refreshUser = async () => {
    const nextUser = await localStore.auth.me();
    setUser(nextUser);
    return nextUser;
  };
  const login = async (username, password) => {
    const nextUser = await localStore.auth.login(username, password);
    setUser(nextUser);
    return nextUser;
  };
  const logout = () => {
    localStore.auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: Boolean(user),
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      authChecked: Boolean(user),
      logout,
      login,
      checkUserAuth: refreshUser,
      checkAppState: refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
