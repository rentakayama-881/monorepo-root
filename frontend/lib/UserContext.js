"use client";

import React, { createContext, useContext, useEffect, useCallback } from "react";
import { useUser, useWallet, invalidateUserData } from "./swr";
import { getToken, clearToken, setTokens } from "./auth";
import { getApiBase } from "./api";

/**
 * UserContext - Single source of truth for user authentication and data
 * Provides user data, wallet, and auth state to all components
 */
const UserContext = createContext(null);

/**
 * UserProvider - Wrap your app with this to provide user context
 */
export function UserProvider({ children }) {
  const { user, isLoading: userLoading, error: userError, mutate: mutateUser, isLoggedIn } = useUser();
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
          headers: {
            "Content-Type": "application/json",
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
  const onLoginSuccess = useCallback((accessToken, refreshToken, expiresIn) => {
    setTokens(accessToken, refreshToken, expiresIn);
    invalidateUserData();
    mutateUser();
    mutateWallet();
  }, [mutateUser, mutateWallet]);

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

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
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
