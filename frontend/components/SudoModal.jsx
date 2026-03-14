"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { requireValidTokenOrThrow, readJsonSafe } from "@/lib/authRequest";
import { getApiBase } from "@/lib/api";
import { loadStoredSudoState, saveSudoToken, clearSudoStorage } from "./sudo/sudo-storage";
import SudoVerifyForm from "./sudo/SudoVerifyForm";

// Sudo Context for global state management
const SudoContext = createContext(null);

export function useSudo() {
  const context = useContext(SudoContext);
  if (!context) {
    throw new Error("useSudo must be used within a SudoProvider");
  }
  return context;
}

// Sudo Provider Component
export function SudoProvider({ children }) {
  const [sudoState, setSudoState] = useState(loadStoredSudoState);
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [requiresTOTP, setRequiresTOTP] = useState(false);
  const sudoToken = sudoState.token;
  const sudoExpires = sudoState.expires;

  const isSudoActive = useCallback(() => {
    if (!sudoToken || !sudoExpires) return false;
    return new Date() < sudoExpires;
  }, [sudoToken, sudoExpires]);

  const storeSudoToken = useCallback((token, expiresAt) => {
    setSudoState({
      token,
      expires: new Date(expiresAt),
    });
    saveSudoToken(token, expiresAt);
  }, []);

  const clearSudoToken = useCallback(() => {
    setSudoState({
      token: null,
      expires: null,
    });
    clearSudoStorage();
  }, []);

  const requestSudo = useCallback(
    (action) => {
      return new Promise((resolve, reject) => {
        if (isSudoActive()) {
          resolve(sudoToken);
          return;
        }
        setPendingAction({ resolve, reject, action });
        setShowModal(true);
      });
    },
    [isSudoActive, sudoToken]
  );

  const onSudoSuccess = useCallback(
    (token, expiresAt) => {
      storeSudoToken(token, expiresAt);
      if (pendingAction) {
        pendingAction.resolve(token);
        setPendingAction(null);
      }
      setShowModal(false);
    },
    [storeSudoToken, pendingAction]
  );

  const onSudoCancel = useCallback(() => {
    if (pendingAction) {
      pendingAction.reject(new Error("Verification was canceled"));
      setPendingAction(null);
    }
    setShowModal(false);
  }, [pendingAction]);

  const fetchSudoStatus = useCallback(async () => {
    try {
      const token = await requireValidTokenOrThrow();
      const res = await fetch(`${getApiBase()}/api/auth/sudo/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Sudo-Token": sudoToken || "",
        },
      });
      if (res.ok) {
        const data = await readJsonSafe(res);
        setRequiresTOTP(data?.requires_totp === true);
        return data;
      }
    } catch (err) {
      // Silently fail - sudo status check is non-critical
    }
    return null;
  }, [sudoToken]);

  const value = {
    sudoToken,
    sudoExpires,
    isSudoActive,
    requestSudo,
    clearSudoToken,
    fetchSudoStatus,
    requiresTOTP,
  };

  return (
    <SudoContext.Provider value={value}>
      {children}
      {showModal && (
        <SudoVerifyForm
          onSuccess={onSudoSuccess}
          onCancel={onSudoCancel}
          actionDescription={pendingAction?.action}
          requiresTOTP={requiresTOTP}
          onCheckStatus={fetchSudoStatus}
        />
      )}
    </SudoContext.Provider>
  );
}

// HOC for wrapping components that need sudo protection
export function withSudoProtection(WrappedComponent, actionDescription) {
  return function SudoProtectedComponent(props) {
    const { requestSudo, sudoToken, isSudoActive } = useSudo();

    const executeSudoAction = async (action) => {
      try {
        const token = await requestSudo(actionDescription);
        return action(token);
      } catch (err) {
        throw err;
      }
    };

    return (
      <WrappedComponent
        {...props}
        sudoToken={sudoToken}
        isSudoActive={isSudoActive}
        executeSudoAction={executeSudoAction}
      />
    );
  };
}

// Hook for executing sudo-protected actions
export function useSudoAction(actionDescription) {
  const { requestSudo, sudoToken, isSudoActive } = useSudo();

  const execute = useCallback(
    async (action) => {
      try {
        const token = await requestSudo(actionDescription);
        return await action(token);
      } catch (err) {
        throw err;
      }
    },
    [requestSudo, actionDescription]
  );

  return {
    execute,
    sudoToken,
    isSudoActive,
  };
}

export default SudoVerifyForm;
