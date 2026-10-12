"use client";

import { useId } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FAQType } from "./faq.types";

interface FAQAccordionItemProps {
  faq: FAQType;
  isOpen: boolean;
  onToggle: () => void;
}

export function FAQAccordionItem({ faq, isOpen, onToggle }: FAQAccordionItemProps) {
  const id = useId();

  return (
    <div
      className={cn(
        "rounded-2xl border transition-colors",
        isOpen ? "border-[#F5C9C9] bg-[#FFF7F5]" : "border-[#F1E4E4] bg-white hover:border-[#F5C9C9]",
      )}
    >
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={isOpen}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className={cn(
            "group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--destructive)] rounded-2xl",
            isOpen ? "text-[#B42318]" : "text-foreground hover:text-[#B42318]",
          )}
        >
          <span>{faq.question}</span>
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300",
              isOpen ? "rotate-45 bg-[var(--destructive)] text-white" : "bg-[#FFF1F1] text-[var(--destructive)] group-hover:bg-[#FFE3E3]",
            )}
            aria-hidden
          >
            <Plus className="h-4 w-4" />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        className={cn("grid transition-[grid-template-rows] duration-300", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <p className="whitespace-pre-line px-5 pb-5 text-[15px] leading-relaxed text-muted-foreground">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
