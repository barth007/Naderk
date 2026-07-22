"use client";

import React, { useEffect, useState } from 'react';
import { useBookingStore } from '@/store/useBookingStore';
import BookingProgressStepper from '@/components/appointments/BookingProgressStepper';
import Step1Service from '@/components/appointments/steps/Step1Service';
import Step2Specialist from '@/components/appointments/steps/Step2Specialist';
import Step3TimeSlot from '@/components/appointments/steps/Step3TimeSlot';
import Step4PatientInfo from '@/components/appointments/steps/Step4PatientInfo';
import Step5Summary from '@/components/appointments/steps/Step5Summary';
import Step6Confirmation from '@/components/appointments/steps/Step6Confirmation';
import { Calendar } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function BookAppointmentPage() {
  const { currentStep, service, doctor, time, resetBooking, setStep } = useBookingStore();
  const isOnSite = service && !service.requires_doctor;
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Step 6 — confirmation screen
  if (currentStep === 6) {
    return <Step6Confirmation />;
  }

  // Step 5 — payment & booking summary
  if (currentStep === 5) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
          <div className="mb-8 flex items-center justify-between">
            <Breadcrumbs />
            <button
              onClick={() => { resetBooking(); router.push('/dashboard/appointments'); }}
              className="text-sm font-semibold text-gray-500 hover:text-[#E03E3E] transition-colors whitespace-nowrap"
            >
              Cancel Booking
            </button>
          </div>
          <Step5Summary />
        </div>
      </div>
    );
  }

  // Steps 1–4 — wizard
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
        {/* Breadcrumb + Cancel */}
        <div className="mb-8 flex items-center justify-between">
          <Breadcrumbs />
          <button
            onClick={() => { resetBooking(); router.push('/dashboard/appointments'); }}
            className="text-sm font-semibold text-gray-500 hover:text-[#E03E3E] transition-colors whitespace-nowrap"
          >
            Cancel Booking
          </button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-bold text-gray-900 leading-tight">Book Appointment</h1>
          <p className="mt-1 text-[15px] text-gray-500">
            Complete the steps below to schedule your visit with our specialized eye care team.
          </p>
        </div>

        <div className="mb-10">
          <BookingProgressStepper
            currentStep={(() => {
              if (isOnSite) {
                if (time) return 3;
                if (service) return 2;
                return 1;
              }
              if (time) return 4;
              if (doctor) return 3;
              if (service) return 2;
              return 1;
            })()}
            isOnSite={!!isOnSite}
          />
        </div>

        {/* Progressive Form Steps rendered together */}
        <div className="space-y-12">
          <Step1Service />
          <Step2Specialist />
          <Step3TimeSlot />
          <Step4PatientInfo />
        </div>

        {/* Footer — advance to Step5Summary when all details filled */}
        {service && (isOnSite ? time : doctor && time) && (
          <>
            <div className="mt-12 bg-[#FEF6F6] rounded-md p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#E03E3E] shadow-sm">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-[15px]">
                    {service.name}
                    {!isOnSite && doctor && ` with Dr. ${doctor.first_name} ${doctor.last_name}`}
                  </h3>
                  <p className="text-[#E03E3E] text-[13px] font-medium mt-0.5">
                    {isOnSite ? 'Facility-based service — no doctor required' : 'Emergency services available 24/7 via phone'}
                  </p>
                </div>
              </div>

              <Button
                variant="default"
                onClick={() => setStep(5)}
                className="w-full sm:w-auto font-medium h-[48px] px-6"
              >
                Review & Pay →
              </Button>
            </div>

            <div className="mt-6 text-center text-[11px] text-gray-500">
              By confirming, you agree to our <a href="#" className="underline hover:text-gray-700">Terms of Service</a> and <a href="#" className="underline hover:text-gray-700">Privacy Policy</a>. Cancellation requires 24hrs notice.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
