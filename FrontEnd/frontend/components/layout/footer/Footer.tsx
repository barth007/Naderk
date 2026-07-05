import Image from "next/image"
import Link from "next/link"
import { DEFAULT_NAV_ITEMS } from "@/components/layout/navbar/navbar.constants"

const servicesLinks =
  DEFAULT_NAV_ITEMS.find((item) => item.label === "Services")?.dropdown?.map((item) => ({
    label: item.label,
    href: item.href,
  })) ?? []

const infoLinks = [
  { label: "About Us", href: "/about" },
  { label: "Blogs", href: "/coming-soon" },
  { label: "FAQ", href: "/coming-soon" },
  { label: "Privacy Policy", href: "/coming-soon" },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#1F2933B2] text-white/80">
      <div className="mx-auto w-full max-w-7xl px-2 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:gap-8">
          <aside className="max-w-xl">
            <Link href="/" aria-label="Go to homepage" className="inline-flex items-center">
              <Image
                src="/naderk_logo.png"
                alt="Naderk Eye Clinic"
                width={75}
                height={50}
                loading="eager"
                className="object-contain"
              />
            </Link>
            <p className="mt-6 text-md leading-relaxed text-white/80 sm:text-md">
              At NaderkEye Clinic, we are committed to providing high-quality eye care services using advanced technology and experienced specialists.
            </p>
          </aside>

          <nav aria-label="Services links" className="space-y-3">
            <h3 className="text-md font-semibold text-white">Services</h3>
            <ul className="space-y-3">
              {servicesLinks.map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <Link
                    href={item.href}
                    className="block text-md text-white/80 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Information links" className="space-y-3">
            <h3 className="text-md font-semibold text-white">Information</h3>
            <ul className="space-y-3">
              {infoLinks.map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <Link
                    href={item.href}
                    className="block text-md text-white/80 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="footer-contact-heading" className="space-y-4">
            <h3 id="footer-contact-heading" className="text-md font-semibold text-white">
              Contact
            </h3>

            <address className="not-italic space-y-4">
              <p className="flex items-center gap-2 text-md text-white/80">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 shrink-0"
                  aria-hidden
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Abuja, Nigeria</span>
              </p>

              <a
                href="mailto:info@cga.com"
                className="inline-flex items-center gap-2 text-md text-white/80 transition-colors hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 shrink-0"
                  aria-hidden
                >
                  <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  <path d="M22 7l-10 7L2 7" />
                </svg>
                <span>info@cga.com</span>
              </a>
            </address>
          </section>
        </div>

        <div className="mt-12 border-t border-white/60 pt-7">
          <div className="flex flex-col items-start justify-between gap-4 text-md text-white/80 sm:flex-row sm:items-center">
            <small>© {year} NaderkEye Care. All rights reserved.</small>
            <nav aria-label="Legal links">
              <ul className="flex items-center gap-8">
                <li>
                  <Link href="/coming-soon" className="transition-colors hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/coming-soon" className="transition-colors hover:text-white">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
