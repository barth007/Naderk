import type { TelehealthContent } from "./telehealth.types";

export const TELEHEALTH_CONTENT: TelehealthContent = {
  hero: {
    badge: "NOW AVAILABLE",
    title: "Virtual Eye Care from Home",
    description: "Connect with our leading ophthalmologists through a secure, high-definition video platform. Get professional consultations without leaving your room.",
    primaryCTA: { label: "Start a Virtual visit", href: "/coming-soon" },
    secondaryCTA: { label: "Schedule Telehealth", href: "/coming-soon" },
    image: "/images/image.png",
    stats: "Trusted by 5,000+ Virtual Visits",
    avatars: [
      "https://i.pravatar.cc/100?img=16",
      "https://i.pravatar.cc/100?img=17",
      "https://i.pravatar.cc/100?img=18",
      "https://i.pravatar.cc/100?img=19",
      "https://i.pravatar.cc/100?img=20",
    ],
  },
  steps: {
    title: "How Virtual Consultations Work",
    description: "Get expert eye care in three steps. No software installation required— It works right in your browser.",
    items: [
      {
        icon: "calendar",
        title: "Schedule",
        description: "Book your appointment online or by phone. You will receive a confirmation email with all details.",
      },
      {
        icon: "mail",
        title: "Secure Link",
        description: "15 minutes before your visit, we will send a secure HIPAA-compliant video link via SMS or email.",
      },
      {
        icon: "video",
        title: "Connect",
        description: "Click the link to join the virtual room. Your doctor will meet you there for your private consultation.",
      },
    ],
  },
  technical: {
    title: "Technical Requirements",
    description: "To ensure the best possible experience during your virtual eye exam, please ensure you have the following:",
    requirements: [
      {
        icon: "screen",
        title: "Supported Devices",
        description: "Any smartphone, tablet, or computer with a camera and microphone.",
      },
      {
        icon: "electricity",
        title: "Stable Internet",
        description: "Broadband connection or 4G/5G mobile data for smooth video streaming.",
      },
      {
        icon: "clock",
        title: "Good Lighting",
        description: "Bright, even lighting in front of you so your eyes are clearly visible.",
      },
    ],
    privacy: {
      title: "Privacy & Security",
      description: "Your privacy is our highest priority. All telehealth sessions at NaderkEye center are:",
      features: [
        "100% HIPAA Compliant",
        "End-to-End Encrypted Video",
        "No Session Recording",
      ],
    },
  },
  testimonial: {
    quote: "I was skeptical about a virtual eye exam, but the technology was seamless. My doctor diagnosed my eye irritation quickly and I had my prescription at the pharmacy within an hour.",
    author: "Sarah Bwala",
    role: "Telehealth Patient since 2025",
  },
  cta: {
    title: "Ready to see better?",
    description: "Book your virtual consultation today and get the care you need from the comfort and safety of your home.",
    primaryCTA: { label: "Start a Virtual Visit", href: "/coming-soon" },
    secondaryCTA: { label: "View Pricing", href: "/coming-soon" },
  },
};
