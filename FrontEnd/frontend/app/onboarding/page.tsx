"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { LayoutGrid, ChevronRight, FileText, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/Checkbox';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import DashboardNavbar from '@/components/layout/DashboardNavbar';

import {
  PersonalInformationSection,
  ContactInformationSection,
  ProfessionalInformationSection,
  AvailabilitySection,
  ProfilePhotoUploadSection,
} from '@/components/onboarding/OnboardingFormSections';

const patientSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  email: z.string().email(),
  dob: z.string().min(1, "Date of Birth is required."),
  gender: z.string().min(1, "Gender is required."),
  phone_number: z.string().min(10, "Phone number is required."),
  state: z.string().min(1, "State is required."),
  city: z.string().min(1, "City is required."),
  address: z.string().min(1, "Street address is required."),
  
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

const doctorSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  email: z.string().email(),
  dob: z.string().min(1, "Date of Birth is required."),
  gender: z.string().min(1, "Gender is required."),
  phone_number: z.string().min(10, "Phone number is required."),
  state: z.string().min(1, "State is required."),
  city: z.string().min(1, "City is required."),
  address: z.string().min(1, "Street address is required."),
  
  specialization: z.string().min(1, "Specialization is required."),
  license_number: z.string().min(1, "License number is required."),
  years_of_experience: z.coerce.number().min(0, "Years of experience must be 0 or more."),
  employment_date: z.string().optional().or(z.literal("")),
  bio: z.string().min(10, "Bio must be at least 10 characters."),
  
  max_daily_patients: z.coerce.number().min(1, "Max daily patients must be at least 1."),
  appointment_buffer_minutes: z.coerce.number().optional(),
  telehealth_enabled: z.boolean().optional(),
  is_accepting_patients: z.boolean().optional(),
  
  profile_picture: z.string().optional(),
  cover_photo: z.string().optional(),
});

const defaultStaffSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  email: z.string().email(),
  dob: z.string().min(1, "Date of Birth is required."),
  gender: z.string().min(1, "Gender is required."),
  phone_number: z.string().min(10, "Phone number is required."),
  state: z.string().min(1, "State is required."),
  city: z.string().min(1, "City is required."),
  address: z.string().min(1, "Street address is required."),
  profile_picture: z.string().optional(),
  cover_photo: z.string().optional(),
});

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const role = user?.role || 'PATIENT';
  const schema = role === 'DOCTOR' ? doctorSchema : role === 'PATIENT' ? patientSchema : defaultStaffSchema;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      dob: user?.dob || '',
      gender: user?.gender || '',
      phone_number: user?.phone_number || '',
      telehealth_enabled: true,
      is_accepting_patients: true,
      max_daily_patients: 15,
      appointment_buffer_minutes: 10,
    } as any
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.profile_completion_status === 'COMPLETED') {
      const r = user.role;
      if (r === 'DOCTOR') router.push('/doctor/dashboard');
      else if (r === 'OPTICIAN') router.push('/optician/dashboard');
      else if (r === 'MEDICAL_AGENT') router.push('/agent/dashboard');
      else if (r === 'ADMIN' || r === 'SUPER_ADMIN') router.push('/admin/dashboard');
      else router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (user) {
      if (user.first_name) setValue('first_name', user.first_name);
      if (user.last_name) setValue('last_name', user.last_name);
      if (user.email) setValue('email', user.email);
      if (user.dob) setValue('dob', user.dob);
      if (user.gender) setValue('gender', user.gender);
      if (user.phone_number) setValue('phone_number', user.phone_number);
    }
  }, [user, setValue]);

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      if (role === 'DOCTOR') {
        await apiClient.put('/users/profile/', {
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number,
          date_of_birth: data.dob,
          gender: data.gender,
          specialization: data.specialization,
          license_number: data.license_number,
          years_of_experience: data.years_of_experience,
          employment_date: data.employment_date || null,
          bio: data.bio,
          max_daily_patients: data.max_daily_patients,
          appointment_buffer_minutes: data.appointment_buffer_minutes,
          telehealth_enabled: data.telehealth_enabled,
          is_accepting_patients: data.is_accepting_patients,
          profile_picture: data.profile_picture || null,
          cover_photo: data.cover_photo || null,
          office_address: data.address,
        });
      } else if (role === 'PATIENT') {
        await apiClient.put('/users/profile/', {
          phone_number: data.phone_number,
          dob: data.dob,
          gender: data.gender,
          state: data.state,
          city: data.city,
          address: data.address,
          insurance_provider: data.insurance_provider || null,
          policy_number: data.policy_number || null,
          primary_physician: data.primary_physician || null,
          reason_for_visit: data.reason_for_visit || null,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_relationship: data.emergency_contact_relationship,
          emergency_contact_phone: data.emergency_contact_phone,
          emergency_contact_email: data.emergency_contact_email || null,
        });
      } else {
        // Default staff / other role profiles
        await apiClient.put('/users/profile/', {
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number,
          date_of_birth: data.dob,
          gender: data.gender,
          profile_picture: data.profile_picture || null,
          cover_photo: data.cover_photo || null,
          office_address: data.address,
        });
      }

      if (user) {
        setUser({ ...user, profile_completion_status: 'COMPLETED' });
      }

      toast.success("Profile onboarding completed successfully!");

      if (role === 'DOCTOR') {
        window.location.href = '/doctor/dashboard';
      } else if (role === 'OPTICIAN') {
        window.location.href = '/optician/dashboard';
      } else if (role === 'MEDICAL_AGENT') {
        window.location.href = '/agent/dashboard';
      } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      toast.error("Failed to complete profile. Please verify your entries.");
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col font-sans">
      <DashboardNavbar />

      <main className="flex-1 w-full max-w-4xl mx-auto pt-8 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <LayoutGrid className="w-4 h-4" />
          <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
          <span className="text-[#E03E3E] font-medium">{role.charAt(0) + role.slice(1).toLowerCase()} Onboarding</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Onboarding</h1>
          <p className="text-gray-500 text-base">Please fill in the required fields to finalize your profile setup.</p>
        </div>

        <div className="bg-white rounded-[1.5rem] p-5 md:p-10 shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            
            <PersonalInformationSection register={register} errors={errors} user={user} />

            <ContactInformationSection register={register} errors={errors} />

            {role === 'DOCTOR' && (
              <>
                <ProfessionalInformationSection register={register} errors={errors} role={role} watch={watch} />
                <AvailabilitySection register={register} errors={errors} />
                <ProfilePhotoUploadSection register={register} errors={errors} setValue={setValue} />
              </>
            )}

            {role === 'OPTICIAN' && (
              <>
                <ProfessionalInformationSection register={register} errors={errors} role={role} watch={watch} />
                <ProfilePhotoUploadSection register={register} errors={errors} setValue={setValue} />
              </>
            )}

            {role === 'PATIENT' && (
              <>
                {/* Medical History */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                    <FileText className="w-5 h-5 text-gray-700" />
                    <h2 className="text-lg font-bold text-gray-900">Insurance & Medical History</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Primary Insurance Provider</label>
                      <Input placeholder="e.g. Reliance HMO" {...register('insurance_provider')} error={errors.insurance_provider?.message as string | undefined} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Policy Number</label>
                      <Input placeholder="e.g. REL-12345678" {...register('policy_number')} error={errors.policy_number?.message as string | undefined} />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-semibold text-gray-700">Primary Care Physician</label>
                      <Input placeholder="e.g. Dr. Sarah Bwala" {...register('primary_physician')} error={errors.primary_physician?.message as string | undefined} />
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

                {/* Emergency Contact */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                    <Phone className="w-5 h-5 text-gray-700" />
                    <h2 className="text-lg font-bold text-gray-900">Emergency Contact</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Contact Name <span className="text-[#E03E3E]">*</span></label>
                      <Input placeholder="e.g. Jane Doe" {...register('emergency_contact_name')} error={errors.emergency_contact_name?.message as string | undefined} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Relationship <span className="text-[#E03E3E]">*</span></label>
                      <Input placeholder="e.g. Spouse, Sibling" {...register('emergency_contact_relationship')} error={errors.emergency_contact_relationship?.message as string | undefined} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Phone Number <span className="text-[#E03E3E]">*</span></label>
                      <Input type="tel" placeholder="e.g. +234 801 234 5678" {...register('emergency_contact_phone')} error={errors.emergency_contact_phone?.message as string | undefined} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Email Address (Optional)</label>
                      <Input type="email" placeholder="e.g. janedoe@gmail.com" {...register('emergency_contact_email')} error={errors.emergency_contact_email?.message as string | undefined} />
                    </div>
                  </div>
                </section>

                {/* Compliance checkboxes */}
                <section className="bg-gray-50 rounded-md p-6 border border-gray-100 space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox {...register('terms')} id="terms" />
                    <label htmlFor="terms" className="text-xs text-gray-600 leading-snug cursor-pointer pt-0.5">
                      I acknowledge I have read and agreed to the <span className="text-[#E03E3E]">Terms of Service</span> and <span className="text-[#E03E3E]">Privacy Policy</span>.
                    </label>
                  </div>
                  {errors.terms && <p className="text-xs text-red-500 ml-7">{errors.terms.message as string}</p>}

                  <div className="flex items-start gap-3">
                    <Checkbox {...register('hipaa')} id="hipaa" />
                    <label htmlFor="hipaa" className="text-xs text-gray-600 leading-snug cursor-pointer pt-0.5">
                      I consent to the use and disclosure of my protected health information for treatment, payment, and healthcare operations as described in the <span className="text-[#E03E3E]">HIPAA Notice</span>.
                    </label>
                  </div>
                  {errors.hipaa && <p className="text-xs text-red-500 ml-7">{errors.hipaa.message as string}</p>}
                </section>
              </>
            )}

            {role !== 'PATIENT' && role !== 'DOCTOR' && role !== 'OPTICIAN' && (
              <ProfilePhotoUploadSection register={register} errors={errors} setValue={setValue} />
            )}

            <Button type="submit" className="w-full h-12 text-base rounded-md mt-8" isLoading={isLoading} loadingText="Saving details...">
              Save and Continue to Dashboard
            </Button>
          </form>
        </div>

        <footer className="mt-12 mb-8 text-center text-xs text-gray-500 space-y-3">
          <p>© {new Date().getFullYear()} NaderkEye Care. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
