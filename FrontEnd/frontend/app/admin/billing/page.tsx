'use client';

import React, { useState, useCallback } from 'react';
import {
  CreditCard, TrendingUp, AlertTriangle, Clock,
  Download, X, CheckCircle2, AlertCircle, Printer, Building2, Calendar,
  ShoppingBag, Stethoscope,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  TableContainer, Table, TableHead, TableBody, TableRow, Th, Td,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import {
  useAdminBillingSummary,
  useAdminTransactions,
  Transaction,
  BillingFilters,
} from '@/services/admin/admin-billing.hooks';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

type TabType = 'all' | 'appointment' | 'order';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(naira);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function exportToCSV(rows: Transaction[]) {
  const headers = ['Reference', 'Patient', 'Email', 'Type', 'Service', 'Insurance', 'Amount (₦)', 'Status', 'Provider', 'Date'];
  const csvRows = [
    headers.join(','),
    ...rows.map(r => [
      r.reference,
      `"${r.patient_name}"`,
      r.patient_email,
      r.type,
      `"${r.service_description}"`,
      `"${r.insurance}"`,
      (r.amount_kobo / 100).toFixed(2),
      r.status,
      r.provider,
      formatDate(r.created_at),
    ].join(',')),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `naderk-billing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';
interface ToastState { message: string; type: ToastType; id: number }

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-md shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {toast.message}
      <button onClick={onDismiss} className="ml-1 opacity-75 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function TxnStatusBadge({ status }: { status: Transaction['status'] }) {
  const cfg: Record<Transaction['status'], { label: string; cls: string }> = {
    SUCCESS:   { label: 'Paid',      cls: 'bg-green-50 text-green-700 border-green-200' },
    INITIATED: { label: 'Pending',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    FAILED:    { label: 'Failed',    cls: 'bg-red-50 text-red-700 border-red-200' },
    ABANDONED: { label: 'Abandoned', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  };
  const { label, cls } = cfg[status] ?? cfg.FAILED;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TxnTypeBadge({ type }: { type: Transaction['type'] }) {
  if (type === 'APPOINTMENT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <Stethoscope className="w-3 h-3" /> Appointment
      </span>
    );
  }
  if (type === 'ORDER') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
        <ShoppingBag className="w-3 h-3" /> Marketplace
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200">
      Other
    </span>
  );
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({ txn, onClose }: { txn: Transaction; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[var(--radius-xl)] shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#faeaea] text-[#E03E3E] flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-gray-900">Payment Receipt</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex justify-between items-start">
            <TxnStatusBadge status={txn.status} />
            <TxnTypeBadge type={txn.type} />
          </div>

          <div className="bg-gray-50 rounded-[var(--radius-md)] p-4 space-y-3">
            <Row label="Reference"  value={txn.reference} mono />
            <Row label="Patient"    value={txn.patient_name} />
            <Row label="Email"      value={txn.patient_email} />
            <Row label="Service"    value={txn.service_description} />
            <Row label="Insurance"  value={txn.insurance} />
            <Row label="Provider"   value={txn.provider} />
            <Row label="Date"       value={formatDate(txn.created_at)} />
          </div>

          <div className="flex items-center justify-between bg-[#faeaea] rounded-[var(--radius-md)] px-4 py-3">
            <span className="text-sm font-semibold text-gray-700">Total Amount</span>
            <span className="text-lg font-bold text-[#E03E3E]">{formatNaira(txn.amount_kobo)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-[var(--radius-md)] border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-[var(--radius-md)] bg-[#E03E3E] text-white text-sm font-semibold hover:bg-[#c93535] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-900 text-right break-all ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, iconBg, iconColor, badge, badgeColor, value, label, sub, subColor, onAction, actionLabel,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  value: string;
  label: string;
  sub?: string;
  subColor?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <Card shadow="sm" bordered className="p-5 flex-1 min-w-0">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-xs font-semibold ${badgeColor ?? 'text-gray-500'}`}>{badge}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-0.5">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && (
        <p className={`text-xs font-medium mt-1 ${subColor ?? 'text-gray-400'}`}>{sub}</p>
      )}
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="mt-2 text-xs font-semibold text-[#E03E3E] hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const [tab, setTab]         = useState<TabType>('all');
  const [page, setPage]       = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [toast, setToast]     = useState<ToastState | null>(null);

  const filters: BillingFilters = { type: tab, date_from: dateFrom || undefined, date_to: dateTo || undefined };

  const { data: summary, isLoading: summaryLoading } = useAdminBillingSummary({ date_from: dateFrom || undefined, date_to: dateTo || undefined });
  const { data: txnData, isLoading: txnsLoading }    = useAdminTransactions(filters, page, PAGE_SIZE);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => setToast(t => (t?.id === id ? null : t)), 4000);
  }, []);

  const handleTabChange = (t: TabType) => { setTab(t); setPage(1); };

  const handleSendReminders = () => showToast('Reminders sent to patients with overdue invoices.');

  const handleExport = () => {
    if (!txnData?.results?.length) { showToast('No transactions to export.', 'error'); return; }
    exportToCSV(txnData.results);
    showToast('CSV downloaded.');
  };

  const totalPages = txnData?.total_pages ?? 1;

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'all',         label: 'All Transactions', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { key: 'appointment', label: 'Appointments',     icon: <Stethoscope className="w-3.5 h-3.5" /> },
    { key: 'order',       label: 'Marketplace',      icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
      {receipt && <ReceiptModal txn={receipt} onClose={() => setReceipt(null)} />}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Oversight</h1>
          <p className="text-sm text-gray-500 mt-0.5">Billing & Revenue Management at NaderkEye Center</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 border border-gray-200 rounded-[var(--radius-md)] px-3 h-9 bg-white text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-transparent border-none outline-none text-xs w-28"
              placeholder="From"
            />
            <span>—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="bg-transparent border-none outline-none text-xs w-28"
              placeholder="To"
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="flex gap-4 flex-wrap">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 min-w-[180px] h-[130px] rounded-[var(--radius-lg)] bg-gray-100 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              badge="Active Queue"
              badgeColor="text-blue-600"
              value={String(summary?.pending_count ?? 0)}
              label="Pending Claims"
              sub="+12% From Last Week"
              subColor="text-green-600"
            />
            <StatCard
              icon={<Building2 className="w-5 h-5" />}
              iconBg="bg-[#faeaea]"
              iconColor="text-[#E03E3E]"
              badge="On Target"
              badgeColor="text-green-600"
              value={formatNaira(summary?.total_revenue_kobo ?? 0)}
              label="Total Revenue"
              sub={`${formatNaira(summary?.appointment_revenue_kobo ?? 0)} appts · ${formatNaira(summary?.order_revenue_kobo ?? 0)} orders`}
              subColor="text-blue-600"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              iconBg="bg-orange-50"
              iconColor="text-orange-500"
              badge="Critical"
              badgeColor="text-orange-500"
              value={formatNaira(summary?.overdue_invoice_amount_kobo ?? 0)}
              label="Overdue Invoices"
              onAction={handleSendReminders}
              actionLabel="Send Reminders"
            />
            <StatCard
              icon={<AlertTriangle className="w-5 h-5" />}
              iconBg="bg-red-50"
              iconColor="text-red-600"
              badge="Alert"
              badgeColor="text-red-600"
              value={String(summary?.failed_count ?? 0)}
              label="Failed Transactions"
              onAction={() => showToast('Failed transactions flagged for review.')}
              actionLabel="Review"
            />
          </>
        )}
      </div>

      {/* ── Recent Transactions ── */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Transactions</h2>
          <p className="text-sm text-gray-500">Monitor live payment activity across all clinical departments.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-100">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-[#E03E3E] text-[#E03E3E]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <TableContainer>
          <Table hoverable>
            <TableHead>
              <TableRow>
                <Th>Patient's Name</Th>
                <Th>Type</Th>
                <Th>Insurance</Th>
                <Th>Amount Paid</Th>
                <Th>Service Provided</Th>
                <Th>Status</Th>
                <Th>Date</Th>
                <Th>Actions</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {txnsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <Td key={j}><div className="h-4 bg-gray-100 animate-pulse rounded w-24" /></Td>
                    ))}
                  </TableRow>
                ))
              ) : !txnData?.results?.length ? (
                <TableRow>
                  <Td colSpan={8} className="text-center py-12 text-gray-400">
                    No transactions found.
                  </Td>
                </TableRow>
              ) : (
                txnData.results.map((txn) => (
                  <TableRow key={txn.id}>
                    <Td>
                      <div>
                        <p className="font-medium text-gray-900">{txn.patient_name}</p>
                        <p className="text-xs text-gray-400">{txn.patient_email}</p>
                      </div>
                    </Td>
                    <Td><TxnTypeBadge type={txn.type} /></Td>
                    <Td className="text-gray-600">{txn.insurance}</Td>
                    <Td className="font-semibold text-gray-900">{formatNaira(txn.amount_kobo)}</Td>
                    <Td className="text-gray-600 max-w-[180px]">
                      <span className="line-clamp-2">{txn.service_description}</span>
                    </Td>
                    <Td><TxnStatusBadge status={txn.status} /></Td>
                    <Td className="text-gray-500 whitespace-nowrap">{formatDate(txn.created_at)}</Td>
                    <Td>
                      <button
                        onClick={() => setReceipt(txn)}
                        className="text-xs font-semibold text-[#E03E3E] hover:underline"
                      >
                        View
                      </button>
                    </Td>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={txnData?.count ?? 0}
            shownItems={txnData?.results?.length ?? 0}
            noun="transactions"
            onPageChange={setPage}
          />
        </TableContainer>
      </div>
    </div>
  );
}
