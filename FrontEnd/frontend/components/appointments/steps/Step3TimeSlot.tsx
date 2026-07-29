import React, { useState } from 'react';
import { useBookingStore } from '@/store/useBookingStore';
import { format } from 'date-fns';
import CalendarTimeSlotPicker from '../CalendarTimeSlotPicker';

export default function Step3TimeSlot() {
  const { service, doctor, setDateTime, time: selectedTime } = useBookingStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setDateTime(format(date, 'yyyy-MM-dd'), null);
  };

  const handleSlotSelect = (time: string) => {
    setDateTime(format(selectedDate, 'yyyy-MM-dd'), time);
  };

  // On-site services don't require a doctor — show the time slot picker anyway
  const isOnSite = service && !service.requires_doctor;
  if (!isOnSite && !doctor) return null;

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
