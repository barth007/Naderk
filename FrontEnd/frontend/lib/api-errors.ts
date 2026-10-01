import { toast } from 'sonner';

/**
 * Turn a DRF problem-details response into something a user can act on.
 *
 * The API returns RFC7807: a generic `detail` plus a per-field `errors` map.
 * Call sites read `detail` alone, which is where the useful text is *not* —
 * "Invalid fields for cart addition" while errors.non_field_errors held
 * "The selected frame 'Ariana Cat Eye' is incompatible with the lens type
 * 'Progressive'", and "Prescription validation failed" while errors carried the
 * four out-of-range values. The specific reason was dropped every time.
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[] | string>;
  /** Some endpoints answer with the success envelope's `message` instead. */
  message?: string;
}

export interface ApiErrorInfo {
  /** Headline for a toast. */
  title: string;
  /** Supporting lines — the field errors, when there are any. */
  description?: string;
  /** field -> first message, for binding to form inputs. */
  fieldErrors: Record<string, string>;
  status?: number;
}

/** Field names the API returns that read badly when auto-humanised. */
const FIELD_LABELS: Record<string, string> = {
  right_sph: 'Right eye SPH',
  right_cyl: 'Right eye CYL',
  right_axis: 'Right eye Axis',
  right_add: 'Right eye ADD',
  left_sph: 'Left eye SPH',
  left_cyl: 'Left eye CYL',
  left_axis: 'Left eye Axis',
  left_add: 'Left eye ADD',
  pupillary_distance: 'Pupillary distance',
  near_pd: 'Near PD',
  prescription_file: 'Prescription file',
  non_field_errors: '',
  detail: '',
};

export function humanizeField(field: string): string {
  if (field in FIELD_LABELS) return FIELD_LABELS[field];
  return field
    .replace(/_/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/^./, (c) => c.toUpperCase());
}

function asMessages(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

export function parseApiError(err: unknown, fallback = 'Something went wrong.'): ApiErrorInfo {
  const response = (err as { response?: { status?: number; data?: ProblemDetails } })?.response;

  // No response at all — the request never reached the API.
  if (!response) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      title: offline ? 'You appear to be offline.' : 'Could not reach the server.',
      description: 'Check your connection and try again.',
      fieldErrors: {},
    };
  }

  const data = response.data ?? {};
  const fieldErrors: Record<string, string> = {};
  const lines: string[] = [];

  for (const [field, raw] of Object.entries(data.errors ?? {})) {
    const messages = asMessages(raw);
    if (messages.length === 0) continue;
    fieldErrors[field] = messages[0];

    const label = humanizeField(field);
    for (const message of messages) {
      lines.push(label ? `${label}: ${message}` : message);
    }
  }

  const generic = data.detail || data.message || data.title || fallback;

  // A single unlabelled error is the whole story — promote it to the headline
  // rather than pairing it with a generic title.
  if (lines.length === 1 && !humanizeField(Object.keys(fieldErrors)[0] ?? '')) {
    return { title: lines[0], fieldErrors, status: response.status };
  }

  return {
    title: generic,
    description: lines.length ? lines.join('\n') : undefined,
    fieldErrors,
    status: response.status,
  };
}

/**
 * Parse and show the error, returning the parsed result so a caller can also
 * bind `fieldErrors` to its form.
 */
export function toastApiError(err: unknown, fallback = 'Something went wrong.'): ApiErrorInfo {
  const info = parseApiError(err, fallback);
  toast.error(info.title, info.description ? { description: info.description } : undefined);
  return info;
}
