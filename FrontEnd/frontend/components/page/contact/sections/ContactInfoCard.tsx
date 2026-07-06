'use client'

import { Card } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { useSiteSettings } from '@/services/cms/admin-cms.hooks';
import { CONTACT_INFO } from "./contact.constants";

export function ContactInfoCard() {
  const { data: settings } = useSiteSettings();

  // Derive contact info from CMS settings if available, fall back to constants
  const items = settings?.phone_primary ? [
    {
      icon: 'phone' as const,
      title: 'Phone',
      details: [
        settings.phone_primary,
        ...(settings.phone_secondary ? [`${settings.phone_secondary} (Emergency)`] : []),
      ],
    },
    {
      icon: 'mail' as const,
      title: 'Email',
      details: [
        ...(settings.email_support ? [settings.email_support] : []),
        ...(settings.email_general ? [settings.email_general] : []),
      ],
    },
    {
      icon: 'mapPin' as const,
      title: 'Location',
      details: [settings.address].filter(Boolean),
    },
  ] : CONTACT_INFO;

  return (
    <Card className="p-6 md:p-8 rounded-md border border-border shadow-sm">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <AnimatedIcon name="mail" size={20} />
          </div>
          <h3 className="text-lg font-bold text-foreground">Contact Information</h3>
        </div>

        <div className="flex flex-col gap-6">
          {items.map((info, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#FCE8E8] text-[#E53E3E]">
                <AnimatedIcon name={info.icon} size={20} />
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="font-semibold text-foreground text-sm">{info.title}</span>
                {info.details.map((detail, dIdx) => (
                  <span key={dIdx} className="text-sm text-muted-foreground">
                    {detail}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
