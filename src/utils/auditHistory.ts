import type { ComplianceAuditResult } from '../types/audit';

export const RECENT_AUDITS_STORAGE_KEY = 'dastavezguard_recent_audits_v1';
export const MAX_RECENT_AUDITS = 5;

export interface RecentAuditEntry {
  id: string;
  savedAt: string;
  result: ComplianceAuditResult;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function buildAuditFingerprint(result: ComplianceAuditResult): string {
  const docKey = result.documents
    .map((d) => `${d.fileName}:${d.documentType}:${d.validityStatus}`)
    .join('|');
  return `${result.targetScheme}::${result.auditDate}::${result.readinessScore}::${docKey}`;
}

export function upsertRecentAudit(
  existing: RecentAuditEntry[],
  result: ComplianceAuditResult,
  maxItems = MAX_RECENT_AUDITS,
  nowIso = new Date().toISOString(),
): { entries: RecentAuditEntry[]; activeId: string } {
  const fingerprint = buildAuditFingerprint(result);
  const existingMatch = existing.find(
    (entry) => buildAuditFingerprint(entry.result) === fingerprint,
  );
  const id = existingMatch?.id ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const nextEntry: RecentAuditEntry = {
    id,
    savedAt: nowIso,
    result,
  };

  const filtered = existing.filter((entry) => entry.id !== id);
  const entries = [nextEntry, ...filtered].slice(0, Math.max(1, maxItems));
  return { entries, activeId: id };
}

export function removeRecentAudit(
  existing: RecentAuditEntry[],
  id: string,
): RecentAuditEntry[] {
  return existing.filter((entry) => entry.id !== id);
}

export function loadRecentAuditsFromStorage(
  storage: StorageLike | null | undefined,
): RecentAuditEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_AUDITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentAuditEntry =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as RecentAuditEntry).id === 'string' &&
          typeof (item as RecentAuditEntry).savedAt === 'string' &&
          Boolean((item as RecentAuditEntry).result) &&
          typeof (item as RecentAuditEntry).result.targetScheme === 'string' &&
          typeof (item as RecentAuditEntry).result.readinessScore === 'number' &&
          Array.isArray((item as RecentAuditEntry).result.documents),
      )
      .slice(0, MAX_RECENT_AUDITS);
  } catch {
    return [];
  }
}

export function saveRecentAuditsToStorage(
  storage: StorageLike | null | undefined,
  entries: RecentAuditEntry[],
): void {
  if (!storage) return;
  try {
    storage.setItem(
      RECENT_AUDITS_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_RECENT_AUDITS)),
    );
  } catch {
    // Ignore storage quota or private browsing errors gracefully
  }
}
