import React from 'react';
import { useBookingStore } from '@/store/useBookingStore';
import Link from 'next/link';

export default function Step6Confirmation() {
  const { date, time, service, doctor, resetBooking } = useBookingStore();

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center">
      {/* Payment success icon */}
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-3xl font-black text-gray-900 mb-2">Payment Successful!</h2>
      <p className="text-gray-500 mb-2 max-w-md">
        Your payment for <span className="font-semibold text-gray-700">{service?.name}</span> with{' '}
        <span className="font-semibold text-gray-700">Dr. {doctor?.last_name}</span> has been received.
      </p>
      <p className="text-sm text-gray-400 mb-8 max-w-md">
        Your booking request is now with the doctor for review. You will be notified once it is accepted.
      </p>

      {/* Status timeline */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="w-0.5 h-8 bg-gray-200 mt-1" />
          </div>
          <div className="pb-8 text-left">
            <p className="text-sm font-bold text-green-700">Payment Received</p>
            <p className="text-xs text-gray-500">Your service plan has been activated</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            </div>
            <div className="w-0.5 h-8 bg-gray-200 mt-1" />
          </div>
          <div className="pb-8 text-left">
            <p className="text-sm font-bold text-yellow-700">Awaiting Doctor Acceptance</p>
            <p className="text-xs text-gray-500">Dr. {doctor?.last_name} will review your request shortly</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            </div>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-400">Appointment Confirmed</p>
            <p className="text-xs text-gray-400">{date} at {time}</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 w-full max-w-md mb-8 text-left text-sm text-blue-700">
        You can track the status of your booking under <span className="font-semibold">My Appointments</span>. We'll notify you the moment the doctor accepts.
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/dashboard"
          onClick={() => setTimeout(resetBooking, 500)}
          className="flex-1 bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 font-bold py-3.5 px-6 rounded-xl transition-all"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/dashboard/appointments"
          onClick={() => setTimeout(resetBooking, 500)}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          View Appointments
        </Link>
      </div>
    </div>
  );
}
