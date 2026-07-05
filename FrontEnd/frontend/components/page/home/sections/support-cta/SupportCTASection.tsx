import Link from "next/link";
import { SUPPORT_CTA_DATA } from "./support-cta.constants";

export function SupportCTASection() {
  const { badge, title, description, cta } = SUPPORT_CTA_DATA;

  return (
    <section className="bg-[#FAF3F3] min-h-[312px] flex items-center py-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center rounded-full bg-[#FCE8E8] px-4 py-1.5 text-xs font-medium text-[#E53E3E]">
            {badge}
          </div>
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {title}
          </h2>
          <p className="mb-8 text-base leading-relaxed text-muted-foreground md:text-lg max-w-2xl">
            {description}
          </p>
          <Link
            href={cta.href}
            className="btn bg-[#E53E3E] !text-white hover:bg-[#D32F2F] border-[#E53E3E] hover:border-[#D32F2F] font-semibold rounded-md px-8 shadow-sm transition-all"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
