import React, { useEffect } from 'react';
import { useMedicalServices } from '@/services/appointments/appointments.hooks';
import { useBookingStore } from '@/store/useBookingStore';
import { MedicalService, AppointmentType } from '@/services/appointments/appointments.types';
import { MapPin, Video } from 'lucide-react';

export default function Step1Service() {
  const { data: services, isLoading, isError } = useMedicalServices();
  const { service: selectedService, setService, appointmentType, setAppointmentDetails, notes } = useBookingStore();

  const handleSelectService = (svc: MedicalService) => {
    setService(svc);
    // Always default to PHYSICAL when changing service; user can switch to TELEHEALTH if available
    setAppointmentDetails('PHYSICAL', notes);
  };

  const handleSelectType = (type: AppointmentType) => {
    setAppointmentDetails(type, notes);
  };

  // If the current appointmentType is TELEHEALTH but the service is on-site only, reset
  useEffect(() => {
    if (selectedService && !selectedService.requires_doctor && appointmentType === 'TELEHEALTH') {
      setAppointmentDetails('PHYSICAL', notes);
    }
  }, [selectedService]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <h2 className="text-[15px] font-bold text-gray-700">1. Select Service</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-gray-100 rounded-[14px] animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <div className="text-red-500">Failed to load services. Please try again later.</div>;
  }

  // On-site = no doctor required. All doctor-required services support both physical and telehealth.
  const isOnSite = selectedService && !selectedService.requires_doctor;
  const showConsultationType = !!selectedService;

  return (
    <div>
      {/* Step 1 — Service selection */}
      <div className="space-y-5">
        <h2 className="text-[15px] font-bold text-gray-700">1. Select Service</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services?.map((service) => (
            <div
              key={service.id}
              onClick={() => handleSelectService(service)}
              className={`cursor-pointer rounded-[14px] p-6 border transition-all duration-200 flex flex-col justify-center bg-white shadow-sm
                ${selectedService?.id === service.id
                  ? 'border-red-200 ring-1 ring-red-50'
                  : 'border-gray-100 hover:border-red-100'
                }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${selectedService?.id === service.id ? 'bg-red-50 text-red-500' : 'bg-red-50 text-red-400'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-[14px] mb-1.5">{service.name}</h3>
                <p className="text-gray-500 text-[13px] flex items-center gap-2">
                  <span className="font-medium text-gray-600">₦{parseFloat(service.fee).toLocaleString()}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{service.duration_minutes} min</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2 — Consultation type (only shown after a service is selected) */}
      {showConsultationType && (
        <div className="mt-10 space-y-5">
          <h2 className="text-[15px] font-bold text-gray-700">2. Consultation Type</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Physical Visit card — always shown */}
            <div
              onClick={() => !isOnSite && handleSelectType('PHYSICAL')}
              className={`rounded-[14px] p-5 border transition-all duration-200 flex items-center gap-4 bg-white shadow-sm
                ${isOnSite
                  ? 'cursor-default border-red-200 ring-1 ring-red-50 bg-red-50/10'   // on-site: auto-selected, not clickable
                  : appointmentType === 'PHYSICAL'
                    ? 'cursor-pointer border-red-200 ring-1 ring-red-50 bg-red-50/10'
                    : 'cursor-pointer border-gray-100 hover:border-red-100'
                }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
                ${(isOnSite || appointmentType === 'PHYSICAL') ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-[14px] mb-0.5">
                  {isOnSite ? 'Physical Visit (On-site)' : 'Physical Visit'}
                </h3>
                <p className="text-gray-500 text-[12px]">
                  {isOnSite
                    ? 'This service is performed at one of our facilities'
                    : 'In-person clinic consultation'}
                </p>
              </div>
            </div>

            {/* Telehealth card — active for all doctor-required services, greyed out for on-site only */}
            {!isOnSite ? (
              <div
                onClick={() => handleSelectType('TELEHEALTH')}
                className={`cursor-pointer rounded-[14px] p-5 border transition-all duration-200 flex items-center gap-4 bg-white shadow-sm
                  ${appointmentType === 'TELEHEALTH'
                    ? 'border-red-200 ring-1 ring-red-50 bg-red-50/10'
                    : 'border-gray-100 hover:border-red-100'
                  }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
                  ${appointmentType === 'TELEHEALTH' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-[14px] mb-0.5">Telehealth</h3>
                  <p className="text-gray-500 text-[12px]">Online secure video call</p>
                </div>
              </div>
            ) : (
              <div className="rounded-[14px] p-5 border border-gray-100 flex items-center gap-4 bg-gray-50 shadow-sm opacity-40 cursor-not-allowed">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-400">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-500 text-[14px] mb-0.5">Telehealth</h3>
                  <p className="text-gray-400 text-[12px]">Not available for this service</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
