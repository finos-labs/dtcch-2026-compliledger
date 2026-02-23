"use client";

import type { ReactNode } from "react";

interface BorderBeamProps {
  duration?: number;

  colorFrom?: string;
  colorTo?: string;
  className?: string;
}

export function BorderBeam({
  duration = 6,
  colorFrom = "var(--accent)",
  colorTo = "var(--sg-teal)",
  className = "",
}: BorderBeamProps): ReactNode {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-[inherit] border border-foreground/5" />
      <div
        className="absolute inset-[-1px] rounded-[inherit]"
        style={{
          background: `conic-gradient(from var(--beam-angle, 0deg) at 50% 50%, transparent 0%, transparent 75%, ${colorFrom} 85%, ${colorTo} 95%, transparent 100%)`,
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1px",
          animation: `border-beam-spin ${duration}s linear infinite`,
        }}
      />
    </div>
  );
}
