import { AnimatedIconName } from "@/components/ui/AnimatedIcon";

export interface ContactInfoType {
  icon: AnimatedIconName;
  title: string;
  details: string[];
}

export interface OperatingHourType {
  day: string;
  hours: string;
}
