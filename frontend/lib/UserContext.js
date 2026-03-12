"use client";

import React, { createContext, useContext, useEffect, useCallback } from "react";
import { useUser, useWallet, invalidateUserData } from "./swr";
import { getToken, getTokenExpiry, clearToken, setTokens, AUTH_CHANGED_EVENT } from "./auth";
import { getApiBase } from "./api";
import { refreshAccessToken } from "./tokenRefresh";

/**
 * Proactive token refresh timer — refreshes access token
 * 1 minute before expiry to prevent token expiration.
 * Pattern: Auth0 SDK (checkSession), Firebase SDK (onIdTokenChanged)
 */
function useTokenRefreshTimer() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let timerId = null;

    const scheduleRefresh = () => {
      const expiry = getTokenExpiry();
      if (!expiry || !getToken()) return;

      // Refresh 1 minute before expiry (access token is 5 min)
      const refreshAt = expiry.getTime() - 60_000;
      const delay = Math.max(refreshAt - Date.now(), 0);

      timerId = setTimeout(async () => {
        const token = await refreshAccessToken();
        if (token) scheduleRefresh();
      }, delay);
    };

    scheduleRefresh();

    // Re-schedule on login/token refresh
    const handleAuthChange = () => {
      if (timerId) clearTimeout(timerId);
      if (getToken()) scheduleRefresh();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    };
  }, []);
}

/**
 * UserContext - Single source of truth for user authentication and data
 * Provides user data, wallet, and auth state to all components
 */
const UserContext = createContext(null);

/**
 * UserProvider - Wrap your app with this to provide user context
 */
export function UserProvider({ children }) {
  // Proactive token refresh — prevents token expiry
  useTokenRefreshTimer();

  const {
    user,
    isLoading: userLoading,
    error: userError,
    mutate: mutateUser,
    isLoggedIn,
  } = useUser();
  const { wallet, isLoading: walletLoading, mutate: mutateWallet } = useWallet();

  // Refresh all user data
  const refreshUser = useCallback(() => {
    mutateUser();
    mutateWallet();
  }, [mutateUser, mutateWallet]);

  // Handle logout
  const logout = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        // Call logout endpoint
        await fetch(`${getApiBase()}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Ignore errors - clear tokens anyway
    }

    clearToken();
    invalidateUserData();

    // Redirect to home
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, []);

  // Handle login success - call after successful login
  const onLoginSuccess = useCallback(
    (accessToken, refreshToken, expiresIn) => {
      setTokens(accessToken, refreshToken, expiresIn);
      invalidateUserData();
      mutateUser();
      mutateWallet();
    },
    [mutateUser, mutateWallet]
  );

  // Listen for storage events (logout in other tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "token" && !e.newValue) {
        // Token was cleared in another tab
        invalidateUserData();
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          window.location.href = "/";
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    }
  }, []);

  // Listen for visibility change to refresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && getToken()) {
        // SWR will handle revalidation automatically via revalidateOnFocus
        // This is just for any additional logic if needed
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }, []);

  const value = {
    // User data
    user,
    isLoggedIn,
    isLoading: userLoading,
    error: userError,

    // Wallet data
    wallet,
    walletLoading,

    // Actions
    refreshUser,
    mutateUser,
    mutateWallet,
    logout,
    onLoginSuccess,

    // Computed values
    username: user?.username || null,
    email: user?.email || null,
    avatarUrl: user?.avatar_url || null,
    walletBalance: wallet?.balance || 0,
    hasPinSet: wallet?.pin_set || false,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * useUserContext - Hook to access user context
 * @returns {Object} User context value
 */
export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}

/**
 * useAuth - Convenience hook for auth-only data
 * @returns {{ isLoggedIn, isLoading, logout, user }}
 */
export function useAuth() {
  const { isLoggedIn, isLoading, logout, user } = useUserContext();
  return { isLoggedIn, isLoading, logout, user };
}

export default UserContext;
