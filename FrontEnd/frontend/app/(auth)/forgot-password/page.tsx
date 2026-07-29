"use client";

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { Mail, ArrowLeft, CheckCircle2, KeyRound, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { ProblemDetailsResponse } from '@/types';

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  new_password: z.string().optional(),
  confirm_password: z.string().optional(),
});

const resetSchema = z.object({
  email: z.string().optional(),
  new_password: z.string().min(8, "Password must be at least 8 characters."),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: "Passwords do not match.",
  path: ['confirm_password'],
});

type FormValues = {
  email?: string;
  new_password?: string;
  confirm_password?: string;
};

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [done, setDone] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const activeSchema = token ? resetSchema : forgotSchema;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ 
    resolver: zodResolver(activeSchema) as any
  });

  const onSubmit = async (data: FormValues) => {
    if (token) {
      try {
        await apiClient.post('/auth/reset-password/', {
          token,
          new_password: data.new_password,
          confirm_password: data.confirm_password,
        });
        setDone(true);
      } catch (err) {
        const axiosError = err as AxiosError<ProblemDetailsResponse>;
        const fieldErrors = axiosError.response?.data?.errors as Record<string, string[]> | undefined;
        if (fieldErrors?.token) {
          toast.error(fieldErrors.token[0]);
        } else if (fieldErrors?.new_password) {
          setError('new_password', { message: fieldErrors.new_password[0] });
        } else {
          toast.error(axiosError.response?.data?.detail || "Something went wrong. Please try again.");
        }
      }
    } else {
      try {
        await apiClient.post('/auth/forgot-password/', { email: data.email });
        setSubmittedEmail(data.email || '');
        setSent(true);
      } catch (err) {
        const axiosError = err as AxiosError<ProblemDetailsResponse>;
        const detail = axiosError.response?.data?.detail;
        toast.error(detail || "Something went wrong. Please try again.");
      }
    }
  };

  // Success: Reset Password Complete
  if (token && done) {
    return (
      <div className="w-full max-w-md bg-white rounded-[1.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#e6f7ed] text-[#2e7d32] flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Password reset!</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your password has been updated. You can now log in with your new password.
        </p>
        <Button
          onClick={() => router.push('/login')}
          className="w-full h-12 text-base rounded-xl bg-[#E03E3E] hover:bg-[#c73333] text-white"
        >
          Go to login
        </Button>
      </div>
    );
  }

  // Success: Forgot Password Link Sent
  if (!token && sent) {
    return (
      <div className="w-full max-w-md bg-white rounded-[1.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#faeaea] text-[#E03E3E] flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-[#E03E3E]" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Check your inbox</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          We sent a password reset link to <strong className="text-gray-800">{submittedEmail}</strong>. It expires in 30 minutes.
        </p>
        <p className="text-xs text-gray-400">
          Didn&apos;t receive it? Check your spam folder or{' '}
          <button
            onClick={() => setSent(false)}
            className="text-[#E03E3E] hover:underline font-semibold"
          >
            try again
          </button>
          .
        </p>
        <Link href="/login" className="block mt-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  // Active form view
  return (
    <div className="w-full max-w-md bg-white rounded-[1.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-[#faeaea] text-[#E03E3E] flex items-center justify-center">
            {token ? (
              <KeyRound className="w-4 h-4" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1.5">
          {token ? 'Set new password' : 'Forgot password?'}
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          {token 
            ? 'Choose a strong password for your account.' 
            : "Enter your email address and we'll send you a link to reset your password."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {!token ? (
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-gray-700">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="new_password" className="text-sm font-semibold text-gray-700">
                New password
              </label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  error={errors.new_password?.message}
                  {...register('new_password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm_password" className="text-sm font-semibold text-gray-700">
                Confirm password
              </label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  error={errors.confirm_password?.message}
                  {...register('confirm_password')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full h-12 text-base rounded-xl bg-[#E03E3E] hover:bg-[#c73333] text-white"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (token ? 'Resetting...' : 'Sending...') 
              : (token ? 'Reset password' : 'Send reset link')}
          </Button>
        </div>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to login
      </Link>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
