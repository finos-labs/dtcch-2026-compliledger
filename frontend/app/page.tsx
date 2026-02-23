import { SGComparison } from "@/components/sg-comparison";
import { SGDemo } from "@/components/sg-demo";
import { SGFAQ } from "@/components/sg-faq";
import { SGFooter } from "@/components/sg-footer";
import { SGHeader } from "@/components/sg-header";
import { SGHero } from "@/components/sg-hero";
import { SGUISections } from "@/components/sg-ui-sections";
import { ThemeSwitch } from "@/components/theme-switch";
import { createMetadata, siteConfig } from "@/lib/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  title: "SettlementGuard — Proof at Scale",
  description: `Welcome to ${siteConfig.name}. ${siteConfig.description}`,
  path: "/",
});

export default function HomePage(): ReactNode {
  return (
    <>
      <SGHeader />
      <ThemeSwitch />
      <main id="main-content" className="flex-1">
        <SGHero />

        {/* SettlementGuard vs Traditional */}
        <SGComparison />

        {/* Scenario Selector + Proof Chain */}
        <SGDemo />

        {/* Enforcement Flow */}
        <SGUISections />

        {/* Technical FAQ */}
        <SGFAQ />
      </main>

      <SGFooter />
    </>
  );
}
