"use client";

import React from "react";

export interface ComplianceStepperProps {
  steps: string[];
  currentStep: number;
}

export function ComplianceStepper({ steps, currentStep }: ComplianceStepperProps) {
  return (
    <div
      role="list"
      aria-label="Progress steps"
      style={{
        display:       "flex",
        alignItems:    "center",
        width:         "100%",
        padding:       "8px 0",
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive    = index === currentStep;
        const isPending   = index > currentStep;
        const isLast      = index === steps.length - 1;

        let circleBg: string;
        let circleBorder: string;
        let circleText: string;
        let labelColor: string;

        if (isCompleted) {
          circleBg     = "var(--success)";
          circleBorder = "var(--success)";
          circleText   = "var(--text-inverse)";
          labelColor   = "var(--success-text)";
        } else if (isActive) {
          circleBg     = "var(--accent)";
          circleBorder = "var(--accent)";
          circleText   = "var(--accent-fg)";
          labelColor   = "var(--accent)";
        } else {
          circleBg     = "transparent";
          circleBorder = "var(--border)";
          circleText   = "var(--text-muted)";
          labelColor   = "var(--text-muted)";
        }

        const connectorColor = isCompleted ? "var(--success)" : "var(--border)";

        return (
          <React.Fragment key={index}>
            {/* Step node */}
            <div
              role="listitem"
              aria-current={isActive ? "step" : undefined}
              aria-label={`Step ${index + 1}: ${step}${isCompleted ? " (completed)" : isActive ? " (current)" : ""}`}
              style={{
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                gap:           6,
                flexShrink:    0,
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width:        28,
                  height:       28,
                  borderRadius: "50%",
                  border:       `2px solid ${circleBorder}`,
                  background:   circleBg,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  transition:   "background 200ms ease, border-color 200ms ease",
                  flexShrink:   0,
                }}
              >
                {isCompleted ? (
                  /* Checkmark icon */
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={circleText}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <span
                    className="mono"
                    style={{
                      fontSize:   10,
                      fontWeight: 700,
                      color:      circleText,
                      lineHeight: 1,
                    }}
                  >
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize:      11,
                  fontWeight:    isActive ? 600 : 500,
                  color:         labelColor,
                  whiteSpace:    "nowrap",
                  textAlign:     "center",
                  transition:    "color 200ms ease",
                  maxWidth:      80,
                  overflow:      "hidden",
                  textOverflow:  "ellipsis",
                }}
                title={step}
              >
                {step}
              </span>
            </div>

            {/* Connector line between steps */}
            {!isLast && (
              <div
                aria-hidden="true"
                style={{
                  flex:           1,
                  height:         2,
                  background:     connectorColor,
                  marginBottom:   22, /* offset to align with circle centers */
                  transition:     "background 200ms ease",
                  minWidth:       12,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
