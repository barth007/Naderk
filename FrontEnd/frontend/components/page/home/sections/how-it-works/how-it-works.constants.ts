import type { ProcessStepType, ServiceFeatureType } from "./how-it-works.types";

export const PROCESS_STEPS: ProcessStepType[] = [
  {
    number: "1",
    title: "Book",
    description: "Choose your service and schedule a time that fits your busy lifestyle.",
  },
  {
    number: "2",
    title: "Visit",
    description: "Meet with our experts doctors in-clinic or via our secure telehealth platform.",
  },
  {
    number: "3",
    title: "Get Results",
    description: "Receive your treatment plan, prescriptions, or results instantly on your dashboard.",
  },
];

export const SERVICES: ServiceFeatureType[] = [
  { title: "Eye Exam", icon: "eye" },
  { title: "Diagnostics", icon: "electricity" },
  { title: "Laboratory", icon: "microscope" },
  { title: "Telehealth", icon: "video" },
  { title: "Optical Store", icon: "glasses" },
];
