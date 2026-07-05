"use client";

import { Card } from "@/components/ui/card";
import { FormField, Input, Select, Textarea } from "@/components/ui/input";
import { ContactInfoCard } from "./ContactInfoCard";
import { OperatingHoursCard } from "./OperatingHoursCard";

export function ContactFormSection() {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
          
          {/* Left Column: Form */}
          <div className="flex flex-col">
            <Card className="p-6 md:p-10 rounded-[24px] border border-border shadow-sm h-full">
              <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">
                  Send us a message
                </h2>
                <p className="text-muted-foreground">
                  Our friendly team would love to hear from you.
                </p>
              </div>

              <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="First name" htmlFor="firstName">
                    <Input id="firstName" placeholder="First name" />
                  </FormField>
                  <FormField label="Last name" htmlFor="lastName">
                    <Input id="lastName" placeholder="Last name" />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="Email Address" htmlFor="email">
                    <Input id="email" type="email" placeholder="you@example.com" />
                  </FormField>
                  <FormField label="Phone number" htmlFor="phone">
                    <Input id="phone" type="tel" placeholder="+234 81234567890" />
                  </FormField>
                </div>

                <FormField label="Subject" htmlFor="subject">
                  <Select id="subject" defaultValue="general">
                    <option value="general">General Inquiry</option>
                    <option value="appointment">Book an Appointment</option>
                    <option value="billing">Billing Question</option>
                    <option value="emergency">Emergency Care</option>
                  </Select>
                </FormField>

                <FormField label="Message" htmlFor="message">
                  <Textarea id="message" placeholder="How can we help today?" className="min-h-[120px]" />
                </FormField>

                <button 
                  type="submit" 
                  className="btn bg-[#E53E3E] !text-white hover:bg-[#D32F2F] border-[#E53E3E] hover:border-[#D32F2F] font-semibold rounded-md w-full mt-2 transition-all"
                >
                  Send message
                </button>
              </form>
            </Card>
          </div>

          {/* Right Column: Info & Hours */}
          <div className="flex flex-col gap-8">
            <ContactInfoCard />
            <OperatingHoursCard />
          </div>

        </div>
      </div>
    </section>
  );
}
