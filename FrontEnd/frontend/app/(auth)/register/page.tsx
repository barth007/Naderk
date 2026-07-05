"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { UserPlus, EyeOff, Eye, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/Checkbox';
import { apiClient } from '@/lib/api';
import { ProblemDetailsResponse } from '@/types';

const registerSchema = z.object({
  full_name: z.string().min(2, "Full name is required."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirm_password: z.string(),
  terms: z.boolean().refine(val => val === true, "You must agree to the Terms of Service."),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/register/', {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      });

      toast.success(response.data.message);
      // Store email temporarily for the OTP page
      if (typeof window !== 'undefined') {
          sessionStorage.setItem('verificationEmail', data.email);
      }
      router.push('/verify-otp');
    } catch (error) {
      const err = error as AxiosError<ProblemDetailsResponse>;
      if (err.response?.data) {
        const problem = err.response.data;
        if (problem.status === 400 && problem.errors) {
            Object.keys(problem.errors).forEach(key => {
                setError(key as keyof RegisterFormValues, { message: problem.errors![key][0] });
            });
        } else {
            toast.error(problem.title, { description: problem.detail });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1000px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch pt-8 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Left side: Image and Marketing Copy */}
      <div className="relative hidden lg:flex flex-col justify-center rounded-[1.5rem] overflow-hidden min-h-[500px] text-white p-10">
        {/* Placeholder for the background image, usually an absolute image or bg-cover class */}
        <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1579684385127-1ef15d508118?q=80&w=2000&auto=format&fit=crop')" }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
        
        {/* Content */}
        <div className="relative z-10 text-center">
            <div className="w-16 h-16 bg-[#E03E3E] rounded-xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Eye className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-4 text-white drop-shadow-md">
                Expert Care for Your<br/>Vision
            </h1>
            
            <p className="text-base text-white/90 mb-8 max-w-md mx-auto drop-shadow">
                Join NaderkEye Center's patient portal to manage appointments, view medical records, and communicate directly with your eyecare specialists.
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-left max-w-sm mx-auto">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#E03E3E]" />
                    <span className="font-medium text-white drop-shadow">Easy Scheduling</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#E03E3E]" />
                    <span className="font-medium text-white drop-shadow">Secure Records</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#E03E3E]" />
                    <span className="font-medium text-white drop-shadow">Expert Consults</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#E03E3E]" />
                    <span className="font-medium text-white drop-shadow">Direct Messaging</span>
                </div>
            </div>
        </div>
      </div>

      {/* Right side: Registration Form */}
      <div className="bg-white rounded-[1.5rem] p-8 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center">
        <div className="w-10 h-10 rounded-full bg-[#faeaea] text-[#E03E3E] flex items-center justify-center mb-4">
          <UserPlus className="w-4 h-4" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-1.5">Create Account</h2>
        <p className="text-gray-500 mb-8 text-sm">The first step to accessing your patient portal.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Full Name</label>
            <Input 
              placeholder="Sarah Bwala" 
              {...register('full_name')}
              error={errors.full_name?.message}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Email address</label>
            <Input 
              type="email" 
              placeholder="sarahbwala@example.com" 
              {...register('email')}
              error={errors.email?.message}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Password</label>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••••••" 
                {...register('password')}
                error={errors.password?.message}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <Eye className="w-5 h-5"/> : <EyeOff className="w-5 h-5"/>}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Confirm Password</label>
            <div className="relative">
              <Input 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="••••••••••••" 
                {...register('confirm_password')}
                error={errors.confirm_password?.message}
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <Eye className="w-5 h-5"/> : <EyeOff className="w-5 h-5"/>}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-start gap-2.5">
                <Checkbox {...register('terms')} id="terms" />
                <label htmlFor="terms" className="text-xs text-gray-500 leading-snug cursor-pointer pt-0.5">
                    By creating an account, you agree to NaderkEye Center's <Link href="/terms" className="text-[#E03E3E] hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-[#E03E3E] hover:underline">Privacy Policy</Link>.
                </label>
            </div>
            {errors.terms && <p className="text-xs text-red-500 mt-1 ml-6">{errors.terms.message}</p>}
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full h-12 text-base rounded-xl" isLoading={isLoading} loadingText="Creating Account...">
              Create Account
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account? <Link href="/login" className="text-[#E03E3E] font-medium hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
