import { FAQAccordionItem } from "./FAQAccordionItem";
import { FAQS } from "./faq.constants";

export function FAQSection() {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-8 items-center">
          
          {/* Left Column */}
          <div className="flex flex-col items-start gap-4 lg:col-span-5">
            <span className="text-sm font-semibold text-[#E53E3E]">
              Support
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              FAQs
            </h2>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground max-w-md">
              Everything you need to know about the product and billing. Can't find the answer you're looking for? Please chat to our friendly team.
            </p>
          </div>

          {/* Right Column: Accordion */}
          <div className="flex flex-col lg:col-span-7">
            <div className="flex flex-col w-full">
              {FAQS.map((faq, idx) => (
                <FAQAccordionItem 
                  key={idx} 
                  faq={faq} 
                  defaultOpen={idx === 0} 
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
