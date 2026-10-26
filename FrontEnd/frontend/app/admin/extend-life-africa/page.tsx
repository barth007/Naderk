'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, HandHeart, HeartPulse, Loader2, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { TableContainer, Table, TableHead, TableBody, TableRow, Th, Td } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { toastApiError } from '@/lib/api-errors';
import { formatMoney } from '@/components/page/extend-life-africa/DonationCard';
import {
  useAdminDonations, useAdminVolunteers, useReviewVolunteer,
  type AdminVolunteer, type DonationCurrency, type VolunteerStatus,
} from '@/services/donations/donations.hooks';

const PAGE_SIZE = 20;

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const selectCls = 'border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-green-50 text-green-700',
  PENDING: 'bg-amber-50 text-amber-700',
  FAILED: 'bg-red-50 text-red-700',
  NEW: 'bg-blue-50 text-blue-700',
  CONTACTED: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-green-50 text-green-700',
  DECLINED: 'bg-gray-100 text-gray-600',
};

function Pill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative flex-1 min-w-[220px]">
      <span className="sr-only">{placeholder}</span>
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20" />
    </label>
  );
}

// ── Donations ────────────────────────────────────────────────────────────────

function DonationsTab() {
  const [status, setStatus] = useState('PAID');
  const [frequency, setFrequency] = useState('');
  const [currency, setCurrency] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminDonations({ status, frequency, currency, q, page, page_size: PAGE_SIZE });
  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(['NGN', 'GBP', 'USD'] as DonationCurrency[]).map((code) => {
          const row = data?.totals.find((t) => t.currency === code);
          return (
            <Card key={code} className="p-5">
              <p className="text-xs font-semibold text-gray-500">Received in {code}</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">{formatMoney(parseFloat(row?.amount ?? '0'), code)}</p>
              <p className="text-xs text-gray-500 mt-1">{row?.count ?? 0} paid gift{row?.count === 1 ? '' : 's'}</p>
            </Card>
          );
        })}
        <Card className="p-5">
          <p className="text-xs font-semibold text-gray-500">Annual donors</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{data?.annual_donors ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Reminded a year after giving</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchBox value={q} onChange={reset(setQ)} placeholder="Search donor, email or reference" />
        <select aria-label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Awaiting payment</option>
          <option value="FAILED">Failed</option>
        </select>
        <select aria-label="Frequency" value={frequency} onChange={(e) => reset(setFrequency)(e.target.value)} className={selectCls}>
          <option value="">One-time and annual</option>
          <option value="ONE_TIME">One-time</option>
          <option value="ANNUAL">Annual</option>
        </select>
        <select aria-label="Currency" value={currency} onChange={(e) => reset(setCurrency)(e.target.value)} className={selectCls}>
          <option value="">All currencies</option>
          <option value="NGN">NGN</option>
          <option value="GBP">GBP</option>
          <option value="USD">USD</option>
        </select>
      </div>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <Th>Donor</Th><Th>Amount</Th><Th>For</Th><Th>Frequency</Th><Th>Status</Th><Th>Date</Th><Th>Next reminder</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow><Td colSpan={7}><span className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Loading gifts…</span></Td></TableRow>
            )}
            {!isLoading && data?.results.length === 0 && (
              <TableRow><Td colSpan={7}><span className="text-gray-500">No gifts match these filters.</span></Td></TableRow>
            )}
            {data?.results.map((d) => (
              <TableRow key={d.id}>
                <Td>
                  <p className="font-semibold text-gray-900">{d.donor_name}</p>
                  <p className="text-xs text-gray-500">{d.donor_email}</p>
                  {d.dedicated_to && <p className="text-xs text-gray-500 mt-0.5">In honour of {d.dedicated_to}</p>}
                </Td>
                <Td><span className="font-semibold">{formatMoney(parseFloat(d.amount), d.currency)}</span></Td>
                <Td>{d.purpose_display}</Td>
                <Td>{d.frequency === 'ANNUAL' ? 'Annual' : 'One-time'}</Td>
                <Td><Pill status={d.status} label={d.status_display} /></Td>
                <Td>
                  {date(d.paid_at ?? d.created_at)}
                  {d.payment_reference && <p className="text-[11px] text-gray-400 font-mono">{d.payment_reference}</p>}
                </Td>
                <Td>{d.frequency === 'ANNUAL' ? (d.next_reminder_on ? date(d.next_reminder_on) : d.reminder_sent_at ? `Sent ${date(d.reminder_sent_at)}` : '—') : '—'}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} totalItems={data.count}
          shownItems={data.results.length} noun="gifts" onPageChange={setPage} />
      )}
    </div>
  );
}

// ── Volunteers ───────────────────────────────────────────────────────────────

const VOLUNTEER_STATUSES: { value: VolunteerStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'DECLINED', label: 'Declined' },
];

function VolunteerDetail({ application }: { application: AdminVolunteer }) {
  const review = useReviewVolunteer();
  const [notes, setNotes] = useState(application.staff_notes);

  const save = (body: { status?: VolunteerStatus; staff_notes?: string }, message: string) =>
    review.mutate({ id: application.id, ...body }, {
      onSuccess: () => toast.success(message),
      onError: (e) => toastApiError(e, 'Could not update the application.'),
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 bg-gray-50 rounded-lg p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-gray-500">Phone</dt><dd>{application.phone || '—'}</dd>
        <dt className="text-gray-500">Country</dt><dd>{application.country || '—'}</dd>
        <dt className="text-gray-500">Registration no.</dt><dd>{application.registration_number || '—'}</dd>
        <dt className="text-gray-500">Prefers</dt><dd>{application.session_format_display}</dd>
        <dt className="text-gray-500 col-span-2">Message</dt>
        <dd className="col-span-2 whitespace-pre-line">{application.message || '—'}</dd>
        {application.reviewed_by_name && (<><dt className="text-gray-500">Last updated by</dt><dd>{application.reviewed_by_name}</dd></>)}
      </dl>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {VOLUNTEER_STATUSES.map((s) => (
            <button key={s.value} type="button" aria-pressed={application.status === s.value} disabled={review.isPending}
              onClick={() => save({ status: s.value }, `Marked ${s.label.toLowerCase()}`)}
              className={`text-xs font-semibold px-3 py-2 rounded-md border ${
                application.status === s.value ? 'bg-[#E03E3E] text-white border-[#E03E3E]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="text-xs font-semibold text-gray-500" htmlFor={`notes-${application.id}`}>Notes for the team</label>
        <textarea id={`notes-${application.id}`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white resize-y focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20" />
        <div className="flex gap-2">
          <button type="button" disabled={review.isPending || notes === application.staff_notes}
            onClick={() => save({ staff_notes: notes }, 'Notes saved')}
            className="text-xs font-semibold px-3.5 py-2 rounded-md bg-gray-900 text-white disabled:opacity-40">
            Save notes
          </button>
          <a href={`mailto:${application.email}`}
            className="text-xs font-semibold px-3.5 py-2 rounded-md border border-gray-200 bg-white text-gray-700 inline-flex items-center gap-1.5 hover:bg-gray-100">
            Email {application.full_name.split(' ')[0]} <ExternalLink className="w-3 h-3" aria-hidden />
          </a>
        </div>
      </div>
    </div>
  );
}

function VolunteersTab() {
  const [status, setStatus] = useState<string>('NEW');
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useAdminVolunteers({ status, role, q, page, page_size: PAGE_SIZE });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[{ value: '', label: 'All' }, ...VOLUNTEER_STATUSES].map((s) => (
          <button key={s.value || 'all'} type="button" aria-pressed={status === s.value}
            onClick={() => { setStatus(s.value); setPage(1); }}
            className={`text-xs font-semibold px-3.5 py-2 rounded-md border ${
              status === s.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            {s.label}
            {s.value && data && <span className="ml-1.5 opacity-70">{data.status_counts[s.value as VolunteerStatus] ?? 0}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name or email" />
        <select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All roles</option>
          <option value="GP">GP</option>
          <option value="NURSE">Nurse</option>
          <option value="NUTRITIONIST">Nutritionist</option>
        </select>
      </div>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow><Th>Applicant</Th><Th>Role</Th><Th>Availability</Th><Th>Status</Th><Th>Applied</Th><Th>{' '}</Th></TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow><Td colSpan={6}><span className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Loading applications…</span></Td></TableRow>
            )}
            {!isLoading && data?.results.length === 0 && (
              <TableRow><Td colSpan={6}><span className="text-gray-500">No applications here.</span></Td></TableRow>
            )}
            {data?.results.map((a) => (
              <React.Fragment key={a.id}>
                <TableRow>
                  <Td><p className="font-semibold text-gray-900">{a.full_name}</p><p className="text-xs text-gray-500">{a.email}</p></Td>
                  <Td>{a.role_display}</Td>
                  <Td>{a.session_format_display}</Td>
                  <Td><Pill status={a.status} label={a.status_display} /></Td>
                  <Td>{date(a.created_at)}</Td>
                  <Td>
                    <button type="button" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}
                      className="text-xs font-semibold text-[#E03E3E] hover:underline">
                      {open === a.id ? 'Close' : 'Review'}
                    </button>
                  </Td>
                </TableRow>
                {open === a.id && (
                  <TableRow><Td colSpan={6}><VolunteerDetail key={a.updated_at} application={a} /></Td></TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} totalItems={data.count}
          shownItems={data.results.length} noun="applications" onPageChange={setPage} />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function ExtendLifeAfricaAdmin() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') === 'volunteers' ? 'volunteers' : 'donations';
  const tabs = [
    { id: 'donations', label: 'Donations', Icon: HeartPulse },
    { id: 'volunteers', label: 'Volunteers', Icon: Users },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-[#FDE8EC] flex items-center justify-center">
            <HandHeart className="w-5 h-5 text-[#E03E3E]" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Extend Life Africa</h1>
            <p className="text-sm text-gray-500">Gifts from the public page and offers to volunteer.</p>
          </div>
        </div>
        <a href="/extend-life-africa" target="_blank" rel="noreferrer"
          className="text-xs font-semibold px-3.5 py-2 rounded-md border border-gray-200 bg-white text-gray-700 inline-flex items-center gap-1.5 hover:bg-gray-50">
          View page <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      </div>

      <div className="flex gap-1 border-b border-gray-200" role="tablist">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            onClick={() => router.replace(`/admin/extend-life-africa?tab=${id}`)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${
              tab === id ? 'border-[#E03E3E] text-[#E03E3E]' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            <Icon className="w-4 h-4" aria-hidden />{label}
          </button>
        ))}
      </div>

      {tab === 'donations' ? <DonationsTab /> : <VolunteersTab />}
      <p className="text-xs text-gray-500">
        The page&apos;s text, prices and contact details are edited in CMS → Page Content → Extend Life Africa.
      </p>
    </div>
  );
}

export default function ExtendLifeAfricaAdminPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}>
      <ExtendLifeAfricaAdmin />
    </Suspense>
  );
}
