import type { ReactNode } from "react";

interface SGLogoProps {
  className?: string;
}

export function SGLogo({ className = "h-7 w-7" }: SGLogoProps): ReactNode {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 79 26 A 38 38 0 1 0 79 74"
        stroke="currentColor"
        strokeWidth="9"
      />
      <path
        d="M 33 64 A 22 22 0 1 1 33 36"
        stroke="currentColor"
        strokeWidth="9"
      />
    </svg>
  );
}
