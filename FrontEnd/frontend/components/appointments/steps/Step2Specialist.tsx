import React, { useEffect } from 'react';
import { useAssignSpecialist } from '@/services/appointments/appointments.hooks';
import { useBookingStore } from '@/store/useBookingStore';
import { format } from 'date-fns';

export default function Step2Specialist() {
  const { service, date: selectedDate, setDoctor, setConsultationInfo, doctor: selectedDoctor } = useBookingStore();
  const assignSpecialistMutation = useAssignSpecialist();

  useEffect(() => {
    if (!service) return;
    assignSpecialistMutation.mutate({
      service_id: service.id,
      date: selectedDate ?? format(new Date(), 'yyyy-MM-dd'),
    }, {
      onSuccess: (data) => {
        setDoctor(data.doctor);
        setConsultationInfo(data.consultation_fee, data.consultation_valid);
      },
    });
  }, [service, selectedDate]); // Re-run when date changes so doctor matches actual availability

  if (!service) return null;

  return (
    <div className="space-y-5">
      <h2 className="text-[15px] font-bold text-gray-700">2. Choose Your Specialist</h2>

      {assignSpecialistMutation.isPending ? (
        <div className="h-24 bg-gray-100 rounded-[14px] animate-pulse max-w-md"></div>
      ) : selectedDoctor ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="relative bg-[#FEF6F6] rounded-[14px] p-5 border-2 border-[#E03E3E] shadow-sm flex items-center justify-between cursor-pointer transition-colors">
              <div className="absolute -top-2.5 right-4 bg-[#E03E3E] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm tracking-wider uppercase">
                Recommended
              </div>
              <div className="flex items-center gap-4">
                <img src={selectedDoctor.avatar || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&auto=format&fit=crop&q=60"} alt="Doctor" className="w-[50px] h-[50px] rounded-full object-cover border-2 border-white shadow-sm" />
                <div>
                  <h3 className="font-bold text-gray-900 text-[14px]">Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}</h3>
                  <p className="text-gray-500 text-[12px] mt-0.5">
                    {selectedDoctor.specialization.replace('_', ' ')} • {selectedDoctor.years_experience}yrs exp.
                  </p>
                </div>
              </div>
              <div className="w-5 h-5 rounded-full border-2 border-[#E03E3E] flex items-center justify-center bg-white">
                <div className="w-2.5 h-2.5 rounded-full bg-[#E03E3E]"></div>
              </div>
            </div>
          </div>
          <div className="flex justify-start">
            <button className="text-[13px] text-[#E03E3E] font-semibold hover:underline px-1">
              View more specialists &rarr;
            </button>
          </div>
        </div>
      ) : (
         <div className="text-[13px] text-gray-500">No specialists available for this service right now.</div>
      )}
    </div>
  );
}
