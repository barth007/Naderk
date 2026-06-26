import React, { useRef, useState } from 'react';
import { UseFormRegister, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/Checkbox';
import { User, Phone, Briefcase, Clock, Image as ImageIcon, Upload, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface SectionProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  setValue?: UseFormSetValue<any>;
  watch?: any;
  user?: any;
}

export function PersonalInformationSection({ register, errors, user }: SectionProps) {
  const hasName = !!(user?.first_name && user?.last_name);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
        <User className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">
            First Name <span className="text-[#E03E3E]">*</span>
          </label>
          <Input
            placeholder="e.g. John"
            {...register('first_name')}
            error={errors.first_name?.message as string | undefined}
            readOnly={hasName}
            className={hasName ? 'bg-gray-50 text-gray-500' : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">
            Last Name <span className="text-[#E03E3E]">*</span>
          </label>
          <Input
            placeholder="e.g. Doe"
            {...register('last_name')}
            error={errors.last_name?.message as string | undefined}
            readOnly={hasName}
            className={hasName ? 'bg-gray-50 text-gray-500' : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Date of Birth <span className="text-[#E03E3E]">*</span></label>
          <Input type="date" {...register('dob')} error={errors.dob?.message as string | undefined} />
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
          {errors.gender && <p className="text-xs text-red-500 mt-1.5">{errors.gender.message as string}</p>}
        </div>
      </div>
    </section>
  );
}

export function ContactInformationSection({ register, errors }: SectionProps) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
        <Phone className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-bold text-gray-900">Contact Information</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Phone Number <span className="text-[#E03E3E]">*</span></label>
          <Input type="tel" placeholder="e.g. +234 801 234 5678" {...register('phone_number')} error={errors.phone_number?.message as string | undefined} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Email Address (Read-only)</label>
          <Input type="email" {...register('email')} readOnly className="bg-gray-50 text-gray-500" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">State <span className="text-[#E03E3E]">*</span></label>
          <Input placeholder="e.g. Lagos" {...register('state')} error={errors.state?.message as string | undefined} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">City <span className="text-[#E03E3E]">*</span></label>
          <Input placeholder="e.g. Ikeja" {...register('city')} error={errors.city?.message as string | undefined} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-semibold text-gray-700">Street Address <span className="text-[#E03E3E]">*</span></label>
          <Input placeholder="e.g. 123 Main Street" {...register('address')} error={errors.address?.message as string | undefined} />
        </div>
      </div>
    </section>
  );
}

export function ProfessionalInformationSection({ register, errors, watch }: SectionProps & { role: string }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
        <Briefcase className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-bold text-gray-900">Professional Details</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Specialization <span className="text-[#E03E3E]">*</span></label>
          <select
            {...register('specialization')}
            className="flex h-11 md:h-12 w-full rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E03E3E]"
          >
            <option value="">Select Specialization</option>
            <option value="OPTOMETRIST">Optometrist</option>
            <option value="OPHTHALMOLOGIST">Ophthalmologist</option>
            <option value="ENT">ENT Specialist</option>
            <option value="GENERAL_PRACTITIONER">General Practitioner</option>
          </select>
          {errors.specialization && <p className="text-xs text-red-500 mt-1.5">{errors.specialization.message as string}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">License Number <span className="text-[#E03E3E]">*</span></label>
          <Input placeholder="e.g. LIC-12345" {...register('license_number')} error={errors.license_number?.message as string | undefined} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Years of Experience <span className="text-[#E03E3E]">*</span></label>
          <Input type="number" placeholder="e.g. 5" {...register('years_of_experience')} error={errors.years_of_experience?.message as string | undefined} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Employment Date</label>
          <Input type="date" {...register('employment_date')} error={errors.employment_date?.message as string | undefined} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-semibold text-gray-700">Biography / Summary <span className="text-[#E03E3E]">*</span></label>
          <textarea
            {...register('bio')}
            rows={4}
            placeholder="Brief professional bio summary..."
            className="flex w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E03E3E]"
          />
          {errors.bio && <p className="text-xs text-red-500 mt-1.5">{errors.bio.message as string}</p>}
        </div>
      </div>
    </section>
  );
}

export function AvailabilitySection({ register, errors }: SectionProps) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
        <Clock className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-bold text-gray-900">Availability & Scheduling</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Max Daily Patients <span className="text-[#E03E3E]">*</span></label>
          <Input type="number" placeholder="e.g. 15" {...register('max_daily_patients')} error={errors.max_daily_patients?.message as string | undefined} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">Appointment Buffer (minutes)</label>
          <Input type="number" placeholder="e.g. 10" {...register('appointment_buffer_minutes')} error={errors.appointment_buffer_minutes?.message as string | undefined} />
        </div>

        <div className="md:col-span-2 space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="flex items-start gap-3">
            <Checkbox {...register('telehealth_enabled')} id="telehealth_enabled" />
            <label htmlFor="telehealth_enabled" className="text-sm text-gray-700 font-semibold cursor-pointer">
              Enable Telehealth consultations
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox {...register('is_accepting_patients')} id="is_accepting_patients" />
            <label htmlFor="is_accepting_patients" className="text-sm text-gray-700 font-semibold cursor-pointer">
              Currently accepting new patients
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

type ImageField = 'profile_picture' | 'cover_photo';

function ImageUploadField({
  label,
  field,
  setValue,
}: {
  label: string;
  field: ImageField;
  setValue: UseFormSetValue<any>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/users/upload-image/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.data.url;
      setValue(field, url);
    } catch {
      toast.error('Failed to upload image. Please try again.');
      setPreview(null);
      setValue(field, '');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setValue(field, '');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed cursor-pointer transition-colors
          ${uploading ? 'border-gray-200 bg-gray-50 cursor-wait' : 'border-gray-300 bg-white hover:border-[#E03E3E] hover:bg-red-50'}`}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" className="w-full h-full object-cover rounded-xl" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="absolute top-2 right-2 bg-white/90 p-1 rounded-full shadow text-gray-600 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                <span className="text-xs text-gray-500 font-medium">Uploading…</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Upload className="w-6 h-6" />
            <span className="text-xs font-medium">{uploading ? 'Uploading…' : 'Click to upload'}</span>
            <span className="text-[10px]">PNG, JPG, WEBP up to 5 MB</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

export function ProfilePhotoUploadSection({ errors, setValue }: SectionProps) {
  if (!setValue) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
        <ImageIcon className="w-5 h-5 text-gray-700" />
        <h2 className="text-lg font-bold text-gray-900">Profile Media</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ImageUploadField label="Profile Picture" field="profile_picture" setValue={setValue} />
        <ImageUploadField label="Cover Photo" field="cover_photo" setValue={setValue} />
      </div>
    </section>
  );
}
