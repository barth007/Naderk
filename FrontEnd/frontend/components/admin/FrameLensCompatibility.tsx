'use client';

import React, { useState } from 'react';
import { Loader2, Check, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import {
  useAdminLensTypes, useFrameLensTypes, useSetFrameLensTypes,
} from '@/services/admin/admin-lenses.hooks';

/**
 * Pick which lens types a frame can be built with.
 *
 * add-to-cart refuses any pair with no FrameLensCompatibility row, and nothing
 * outside tests ever created one — so a frame added through the admin was
 * incompatible with every lens, and the patient hit
 * "The selected frame X is incompatible with the lens type Y" at checkout.
 */
export default function FrameLensCompatibility({
  frameId, frameName,
}: {
  frameId: string;
  frameName?: string;
}) {
  const { data: lensTypes = [], isLoading: loadingTypes } = useAdminLensTypes();
  const { data: selectedIds, isLoading: loadingSelected } = useFrameLensTypes(frameId);
  const save = useSetFrameLensTypes();

  // `draft` is null until the admin touches something, so the server value
  // shows through and a refetch cannot clobber an in-progress edit. Derived
  // rather than synced in an effect, which would cascade renders.
  const [draft, setDraft] = useState<string[] | null>(null);
  const checked = draft ?? selectedIds ?? [];
  const dirty = draft !== null;

  const toggle = (id: string) =>
    setDraft(checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id]);

  const submit = () => {
    save.mutate({ frameId, lensTypeIds: checked }, {
      // Drop the draft so the refetched server value takes over again.
      onSuccess: () => { toast.success('Lens compatibility saved.'); setDraft(null); },
      onError: () => toast.error('Failed to save lens compatibility.'),
    });
  };

  const loading = loadingTypes || loadingSelected;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-gray-400" />
        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          Compatible Lens Types
        </h4>
      </div>

      {checked.length === 0 && !loading && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
          {frameName ?? 'This frame'} cannot be bought until at least one lens type is selected.
        </p>
      )}

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
      ) : lensTypes.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          No lens types exist yet — add some in Glasses Builder first.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {lensTypes.map(lt => {
            const on = checked.includes(lt.id);
            return (
              <button
                type="button"
                key={lt.id}
                onClick={() => toggle(lt.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-semibold text-left transition-colors',
                  on ? 'border-[#E03E3E] bg-red-50 text-[#E03E3E]' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                  !lt.is_active && 'opacity-60',
                )}
              >
                <span className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  on ? 'bg-[#E03E3E] border-[#E03E3E]' : 'border-gray-300',
                )}>
                  {on && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="truncate">
                  {lt.name}
                  {!lt.is_active && <span className="text-[9px] text-gray-400"> (inactive)</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {dirty && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={save.isPending}
            className="flex items-center gap-1.5 bg-[#E03E3E] text-white text-xs font-semibold px-3.5 py-2 rounded-md hover:bg-[#c93535] disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Compatibility
          </button>
        </div>
      )}
    </div>
  );
}
