import { ProcessStep } from "./ProcessStep";
import { ServicesOverview } from "./ServicesOverview";
import { PROCESS_STEPS } from "./how-it-works.constants";

export function HowItWorksSection() {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        {/* Part 1: How It Works */}
        <div className="flex flex-col gap-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Streamline care in three simple steps.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3 md:gap-12">
            {PROCESS_STEPS.map((step, index) => (
              <ProcessStep key={index} step={step} />
            ))}
          </div>
        </div>

        {/* Part 2: Services Overview */}
        <ServicesOverview />
      </div>
    </section>
  );
}
