import type { ContactInfoType, OperatingHourType } from "./contact.types";

export const CONTACT_INFO: ContactInfoType[] = [
  {
    icon: "phone",
    title: "Phone",
    details: ["+234 81234567890", "+234 81234567891 (Emergency)"],
  },
  {
    icon: "mail",
    title: "Email",
    details: ["info@naderkeye.com", "appointments@eyecare.com"],
  },
  {
    icon: "mapPin",
    title: "Location",
    details: ["150 street suite 400", "Medical district, Abuja"],
  },
];

export const OPERATING_HOURS: OperatingHourType[] = [
  { day: "Monday - Friday", hours: "8:00AM - 6:00PM" },
  { day: "Saturday", hours: "9:00AM - 2:00PM" },
  { day: "Sunday", hours: "Closed" },
];
