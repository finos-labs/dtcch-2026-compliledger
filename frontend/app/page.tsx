import { SGBottomCTA } from "@/components/sg-bottom-cta";
import { SGComparison } from "@/components/sg-comparison";
import { SGCTASections } from "@/components/sg-cta-sections";
import { SGDemo } from "@/components/sg-demo";
import { SGFAQ } from "@/components/sg-faq";
import { SGFeatures } from "@/components/sg-features";
import { SGFooter } from "@/components/sg-footer";
import { SGHeader } from "@/components/sg-header";
import { SGHero } from "@/components/sg-hero";
import { SGLanguage } from "@/components/sg-language";
import { SGMessages } from "@/components/sg-messages";
import { SGStats } from "@/components/sg-stats";
import { SGUISections } from "@/components/sg-ui-sections";
import { TextReveal } from "@/components/text-reveal";
import { ThemeSwitch } from "@/components/theme-switch";
import { TrustedByMarquee } from "@/components/marquee";
import { PinnedSection } from "@/components/pinned-section";
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

        {/* Trusted By Marquee */}
        <TrustedByMarquee />

        {/* Text Reveal Section */}
        <section className="relative py-32 md:py-48">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <TextReveal
              text="From trust to proof. Before settlement finalizes."
              className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
            />
          </div>
        </section>

        {/* Core Features */}
        <SGFeatures />

        {/* Animated Stats */}
        <SGStats />

        {/* Comparison Table */}
        <SGComparison />

        {/* Enforcement Flow — GSAP Pinned */}
        <PinnedSection />

        {/* Key Messages */}
        <SGMessages />

        {/* Demo Scenarios */}
        <SGDemo />

        {/* UI Section Descriptions */}
        <SGUISections />

        {/* Calls to Action */}
        <SGCTASections />

        {/* Language Guide */}
        <SGLanguage />

        {/* FAQ */}
        <SGFAQ />

        {/* Bottom CTA */}
        <SGBottomCTA />
      </main>

      <SGFooter />
    </>
  );
}
