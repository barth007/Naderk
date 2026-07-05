import { Card } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { OPERATING_HOURS } from "./contact.constants";

export function OperatingHoursCard() {
  return (
    <Card className="p-6 md:p-8 rounded-md border border-border shadow-sm flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <AnimatedIcon name="clock" size={20} className="text-muted-foreground" />
        <h3 className="text-lg font-bold text-foreground">Operating Hours</h3>
      </div>

      <div className="flex flex-col gap-4">
        {OPERATING_HOURS.map((schedule, idx) => (
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
