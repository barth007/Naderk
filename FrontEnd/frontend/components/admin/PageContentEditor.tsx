'use client';

import React, { useState } from 'react';
import { Loader2, Check, Plus, Trash2, FileText, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { toastApiError } from '@/lib/api-errors';
import ImageUploader from '@/components/admin/ImageUploader';
import {
  usePageSchema, useSavePageSection, PageField, PageSectionSchema,
} from '@/services/cms/page-content.hooks';

/**
 * Edits a public page's copy from field definitions the backend supplies.
 *
 * Driven by the schema rather than hardcoded forms, so adding a section to
 * page_schemas.py makes it editable here with no frontend change.
 */

const inputCls =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20';

type Content = Record<string, unknown>;

function FieldInput({
  field, value, onChange,
}: {
  field: PageField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === 'textarea') {
    return (
      <textarea
        rows={3}
        value={(value as string) ?? ''}
        onChange={e => onChange(e.target.value)}
        className={cn(inputCls, 'resize-y')}
      />
    );
  }

  if (field.type === 'image') {
    // Reuses the uploader the rest of the admin uses, so pictures go to the
    // same storage rather than being pasted URLs.
    return (
      <ImageUploader
        value={value ? [value as string] : []}
        onChange={(urls) => onChange(urls[0] ?? '')}
        max={1}
        prefix="pages"
      />
    );
  }

  if (field.type === 'list') {
    const rows = Array.isArray(value) ? (value as Content[]) : [];
    const setRow = (i: number, patch: Content) =>
      onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

    return (
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Item {i + 1}
              </span>
              <button
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                aria-label={`Remove item ${i + 1}`}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {(field.fields ?? []).map(sub => (
              <div key={sub.name}>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  {sub.label}
                </label>
                <FieldInput
                  field={sub}
                  value={row[sub.name]}
                  onChange={(v) => setRow(i, { [sub.name]: v })}
                />
              </div>
            ))}
          </div>
        ))}
        <button
          onClick={() => onChange([...rows, {}])}
          className="flex items-center gap-1.5 text-xs font-bold text-[#E03E3E] hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Add item
        </button>
      </div>
    );
  }

  return (
    <input
      value={(value as string) ?? ''}
      onChange={e => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

function SectionEditor({ page, section }: { page: string; section: PageSectionSchema }) {
  const save = useSavePageSection(page);
  // null until edited, so a refetch cannot clobber work in progress.
  const [draft, setDraft] = useState<Content | null>(null);
  const [open, setOpen] = useState(false);

  const content = draft ?? section.content ?? {};
  const dirty = draft !== null;

  const setField = (name: string, v: unknown) => setDraft({ ...content, [name]: v });

  const submit = () =>
    save.mutate({ sectionKey: section.key, content }, {
      onSuccess: () => { toast.success(`${section.label} saved.`); setDraft(null); },
      onError: (e) => toastApiError(e, `Could not save ${section.label}.`),
    });

  return (
    <Card className="border border-gray-100 rounded-xl overflow-hidden shadow-none">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50/70 border-b border-gray-100 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-xs font-bold text-gray-800 truncate">{section.label}</span>
          {dirty && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              Unsaved
            </span>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {section.fields.map(field => (
            <div key={field.name}>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                {field.label}
                {field.help && (
                  <span className="ml-1.5 normal-case font-medium text-gray-300">{field.help}</span>
                )}
              </label>
              <FieldInput
                field={field}
                value={content[field.name]}
                onChange={(v) => setField(field.name, v)}
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setDraft(null)}
              disabled={!dirty}
              className="border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-gray-50 disabled:opacity-40"
            >
              Discard
            </button>
            <button
              onClick={submit}
              disabled={save.isPending || !dirty}
              className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md hover:bg-[#c93535] disabled:opacity-50"
            >
              {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Section
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function PageContentEditor({ page }: { page: string }) {
  const { data, isLoading, isError } = usePageSchema(page);

  if (isLoading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>;
  }
  if (isError || !data) {
    return <p className="text-sm text-gray-400 py-10 text-center">Could not load this page&rsquo;s content.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Editing the <span className="font-bold text-gray-600">{data.label}</span> page. Changes go live immediately.
      </p>
      {data.sections.map(section => (
        <SectionEditor key={section.key} page={page} section={section} />
      ))}
    </div>
  );
}
