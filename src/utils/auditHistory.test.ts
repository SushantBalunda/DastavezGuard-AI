import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadRecentAuditsFromStorage,
  RECENT_AUDITS_STORAGE_KEY,
  removeRecentAudit,
  saveRecentAuditsToStorage,
  upsertRecentAudit,
  type RecentAuditEntry,
  type StorageLike,
} from './auditHistory';
import { getSampleAuditCase } from './compliance';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

test('upsertRecentAudit keeps at most 5 recent audits and deduplicates matching reports', () => {
  const base = getSampleAuditCase().auditResult;
  let entries: RecentAuditEntry[] = [];

  for (let i = 1; i <= 7; i += 1) {
    const res = upsertRecentAudit(
      entries,
      { ...base, targetScheme: `Scheme ${i}`, readinessScore: 100 - i * 10 },
      5,
      `2026-11-16T0${i}:00:00.000Z`,
    );
    entries = res.entries;
  }

  assert.equal(entries.length, 5);
  assert.equal(entries[0].result.targetScheme, 'Scheme 7');
  assert.equal(entries[4].result.targetScheme, 'Scheme 3');

  // Re-adding Scheme 5 moves it to top without creating a duplicate
  const deduped = upsertRecentAudit(
    entries,
    { ...base, targetScheme: 'Scheme 5', readinessScore: 50 },
    5,
    '2026-11-16T09:00:00.000Z',
  );
  assert.equal(deduped.entries.length, 5);
  assert.equal(deduped.entries[0].result.targetScheme, 'Scheme 5');
});

test('saveRecentAuditsToStorage and loadRecentAuditsFromStorage roundtrip safely', () => {
  const storage = createMemoryStorage();
  const base = getSampleAuditCase().auditResult;
  const { entries } = upsertRecentAudit([], base);

  saveRecentAuditsToStorage(storage, entries);
  const loaded = loadRecentAuditsFromStorage(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].result.targetScheme, base.targetScheme);

  // Corrupted JSON falls back cleanly to empty array
  storage.setItem(RECENT_AUDITS_STORAGE_KEY, '{invalid-json');
  assert.deepEqual(loadRecentAuditsFromStorage(storage), []);
});

test('removeRecentAudit deletes only the targeted entry', () => {
  const base = getSampleAuditCase().auditResult;
  const r1 = upsertRecentAudit([], { ...base, targetScheme: 'A' });
  const r2 = upsertRecentAudit(r1.entries, { ...base, targetScheme: 'B' });
  const remaining = removeRecentAudit(r2.entries, r1.activeId);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].result.targetScheme, 'B');
});
