'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpRight, Globe, X } from 'lucide-react';

/** Anyone shown in a profile popup: a trustee, a team member. */
export type Profile = {
  name: string;
  role?: string;
  image?: string;
  imageAlt?: string;
  bio?: string;
  website?: string;
  socials?: { label?: string; url?: string }[];
};

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

/**
 * A link typed into the CMS, made safe to put in an href: "example.com"
 * becomes https://example.com, and anything that is not http(s) is dropped.
 */
export function safeUrl(raw?: string): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(v) ? v : `https://${v}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** "LinkedIn" as typed, or the site's name when the platform was left blank. */
function socialLabel(label: string | undefined, href: string) {
  if (label?.trim()) return label.trim();
  return new URL(href).hostname.replace(/^www\./, '');
}

/** One person in full: large photo, whole bio, website and social links. */
export function ProfileModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const website = safeUrl(profile.website);
  const socials = (profile.socials ?? [])
    .map((s) => ({ label: s.label, href: safeUrl(s.url) }))
    .filter((s): s is { label: string | undefined; href: string } => s.href !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="profile-name"
        className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close"
          className="absolute right-4 top-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 text-[#6B6B7B] shadow-sm hover:bg-[#F6F1F1]">
          <X className="w-5 h-5" aria-hidden />
        </button>

        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-[42%] shrink-0">
            {profile.image
              // eslint-disable-next-line @next/next/no-img-element -- CMS URLs from any host
              ? <img src={profile.image} alt={profile.imageAlt || profile.name}
                  className="aspect-square sm:aspect-auto sm:h-full w-full object-cover rounded-t-3xl sm:rounded-l-3xl sm:rounded-tr-none" />
              : <div className="aspect-square sm:h-full w-full flex items-center justify-center bg-[#FFE3E3] rounded-t-3xl sm:rounded-l-3xl sm:rounded-tr-none text-6xl font-extrabold text-[#9B1C1C]" aria-hidden>
                  {initials(profile.name)}
                </div>}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4 p-6 sm:p-8">
            <div className="pr-10">
              <h2 id="profile-name" className="text-2xl font-extrabold text-[#1A1A2E]">{profile.name}</h2>
              {profile.role && <p className="mt-1 text-sm font-semibold text-[#B42318]">{profile.role}</p>}
            </div>

            {profile.bio?.trim() && (
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#4A4A5A]">{profile.bio.trim()}</p>
            )}

            {(website || socials.length > 0) && (
              <div className="mt-auto flex flex-col gap-3 border-t border-[#F1E4E4] pt-4">
                {website && (
                  <a href={website} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-[#B42318] hover:text-[#7A1A10]">
                    <Globe className="h-4 w-4" aria-hidden /> Website <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </a>
                )}
                {socials.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label="Social media">
                    {socials.map((s, i) => (
                      <li key={`${s.href}-${i}`}>
                        <a href={s.href} target="_blank" rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[#E7D7D7] bg-white px-4 text-sm font-semibold text-[#1A1A2E] hover:bg-[#FFF1F1]">
                          {socialLabel(s.label, s.href)} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
