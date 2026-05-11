import type { HeroContent } from "./hero.types"

export const HERO_CONTENT: HeroContent = {
  badge: "Vision Excellence",
  title: {
    first: "Advanced",
    highlight: "Care",
    second: "for Your Vision.",
  },
  description:
    "Comprehensive eye examinations, diagnosis, and treatment using modern technology and professional care. Your sight is our priority.",
  ctas: {
    primary: {
      label: "Book Consultation",
      href: "/coming-soon",
    },
    secondary: {
      label: "Explore Services",
      href: "/coming-soon",
    },
  },
  trust: {
    count: "50,000+",
    message: "Patients across Africa",
    rating: "4.9/5 Patient Rating",
    avatars: [
      "/avatars/doc-1.png",
      "/avatars/doc-2.png",
      "/avatars/patient-1.png",
      "/avatars/patient-2.png",
      "/avatars/patient-3.png",
    ],
  },
  features: [
    { icon: "shield", label: "Secure & HIPAA Compliant" },
    { icon: "electricity", label: "Advanced Diagnostics" },
    { icon: "users", label: "24/7 Expert Support" },
  ],
};

export const DASHBOARD_STATS = [
  { label: "Appointments Today", value: "24", trend: "+12%", color: "#E53E3E" },
  { label: "Total Patients", value: "12,543", trend: "+8%", color: "#3182CE" },
  { label: "Consultations", value: "3,287", trend: "+15%", color: "#805AD5" },
  { label: "Successful Treatments", value: "98.6%", trend: "+2%", color: "#38A169" },
];

export const SHOWCASE_TABS = [
  { 
    id: "telehealth", 
    label: "Telehealth", 
    title: "Virtual Consultations",
    description: "Speak with specialists from the comfort of your home."
  },
  { 
    id: "diagnostics", 
    label: "Diagnostics", 
    title: "Intelligent Screening",
    description: "Advanced retinal analysis for early disease detection."
  },
  { 
    id: "optical", 
    label: "Optical Store", 
    title: "Premium Eyewear",
    description: "Browse our curated collection of designer frames."
  },
  { 
    id: "laboratory", 
    label: "Lab Results", 
    title: "Clinical Excellence",
    description: "Accurate and fast results for all your clinical tests."
  },
  { 
    id: "insights", 
    label: "Patient Insights", 
    title: "Predictive Health",
    description: "Personalized healthcare recommendations based on your records."
  },
];
