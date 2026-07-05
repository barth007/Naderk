import type { LaboratoryContent } from "./laboratory.types";

export const LABORATORY_CONTENT: LaboratoryContent = {
  hero: {
    badge: "Diagnostic Excellence",
    title: "Advanced Lab & Diagnostics",
    description: "Precise testing for comprehensive eye health. Utilizing state of the art technology to detect, monitor, and manage ocular conditions with unparalleled accuracy.",
    primaryCTA: { label: "Book Appointment", href: "/coming-soon" },
    secondaryCTA: { label: "Explore Services", href: "/coming-soon" },
    image: "/images/image 13.png",
    imageAlt: "Advanced laboratory diagnostic equipment",
  },
  overview: {
    title: "Our Full Range of Services",
    description: "At Naderk Eye Centre, our commitment extends beyond treatment; we are building a healthier, sustainable future through preventive healthcare, advanced technology, and patient-centred excellence, and a deep sense of purpose.",
    services: [
      {
        icon: "eye",
        title: "Vision & Auditory Care",
        description: "Comprehensive Optometry, Ophthalmology, and Ear Care.",
      },
      {
        icon: "stethoscope",
        title: "Specialised Medicine",
        description: "Pulmonology and Multispecialty Clinical Consultations.",
      },
      {
        icon: "electricity",
        title: "Advanced Diagnostics",
        description: "Full-scale Laboratory services and precision imaging.",
      },
      {
        icon: "globe",
        title: "Global Reach",
        description: "Telehealth services and 'Second Opinion' consultations, connecting you with global experts.",
      },
    ],
  },
  portal: {
    title: "Accessing Your Results",
    description: "Stay informed about your eye health. Our digital patient portal allows you to view detailed diagnostics reports, compare historical data, and share results with other healthcare providers securely.",
    buttonLabel: "Log In To View Your Results",
    href: "/coming-soon",
  },
  standards: {
    title: "Uncompromising Standards",
    description: "Our services span Optometry, Ophthalmology, Ear Care, Pulmonology, Diagnostics, Laboratory Services, Telehealth, and Second Opinions.",
    features: [
      {
        icon: "shield",
        title: "Certified Technicians",
        description: "Our lab is staffed by board-certified ophthalmic technicians with years of diagnostics experience.",
      },
      {
        icon: "microscope",
        title: "State of the art Equipment",
        description: "We invest in the latest FDA approved diagnostic machinery for the most accurate ocular imaging.",
      },
    ],
    images: [
      { src: "/images/image 13.png", alt: "Advanced microscope" },
      { src: "/images/image 11.png", alt: "Clinical testing" },
    ],
  },
};
