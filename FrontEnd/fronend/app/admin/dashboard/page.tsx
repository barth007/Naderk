'use client';

import React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Calendar, Video, FileText, TrendingUp, TrendingDown,
  MessageSquare, FileBarChart, UserPlus,
  Download, Plus, AlertTriangle, Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useAdminDashboard,
  AdminVolumeTrend,
  AdminRevenueBreakdown,
  AdminAppointmentQueueItem,
} from '@/services/admin/admin.hooks';

// ---------- Skeletons ----------

const StatCardSkeleton = () => (
  <div className="h-32 bg-gray-50 rounded-xl animate-pulse border border-gray-100" />
);

const ChartSkeleton = () => (
  <div className="h-64 bg-gray-50 rounded-xl animate-pulse border border-gray-100" />
);

// ---------- Status badge ----------

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-blue-50 text-blue-700',
  CHECKED_IN: 'bg-indigo-50 text-indigo-700',
  IN_PROGRESS: 'bg-green-50 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  NO_SHOW: 'bg-red-50 text-red-600',
  RESCHEDULED: 'bg-yellow-50 text-yellow-700',
};

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  const cls = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

// ---------- Stat card — badge top-right, matching screenshot ----------

function StatCard({
  icon,
  iconBg,
  label,
  value,
  sub,
  topRightBadge,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  topRightBadge: React.ReactNode;
}) {
  return (
    <Card className="p-5 rounded-xl border border-gray-100 shadow-none relative">
      {/* top-right badge */}
      <div className="absolute top-4 right-4">{topRightBadge}</div>

      {/* icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
        {icon}
      </div>

      {/* label */}
      <p className="text-xs text-gray-500 font-medium">{label}</p>

      {/* value */}
      <p className="text-xl font-bold text-gray-900 mt-0.5">
        {value} {sub && <span className="text-sm font-semibold text-gray-700">{sub}</span>}
      </p>
    </Card>
  );
}

// ---------- Patient Volume Trends — SVG line chart with proper axes ----------

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function LineChart({ data }: { data: AdminVolumeTrend[] }) {
  // Always show full 12-month axis; fill zeros for missing months
  const currentYear = new Date().getFullYear();
  const filled: { month: string; count: number }[] = MONTHS_SHORT.map((m) => {
    const found = data.find((d) => d.month === m);
    return { month: m, count: found ? found.count : 0 };
  });

  const W = 560;
  const H = 220;
  const PAD = { top: 16, right: 20, bottom: 36, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...filled.map((d) => d.count), 200);
  // Round up to nearest 200
  const yMax = Math.ceil(maxVal / 200) * 200 || 200;
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax].map((v) => Math.round(v));

  const xStep = chartW / (filled.length - 1);
  const yPos = (v: number) => PAD.top + chartH - (v / yMax) * chartH;

  const pts = filled.map((d, i) => ({ x: PAD.left + i * xStep, y: yPos(d.count), ...d }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD =
    pathD +
    ` L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD.top + chartH).toFixed(1)}` +
    ` L ${pts[0].x.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  return (
    <div className="relative">
      {/* Y-axis title */}
      <div
        className="absolute text-xs text-gray-400 font-medium"
        style={{
          left: 0,
          top: '50%',
          transform: 'rotate(-90deg) translateX(-50%)',
          transformOrigin: 'left center',
          whiteSpace: 'nowrap',
        }}
      >
        Number of patients
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }}>
        <defs>
          <linearGradient id="adminAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E03E3E" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#E03E3E" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y gridlines + labels */}
        {yTicks.map((v) => {
          const y = yPos(v);
          return (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + chartW}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {v >= 1000 ? `${v / 1000}k` : v}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#adminAreaGrad)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#E03E3E"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X labels */}
        {pts.map((p) => (
          <text key={p.month} x={p.x} y={H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">
            {p.month}
          </text>
        ))}
      </svg>

      {/* X-axis title */}
      <p className="text-xs text-gray-400 text-center mt-0.5 font-medium">Month</p>
    </div>
  );
}

// ---------- Revenue Breakdown donut ----------

function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweep: number) {
  if (sweep >= 360) sweep = 359.99;
  const s = polarToCart(cx, cy, r, startDeg);
  const e = polarToCart(cx, cy, r, startDeg + sweep);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

function DonutChart({
  data,
  totalRevenue,
}: {
  data: AdminRevenueBreakdown;
  totalRevenue: number;
}) {
  const COLORS = ['#E03E3E', '#3b82f6', '#10b981'];
  const LABELS = ['Medical Services', 'Optical Store', 'Telehealth'];
  const values = [data.medical_services, data.optical_store, data.telehealth];
  const total = values.reduce((a, b) => a + b, 0) || 100;

  const CX = 80;
  const CY = 80;
  const R = 58;
  const SW = 16;

  let angle = 0;
  const slices = values.map((v, i) => {
    const sweep = (v / total) * 360;
    const start = angle;
    angle += sweep;
    return { start, sweep, color: COLORS[i], label: LABELS[i], pct: v };
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="relative">
          <svg viewBox="0 0 160 160" className="w-40 h-40">
            {slices.map((s, i) => (
              <path
                key={i}
                d={arcPath(CX, CY, R, s.start, s.sweep)}
                fill="none"
                stroke={s.color}
                strokeWidth={SW}
                strokeLinecap="butt"
              />
            ))}
            {/* center label */}
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">
              ₦{totalRevenue >= 1000
                ? `${(totalRevenue / 1000).toFixed(0)}k`
                : totalRevenue.toLocaleString()}
            </text>
            <text x={CX} y={CY + 6} textAnchor="middle" fontSize="7" fill="#9ca3af" letterSpacing="0.5">
              TOTAL MONTHLY
            </text>
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-xs text-gray-600">{s.label}</span>
            </div>
            <span className="text-xs font-semibold text-gray-900">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Appointment row ----------

function AppointmentRow({ appt }: { appt: AdminAppointmentQueueItem }) {
  const time = appt.time ? appt.time.substring(0, 5) : '—';
  const [y, m, d] = appt.date ? appt.date.split('-').map(Number) : [0, 0, 0];
  const dateLabel = appt.date
    ? new Date(y, m - 1, d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  // initials avatar
  const initials = appt.patient_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-900">{appt.patient_name}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={appt.status} />
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">{appt.service}</td>
      <td className="py-3 px-4 text-sm text-gray-500">
        {dateLabel} {time}
      </td>
    </tr>
  );
}

// ---------- Main page ----------

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useAdminDashboard();
  const stats = data?.stats;

  // percentage badge — top right of card
  function pctBadge(change: number) {
    const positive = change >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
          positive ? 'text-green-600' : 'text-red-500'
        }`}
      >
        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {positive ? '+' : ''}
        {change}%
      </span>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Oversight</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitoring daily operations at NaderkEye Center</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold shadow-none border-gray-200"
            onClick={() => toast.info('Export feature coming soon.')}
          >
            <Download className="w-3.5 h-3.5" />
            Export Data
          </Button>
          <Link href="/admin/appointments">
            <Button
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold bg-[#E03E3E] hover:bg-[#c93535] text-white shadow-none"
            >
              <Plus className="w-3.5 h-3.5" />
              New Appointments
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : isError ? (
          <div className="col-span-4">
            <Card className="p-6 text-center border border-red-100 bg-red-50/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-[#E03E3E] mx-auto mb-2" />
              <p className="text-sm text-gray-600">Failed to load dashboard data.</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => refetch()}>
                Retry
              </Button>
            </Card>
          </div>
        ) : (
          <>
            <StatCard
              icon={<Calendar className="w-5 h-5 text-[#E03E3E]" />}
              iconBg="bg-red-50"
              label="Total Appointments"
              value={`${stats?.appointments_today ?? 0}`}
              sub="Today"
              topRightBadge={pctBadge(stats?.appointments_today_change ?? 0)}
            />
            <StatCard
              icon={<Video className="w-5 h-5 text-blue-600" />}
              iconBg="bg-blue-50"
              label="Active Telehealth"
              value={`${stats?.active_telehealth ?? 0}`}
              sub="Sessions"
              topRightBadge={
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                  <Activity className="w-3 h-3" />
                  Live
                </span>
              }
            />
            <StatCard
              icon={<FileText className="w-5 h-5 text-amber-600" />}
              iconBg="bg-amber-50"
              label="Pending Lab Results"
              value={`${stats?.pending_prescriptions ?? 0}`}
              sub="Files"
              topRightBadge={
                (stats?.pending_prescriptions ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                    <AlertTriangle className="w-3 h-3" />
                    Urgent
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )
              }
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
              iconBg="bg-emerald-50"
              label="Optical Daily Revenue"
              value={`₦${(stats?.optical_revenue_today ?? 0).toLocaleString()}`}
              topRightBadge={pctBadge(stats?.optical_revenue_change ?? 0)}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-bold text-gray-900">Quick Actions</h2>
        <p className="text-sm text-gray-500 mb-3">Real-time status of clinical flow</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Send Clinic Wide Message */}
          <button
            onClick={() => toast.info('Clinic-wide messaging coming soon.')}
            className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left w-full"
          >
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4.5 h-4.5 text-[#E03E3E]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Send Clinic Wide Message</p>
              <p className="text-xs text-gray-400 mt-0.5">Alert all staff members instantly</p>
            </div>
          </button>

          {/* Generate Daily Report */}
          <button
            onClick={() => toast.info('Report generation coming soon.')}
            className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left w-full"
          >
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <FileBarChart className="w-4.5 h-4.5 text-[#E03E3E]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Generate Daily Report</p>
              <p className="text-xs text-gray-400 mt-0.5">PDF Summary of today's stats</p>
            </div>
          </button>

          {/* New Patient Record */}
          <Link href="/admin/records/new" className="w-full">
            <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors cursor-pointer w-full h-full">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4.5 h-4.5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">New Patient Record</p>
                <p className="text-xs text-gray-400 mt-0.5">Onboard a new visitor to clinical system</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart */}
        <Card className="lg:col-span-2 p-5 rounded-xl border border-gray-100 shadow-none">
          <h2 className="text-sm font-bold text-gray-900">Patient Volume Trends</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Monthly distribution across clinic departments</p>
          {isLoading ? <ChartSkeleton /> : <LineChart data={data?.patient_volume_trends ?? []} />}
        </Card>

        {/* Donut chart */}
        <Card className="p-5 rounded-xl border border-gray-100 shadow-none">
          <h2 className="text-sm font-bold text-gray-900">Revenue Breakdown</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Total channel distribution</p>
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <DonutChart
              data={
                data?.revenue_breakdown ?? {
                  medical_services: 65,
                  optical_store: 25,
                  telehealth: 10,
                }
              }
              totalRevenue={stats?.optical_revenue_today ?? 100000}
            />
          )}
        </Card>
      </div>

      {/* Appointment queue */}
      <Card className="rounded-xl border border-gray-100 shadow-none overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{"Today's Appointment Queue"}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Real-time status of clinical flow</p>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        ) : !data?.appointment_queue?.length ? (
          <div className="py-12 text-center">
            <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No confirmed appointments for today.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-gray-100">
                <tr>
                  {["Patient's Name", 'Status', 'Service', 'Date & Time'].map((h) => (
                    <th key={h} className="py-3 px-4 text-sm font-semibold text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.appointment_queue.map((appt) => (
                  <AppointmentRow key={appt.id} appt={appt} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
