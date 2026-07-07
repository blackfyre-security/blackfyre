import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function DefaultIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state animate-fade-in">
      <div style={{ color: "var(--text-muted)", opacity: 0.7, marginBottom: 8 }}>
        {icon ?? <DefaultIcon />}
      </div>
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm mt-1 max-w-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary btn-sm mt-4"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
