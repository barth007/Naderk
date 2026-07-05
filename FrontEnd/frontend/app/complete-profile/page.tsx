"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { User, FileText, LayoutGrid, ChevronRight, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/Checkbox';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import DashboardNavbar from '@/components/layout/DashboardNavbar';

const profileSchema = z.object({
  full_name: z.string().min(2, "Full name is required."),
  email: z.string().email("Please enter a valid email address."),
  phone_number: z.string().min(10, "Phone number is required."),
  dob: z.string().min(1, "Date of Birth is required."),
  gender: z.string().min(1, "Gender is required."),
  state: z.string().min(1, "State is required."),
  city: z.string().min(1, "City is required."),
  address: z.string().min(1, "Street address is required."),
  delivery_address: z.string().optional(),

  insurance_provider: z.string().optional(),
  policy_number: z.string().optional(),
  primary_physician: z.string().optional(),
  reason_for_visit: z.string().optional(),

  emergency_contact_name: z.string().min(2, "Emergency contact name is required."),
  emergency_contact_relationship: z.string().min(2, "Relationship is required."),
  emergency_contact_phone: z.string().min(10, "Emergency contact phone is required."),
  emergency_contact_email: z.string().email("Please enter a valid email address.").optional().or(z.literal("")),

  terms: z.boolean().refine(val => val === true, "You must acknowledge the terms."),
  hipaa: z.boolean().refine(val => val === true, "You must consent to the HIPAA notice."),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.first_name ? `${user.first_name} ${user.last_name}`.trim() : "",
      email: user?.email || "",
    }
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.profile_completion_status === 'COMPLETED') {
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (user) {
      if (user.first_name) setValue('full_name', `${user.first_name} ${user.last_name}`.trim());
      if (user.email) setValue('email', user.email);
    }
  }, [user, setValue]);

  const onSubmit = async (data: ProfileFormValues) => {
    setIsLoading(true);
    try {
      await apiClient.put('/users/profile/', {
        phone_number: data.phone_number,
        dob: data.dob,
        gender: data.gender,
        state: data.state,
        city: data.city,
        address: data.address,
        delivery_address: data.delivery_address || null,
        insurance_provider: data.insurance_provider,
        policy_number: data.policy_number,
        primary_physician: data.primary_physician,
        reason_for_visit: data.reason_for_visit,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_relationship: data.emergency_contact_relationship,
        emergency_contact_phone: data.emergency_contact_phone,
        emergency_contact_email: data.emergency_contact_email,
      });

      if (user) {
        setUser({ ...user, profile_completion_status: 'COMPLETED' });
      }

      toast.success("Registration completed successfully!");
      // redirect
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error("Failed to complete registration. Please check the fields.");
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col font-sans">
      {/* Header */}
      <DashboardNavbar />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto pt-8 pb-20 px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <LayoutGrid className="w-4 h-4" />
          <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
          <span className="text-[#E03E3E] font-medium">Patient Profile</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Profile</h1>
          <p className="text-gray-500 text-base">Complete the form below to update your profile.</p>
        </div>

        <div className="bg-white rounded-[1.5rem] p-5 md:p-10 shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">

            {/* Section 1: Personal Info */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <User className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Full Name <span className="text-[#E03E3E]">*</span></label>
                  <Input placeholder="e.g. John Doe" {...register('full_name')} error={errors.full_name?.message} readOnly className="bg-gray-50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Email Address <span className="text-[#E03E3E]">*</span></label>
                  <Input type="email" placeholder="e.g. johndoe@gmail.com" {...register('email')} error={errors.email?.message} readOnly className="bg-gray-50" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Phone Number <span className="text-[#E03E3E]">*</span></label>
                  <Input type="tel" placeholder="e.g. +234 801 234 5678" {...register('phone_number')} error={errors.phone_number?.message} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Date of Birth <span className="text-[#E03E3E]">*</span></label>
                  <Input type="date" {...register('dob')} error={errors.dob?.message} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Gender <span className="text-[#E03E3E]">*</span></label>
                  <select
                    {...register('gender')}
                    className="flex h-11 md:h-12 w-full rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E03E3E]"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <p className="text-xs text-red-500 mt-1.5">{errors.gender.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">State <span className="text-[#E03E3E]">*</span></label>
                  <Input placeholder="e.g. Lagos" {...register('state')} error={errors.state?.message} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">City <span className="text-[#E03E3E]">*</span></label>
                  <Input placeholder="e.g. Ikeja" {...register('city')} error={errors.city?.message} />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Street Address <span className="text-[#E03E3E]">*</span></label>
                  <Input placeholder="e.g. 123 Main Street" {...register('address')} error={errors.address?.message} />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Delivery Address
                    <span className="ml-2 text-[10px] font-normal text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded">Optional</span>
                  </label>
                  <textarea
                    {...register('delivery_address')}
                    rows={2}
                    placeholder="e.g. 14 Lugbe Road, Opposite Zenith Bank, Abuja, FCT — leave blank to use your street address above"
                    className="flex w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E03E3E] resize-none"
                  />
                  <p className="text-[11px] text-gray-400">
                    Used for order deliveries from the marketplace. Leave blank to use your primary address.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Medical Info */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Insurance & Medical History</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Primary Insurance Provider</label>
                  <Input placeholder="e.g. Reliance HMO" {...register('insurance_provider')} error={errors.insurance_provider?.message} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Policy Number</label>
                  <Input placeholder="e.g. REL-12345678" {...register('policy_number')} error={errors.policy_number?.message} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Primary Care Physician</label>
                  <Input placeholder="e.g. Dr. Sarah Bwala" {...register('primary_physician')} error={errors.primary_physician?.message} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Reason for visit</label>
                  <textarea
                    {...register('reason_for_visit')}
                    rows={4}
                    placeholder="Briefly describe any specific concerns or symptoms..."
                    className="flex w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E03E3E]"
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Emergency Contact */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <Phone className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">Emergency Contact</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Contact Name <span className="text-[#E03E3E]">*</span></label>
                  <Input placeholder="e.g. Jane Doe" {...register('emergency_contact_name')} error={errors.emergency_contact_name?.message} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Relationship <span className="text-[#E03E3E]">*</span></label>
                  <Input placeholder="e.g. Spouse, Sibling" {...register('emergency_contact_relationship')} error={errors.emergency_contact_relationship?.message} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Phone Number <span className="text-[#E03E3E]">*</span></label>
                  <Input type="tel" placeholder="e.g. +234 801 234 5678" {...register('emergency_contact_phone')} error={errors.emergency_contact_phone?.message} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Email Address (Optional)</label>
                  <Input type="email" placeholder="e.g. janedoe@gmail.com" {...register('emergency_contact_email')} error={errors.emergency_contact_email?.message} />
                </div>
              </div>
            </section>

            {/* Section 4: Compliance */}
            <section className="bg-gray-50 rounded-md p-6 border border-gray-100 space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox {...register('terms')} id="terms" />
                <label htmlFor="terms" className="text-xs text-gray-600 leading-snug cursor-pointer pt-0.5">
                  I acknowledge I have read and agreed to the <span className="text-[#E03E3E]">Terms of Service</span> and <span className="text-[#E03E3E]">Privacy Policy</span>.
                </label>
              </div>
              {errors.terms && <p className="text-xs text-red-500 ml-7">{errors.terms.message}</p>}

              <div className="flex items-start gap-3">
                <Checkbox {...register('hipaa')} id="hipaa" />
                <label htmlFor="hipaa" className="text-xs text-gray-600 leading-snug cursor-pointer pt-0.5">
                  I consent to the use and disclosure of my protected health information for treatment, payment, and healthcare operations as described in the <span className="text-[#E03E3E]">HIPAA Notice</span>.
                </label>
              </div>
              {errors.hipaa && <p className="text-xs text-red-500 ml-7">{errors.hipaa.message}</p>}
            </section>

            <Button type="submit" className="w-full h-12 text-base rounded-md mt-8" isLoading={isLoading} loadingText="Processing...">
              Complete Profile
            </Button>
          </form>
        </div>

        {/* Footer */}
        <footer className="mt-12 mb-8 text-center text-xs text-gray-500 space-y-3">
          <p>© {new Date().getFullYear()} NaderkEye Care. All rights reserved.</p>
          <div className="flex items-center justify-center gap-6">
            <a href="#" className="hover:text-gray-900">• Privacy Policy</a>
            <a href="#" className="hover:text-gray-900">• Terms of Service</a>
            <a href="#" className="hover:text-gray-900">• Patient's Rights</a>
          </div>
        </footer>

      </main>
    </div>
  );
}
