import {
  ContactHeroSection,
  ContactFormSection,
  ContactMapSection
} from "@/components/page/contact/sections";
import { FAQSection } from "@/components/page/home/sections/faq"; // Reusing the FAQ section

export const metadata = {
  title: "Contact Us - NaderkEye",
  description: "Reach out to our dedicated team for appointments, inquiries, or emergency vision care.",
};

export default function ContactPage() {
  return (
    <main>
      <ContactHeroSection />
      <ContactFormSection />
      <ContactMapSection />
    </main>
  );
}
