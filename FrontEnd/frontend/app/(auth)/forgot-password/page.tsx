"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { ProblemDetailsResponse } from '@/types';

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    try {
      await apiClient.post('/auth/forgot-password/', { email: data.email });
      setSubmittedEmail(data.email);
      setSent(true);
    } catch (err) {
      const axiosError = err as AxiosError<ProblemDetailsResponse>;
      const detail = axiosError.response?.data?.detail;
      toast.error(detail || "Something went wrong. Please try again.");
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Check your inbox</h1>
          <p className="text-slate-600 dark:text-slate-400">
            We sent a password reset link to <strong>{submittedEmail}</strong>. It expires in 30 minutes.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Didn&apos;t receive it? Check your spam folder or{' '}
            <button
              onClick={() => setSent(false)}
              className="text-[#E03E3E] hover:underline font-medium"
            >
              try again
            </button>
            .
          </p>
          <Link href="/login" className="block mt-4 text-sm text-slate-600 dark:text-slate-400 hover:underline">
            Back to login
          </Link>
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
              <Mail className="h-8 w-8 text-[#E03E3E]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forgot password?</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#E03E3E] hover:bg-[#c73333] text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
