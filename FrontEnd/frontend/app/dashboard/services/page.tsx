'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ChevronRight, Loader2, Stethoscope, Search } from 'lucide-react';
import { useMedicalServices } from '@/services/appointments/appointments.hooks';
import { MedicalService, BillingType } from '@/services/appointments/appointments.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BILLING_BADGE: Record<BillingType, { label: string; style: string }> = {
  PER_VISIT:    { label: 'Pay per visit',     style: 'bg-blue-50 text-blue-700' },
  MONTHLY:      { label: 'Monthly plan',      style: 'bg-purple-50 text-purple-700' },
  SESSION_PACK: { label: 'Session pack',      style: 'bg-amber-50 text-amber-700' },
};

function billingDescription(service: MedicalService) {
  const amount = `₦${parseFloat(service.fee).toLocaleString()}`;
  if (service.billing_type === 'PER_VISIT')
    return `${amount} per visit`;
  if (service.billing_type === 'MONTHLY')
    return `${amount} / month — unlimited sessions`;
  if (service.billing_type === 'SESSION_PACK')
    return `${amount} for ${service.sessions_included} sessions`;
  return amount;
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service, onBook }: { service: MedicalService; onBook: () => void }) {
  const badge = BILLING_BADGE[service.billing_type] ?? BILLING_BADGE.PER_VISIT;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group">
      {/* Icon + name */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
          <Stethoscope className="w-5 h-5 text-[#E03E3E]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 leading-snug">{service.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {service.required_specialization.toLowerCase().replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Description */}
      {service.description && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{service.description}</p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.style}`}>
          {badge.label}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full font-medium">
          <Clock className="w-3 h-3" />
          {service.duration_minutes} min
        </span>
      </div>

      {/* Price + CTA */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-auto">
        <div>
          <p className="text-base font-bold text-gray-900">
            ₦{parseFloat(service.fee).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">{billingDescription(service)}</p>
        </div>
        <button
          onClick={onBook}
          className="flex items-center gap-1.5 bg-[#E03E3E] hover:bg-[#c93535] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
        >
          Book <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const router = useRouter();
  const { data: services = [], isLoading } = useMedicalServices();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<BillingType | 'ALL'>('ALL');

  const filtered = services.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = activeFilter === 'ALL' || s.billing_type === activeFilter;
    return matchSearch && matchFilter;
  });

  function handleBook(service: MedicalService) {
    // Store selected service and route to the booking flow
    sessionStorage.setItem('selectedServiceId', service.id);
    sessionStorage.setItem('selectedServiceName', service.name);
    router.push('/dashboard/appointments/book');
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Our Services</h1>
        <p className="text-sm text-gray-500 mt-1">
          Book a consultation with one of our specialists.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20"
          />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'PER_VISIT', 'MONTHLY', 'SESSION_PACK'] as const).map((f) => {
            const labels: Record<string, string> = {
              ALL: 'All', PER_VISIT: 'Per visit', MONTHLY: 'Monthly', SESSION_PACK: 'Pack',
            };
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors whitespace-nowrap ${activeFilter === f ? 'bg-[#E03E3E] text-white border-[#E03E3E]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No services available</p>
          {search && <p className="text-xs mt-1">Try a different search term.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onBook={() => handleBook(service)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
