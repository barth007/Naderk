'use client'

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFAQs } from '@/services/cms/admin-cms.hooks'
import { FAQAccordionItem } from "./FAQAccordionItem";
import { FAQS } from "./faq.constants";
import type { FAQType } from "./faq.types";

/** Questions shown before "Show more". */
const INITIAL_COUNT = 8;
const ALL = 'All';

type Item = FAQType & { key: string; category: string };

export function FAQSection() {
  const { data: apiFaqs } = useFAQs();
  const faqs: Item[] = useMemo(() => (
    apiFaqs && apiFaqs.length > 0
      ? apiFaqs.map(f => ({ key: String(f.id), question: f.question, answer: f.answer, category: f.category?.trim() ?? '' }))
      : FAQS.map((f, i) => ({ ...f, key: `faq-${i}`, category: '' }))
  ), [apiFaqs]);

  // Category chips appear only once the CMS gives questions more than one category.
  const categories = useMemo(() => {
    const seen = [...new Set(faqs.map(f => f.category).filter(Boolean))];
    return seen.length > 1 ? [ALL, ...seen] : [];
  }, [faqs]);

  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = faqs.filter(f =>
    (category === ALL || f.category === category) &&
    (!q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)),
  );
  // A search or a category already narrows the list, so show every match.
  const limited = !showAll && !q && filtered.length > INITIAL_COUNT;
  const shown = limited ? filtered.slice(0, INITIAL_COUNT) : filtered;
  const firstOpen = openKey ?? shown[0]?.key ?? null;

  // Two independent columns, so opening one answer does not stretch its neighbour.
  const half = Math.ceil(shown.length / 2);
  const columns = shown.length > 4 ? [shown.slice(0, half), shown.slice(half)] : [shown];

  const pickCategory = (c: string) => { setCategory(c); setShowAll(false); setOpenKey(null); };

  return (
    <section className="bg-background py-16 md:py-24" aria-labelledby="faq-title">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="text-sm font-semibold text-[#E53E3E]">Support</span>
          <h2 id="faq-title" className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            FAQs
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Everything you need to know about the product and billing. Can&rsquo;t find the answer you&rsquo;re looking for? Please chat to our friendly team.
          </p>
        </header>

        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-4">
          {faqs.length > INITIAL_COUNT && (
            <label className="relative w-full max-w-md">
              <span className="sr-only">Search questions</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={e => { setQuery(e.target.value); setOpenKey(null); }}
                placeholder="Search questions"
                className="h-12 w-full rounded-full border border-[#E7D7D7] bg-white pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--destructive)] focus:outline-none focus:ring-2 focus:ring-[var(--destructive)]/15"
              />
            </label>
          )}

          {categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Filter by topic">
              {categories.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => pickCategory(c)}
                  className={cn(
                    "min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
                    category === c
                      ? "border-[var(--destructive)] bg-[var(--destructive)] text-white"
                      : "border-[#E7D7D7] bg-white text-foreground hover:border-[#F5C9C9] hover:text-[#B42318]",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground" aria-live="polite">
            No questions match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className={cn("mt-10 grid gap-4", columns.length > 1 ? "lg:grid-cols-2" : "mx-auto max-w-3xl")}>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-4">
                {col.map(faq => (
                  <FAQAccordionItem
                    key={faq.key}
                    faq={faq}
                    isOpen={firstOpen === faq.key}
                    onToggle={() => setOpenKey(firstOpen === faq.key ? '' : faq.key)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {!q && filtered.length > INITIAL_COUNT && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              aria-expanded={showAll}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#E7D7D7] bg-white px-5 text-sm font-semibold text-foreground hover:bg-[#FFF1F1] hover:text-[#B42318]"
            >
              {showAll ? 'Show fewer questions' : `Show all ${filtered.length} questions`}
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
