'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, Glasses, SlidersHorizontal, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  useBuilderFields, useUpdateBuilderFields, useCreateBuilderField, useDeleteBuilderField,
  useLensRules, useCreateLensRule, useUpdateLensRule, useDeleteLensRule,
  useLensTypes, useLensOptions,
  BuilderFieldConfig, CreateBuilderFieldPayload, FieldInputType,
  LensRule, LensRulePayload, RuleMetric, RuleOperator, RuleAction,
} from '@/services/marketplace/marketplace.hooks';

const BASE_METRICS: { value: string; label: string }[] = [
  { value: 'SPH', label: 'Sphere (SPH)' },
  { value: 'CYL', label: 'Cylinder (CYL)' },
  { value: 'ADD', label: 'Addition (ADD)' },
  { value: 'PD', label: 'Pupillary Distance (PD)' },
];
const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'GTE', label: '≥ (at least)' },
  { value: 'LTE', label: '≤ (at most)' },
  { value: 'GT', label: '> (greater than)' },
  { value: 'LT', label: '< (less than)' },
  { value: 'BETWEEN', label: 'between' },
  { value: 'EQ', label: '= (equals)' },
];
const ACTIONS: { value: RuleAction; label: string; hint: string; cls: string }[] = [
  { value: 'RECOMMEND', label: 'Recommend', hint: 'Highlight these lenses with a note', cls: 'bg-green-50 text-green-700' },
  { value: 'RESTRICT', label: 'Restrict', hint: 'Only allow these lenses', cls: 'bg-blue-50 text-blue-700' },
  { value: 'HIDE', label: 'Hide', hint: 'Remove these lenses', cls: 'bg-red-50 text-red-700' },
];

// ─── Rule Modal ───────────────────────────────────────────────────────────────

function RuleModal({ initial, metricOptions, onClose, onSaved }: { initial?: LensRule; metricOptions: { value: string; label: string }[]; onClose: () => void; onSaved: (m: string) => void }) {
  const isEdit = !!initial;
  const { data: lensTypes = [] } = useLensTypes();
  const { data: lensOptions = [] } = useLensOptions();
  const { mutate: create, isPending: creating } = useCreateLensRule();
  const { mutate: update, isPending: updating } = useUpdateLensRule();
  const pending = creating || updating;

  const [form, setForm] = useState<LensRulePayload>({
    name: initial?.name ?? '',
    metric: initial?.metric ?? 'SPH',
    operator: initial?.operator ?? 'GTE',
    use_absolute: initial?.use_absolute ?? true,
    threshold: initial?.threshold ?? '',
    threshold_max: initial?.threshold_max ?? '',
    action: initial?.action ?? 'RECOMMEND',
    target_lens_type_ids: initial?.target_lens_type_ids ?? [],
    target_lens_option_ids: initial?.target_lens_option_ids ?? [],
    message: initial?.message ?? '',
    priority: initial?.priority ?? 0,
    is_active: initial?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setF = <K extends keyof LensRulePayload>(k: K, v: LensRulePayload[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  };
  const toggleId = (list: string[], id: string) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Rule name is required.';
    if (form.threshold === '' || isNaN(parseFloat(form.threshold))) e.threshold = 'A numeric threshold is required.';
    if (form.operator === 'BETWEEN' && (!form.threshold_max || isNaN(parseFloat(form.threshold_max)))) e.threshold_max = 'Upper bound required for "between".';
    if ((form.target_lens_type_ids?.length ?? 0) === 0 && (form.target_lens_option_ids?.length ?? 0) === 0) e.targets = 'Select at least one target lens type or option.';
    if (Object.keys(e).length) { setErrors(e); return; }

    const payload = { ...form, threshold_max: form.operator === 'BETWEEN' ? form.threshold_max : null };
    const cb = { onSuccess: () => { onSaved(isEdit ? 'Rule updated.' : 'Rule created.'); onClose(); }, onError: (er: any) => setErrors({ _form: er?.response?.data?.detail || 'Failed to save rule.' }) };
    if (isEdit) update({ id: initial!.id, ...payload }, cb); else create(payload, cb);
  };

  const input = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="rounded-xl border border-gray-100 shadow-xl p-6 w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">{isEdit ? 'Edit Rule' : 'New Recommendation Rule'}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Rule Name *</label>
            <input value={form.name} onChange={e => setF('name', e.target.value)} className={input} placeholder="e.g. High-index for strong prescriptions" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Condition */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">When</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.metric} onChange={e => setF('metric', e.target.value)} className={`${input} bg-white`}>
                {metricOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={form.operator} onChange={e => setF('operator', e.target.value as RuleOperator)} className={`${input} bg-white`}>
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input type="number" step="0.25" value={form.threshold} onChange={e => setF('threshold', e.target.value)} className={input} placeholder="Threshold e.g. 4.00" />
                {errors.threshold && <p className="text-xs text-red-500 mt-1">{errors.threshold}</p>}
              </div>
              {form.operator === 'BETWEEN' && (
                <div>
                  <input type="number" step="0.25" value={form.threshold_max ?? ''} onChange={e => setF('threshold_max', e.target.value)} className={input} placeholder="Upper bound" />
                  {errors.threshold_max && <p className="text-xs text-red-500 mt-1">{errors.threshold_max}</p>}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={form.use_absolute} onChange={e => setF('use_absolute', e.target.checked)} className="accent-[#E03E3E]" />
              Compare absolute value (SPH/CYL are often negative)
            </label>
          </div>

          {/* Action */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">Then</label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIONS.map(a => (
                <button key={a.value} onClick={() => setF('action', a.value)} type="button"
                  className={`text-left border rounded-md px-2.5 py-2 transition ${form.action === a.value ? 'border-[#E03E3E] bg-red-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="text-xs font-bold text-gray-800">{a.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{a.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Targets */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">Target Lens Types</label>
            <div className="flex flex-wrap gap-1.5">
              {lensTypes.map(t => {
                const on = form.target_lens_type_ids?.includes(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => setF('target_lens_type_ids', toggleId(form.target_lens_type_ids ?? [], t.id))}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${on ? 'bg-[#E03E3E] text-white border-[#E03E3E]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {t.name}
                  </button>
                );
              })}
              {lensTypes.length === 0 && <p className="text-xs text-gray-400">No lens types found.</p>}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">Target Lens Options (coatings)</label>
            <div className="flex flex-wrap gap-1.5">
              {lensOptions.map(o => {
                const on = form.target_lens_option_ids?.includes(o.id);
                return (
                  <button key={o.id} type="button" onClick={() => setF('target_lens_option_ids', toggleId(form.target_lens_option_ids ?? [], o.id))}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${on ? 'bg-[#E03E3E] text-white border-[#E03E3E]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {o.name}
                  </button>
                );
              })}
              {lensOptions.length === 0 && <p className="text-xs text-gray-400">No lens options found.</p>}
            </div>
          </div>

          {errors.targets && <p className="text-xs text-red-500 -mt-2">{errors.targets}</p>}

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Patient Message (optional)</label>
            <textarea value={form.message} onChange={e => setF('message', e.target.value)} rows={2} className={`${input} resize-none`}
              placeholder="e.g. Based on your prescription, we recommend high-index lenses for a thinner, lighter fit." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Priority</label>
              <input type="number" value={form.priority} onChange={e => setF('priority', parseInt(e.target.value) || 0)} className={input} />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 mt-6">
              <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} className="accent-[#E03E3E]" />
              Active
            </label>
          </div>

          {errors._form && <p className="text-xs text-red-500">{errors._form}</p>}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={pending} className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 flex items-center justify-center gap-2">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Add Field Modal ────────────────────────────────────────────────────────

function AddFieldModal({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const { mutate: create, isPending } = useCreateBuilderField();
  const [form, setForm] = useState<CreateBuilderFieldPayload>({
    label: '', input_type: 'NUMBER', select_options: [], is_required: false,
    min_value: null, max_value: null, help_text: '',
  });
  const [optionsText, setOptionsText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = <K extends keyof CreateBuilderFieldPayload>(k: K, v: CreateBuilderFieldPayload[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  };
  const input = 'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.label.trim()) e.label = 'Field label is required.';
    const opts = form.input_type === 'SELECT' ? optionsText.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (form.input_type === 'SELECT' && opts.length === 0) e.select_options = 'Add at least one dropdown option.';
    if (Object.keys(e).length) { setErrors(e); return; }

    create({ ...form, select_options: opts }, {
      onSuccess: () => { onSaved('Custom field added.'); onClose(); },
      onError: () => setErrors({ _form: 'Failed to add field.' }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="rounded-xl border border-gray-100 shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Add Custom Field</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Field Label *</label>
            <input value={form.label} onChange={e => setF('label', e.target.value)} className={input} placeholder="e.g. Prism, Base Curve, Vertex Distance" />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Input Type</label>
            <select value={form.input_type} onChange={e => setF('input_type', e.target.value as FieldInputType)} className={`${input} bg-white`}>
              <option value="NUMBER">Number</option>
              <option value="TEXT">Text</option>
              <option value="SELECT">Dropdown</option>
            </select>
          </div>
          {form.input_type === 'SELECT' && (
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Options (comma-separated)</label>
              <input value={optionsText} onChange={e => { setOptionsText(e.target.value); if (errors.select_options) setErrors(er => { const n = { ...er }; delete n.select_options; return n; }); }} className={input} placeholder="e.g. Low, Medium, High" />
              {errors.select_options && <p className="text-xs text-red-500 mt-1">{errors.select_options}</p>}
            </div>
          )}
          {form.input_type === 'NUMBER' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Min</label>
                <input type="number" value={form.min_value ?? ''} onChange={e => setF('min_value', e.target.value || null)} className={input} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Max</label>
                <input type="number" value={form.max_value ?? ''} onChange={e => setF('max_value', e.target.value || null)} className={input} />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Help Text</label>
            <input value={form.help_text} onChange={e => setF('help_text', e.target.value)} className={input} placeholder="Shown under the field to the patient" />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={form.is_required} onChange={e => setF('is_required', e.target.checked)} className="accent-[#E03E3E]" /> Required
          </label>
          {errors._form && <p className="text-xs text-red-500">{errors._form}</p>}
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={isPending} className="flex-1 bg-[#E03E3E] text-white text-sm font-semibold py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add Field
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GlassesBuilderAdminPage() {
  const { data: fields = [], isLoading: loadingFields } = useBuilderFields();
  const { data: rules = [], isLoading: loadingRules } = useLensRules();
  const { mutate: saveFields, isPending: savingFields } = useUpdateBuilderFields();
  const { mutate: deleteRule } = useDeleteLensRule();
  const { mutate: deleteField } = useDeleteBuilderField();

  const [localFields, setLocalFields] = useState<BuilderFieldConfig[]>([]);
  const [showRule, setShowRule] = useState(false);
  const [editingRule, setEditingRule] = useState<LensRule | undefined>();
  const [showAddField, setShowAddField] = useState(false);

  const notify = (msg: string, type: 'success' | 'error' = 'success') =>
    type === 'error' ? toast.error(msg) : toast.success(msg);

  // Metric options for rules = built-in metrics + custom numeric fields
  const metricOptions = [
    ...BASE_METRICS,
    ...fields.filter(f => f.is_custom && f.input_type === 'NUMBER').map(f => ({ value: f.field_key, label: f.field_label })),
  ];

  const removeField = (f: BuilderFieldConfig) => {
    if (!confirm(`Delete custom field "${f.field_label}"?`)) return;
    deleteField(f.id, { onSuccess: () => notify('Field deleted.'), onError: () => notify('Failed to delete field.', 'error') });
  };

  useEffect(() => { setLocalFields(fields); }, [fields]);

  const setField = (id: string, patch: Partial<BuilderFieldConfig>) =>
    setLocalFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const persistFields = () => {
    saveFields(localFields.map(f => ({
      id: f.id, label: f.label, is_visible: f.is_visible, is_required: f.is_required,
      min_value: f.min_value, max_value: f.max_value, help_text: f.help_text, order: f.order,
    })), { onSuccess: () => notify('Field settings saved.'), onError: () => notify('Failed to save fields.', 'error') });
  };

  const removeRule = (r: LensRule) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    deleteRule(r.id, { onSuccess: () => notify('Rule deleted.'), onError: () => notify('Failed to delete.', 'error') });
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl">

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"><Glasses className="w-5 h-5 text-[#E03E3E]" /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Glasses Builder Configuration</h1>
          <p className="text-sm text-gray-500">Control the prescription fields patients fill in and the rules that recommend lenses.</p>
        </div>
      </div>

      {/* ── Prescription Fields ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-gray-400" /> Prescription Fields</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAddField(true)} className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3.5 py-2 rounded-md hover:bg-gray-50">
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>
            <button onClick={persistFields} disabled={savingFields} className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-xs font-semibold px-3.5 py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50">
              {savingFields ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Fields
            </button>
          </div>
        </div>

        {loadingFields ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-2">
            {localFields.map(f => (
              <Card key={f.id} className="p-3 border border-gray-100 rounded-lg">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[140px]">
                    <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      {f.field_label}
                      {f.is_custom && <span className="text-[8px] font-bold uppercase bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">Custom</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">{f.input_type.toLowerCase()}{f.is_custom ? '' : ' · built-in'}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={f.is_visible} onChange={e => setField(f.id, { is_visible: e.target.checked })} className="accent-[#E03E3E]" /> Visible
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={f.is_required} onChange={e => setField(f.id, { is_required: e.target.checked })} className="accent-[#E03E3E]" /> Required
                  </label>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    Min <input type="number" value={f.min_value ?? ''} onChange={e => setField(f.id, { min_value: e.target.value || null })} className="w-16 border border-gray-200 rounded px-1.5 py-1" />
                    Max <input type="number" value={f.max_value ?? ''} onChange={e => setField(f.id, { max_value: e.target.value || null })} className="w-16 border border-gray-200 rounded px-1.5 py-1" />
                  </div>
                  <input value={f.help_text} onChange={e => setField(f.id, { help_text: e.target.value })} placeholder="Help text shown to patient" className="flex-1 min-w-[180px] border border-gray-200 rounded px-2 py-1 text-xs" />
                  {f.is_custom && (
                    <button onClick={() => removeField(f)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500 shrink-0" title="Delete custom field">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Recommendation Rules ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Lens Recommendation Rules</h2>
          <button onClick={() => { setEditingRule(undefined); setShowRule(true); }} className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-xs font-semibold px-3.5 py-2 rounded-md hover:bg-[#c93535]">
            <Plus className="w-4 h-4" /> New Rule
          </button>
        </div>

        {loadingRules ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <p className="text-sm font-medium">No rules yet</p>
            <p className="text-xs mt-1">Create a rule to recommend lenses based on prescription strength.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map(r => {
              const action = ACTIONS.find(a => a.value === r.action)!;
              const targets = [...r.target_lens_type_names, ...r.target_lens_option_names];
              return (
                <Card key={r.id} className={`p-4 border rounded-lg ${r.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${action.cls}`}>{action.label}</span>
                        <h3 className="text-sm font-bold text-gray-900">{r.name}</h3>
                      </div>
                      <p className="text-xs text-gray-500">
                        When <span className="font-semibold">{r.metric_display}</span> {r.operator_display} <span className="font-semibold">{r.threshold}{r.operator === 'BETWEEN' ? `–${r.threshold_max}` : ''}</span>
                        {' → '}{action.label.toLowerCase()} <span className="font-semibold">{targets.join(', ') || '—'}</span>
                      </p>
                      {r.message && <p className="text-[11px] text-gray-400 mt-1 italic">“{r.message}”</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingRule(r); setShowRule(true); }} className="p-1.5 rounded-md hover:bg-gray-50 text-gray-500"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeRule(r)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {showRule && <RuleModal initial={editingRule} metricOptions={metricOptions} onClose={() => { setShowRule(false); setEditingRule(undefined); }} onSaved={notify} />}
      {showAddField && <AddFieldModal onClose={() => setShowAddField(false)} onSaved={notify} />}
    </div>
  );
}
