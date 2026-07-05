"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ShieldCheck } from 'lucide-react';

import { OTPInput } from '@/components/ui/OTPInput';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ProblemDetailsResponse, AuthTokens } from '@/types';

export default function VerifyOTPPage() {
  const router = useRouter();
  const setAuth = useAuth(state => state.setAuth);
  
  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    // Get email from sessionStorage when component mounts
    const storedEmail = sessionStorage.getItem('verificationEmail');
    if (!storedEmail) {
        toast.error("Session expired. Please log in or register again.");
        router.push('/login');
    } else {
        setEmail(storedEmail);
    }
  }, [router]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleVerify = async (code: string) => {
    if (code.length !== 6) return;
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await apiClient.post('/auth/verify-otp/', {
        email,
        code
      });

      const tokens = response.data.data as AuthTokens;
      setAuth(tokens.user, tokens.access, tokens.refresh);
      
      toast.success(response.data.message);
      sessionStorage.removeItem('verificationEmail');
      router.push('/profile');
      
    } catch (err) {
      const error = err as AxiosError<ProblemDetailsResponse>;
      if (error.response?.data) {
        setError(error.response.data.detail);
        toast.error(error.response.data.title, { description: error.response.data.detail });
      }
      // Reset OTP on error to force re-entry
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await apiClient.post('/auth/resend-otp/', { email });
      toast.success("A new verification code has been sent.");
      setTimeLeft(300); // Reset timer
      setOtp('');
      setError(undefined);
    } catch (err) {
      toast.error("Failed to resend code. Please try again.");
    }
  };

  if (!email) return null;

  return (
    <div className="w-full max-w-md mx-auto pt-12 pb-24">
      <div className="bg-white rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center text-center">
        
        <div className="w-16 h-16 rounded-full bg-[#faeaea] text-[#E03E3E] flex items-center justify-center mb-6">
          <ShieldCheck className="w-8 h-8" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Verify Account</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          We sent a 6-digit verification code to <br/>
          <span className="font-semibold text-gray-900">{email}</span>
        </p>

        <div className="mb-8">
            <OTPInput 
                length={6} 
                value={otp} 
                onChange={(val) => {
                    setOtp(val);
                    setError(undefined);
                }}
                onComplete={handleVerify}
                error={error}
                disabled={isLoading}
            />
        </div>

        <Button 
            className="w-full h-14 text-lg rounded-xl mb-6" 
            onClick={() => handleVerify(otp)}
            disabled={otp.length !== 6}
            isLoading={isLoading}
            loadingText="Verifying..."
        >
            Verify & Continue
        </Button>

        <div className="text-sm text-gray-500">
            {timeLeft > 0 ? (
                <p>Code expires in <span className="font-semibold text-[#E03E3E]">{formatTime(timeLeft)}</span></p>
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-red-500 font-medium">Code expired</p>
                    <button 
                        onClick={handleResend}
                        className="text-[#E03E3E] hover:underline font-semibold"
                    >
                        Resend Code
                    </button>
                </div>
            )}
        </div>
        
        {timeLeft > 0 && (
            <button 
                onClick={handleResend}
                className="mt-6 text-sm text-gray-400 hover:text-gray-700 underline"
            >
                Didn't receive it? Resend
            </button>
        )}
      </div>
    </div>
  );
}
