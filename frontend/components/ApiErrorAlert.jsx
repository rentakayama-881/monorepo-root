"use client";

import Alert from "@/components/ui/Alert";
import { mapApiErrorToAlert } from "@/lib/errorAlerts";

export default function ApiErrorAlert({ error, className = "", dismissible = false, onDismiss }) {
  if (!error) return null;
  const { variant, title, message } = mapApiErrorToAlert(error);

  return (
    <Alert
      variant={variant}
      title={title}
      message={message}
      dismissible={dismissible}
      onDismiss={onDismiss}
      className={className}
    />
  );
}
