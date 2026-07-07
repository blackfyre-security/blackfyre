"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const variantConfig: Record<
  ToastVariant,
  { bg: string; border: string; text: string; iconPath: string }
> = {
  success: {
    bg:       "var(--success-bg)",
    border:   "var(--success)",
    text:     "var(--success-text)",
    iconPath: "M9 12l2 2 4-4",
  },
  error: {
    bg:       "var(--critical-bg)",
    border:   "var(--critical)",
    text:     "var(--critical-text)",
    iconPath: "M18 6L6 18M6 6l12 12",
  },
  warning: {
    bg:       "var(--medium-bg)",
    border:   "var(--medium)",
    text:     "var(--medium-text)",
    iconPath: "M12 9v4m0 4h.01",
  },
  info: {
    bg:       "var(--info-bg)",
    border:   "var(--info-color)",
    text:     "var(--info-text)",
    iconPath: "M12 8v4m0 4h.01",
  },
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const d = variantConfig[variant].iconPath;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

function ToastItemComponent({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const cfg = variantConfig[toast.variant];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="animate-slide-right"
      style={{
        background:   cfg.bg,
        border:       `1px solid ${cfg.border}`,
        color:        cfg.text,
        borderRadius: 6,
        boxShadow:    "var(--shadow-overlay)",
        padding:      "10px 14px",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        minWidth:     280,
        maxWidth:     360,
      }}
    >
      <ToastIcon variant={toast.variant} />
      <p style={{ flex: 1, fontSize: 13, fontWeight: 500, color: cfg.text }}>
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        style={{
          flexShrink:   0,
          padding:      "2px 4px",
          borderRadius: 4,
          background:   "transparent",
          border:       "none",
          cursor:       "pointer",
          color:        cfg.text,
          opacity:      0.6,
          transition:   "opacity 120ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.6";
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom:   16,
          right:    16,
          zIndex:   50,
          display:  "flex",
          flexDirection: "column",
          gap:      8,
        }}
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItemComponent key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
