'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, subDays, subMonths, subWeeks, subYears, isAfter } from 'date-fns';
import { Calendar, ChevronDown, Users, FileText, Droplets } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  Th,
  Td,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import {
  usePatientRecords,
  useMedicalRecordsOverview,
} from '@/services/medical-records/records.hooks';
import { PatientRecord, MedicalRecordsOverview } from '@/services/medical-records/records.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 4;

const STATUS_OPTIONS = ['All Statuses', 'Active', 'Inactive'];
const VISIT_RANGE_OPTIONS = ['Anytime', 'Last Week', 'Last Month', 'Last 3 Months', 'Last Year'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} hours ago`;
  if (diff < 172800) return 'Yesterday';
  return format(new Date(isoString), 'MMM d, yyyy');
}

function formatLastVisit(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return `${format(new Date(dateStr), 'MMMM do')}, standard visit`;
  } catch {
    return dateStr;
  }
}

function patientSinceYear(registerDate: string | null): string {
  if (!registerDate) return '';
  try {
    return String(new Date(registerDate).getFullYear());
  } catch {
    return '';
  }
}

function isActive(patient: PatientRecord): boolean {
  if (!patient.last_visit) return false;
  try {
    return isAfter(new Date(patient.last_visit), subMonths(new Date(), 6));
  } catch {
    return false;
  }
}

function visitInRange(lastVisit: string | null, range: string): boolean {
  if (range === 'Anytime' || !lastVisit) return true;
  try {
    const d = new Date(lastVisit);
    const now = new Date();
    if (range === 'Last Week') return isAfter(d, subWeeks(now, 1));
    if (range === 'Last Month') return isAfter(d, subMonths(now, 1));
    if (range === 'Last 3 Months') return isAfter(d, subMonths(now, 3));
    if (range === 'Last Year') return isAfter(d, subYears(now, 1));
  } catch {}
  return true;
}

// ─── Filter dropdown ──────────────────────────────────────────────────────────

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="relative">
        <select
          className="appearance-none border border-gray-200 rounded-md pl-3 pr-8 py-2 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 cursor-pointer min-w-[130px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

interface ActivityItem {
  label: string;
  sub: string;
  color: string;
}

function buildActivity(overview: MedicalRecordsOverview): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const enc of overview.recent_encounters.slice(0, 2)) {
    items.push({
      label: enc.diagnosis ? `Diagnosis: ${enc.diagnosis.slice(0, 40)}` : 'Consultation Recorded',
      sub: `${timeAgo(enc.created_at)} by Dr. ${enc.doctor_detail?.last_name ?? '—'}`,
      color: '#7c3aed',
    });
  }

  for (const scan of overview.recent_scans.slice(0, 1)) {
    items.push({
      label: `${scan.scan_type} Scan Uploaded`,
      sub: `${timeAgo(scan.created_at)} by ${scan.uploaded_by_name}`,
      color: '#3b82f6',
    });
  }

  for (const diag of overview.recent_diagnostics.slice(0, 1)) {
    items.push({
      label: diag.test_name,
      sub: timeAgo(diag.created_at),
      color: '#E03E3E',
    });
  }

  return items.slice(0, 4);
}

// ─── Patient detail panel ─────────────────────────────────────────────────────

function DetailPanel({ patient }: { patient: PatientRecord }) {
  const { data: overview, isLoading } = useMedicalRecordsOverview(patient.id);

  const activeMed = overview?.active_medications?.[0];
  const activity = overview ? buildActivity(overview) : [];

  const vitalsStr = patient.vitals || '';
  const iopMatch = vitalsStr.match(/IOP[:\s]+([^\s,]+\s*(?:mmHg)?)/i);
  const vaMatch = vitalsStr.match(/VA[:\s]+([^\s,]+)/i);
  const iop = iopMatch ? iopMatch[1] : null;
  const va = vaMatch ? vaMatch[1] : null;

  let nextAppt = '—';
  if (patient.next_appointment) {
    try {
      nextAppt = format(new Date(patient.next_appointment), "MMMM d, yyyy 'by' h:mmaaa");
    } catch {
      nextAppt = patient.next_appointment;
    }
  }

  const initials = patient.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <Card className="p-5 rounded-md border border-gray-100 shadow-sm">
        <div className="w-20 h-20 rounded-md bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500 mb-3 overflow-hidden">
          <span>{initials}</span>
        </div>

        <h2 className="font-bold text-gray-900 text-base">{patient.name}</h2>
        {patient.register_date && (
          <p className="text-xs text-gray-400 mt-0.5">Patient since {patientSinceYear(patient.register_date)}</p>
        )}

        {/* Vitals */}
        {(iop || va) && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {iop && (
              <div className="bg-gray-50 rounded-md p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">Intraocular Pressure</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{iop}</p>
                <p className="text-xs text-gray-400">mmHg</p>
              </div>
            )}
            {va && (
              <div className="bg-gray-50 rounded-md p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">Visual Acuity</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{va}</p>
                <p className="text-xs text-gray-400">OS</p>
              </div>
            )}
          </div>
        )}

        {/* Next appointment */}
        <div className="flex items-start gap-2.5 mt-4">
          <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#E03E3E]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700">Next Appointment</p>
            <p className="text-xs text-gray-500 mt-0.5">{nextAppt}</p>
          </div>
        </div>

        {/* Current RX */}
        <div className="flex items-start gap-2.5 mt-3">
          <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Droplets className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700">Current RX</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isLoading
                ? 'Loading…'
                : activeMed
                ? `${activeMed.name} ${activeMed.dosage}`
                : patient.current_rx || '—'}
            </p>
          </div>
        </div>

        {/* View Full Profile */}
        <Link href={`/admin/records/${patient.id}`} className="block mt-4">
          <button className="w-full bg-[#E03E3E] hover:bg-[#c93535] text-white font-semibold text-sm h-10 rounded-md transition-colors">
            View Full Profile
          </button>
        </Link>
      </Card>

      {/* Recent Activity */}
      <Card className="p-5 rounded-md border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Recent Records Activity</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-50 rounded-md animate-pulse" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <p className="text-xs text-gray-400">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {activity.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                  style={{ background: item.color }}
                />
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminRecordsPage() {
  const { data: allPatients = [], isLoading } = usePatientRecords();
  const [selected, setSelected] = useState<PatientRecord | null>(null);
  const [page, setPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [departmentFilter, setDepartmentFilter] = useState('All Department');
  const [visitRangeFilter, setVisitRangeFilter] = useState('Anytime');
  const [insuranceFilter, setInsuranceFilter] = useState('Any Provider');

  const departments = useMemo(() => {
    const set = new Set<string>();
    allPatients.forEach((p) => { if (p.complaints_summary) set.add(p.complaints_summary); });
    return ['All Department', ...Array.from(set).slice(0, 10)];
  }, [allPatients]);

  const filteredPatients = useMemo(() => {
    return allPatients.filter((p) => {
      if (statusFilter === 'Active' && !isActive(p)) return false;
      if (statusFilter === 'Inactive' && isActive(p)) return false;
      if (departmentFilter !== 'All Department' && p.complaints_summary !== departmentFilter) return false;
      if (!visitInRange(p.last_visit, visitRangeFilter)) return false;
      return true;
    });
  }, [allPatients, statusFilter, departmentFilter, visitRangeFilter, insuranceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedPatients = filteredPatients.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetFilters() {
    setStatusFilter('All Statuses');
    setDepartmentFilter('All Department');
    setVisitRangeFilter('Anytime');
    setInsuranceFilter('Any Provider');
    setPage(1);
  }

  const hasActiveFilters =
    statusFilter !== 'All Statuses' ||
    departmentFilter !== 'All Department' ||
    visitRangeFilter !== 'Anytime' ||
    insuranceFilter !== 'Any Provider';

  return (
    <div className="p-6 flex flex-col gap-5 max-w-screen-xl">
      {/* Header: title (left) + filters block (right) — same row */}
      <div className="flex items-start justify-between gap-8 flex-wrap">
        {/* Left — page title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Records</h1>
          <p className="text-sm text-gray-500 mt-0.5">View all patient&apos;s records</p>
        </div>

        {/* Right — Advanced Filters label + selects */}
        <div className="flex flex-col gap-2">
          {/* Top row: label + Reset All */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-gray-700">Advanced Filters</span>
            <button
              onClick={resetFilters}
              className={`text-sm font-semibold transition-colors ${
                hasActiveFilters
                  ? 'text-[#E03E3E] hover:text-[#c93535] cursor-pointer'
                  : 'text-gray-300 cursor-default pointer-events-none'
              }`}
            >
              Reset All
            </button>
          </div>

          {/* Filter selects row */}
          <div className="flex items-end gap-3 flex-wrap">
            <FilterSelect
              label="Patient Status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
            />
            <FilterSelect
              label="Department"
              value={departmentFilter}
              options={departments}
              onChange={(v) => { setDepartmentFilter(v); setPage(1); }}
            />
            <FilterSelect
              label="Last Visit Range"
              value={visitRangeFilter}
              options={VISIT_RANGE_OPTIONS}
              onChange={(v) => { setVisitRangeFilter(v); setPage(1); }}
            />
            <FilterSelect
              label="Insurance Provider"
              value={insuranceFilter}
              options={['Any Provider']}
              onChange={(v) => { setInsuranceFilter(v); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* Two-column content */}
      <div className="flex gap-5 items-start">
        {/* Patient List */}
        <div className="flex-1 min-w-0">
          <TableContainer className="rounded-md border-gray-100 shadow-sm">
            <Table hoverable>
              <TableHead>
                <TableRow>
                  <Th className="normal-case tracking-normal text-sm font-semibold text-gray-700">Patient&apos;s ID</Th>
                  <Th className="normal-case tracking-normal text-sm font-semibold text-gray-700">Name &amp; Contact</Th>
                  <Th className="normal-case tracking-normal text-sm font-semibold text-gray-700">Last Visit</Th>
                  <Th className="normal-case tracking-normal text-sm font-semibold text-gray-700">Insurance</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <TableRow key={i}>
                      <Td colSpan={4}>
                        <div className="h-10 bg-gray-50 rounded-md animate-pulse" />
                      </Td>
                    </TableRow>
                  ))
                ) : paginatedPatients.length === 0 ? (
                  <TableRow>
                    <Td colSpan={4} className="py-14 text-center">
                      <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No patient records found.</p>
                      {hasActiveFilters && (
                        <button
                          onClick={resetFilters}
                          className="mt-2 text-xs text-[#E03E3E] font-semibold"
                        >
                          Reset filters
                        </button>
                      )}
                    </Td>
                  </TableRow>
                ) : (
                  paginatedPatients.map((patient) => {
                    const active = isActive(patient);
                    const isSelected = selected?.id === patient.id;
                    return (
                      <TableRow
                        key={patient.id}
                        selected={isSelected}
                        onClick={() => setSelected(isSelected ? null : patient)}
                        className="cursor-pointer"
                      >
                        <Td className="text-gray-500 font-medium whitespace-nowrap">
                          {patient.patient_id || '—'}
                        </Td>

                        <Td>
                          <div className="flex items-center gap-2.5">
                            <Avatar fallback={patient.name} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900 leading-tight">
                                {patient.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {patient.phone_number || patient.email}
                              </p>
                            </div>
                          </div>
                        </Td>

                        <Td className="text-gray-500 whitespace-nowrap">
                          {formatLastVisit(patient.last_visit)}
                        </Td>

                        <Td>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                              active
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                active ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                            />
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </Td>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {!isLoading && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                totalItems={filteredPatients.length}
                shownItems={paginatedPatients.length}
                noun="records"
                onPageChange={setPage}
              />
            )}
          </TableContainer>
        </div>

        {/* Detail Panel */}
        <div className="w-72 flex-shrink-0">
          {selected ? (
            <DetailPanel patient={selected} />
          ) : (
            <Card className="p-8 rounded-md border border-gray-100 shadow-sm text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500">Select a patient</p>
              <p className="text-xs text-gray-400 mt-1">Click any row to view their records</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
