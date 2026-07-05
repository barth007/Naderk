import React from 'react';
import Link from 'next/link';
import { Shield, Clock, Monitor, Video } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function EmptyTelehealthState() {
  const { user } = useAuth();
  const isPatient = user?.role === 'PATIENT';

  return (
    <div className="max-w-4xl mx-auto bg-white border border-gray-100 rounded-md shadow-sm p-8 md:p-12 text-center flex flex-col items-center">
      {/* Icon Circle */}
      <div className="w-20 h-20 rounded-full bg-[#E03E3E]/5 flex items-center justify-center mb-6">
        <Video className="w-10 h-10 text-[#E03E3E]" />
      </div>

      {/* Main Title & Description */}
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">
        {isPatient ? "Virtual care at your fingertips" : "No telehealth consultations scheduled"}
      </h2>
      <p className="text-gray-500 max-w-xl mx-auto leading-relaxed mb-8">
        {isPatient 
          ? "Telehealth allows you to have secure, high quality video consultations with your healthcare providers from the comfort of your home. You haven't scheduled or attended any virtual sessions yet."
          : "Upcoming virtual consultations will appear here. When a patient schedules a telehealth session, it will be listed on this page."
        }
      </p>

      {/* CTA Button */}
      {isPatient && (
        <Link 
          href="/dashboard/appointments" 
          className="px-6 py-3 bg-[#E03E3E] hover:bg-[#c93232] text-white text-sm font-semibold rounded-md transition-all shadow-sm mb-12 hover:shadow"
        >
          Schedule Telehealth Session
        </Link>
      )}

      {/* Divider */}
      <div className="w-full border-t border-gray-100 my-8"></div>

      {/* Three Selling Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-3xl">
        {/* Secure & Private */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-lg bg-[#E03E3E]/5 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-[#E03E3E]" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 mb-1">
            Secure & Private
          </h4>
          <p className="text-xs text-gray-500 leading-normal">
            HIPAA compliant calls
          </p>
        </div>

        {/* Save Time */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-lg bg-[#E03E3E]/5 flex items-center justify-center mb-3">
            <Clock className="w-6 h-6 text-[#E03E3E]" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 mb-1">
            Save Time
          </h4>
          <p className="text-xs text-gray-500 leading-normal">
            No commute necessary
          </p>
        </div>

        {/* Easy Access */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-lg bg-[#E03E3E]/5 flex items-center justify-center mb-3">
            <Monitor className="w-6 h-6 text-[#E03E3E]" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 mb-1">
            Easy Access
          </h4>
          <p className="text-xs text-gray-500 leading-normal">
            Join from any device
          </p>
        </div>
      </div>
    </div>
  );
}
