/**
 * useFormState — Hook for managing complex form state with nested objects.
 *
 * Simplifies the pattern of:
 *   const [form, setForm] = useState({...});
 *   const updateField = (field, value) => setForm(prev => ({...prev, [field]: value}));
 */

import { useState, useCallback, useRef } from "react";

/**
 * @param {object} initialValues - Initial form values
 * @returns {{ values, setValues, setField, setFields, reset, isDirty }}
 */
export function useFormState(initialValues) {
  const initialRef = useRef(initialValues);
  const [values, setValues] = useState(initialValues);
  const [initialSnapshot, setInitialSnapshot] = useState(() => JSON.stringify(initialValues));

  const setField = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setFields = useCallback((updates) => {
    setValues((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback((newInitial) => {
    const resetTo = newInitial ?? initialRef.current;
    initialRef.current = resetTo;
    setInitialSnapshot(JSON.stringify(resetTo));
    setValues(resetTo);
  }, []);

  const isDirty = JSON.stringify(values) !== initialSnapshot;

  return { values, setValues, setField, setFields, reset, isDirty };
}
