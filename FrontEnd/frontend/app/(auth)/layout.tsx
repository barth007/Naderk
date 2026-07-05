import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      {/* NaderkEye Logo top left */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        {/* Placeholder for real logo */}
        <div className="w-8 h-8 bg-[#E03E3E] rounded-md flex items-center justify-center text-white font-bold">N</div>
        <span className="font-semibold text-lg text-gray-800">NaderkEye Care</span>
      </div>

      {children}
    </div>
  );
}
