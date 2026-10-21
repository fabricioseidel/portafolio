import type { PendingFile, PendingFiles } from '@/admin/types';
import type { SiteInput } from '@/core/schema';

/** Borrador local del panel, para no perder cambios al recargar. */
export type Draft = { site: SiteInput; files: PendingFiles; baseHeadSha: string | null; savedAt: number };

export function draftKey(repoKey: string): string {
  return 'portafolio:draft:' + repoKey;
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveDraft(
  repoKey: string,
  draft: Omit<Draft, 'savedAt'>,
  now: number = Date.now(),
): { ok: boolean; withoutFiles?: boolean } {
  const key = draftKey(repoKey);
  const base = { site: draft.site, baseHeadSha: draft.baseHeadSha, savedAt: now };
  // Sin `dataUrl`, que repite el base64: se reconstruye al cargar y el borrador ocupa la mitad.
  const files = Object.fromEntries(
    Object.entries(draft.files).map(([k, { path, publicPath, base64, mime, size }]) => [k, { path, publicPath, base64, mime, size }]),
  );
  if (write(key, { ...base, files })) return { ok: true };
  // Almacenamiento lleno (QuotaExceededError): al menos se conserva el contenido.
  if (write(key, { ...base, files: {} })) return Object.keys(files).length ? { ok: true, withoutFiles: true } : { ok: true };
  return { ok: false };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function toPendingFile(value: unknown): PendingFile | null {
  if (!isRecord(value)) return null;
  const { path, publicPath, base64, mime, size } = value;
  if (typeof path !== 'string' || typeof publicPath !== 'string' || typeof base64 !== 'string') return null;
  if (typeof mime !== 'string' || typeof size !== 'number') return null;
  return { path, publicPath, base64, mime, size, dataUrl: `data:${mime};base64,${base64}` };
}

export function loadDraft(repoKey: string): Draft | null {
  let data: unknown;
  try {
    const raw = localStorage.getItem(draftKey(repoKey));
    if (!raw) return null;
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || !isRecord(data.site) || !Array.isArray(data.site.sections) || !isRecord(data.files)) return null;

  const files: PendingFiles = {};
  for (const [key, value] of Object.entries(data.files)) {
    const file = toPendingFile(value);
    if (file) files[key] = file;
  }
  return {
    site: data.site as SiteInput,
    files,
    baseHeadSha: typeof data.baseHeadSha === 'string' ? data.baseHeadSha : null,
    savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
  };
}

export function clearDraft(repoKey: string): void {
  try {
    localStorage.removeItem(draftKey(repoKey));
  } catch {
    /* almacenamiento bloqueado: se ignora */
  }
}
