"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { LogIn, UserPlus, ShieldCheck, CalendarClock, EyeOff, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/Checkbox';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ProblemDetailsResponse, AuthTokens } from '@/types';

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuth(state => state.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login/', {
        email: data.email,
        password: data.password,
      });

      const tokens = response.data.data as AuthTokens;
      setAuth(tokens.user, tokens.access, tokens.refresh);
      toast.success(response.data.message);

      const { role, profile_completion_status } = tokens.user;

      if (profile_completion_status !== 'COMPLETED') {
        router.push('/onboarding');
        return;
      }

      if (role === 'DOCTOR') {
        router.push('/doctor/dashboard');
      } else if (role === 'OPTICIAN') {
        router.push('/optician/dashboard');
      } else if (role === 'MEDICAL_AGENT') {
        router.push('/agent/dashboard');
      } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      const err = error as AxiosError<ProblemDetailsResponse>;
      if (err.response?.data) {
        const problem = err.response.data;
        if (problem.status === 401 && problem.detail.includes('not verified')) {
            toast.error(problem.detail);
            router.push('/verify-otp');
        } else if (problem.status === 400 && problem.errors) {
            // Map validation errors to form fields
            Object.keys(problem.errors).forEach(key => {
                setError(key as keyof LoginFormValues, { message: problem.errors![key][0] });
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
    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch pt-8 pb-16 px-4">
      {/* Left Card: Login */}
      <div className="bg-white rounded-[1.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
        <div className="w-10 h-10 rounded-full bg-[#faeaea] text-[#E03E3E] flex items-center justify-center mb-5">
          <LogIn className="w-4 h-4" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Welcome Back!</h1>
        <p className="text-gray-500 mb-6 text-sm">Log in to access your medical records and appointments.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 flex-grow">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Email address</label>
            <Input 
              type="email" 
              placeholder="name@example.com" 
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

          <div className="flex items-center justify-between pt-2">
            <Checkbox label="Remember me" {...register('rememberMe')} />
            <Link href="/forgot-password" className="text-sm font-medium text-[#E03E3E] hover:underline">
              Forgot Password?
            </Link>
          </div>

          <div className="pt-4 mt-auto">
            <Button type="submit" className="w-full h-12 text-base rounded-xl" isLoading={isLoading} loadingText="Signing in...">
              Sign in
            </Button>
          </div>
        </form>
      </div>

      {/* Right Card: Registration Prompt */}
      <div className="bg-white rounded-[1.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
        <div className="w-10 h-10 rounded-full bg-[#faeaea] text-[#E03E3E] flex items-center justify-center mb-5">
          <UserPlus className="w-4 h-4" />
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">New Patient?</h2>
        <p className="text-gray-500 mb-6 text-sm leading-relaxed">
          Creating an account is fast and secure. You will be able to book appointments online and message our doctors directly.
        </p>

        <div className="space-y-5 mb-6 flex-grow">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E03E3E] flex items-center justify-center shrink-0">
              <ShieldCheck className="text-white w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">HIPAA Compliant</h3>
              <p className="text-xs text-gray-500 mt-0.5">Your health data is encrypted and protected.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E03E3E] flex items-center justify-center shrink-0">
              <CalendarClock className="text-white w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">Easy Scheduling</h3>
              <p className="text-xs text-gray-500 mt-0.5">View available slots and book in seconds.</p>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <Link href="/register">
            <Button variant="secondary" className="w-full h-12 text-base rounded-xl">
              Register New Account
            </Button>
          </Link>
        </div>

        {/* Footer links inside card */}
        <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="relative z-10 bg-white px-2 -mt-10 text-[10px] tracking-widest text-gray-400">HELP CENTER</span>
        </div>
        <div className="flex justify-center gap-6 text-xs text-gray-500 -mt-1">
            <button className="hover:text-gray-900">Contact Us</button>
            <button className="hover:text-gray-900">Location</button>
        </div>
      </div>
    </div>
  );
}
