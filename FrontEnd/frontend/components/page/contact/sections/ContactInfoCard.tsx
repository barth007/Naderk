import { Card } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { CONTACT_INFO } from "./contact.constants";

export function ContactInfoCard() {
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
          {CONTACT_INFO.map((info, idx) => {
            return (
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
            );
          })}
        </div>
      </div>
    </Card>
  );
}
