import React from 'react';
import { useMedicalServices } from '@/services/appointments/appointments.hooks';
import { useBookingStore } from '@/store/useBookingStore';
import { MedicalService, AppointmentType } from '@/services/appointments/appointments.types';
import { MapPin, Video } from 'lucide-react';

export default function Step1Service() {
  const { data: services, isLoading, isError } = useMedicalServices();
  const { service: selectedService, setService, appointmentType, setAppointmentDetails, notes } = useBookingStore();

  const handleSelectService = (service: MedicalService) => {
    setService(service);
  };

  const handleSelectType = (type: AppointmentType) => {
    setAppointmentDetails(type, notes);
  };

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

  return (
    <div>
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
                  <span className="font-medium text-gray-600">₦50,000</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>{service.duration_minutes} min</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 space-y-5">
        <h2 className="text-[15px] font-bold text-gray-700">2. Consultation Type</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div 
            onClick={() => handleSelectType('PHYSICAL')}
            className={`cursor-pointer rounded-[14px] p-5 border transition-all duration-200 flex items-center gap-4 bg-white shadow-sm
              ${appointmentType === 'PHYSICAL' 
                ? 'border-red-200 ring-1 ring-red-50 bg-red-50/10' 
                : 'border-gray-100 hover:border-red-100'
              }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${appointmentType === 'PHYSICAL' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>
               <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-[14px] mb-0.5">Physical Visit</h3>
              <p className="text-gray-500 text-[12px]">In-person clinic consultation</p>
            </div>
          </div>

          <div 
            onClick={() => handleSelectType('TELEHEALTH')}
            className={`cursor-pointer rounded-[14px] p-5 border transition-all duration-200 flex items-center gap-4 bg-white shadow-sm
              ${appointmentType === 'TELEHEALTH' 
                ? 'border-red-200 ring-1 ring-red-50 bg-red-50/10' 
                : 'border-gray-100 hover:border-red-100'
              }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${appointmentType === 'TELEHEALTH' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>
               <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-[14px] mb-0.5">Telehealth</h3>
              <p className="text-gray-500 text-[12px]">Online secure video call</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
