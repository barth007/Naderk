"use client";

import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { cn } from "@/lib/cn";
import type { FAQType } from "./faq.types";
import { useState } from "react";

interface FAQAccordionItemProps {
  faq: FAQType;
  defaultOpen?: boolean;
}

export function FAQAccordionItem({ faq, defaultOpen = false }: FAQAccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div 
      className={cn(
        "collapse bg-transparent rounded-none border-b border-border/60",
        isOpen ? "collapse-open" : "collapse-close"
      )}
    >
      <div 
        className="collapse-title flex cursor-pointer items-center justify-between px-0 py-6 text-lg font-medium transition-colors hover:text-primary"
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
      >
        <span className="pr-4">{faq.question}</span>
        <div className="shrink-0 text-muted-foreground transition-all duration-300">
          <AnimatedIcon name={isOpen ? "minus" : "plus"} size={24} />
        </div>
      </div>
      <div className="collapse-content px-0 pb-6">
        <p className="text-base leading-relaxed text-muted-foreground">
          {faq.answer}
        </p>
      </div>
    </div>
  );
}
