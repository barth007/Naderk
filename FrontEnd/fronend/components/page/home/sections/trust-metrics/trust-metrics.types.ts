import type { LucideIcon } from "lucide-react";

export interface TrustStat {
  value: string;
  label: string;
  description?: string;
}

export interface ClientLogo {
  id: number;
  name: string;
  logo: string;
}

export interface TrustMetricsContent {
  heading: string;
  stats: TrustStat[];
  clientsRow1: ClientLogo[];
  clientsRow2: ClientLogo[];
}
