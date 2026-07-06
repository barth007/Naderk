'use client'

import { Card } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { useSiteSettings } from '@/services/cms/admin-cms.hooks';
import { OPERATING_HOURS } from "./contact.constants";

export function OperatingHoursCard() {
  const { data: settings } = useSiteSettings();

  const hours = settings?.hours_weekday ? [
    { day: settings.hours_weekday.split(':')[0] || 'Monday - Friday', hours: settings.hours_weekday.split(':').slice(1).join(':').trim() || settings.hours_weekday },
    ...(settings.hours_saturday ? [{ day: settings.hours_saturday.split(':')[0] || 'Saturday', hours: settings.hours_saturday.split(':').slice(1).join(':').trim() || settings.hours_saturday }] : []),
    ...(settings.hours_sunday ? [{ day: settings.hours_sunday.split(':')[0] || 'Sunday', hours: settings.hours_sunday.split(':').slice(1).join(':').trim() || settings.hours_sunday }] : []),
  ] : OPERATING_HOURS;

  return (
    <Card className="p-6 md:p-8 rounded-md border border-border shadow-sm flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <AnimatedIcon name="clock" size={20} className="text-muted-foreground" />
        <h3 className="text-lg font-bold text-foreground">Operating Hours</h3>
      </div>

      <div className="flex flex-col gap-4">
        {hours.map((schedule, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-sm">{schedule.day}</span>
            <span className="text-sm text-muted-foreground">{schedule.hours}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-md bg-[#FCE8E8] p-4 text-[#E53E3E]">
        <AnimatedIcon name="phone" size={20} className="shrink-0" />
        <span className="text-sm font-medium leading-relaxed">
          Emergency services available 24/7 via phone
        </span>
      </div>
    </Card>
  );
}
