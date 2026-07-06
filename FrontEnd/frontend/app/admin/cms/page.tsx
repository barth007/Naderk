'use client';

import React, { useState, useRef } from 'react';
import {
  Plus, Pencil, Trash2, X, CheckCircle2, AlertCircle,
  Image as ImageIcon, Loader2, Globe, Star, Users, MessageSquare,
  HelpCircle, BarChart2, Building, Settings, ChevronDown, ChevronUp,
  Upload,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  TableContainer, Table, TableHead, TableBody, TableRow, Th, Td,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import {
  useHeroSlides, useCreateHeroSlide, useUpdateHeroSlide, useDeleteHeroSlide,
  useTestimonials, useCreateTestimonial, useUpdateTestimonial, useDeleteTestimonial,
  useTeamMembers, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember,
  useFAQs, useCreateFAQ, useUpdateFAQ, useDeleteFAQ,
  useTrustMetrics, useCreateTrustMetric, useUpdateTrustMetric, useDeleteTrustMetric,
  useTrustedClients, useCreateTrustedClient, useUpdateTrustedClient, useDeleteTrustedClient,
  useSiteSettings, useUpdateSiteSettings,
  type HeroSlide, type Testimonial, type TeamMember, type FAQ,
  type TrustMetric, type TrustedClient, type SiteSettings,
} from '@/services/cms/admin-cms.hooks';
import { apiClient } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToastState { message: string; type: 'success' | 'error' }

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-md shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {toast.message}
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ── Image Uploader ────────────────────────────────────────────────────────────

function ImageUploader({ value, onChange, label = 'Image' }: { value: string; onChange: (url: string) => void; label?: string }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/messages/upload/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(res.data.data.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
          placeholder="https://..."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload
        </button>
        <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
      </div>
      {value && (
        <div className="mt-1.5 w-12 h-12 rounded-md overflow-hidden border border-gray-100">
          <img src={value} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder = '', type = 'text' }: { value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function Textarea({ value, onChange, placeholder = '', rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      rows={rows}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E] resize-none"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, onSave, saving, children }: { title: string; onClose: () => void; onSave: () => void; saving: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-[#E03E3E] hover:bg-red-700 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${active ? 'text-green-700 bg-green-50 border-green-100' : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Add/Edit button row ───────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon: Icon, count, onAdd }: {
  title: string; subtitle: string; icon: React.ElementType; count: number; onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-[#E03E3E]">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 font-medium">{subtitle} · {count} item{count !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E03E3E] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add New
      </button>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'hero', label: 'Hero Slides', icon: Globe },
  { id: 'testimonials', label: 'Testimonials', icon: MessageSquare },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'faqs', label: 'FAQs', icon: HelpCircle },
  { id: 'metrics', label: 'Trust Metrics', icon: BarChart2 },
  { id: 'clients', label: 'Client Logos', icon: Building },
  { id: 'settings', label: 'Site Settings', icon: Settings },
] as const;

type TabId = typeof TABS[number]['id'];

// ── Hero Slides Tab ───────────────────────────────────────────────────────────

function HeroSlidesTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const { data: slides = [], isLoading } = useHeroSlides();
  const create = useCreateHeroSlide();
  const update = useUpdateHeroSlide();
  const del = useDeleteHeroSlide();

  const empty: Omit<HeroSlide, 'id'> = {
    badge_text: '', title: '', subtitle: '', description: '', image_url: '',
    cta_primary_text: '', cta_primary_link: '', cta_secondary_text: '', cta_secondary_link: '',
    discount_text: '', theme: 'LIGHT', order: slides.length + 1, is_active: true,
  };
  const [modal, setModal] = useState<{ open: boolean; data: Partial<HeroSlide> }>({ open: false, data: empty });
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  function open(item?: HeroSlide) { setModal({ open: true, data: item ?? { ...empty, order: slides.length + 1 } }); }
  function close() { setModal({ open: false, data: empty }); }
  function set(k: string, v: unknown) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }

  async function save() {
    try {
      if ((modal.data as HeroSlide).id) {
        await update.mutateAsync(modal.data as HeroSlide);
      } else {
        await create.mutateAsync(modal.data as Omit<HeroSlide, 'id'>);
      }
      showToast('Hero slide saved', 'success');
      close();
    } catch { showToast('Failed to save', 'error'); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this slide?')) return;
    try { await del.mutateAsync(id); showToast('Deleted', 'success'); }
    catch { showToast('Failed to delete', 'error'); }
  }

  const total = slides.length;
  const paged = slides.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <SectionHeader title="Hero Slides" subtitle="Homepage carousel" icon={Globe} count={slides.filter(s => s.is_active).length} onAdd={() => open()} />
      <TableContainer className="rounded-2xl border border-gray-100 shadow-sm">
        <Table>
          <TableHead>
            <TableRow>
              <Th className="px-4 py-3 text-xs">Slide</Th>
              <Th className="px-4 py-3 text-xs">Badge / CTA</Th>
              <Th className="px-4 py-3 text-xs">Theme</Th>
              <Th className="px-4 py-3 text-xs">Order</Th>
              <Th className="px-4 py-3 text-xs">Status</Th>
              <Th className="px-4 py-3 text-xs">Actions</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <Td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></Td>
                  ))}
                </TableRow>
              ))
            ) : paged.length === 0 ? (
              <TableRow>
                <Td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400 font-semibold">No slides yet</Td>
              </TableRow>
            ) : paged.map(s => (
              <TableRow key={s.id}>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {s.image_url ? (
                      <div className="w-10 h-10 rounded-md overflow-hidden border border-gray-100 shrink-0">
                        <img src={s.image_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-gray-900 leading-tight">{s.title}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{s.subtitle}</p>
                    </div>
                  </div>
                </Td>
                <Td className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-700">{s.badge_text}</p>
                  <p className="text-[10px] text-gray-400">{s.cta_primary_text}</p>
                </Td>
                <Td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${s.theme === 'DARK' ? 'text-gray-700 bg-gray-100 border-gray-200' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>{s.theme}</span>
                </Td>
                <Td className="px-4 py-3 text-xs font-bold text-gray-500">{s.order}</Td>
                <Td className="px-4 py-3"><ActiveBadge active={s.is_active} /></Td>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => open(s)} className="text-gray-400 hover:text-gray-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(s.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} totalItems={total} shownItems={paged.length} noun="slides" onPageChange={setPage} />
      </TableContainer>

      {modal.open && (
        <Modal title={(modal.data as HeroSlide).id ? 'Edit Hero Slide' : 'New Hero Slide'} onClose={close} onSave={save} saving={saving}>
          <ImageUploader label="Slide Image" value={modal.data.image_url ?? ''} onChange={v => set('image_url', v)} />
          <Field label="Title *"><Input value={modal.data.title ?? ''} onChange={v => set('title', v)} placeholder="Designer Eyewear Collection" /></Field>
          <Field label="Subtitle"><Input value={modal.data.subtitle ?? ''} onChange={v => set('subtitle', v)} placeholder="EXCLUSIVE OFFERS" /></Field>
          <Field label="Description"><Textarea value={modal.data.description ?? ''} onChange={v => set('description', v)} /></Field>
          <Field label="Badge Text"><Input value={modal.data.badge_text ?? ''} onChange={v => set('badge_text', v)} placeholder="NEW ARRIVALS" /></Field>
          <Field label="Discount / Tag"><Input value={modal.data.discount_text ?? ''} onChange={v => set('discount_text', v)} placeholder="40% OFF" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA Primary Text"><Input value={modal.data.cta_primary_text ?? ''} onChange={v => set('cta_primary_text', v)} /></Field>
            <Field label="CTA Primary Link"><Input value={modal.data.cta_primary_link ?? ''} onChange={v => set('cta_primary_link', v)} placeholder="/services/..." /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Theme">
              <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none" value={modal.data.theme ?? 'LIGHT'} onChange={e => set('theme', e.target.value)}>
                <option value="LIGHT">Light</option>
                <option value="DARK">Dark</option>
              </select>
            </Field>
            <Field label="Order"><Input type="number" value={modal.data.order ?? 0} onChange={v => set('order', parseInt(v) || 0)} /></Field>
          </div>
          <Field label="Active">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={modal.data.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="rounded" />
              <span className="text-xs font-semibold text-gray-600">Show on website</span>
            </label>
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ── Testimonials Tab ──────────────────────────────────────────────────────────

function TestimonialsTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const { data: items = [], isLoading } = useTestimonials();
  const create = useCreateTestimonial();
  const update = useUpdateTestimonial();
  const del = useDeleteTestimonial();

  const empty: Omit<Testimonial, 'id'> = { name: '', role: '', company: '', location: '', quote: '', rating: 5, image_url: '', order: 0, is_active: true };
  const [modal, setModal] = useState<{ open: boolean; data: Partial<Testimonial> }>({ open: false, data: empty });
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  function open(item?: Testimonial) { setModal({ open: true, data: item ?? { ...empty, order: items.length + 1 } }); }
  function close() { setModal({ open: false, data: empty }); }
  function set(k: string, v: unknown) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }

  async function save() {
    try {
      if ((modal.data as Testimonial).id) await update.mutateAsync(modal.data as Testimonial);
      else await create.mutateAsync(modal.data as Omit<Testimonial, 'id'>);
      showToast('Testimonial saved', 'success'); close();
    } catch { showToast('Failed to save', 'error'); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this testimonial?')) return;
    try { await del.mutateAsync(id); showToast('Deleted', 'success'); }
    catch { showToast('Failed to delete', 'error'); }
  }

  const total = items.length;
  const paged = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <SectionHeader title="Testimonials" subtitle="Homepage reviews" icon={MessageSquare} count={items.filter(t => t.is_active).length} onAdd={() => open()} />
      <TableContainer className="rounded-2xl border border-gray-100 shadow-sm">
        <Table>
          <TableHead>
            <TableRow>
              <Th className="px-4 py-3 text-xs">Person</Th>
              <Th className="px-4 py-3 text-xs">Quote</Th>
              <Th className="px-4 py-3 text-xs">Rating</Th>
              <Th className="px-4 py-3 text-xs">Status</Th>
              <Th className="px-4 py-3 text-xs">Actions</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <Td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></Td>)}</TableRow>
            )) : paged.length === 0 ? (
              <TableRow><Td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400 font-semibold">No testimonials yet</Td></TableRow>
            ) : paged.map(t => (
              <TableRow key={t.id}>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {t.image_url ? (
                      <img src={t.image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-100 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-red-50 text-[#E03E3E] font-bold text-xs flex items-center justify-center shrink-0">
                        {t.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-gray-900">{t.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{t.role}{t.location ? ` · ${t.location}` : ''}</p>
                    </div>
                  </div>
                </Td>
                <Td className="px-4 py-3 max-w-xs">
                  <p className="text-xs text-gray-600 font-medium line-clamp-2">{t.quote}</p>
                </Td>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < t.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                </Td>
                <Td className="px-4 py-3"><ActiveBadge active={t.is_active} /></Td>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => open(t)} className="text-gray-400 hover:text-gray-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} totalItems={total} shownItems={paged.length} noun="testimonials" onPageChange={setPage} />
      </TableContainer>

      {modal.open && (
        <Modal title={(modal.data as Testimonial).id ? 'Edit Testimonial' : 'New Testimonial'} onClose={close} onSave={save} saving={saving}>
          <ImageUploader label="Photo" value={modal.data.image_url ?? ''} onChange={v => set('image_url', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *"><Input value={modal.data.name ?? ''} onChange={v => set('name', v)} /></Field>
            <Field label="Role *"><Input value={modal.data.role ?? ''} onChange={v => set('role', v)} placeholder="Patient, Engineer..." /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company"><Input value={modal.data.company ?? ''} onChange={v => set('company', v)} /></Field>
            <Field label="Location"><Input value={modal.data.location ?? ''} onChange={v => set('location', v)} placeholder="Lagos" /></Field>
          </div>
          <Field label="Quote *"><Textarea value={modal.data.quote ?? ''} onChange={v => set('quote', v)} rows={3} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rating (1–5)"><Input type="number" value={modal.data.rating ?? 5} onChange={v => set('rating', Math.min(5, Math.max(1, parseInt(v) || 5)))} /></Field>
            <Field label="Order"><Input type="number" value={modal.data.order ?? 0} onChange={v => set('order', parseInt(v) || 0)} /></Field>
          </div>
          <Field label="Active">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={modal.data.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="rounded" />
              <span className="text-xs font-semibold text-gray-600">Show on website</span>
            </label>
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ── Team Tab ──────────────────────────────────────────────────────────────────

function TeamTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const { data: members = [], isLoading } = useTeamMembers();
  const create = useCreateTeamMember();
  const update = useUpdateTeamMember();
  const del = useDeleteTeamMember();

  const empty: Omit<TeamMember, 'id'> = { name: '', role: '', bio: '', image_url: '', twitter_url: '', linkedin_url: '', instagram_url: '', order: 0, is_active: true };
  const [modal, setModal] = useState<{ open: boolean; data: Partial<TeamMember> }>({ open: false, data: empty });
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  function open(item?: TeamMember) { setModal({ open: true, data: item ?? { ...empty, order: members.length + 1 } }); }
  function close() { setModal({ open: false, data: empty }); }
  function set(k: string, v: unknown) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }

  async function save() {
    try {
      if ((modal.data as TeamMember).id) await update.mutateAsync(modal.data as TeamMember);
      else await create.mutateAsync(modal.data as Omit<TeamMember, 'id'>);
      showToast('Team member saved', 'success'); close();
    } catch { showToast('Failed to save', 'error'); }
  }

  async function remove(id: number) {
    if (!confirm('Remove this team member?')) return;
    try { await del.mutateAsync(id); showToast('Removed', 'success'); }
    catch { showToast('Failed to delete', 'error'); }
  }

  const total = members.length;
  const paged = members.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <SectionHeader title="Team Members" subtitle="About page & cards" icon={Users} count={members.filter(m => m.is_active).length} onAdd={() => open()} />
      <TableContainer className="rounded-2xl border border-gray-100 shadow-sm">
        <Table>
          <TableHead>
            <TableRow>
              <Th className="px-4 py-3 text-xs">Member</Th>
              <Th className="px-4 py-3 text-xs">Bio</Th>
              <Th className="px-4 py-3 text-xs">Socials</Th>
              <Th className="px-4 py-3 text-xs">Order</Th>
              <Th className="px-4 py-3 text-xs">Status</Th>
              <Th className="px-4 py-3 text-xs">Actions</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <Td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></Td>)}</TableRow>
            )) : paged.length === 0 ? (
              <TableRow><Td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400 font-semibold">No team members yet</Td></TableRow>
            ) : paged.map(m => (
              <TableRow key={m.id}>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-100 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-red-50 text-[#E03E3E] font-bold text-xs flex items-center justify-center shrink-0">{m.name.charAt(0)}</div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-gray-900">{m.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{m.role}</p>
                    </div>
                  </div>
                </Td>
                <Td className="px-4 py-3 max-w-xs">
                  <p className="text-xs text-gray-500 font-medium line-clamp-2">{m.bio}</p>
                </Td>
                <Td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {m.twitter_url && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">TW</span>}
                    {m.linkedin_url && <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">LI</span>}
                    {m.instagram_url && <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded">IG</span>}
                  </div>
                </Td>
                <Td className="px-4 py-3 text-xs font-bold text-gray-500">{m.order}</Td>
                <Td className="px-4 py-3"><ActiveBadge active={m.is_active} /></Td>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => open(m)} className="text-gray-400 hover:text-gray-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(m.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} totalItems={total} shownItems={paged.length} noun="members" onPageChange={setPage} />
      </TableContainer>

      {modal.open && (
        <Modal title={(modal.data as TeamMember).id ? 'Edit Team Member' : 'New Team Member'} onClose={close} onSave={save} saving={saving}>
          <ImageUploader label="Photo" value={modal.data.image_url ?? ''} onChange={v => set('image_url', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *"><Input value={modal.data.name ?? ''} onChange={v => set('name', v)} /></Field>
            <Field label="Role / Title *"><Input value={modal.data.role ?? ''} onChange={v => set('role', v)} placeholder="Founder & CEO" /></Field>
          </div>
          <Field label="Bio"><Textarea value={modal.data.bio ?? ''} onChange={v => set('bio', v)} rows={2} /></Field>
          <Field label="Twitter URL"><Input value={modal.data.twitter_url ?? ''} onChange={v => set('twitter_url', v)} placeholder="https://twitter.com/..." /></Field>
          <Field label="LinkedIn URL"><Input value={modal.data.linkedin_url ?? ''} onChange={v => set('linkedin_url', v)} placeholder="https://linkedin.com/in/..." /></Field>
          <Field label="Instagram URL"><Input value={modal.data.instagram_url ?? ''} onChange={v => set('instagram_url', v)} placeholder="https://instagram.com/..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Order"><Input type="number" value={modal.data.order ?? 0} onChange={v => set('order', parseInt(v) || 0)} /></Field>
            <Field label="Active">
              <label className="flex items-center gap-2 cursor-pointer mt-5">
                <input type="checkbox" checked={modal.data.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="rounded" />
                <span className="text-xs font-semibold text-gray-600">Show on website</span>
              </label>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── FAQs Tab ──────────────────────────────────────────────────────────────────

function FAQsTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const { data: items = [], isLoading } = useFAQs();
  const create = useCreateFAQ();
  const update = useUpdateFAQ();
  const del = useDeleteFAQ();

  const empty: Omit<FAQ, 'id'> = { question: '', answer: '', category: '', order: 0, is_active: true };
  const [modal, setModal] = useState<{ open: boolean; data: Partial<FAQ> }>({ open: false, data: empty });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  function open(item?: FAQ) { setModal({ open: true, data: item ?? { ...empty, order: items.length + 1 } }); }
  function close() { setModal({ open: false, data: empty }); }
  function set(k: string, v: unknown) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }

  async function save() {
    try {
      if ((modal.data as FAQ).id) await update.mutateAsync(modal.data as FAQ);
      else await create.mutateAsync(modal.data as Omit<FAQ, 'id'>);
      showToast('FAQ saved', 'success'); close();
    } catch { showToast('Failed to save', 'error'); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this FAQ?')) return;
    try { await del.mutateAsync(id); showToast('Deleted', 'success'); }
    catch { showToast('Failed to delete', 'error'); }
  }

  const total = items.length;
  const paged = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <SectionHeader title="FAQs" subtitle="Homepage FAQ section" icon={HelpCircle} count={items.filter(f => f.is_active).length} onAdd={() => open()} />
      <TableContainer className="rounded-2xl border border-gray-100 shadow-sm">
        <Table>
          <TableHead>
            <TableRow>
              <Th className="px-4 py-3 text-xs">Question</Th>
              <Th className="px-4 py-3 text-xs">Category</Th>
              <Th className="px-4 py-3 text-xs">Order</Th>
              <Th className="px-4 py-3 text-xs">Status</Th>
              <Th className="px-4 py-3 text-xs">Actions</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <Td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></Td>)}</TableRow>
            )) : paged.length === 0 ? (
              <TableRow><Td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400 font-semibold">No FAQs yet</Td></TableRow>
            ) : paged.map(f => (
              <React.Fragment key={f.id}>
                <TableRow>
                  <Td className="px-4 py-3 max-w-sm">
                    <button className="flex items-start gap-1.5 text-left w-full" onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
                      {expanded === f.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />}
                      <p className="text-xs font-semibold text-gray-900">{f.question}</p>
                    </button>
                    {expanded === f.id && <p className="text-xs text-gray-500 mt-2 ml-5 leading-relaxed">{f.answer}</p>}
                  </Td>
                  <Td className="px-4 py-3">
                    {f.category && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600">{f.category}</span>}
                  </Td>
                  <Td className="px-4 py-3 text-xs font-bold text-gray-500">{f.order}</Td>
                  <Td className="px-4 py-3"><ActiveBadge active={f.is_active} /></Td>
                  <Td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => open(f)} className="text-gray-400 hover:text-gray-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(f.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </Td>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
        <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} totalItems={total} shownItems={paged.length} noun="FAQs" onPageChange={setPage} />
      </TableContainer>

      {modal.open && (
        <Modal title={(modal.data as FAQ).id ? 'Edit FAQ' : 'New FAQ'} onClose={close} onSave={save} saving={saving}>
          <Field label="Question *"><Textarea value={modal.data.question ?? ''} onChange={v => set('question', v)} rows={2} /></Field>
          <Field label="Answer *"><Textarea value={modal.data.answer ?? ''} onChange={v => set('answer', v)} rows={4} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Input value={modal.data.category ?? ''} onChange={v => set('category', v)} placeholder="Billing, Services..." /></Field>
            <Field label="Order"><Input type="number" value={modal.data.order ?? 0} onChange={v => set('order', parseInt(v) || 0)} /></Field>
          </div>
          <Field label="Active">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={modal.data.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="rounded" />
              <span className="text-xs font-semibold text-gray-600">Show on website</span>
            </label>
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ── Trust Metrics Tab ─────────────────────────────────────────────────────────

function TrustMetricsTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const { data: items = [], isLoading } = useTrustMetrics();
  const create = useCreateTrustMetric();
  const update = useUpdateTrustMetric();
  const del = useDeleteTrustMetric();

  const empty: Omit<TrustMetric, 'id'> = { label: '', value: '', icon: '', order: 0, is_active: true };
  const [modal, setModal] = useState<{ open: boolean; data: Partial<TrustMetric> }>({ open: false, data: empty });

  function open(item?: TrustMetric) { setModal({ open: true, data: item ?? { ...empty, order: items.length + 1 } }); }
  function close() { setModal({ open: false, data: empty }); }
  function set(k: string, v: unknown) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }

  async function save() {
    try {
      if ((modal.data as TrustMetric).id) await update.mutateAsync(modal.data as TrustMetric);
      else await create.mutateAsync(modal.data as Omit<TrustMetric, 'id'>);
      showToast('Metric saved', 'success'); close();
    } catch { showToast('Failed to save', 'error'); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this metric?')) return;
    try { await del.mutateAsync(id); showToast('Deleted', 'success'); }
    catch { showToast('Failed to delete', 'error'); }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <SectionHeader title="Trust Metrics" subtitle="Homepage stat cards" icon={BarChart2} count={items.filter(m => m.is_active).length} onAdd={() => open()} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 border border-gray-100 rounded-2xl animate-pulse bg-gray-50" />
        )) : items.map(m => (
          <Card key={m.id} className="p-4 border border-gray-100 rounded-2xl flex items-start justify-between">
            <div>
              <p className="text-2xl font-black text-[#E03E3E]">{m.value}</p>
              <p className="text-xs font-bold text-gray-800 mt-0.5">{m.label}</p>
              {m.icon && <p className="text-[10px] text-gray-400 font-medium mt-0.5">Icon: {m.icon}</p>}
            </div>
            <div className="flex items-center gap-2">
              <ActiveBadge active={m.is_active} />
              <button onClick={() => open(m)} className="text-gray-400 hover:text-gray-600"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(m.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </Card>
        ))}
      </div>

      {modal.open && (
        <Modal title={(modal.data as TrustMetric).id ? 'Edit Metric' : 'New Metric'} onClose={close} onSave={save} saving={saving}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value *"><Input value={modal.data.value ?? ''} onChange={v => set('value', v)} placeholder="10K+" /></Field>
            <Field label="Label *"><Input value={modal.data.label ?? ''} onChange={v => set('label', v)} placeholder="Active Patients" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Icon (lucide name)"><Input value={modal.data.icon ?? ''} onChange={v => set('icon', v)} placeholder="users" /></Field>
            <Field label="Order"><Input type="number" value={modal.data.order ?? 0} onChange={v => set('order', parseInt(v) || 0)} /></Field>
          </div>
          <Field label="Active">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={modal.data.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="rounded" />
              <span className="text-xs font-semibold text-gray-600">Show on website</span>
            </label>
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ── Trusted Clients Tab ───────────────────────────────────────────────────────

function TrustedClientsTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const { data: items = [], isLoading } = useTrustedClients();
  const create = useCreateTrustedClient();
  const update = useUpdateTrustedClient();
  const del = useDeleteTrustedClient();

  const empty: Omit<TrustedClient, 'id'> = { name: '', logo_url: '', website: '', order: 0, is_active: true };
  const [modal, setModal] = useState<{ open: boolean; data: Partial<TrustedClient> }>({ open: false, data: empty });
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  function open(item?: TrustedClient) { setModal({ open: true, data: item ?? { ...empty, order: items.length + 1 } }); }
  function close() { setModal({ open: false, data: empty }); }
  function set(k: string, v: unknown) { setModal(m => ({ ...m, data: { ...m.data, [k]: v } })); }

  async function save() {
    try {
      if ((modal.data as TrustedClient).id) await update.mutateAsync(modal.data as TrustedClient);
      else await create.mutateAsync(modal.data as Omit<TrustedClient, 'id'>);
      showToast('Client saved', 'success'); close();
    } catch { showToast('Failed to save', 'error'); }
  }

  async function remove(id: number) {
    if (!confirm('Remove this client?')) return;
    try { await del.mutateAsync(id); showToast('Removed', 'success'); }
    catch { showToast('Failed to delete', 'error'); }
  }

  const total = items.length;
  const paged = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <SectionHeader title="Client Logos" subtitle="Marquee / trusted-by section" icon={Building} count={items.filter(c => c.is_active).length} onAdd={() => open()} />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {isLoading ? Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" />
        )) : paged.map(c => (
          <div key={c.id} className="relative group border border-gray-100 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 bg-white hover:shadow-sm transition-shadow">
            <img src={c.logo_url} alt={c.name} className="h-8 object-contain grayscale group-hover:grayscale-0 transition-all" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <p className="text-[10px] font-semibold text-gray-500 text-center truncate w-full">{c.name}</p>
            <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5">
              <button onClick={() => open(c)} className="w-5 h-5 flex items-center justify-center rounded bg-white shadow-sm text-gray-500 hover:text-gray-700"><Pencil className="w-2.5 h-2.5" /></button>
              <button onClick={() => remove(c.id)} className="w-5 h-5 flex items-center justify-center rounded bg-white shadow-sm text-gray-500 hover:text-red-500"><Trash2 className="w-2.5 h-2.5" /></button>
            </div>
          </div>
        ))}
      </div>
      {total > PER_PAGE && (
        <div className="border-t border-gray-100 pt-3">
          <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} totalItems={total} shownItems={paged.length} noun="clients" onPageChange={setPage} />
        </div>
      )}

      {modal.open && (
        <Modal title={(modal.data as TrustedClient).id ? 'Edit Client' : 'New Client Logo'} onClose={close} onSave={save} saving={saving}>
          <Field label="Company Name *"><Input value={modal.data.name ?? ''} onChange={v => set('name', v)} placeholder="Microsoft" /></Field>
          <ImageUploader label="Logo URL" value={modal.data.logo_url ?? ''} onChange={v => set('logo_url', v)} />
          <Field label="Website"><Input value={modal.data.website ?? ''} onChange={v => set('website', v)} placeholder="https://..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Order"><Input type="number" value={modal.data.order ?? 0} onChange={v => set('order', parseInt(v) || 0)} /></Field>
            <Field label="Active">
              <label className="flex items-center gap-2 cursor-pointer mt-5">
                <input type="checkbox" checked={modal.data.is_active ?? true} onChange={e => set('is_active', e.target.checked)} className="rounded" />
                <span className="text-xs font-semibold text-gray-600">Show on website</span>
              </label>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Site Settings Tab ─────────────────────────────────────────────────────────

function SiteSettingsTab({ showToast }: { showToast: (m: string, t: 'success' | 'error') => void }) {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const [form, setForm] = useState<Partial<SiteSettings>>({});
  const [dirty, setDirty] = useState(false);

  React.useEffect(() => {
    if (settings) { setForm(settings); setDirty(false); }
  }, [settings]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); setDirty(true); }

  async function save() {
    try {
      await updateSettings.mutateAsync(form);
      showToast('Settings saved', 'success');
      setDirty(false);
    } catch { showToast('Failed to save settings', 'error'); }
  }

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#E03E3E]" /></div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-[#E03E3E]">
            <Settings className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Site Settings</h2>
            <p className="text-xs text-gray-500 font-medium">Global contact info & social links</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={!dirty || updateSettings.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#E03E3E] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-40"
        >
          {updateSettings.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Changes
        </button>
      </div>

      <Card className="p-5 border border-gray-100 rounded-2xl space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary Phone"><Input value={form.phone_primary ?? ''} onChange={v => set('phone_primary', v)} placeholder="+234 81234567890" /></Field>
          <Field label="Secondary Phone"><Input value={form.phone_secondary ?? ''} onChange={v => set('phone_secondary', v)} /></Field>
          <Field label="Support Email"><Input value={form.email_support ?? ''} onChange={v => set('email_support', v)} type="email" /></Field>
          <Field label="General Email"><Input value={form.email_general ?? ''} onChange={v => set('email_general', v)} type="email" /></Field>
        </div>
        <Field label="Address"><Textarea value={form.address ?? ''} onChange={v => set('address', v)} rows={2} /></Field>
        <Field label="Google Maps URL"><Input value={form.google_maps_url ?? ''} onChange={v => set('google_maps_url', v)} placeholder="https://maps.google.com/..." /></Field>
      </Card>

      <Card className="p-5 border border-gray-100 rounded-2xl space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operating Hours</p>
        <Field label="Weekdays"><Input value={form.hours_weekday ?? ''} onChange={v => set('hours_weekday', v)} placeholder="Monday - Friday: 8:00AM - 6:00PM" /></Field>
        <Field label="Saturday"><Input value={form.hours_saturday ?? ''} onChange={v => set('hours_saturday', v)} placeholder="Saturday: 9:00AM - 2:00PM" /></Field>
        <Field label="Sunday"><Input value={form.hours_sunday ?? ''} onChange={v => set('hours_sunday', v)} placeholder="Sunday: Closed" /></Field>
      </Card>

      <Card className="p-5 border border-gray-100 rounded-2xl space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Social Links</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Facebook"><Input value={form.facebook_url ?? ''} onChange={v => set('facebook_url', v)} placeholder="https://facebook.com/..." /></Field>
          <Field label="Twitter / X"><Input value={form.twitter_url ?? ''} onChange={v => set('twitter_url', v)} placeholder="https://twitter.com/..." /></Field>
          <Field label="Instagram"><Input value={form.instagram_url ?? ''} onChange={v => set('instagram_url', v)} placeholder="https://instagram.com/..." /></Field>
          <Field label="LinkedIn"><Input value={form.linkedin_url ?? ''} onChange={v => set('linkedin_url', v)} placeholder="https://linkedin.com/company/..." /></Field>
        </div>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminCMSPage() {
  const [activeTab, setActiveTab] = useState<TabId>('hero');
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div className="space-y-6 pb-10">
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Content Management</h1>
        <p className="text-sm text-gray-500 mt-1 font-semibold">
          Manage all public-facing website content — slides, team, testimonials, FAQs, and site info.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 flex-wrap border-b border-gray-100 pb-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-b-2 -mb-px ${
                active
                  ? 'text-[#E03E3E] border-[#E03E3E] bg-red-50/60'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'hero' && <HeroSlidesTab showToast={showToast} />}
        {activeTab === 'testimonials' && <TestimonialsTab showToast={showToast} />}
        {activeTab === 'team' && <TeamTab showToast={showToast} />}
        {activeTab === 'faqs' && <FAQsTab showToast={showToast} />}
        {activeTab === 'metrics' && <TrustMetricsTab showToast={showToast} />}
        {activeTab === 'clients' && <TrustedClientsTab showToast={showToast} />}
        {activeTab === 'settings' && <SiteSettingsTab showToast={showToast} />}
      </div>
    </div>
  );
}
