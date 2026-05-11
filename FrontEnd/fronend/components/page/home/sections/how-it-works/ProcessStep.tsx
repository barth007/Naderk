import { cn } from "@/lib/cn";
import type { ProcessStepType } from "./how-it-works.types";

interface ProcessStepProps {
  step: ProcessStepType;
  className?: string;
}

export function ProcessStep({ step, className }: ProcessStepProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E53E3E] text-2xl font-medium text-white shadow-sm">
        {step.number}
      </div>
      <div>
        <h3 className="mb-2 text-xl font-bold text-foreground">{step.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
      </div>
    </div>
  );
}
