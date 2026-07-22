"use client";

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { ProblemDetailsResponse } from '@/types';

const schema = z.object({
  new_password: z.string().min(8, "Password must be at least 8 characters."),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: "Passwords do not match.",
  path: ['confirm_password'],
});

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    if (!token) {
      toast.error("Invalid reset link. Please request a new one.");
      return;
    }
    try {
      await apiClient.post('/auth/reset-password/', {
        token,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      });
      setDone(true);
    } catch (err) {
      const axiosError = err as AxiosError<ProblemDetailsResponse>;
      const errors = axiosError.response?.data?.errors as Record<string, string[]> | undefined;
      if (errors?.token) {
        toast.error(errors.token[0]);
      } else if (errors?.new_password) {
        setError('new_password', { message: errors.new_password[0] });
      } else {
        toast.error(axiosError.response?.data?.detail || "Something went wrong. Please try again.");
      }
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <p className="text-slate-600 dark:text-slate-400">Invalid or missing reset token.</p>
          <Link href="/forgot-password" className="text-[#E03E3E] hover:underline text-sm">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Password reset!</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Your password has been updated. You can now log in with your new password.
          </p>
          <Button
            onClick={() => router.push('/login')}
            className="w-full bg-[#E03E3E] hover:bg-[#c73333] text-white"
          >
            Go to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full">
              <KeyRound className="h-8 w-8 text-[#E03E3E]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Set new password</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="new_password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              New password
            </label>
            <div className="relative">
              <Input
                id="new_password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                {...register('new_password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.new_password && (
              <p className="text-xs text-red-500">{errors.new_password.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm_password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirm password
            </label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your password"
                autoComplete="new-password"
                {...register('confirm_password')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirm_password && (
              <p className="text-xs text-red-500">{errors.confirm_password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#E03E3E] hover:bg-[#c73333] text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Resetting...' : 'Reset password'}
          </Button>
        </form>

        <Link
          href="/login"
          className="block text-center text-sm text-slate-600 dark:text-slate-400 hover:underline"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
