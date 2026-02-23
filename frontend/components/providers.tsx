"use client";

import { SmoothScroll } from "@/components/smooth-scroll";
import { ReducedMotionProvider } from "@/lib/motion";
import { ThemeProvider } from "next-themes";
import { PagePreloader } from "@/components/page-preloader";
import { ScrollProgress } from "@/components/scroll-progress";
import { NoiseOverlay } from "@/components/noise-overlay";
import { CustomCursor } from "@/components/custom-cursor";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }): ReactNode {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ReducedMotionProvider>
        <SmoothScroll>
          <PagePreloader />
          <ScrollProgress />
          <NoiseOverlay />
          <CustomCursor />
          {children}
        </SmoothScroll>
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}
