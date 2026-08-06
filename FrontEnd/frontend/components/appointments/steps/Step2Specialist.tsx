import React, { useEffect } from 'react';
import { useAssignedSpecialist } from '@/services/appointments/appointments.hooks';
import { useBookingStore } from '@/store/useBookingStore';
import { format, parseISO } from 'date-fns';

export default function Step2Specialist() {
  const {
    service,
    date: selectedDate,
    appointmentType,
    doctor: selectedDoctor,
    setDoctor,
    setConsultationInfo,
  } = useBookingStore();

  const needsDoctor = !!service?.requires_doctor;

  const { data, isFetching, isError } = useAssignedSpecialist(
    service?.id,
    selectedDate ?? undefined,
    appointmentType,
    needsDoctor,
  );

  // Mirror the query result into the booking store, which is what Step3 and
  // Step5 read. Clearing on a miss matters: a stale doctor from a previous date
  // would otherwise let the patient book a slot nobody is available for.
  useEffect(() => {
    if (!needsDoctor) return;
    if (data?.doctor) {
      setDoctor(data.doctor);
      setConsultationInfo(data.consultation_fee, data.consultation_valid);
    } else if (isError) {
      setDoctor(null);
    }
  }, [data, isError, needsDoctor, setDoctor, setConsultationInfo]);

  // On-site services don't need a specialist — skip this step entirely
  if (!service || !needsDoctor) return null;

  const prettyDate = selectedDate ? format(parseISO(selectedDate), 'EEE, MMM d') : 'the selected date';

  return (
    <div className="space-y-5">
      <h2 className="text-[15px] font-bold text-gray-700">2. Choose Your Specialist</h2>

      {isFetching ? (
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
        <div className="rounded-[14px] border border-amber-100 bg-amber-50/60 p-4 max-w-xl">
          <p className="text-[13px] font-semibold text-amber-900">
            No {appointmentType === 'TELEHEALTH' ? 'telehealth ' : ''}specialist is free on {prettyDate}.
          </p>
          <p className="text-[12px] text-amber-800 mt-1">
            Pick another date in the calendar below
            {service.available_online ? ', or switch consultation type,' : ''} to see who is available.
          </p>
        </div>
      )}
    </div>
  );
}
