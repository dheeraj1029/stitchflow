import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, setAccessToken, setUnauthorizedHandler } from "./authApi.js";
import { AuthContext } from "./AuthContext.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (credentials) => {
    setIsSubmitting(true);
    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      if (
        typeof result.accessToken !== "string" ||
        !result.user ||
        typeof result.user.role !== "string"
      ) {
        throw new Error("The login service returned an invalid session.");
      }
      setAccessToken(result.accessToken);
      setUser(result.user);
      return result.user;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, isSubmitting }),
    [user, login, isSubmitting, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
