import React from 'react';
import { useBookingStore } from '@/store/useBookingStore';
import { format, parseISO } from 'date-fns';
import CalendarTimeSlotPicker from '../CalendarTimeSlotPicker';

export default function Step3TimeSlot() {
  const { service, doctor, date, setDateTime, time: selectedTime } = useBookingStore();

  // The date lives in the store, not in local state: Step2 assigns the doctor
  // for whichever date is picked here, so a local copy would let the two steps
  // disagree about which day is being booked.
  const selectedDate = date ? parseISO(date) : new Date();

  const handleDateSelect = (d: Date) => {
    setDateTime(format(d, 'yyyy-MM-dd'), null);
  };

  const handleSlotSelect = (time: string) => {
    setDateTime(format(selectedDate, 'yyyy-MM-dd'), time);
  };

  // On-site services don't require a doctor — show the time slot picker anyway.
  // Doctor services render the calendar even before a doctor is assigned, so a
  // patient whose specialist is booked today can move to a date that works.
  const isOnSite = service && !service.requires_doctor;
  if (!service) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-sm font-bold text-gray-700">
        {isOnSite ? '2. Preferred Time Slot' : '3. Preferred Time Slot'}
      </h2>

      {isOnSite && (
        <p className="text-xs text-gray-500 -mt-2">
          Choose any available time within our facility operating hours (8:00 AM – 5:00 PM).
        </p>
      )}

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 sm:p-6">
        <CalendarTimeSlotPicker
          doctorId={doctor?.id}
          serviceId={isOnSite ? service?.id : undefined}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          selectedTime={selectedTime}
          onTimeSelect={handleSlotSelect}
        />
      </div>
    </div>
  );
}
