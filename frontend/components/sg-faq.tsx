"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "What is SettlementGuard?",
    answer:
      "SettlementGuard is the enforcement layer that sits between a settlement intent and settlement finality. It deterministically evaluates compliance through a Canonical Proof Chain and either proves the settlement should proceed — or stops it. It is not a settlement system, a custody platform, or a compliance monitor.",
  },
  {
    question: "How does the Canonical Proof Chain work?",
    answer:
      "Every settlement attempt runs through an identical, ordered sequence of four compliance checks: Issuer Legitimacy, Asset Classification, Custody Conditions, and Backing & Reserve. The chain never changes. Results are always reproducible. Nothing is skipped, nothing is assumed.",
  },
  {
    question: "What happens when a check fails?",
    answer:
      "If any single check in the Canonical Proof Chain fails, no attestation is issued. Without an attestation, settlement does not proceed. The specific failure reason is recorded in the sealed proof bundle — providing a clear, auditable record of why the settlement was blocked.",
  },
  {
    question: "What asset types does SettlementGuard support?",
    answer:
      "SettlementGuard is asset-agnostic. The same enforcement structure applies to tokenized Treasuries, stablecoins, and other real-world assets. Only the input rules change by asset type. The proof chain, bundle structure, and attestation format are identical across asset classes.",
  },
  {
    question: "How is sensitive data protected?",
    answer:
      "SettlementGuard uses a hybrid architecture. Proof evaluation runs off-chain in a secure enterprise environment (AWS or equivalent), keeping sensitive data private. Only cryptographic hashes — not the underlying data — are anchored on-chain. This gives you the privacy of off-chain processing with the tamper-resistance of on-chain commitment.",
  },
  {
    question: "Can regulators independently verify settlements?",
    answer:
      "Yes. Any authorized party can verify a settlement attestation at any time by pasting the attestation JSON and signature. SettlementGuard confirms whether the cryptographic signature is valid, whether the proof bundle exists, and whether the commitment is anchored on-chain. Tampering is immediately detectable.",
  },
  {
    question: "Does SettlementGuard replace existing settlement infrastructure?",
    answer:
      "No. SettlementGuard is a drop-in enforcement layer. It does not replace your settlement rails — it strengthens them. It sits between the settlement intent and settlement finality, adding deterministic compliance enforcement without disrupting your existing workflows.",
  },
];

function FAQItemComponent({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      layout
      className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
        isOpen
          ? "border-accent/15 bg-accent/[0.03]"
          : "border-foreground/5 bg-muted/30 hover:bg-muted/50"
      }`}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-base font-medium text-foreground">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`shrink-0 rounded-full p-1 transition-colors duration-200 ${
            isOpen ? "bg-accent/10" : ""
          }`}
        >
          <Plus
            className={`h-4 w-4 transition-colors duration-200 ${
              isOpen ? "text-accent" : "text-foreground/50"
            }`}
          />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-6 leading-relaxed text-muted-foreground">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SGFAQ(): ReactNode {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="px-4 py-20 sm:px-6 md:py-28 lg:px-8 border-t border-foreground/5">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="text-sm font-medium uppercase tracking-wider text-accent">
              FAQ
            </p>
            <p className="mt-4 text-3xl text-foreground font-medium tracking-tight md:text-4xl">
              Answers to your questions
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="flex flex-col gap-3">
              {faqs.map((faq, index) => (
                <FAQItemComponent
                  key={faq.question}
                  item={faq}
                  isOpen={openIndex === index}
                  onToggle={() => handleToggle(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
