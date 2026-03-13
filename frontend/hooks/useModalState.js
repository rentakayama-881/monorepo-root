/**
 * useModalState — Hook for managing multiple modal open/close states.
 *
 * Replaces the pattern of many:
 *   const [showDeleteModal, setShowDeleteModal] = useState(false);
 *   const [showConfirmModal, setShowConfirmModal] = useState(false);
 *
 * Usage:
 *   const modal = useModalState();
 *   <Button onClick={() => modal.open("delete")} />
 *   {modal.isOpen("delete") && <DeleteModal onClose={() => modal.close("delete")} />}
 *
 * Or with data:
 *   modal.open("edit", { id: 123 });
 *   modal.getData("edit") // { id: 123 }
 */

import { useState, useCallback } from "react";

/**
 * @returns {{ open, close, toggle, isOpen, getData, closeAll }}
 */
export function useModalState() {
  const [modals, setModals] = useState({});

  const open = useCallback((name, data = null) => {
    setModals((prev) => ({ ...prev, [name]: { open: true, data } }));
  }, []);

  const close = useCallback((name) => {
    setModals((prev) => ({ ...prev, [name]: { open: false, data: null } }));
  }, []);

  const toggle = useCallback((name, data = null) => {
    setModals((prev) => {
      const current = prev[name];
      if (current?.open) {
        return { ...prev, [name]: { open: false, data: null } };
      }
      return { ...prev, [name]: { open: true, data: data ?? current?.data } };
    });
  }, []);

  const isOpen = useCallback((name) => modals[name]?.open === true, [modals]);

  const getData = useCallback((name) => modals[name]?.data ?? null, [modals]);

  const closeAll = useCallback(() => {
    setModals({});
  }, []);

  return { open, close, toggle, isOpen, getData, closeAll };
}
