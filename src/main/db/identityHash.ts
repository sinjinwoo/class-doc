// Implements docs/schema.md §4's identity_hash algorithm exactly: normalize
// (trim) each is_identity=1 field's value, sort by field_key, JSON-stringify,
// SHA-256. Shared by students.ts's CSV-import upsert and single-student
// form upsert (same underlying algorithm, per the plan).
import { createHash } from 'crypto'

export function normalizeFieldValue(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function computeIdentityHash(
  entries: Array<{ fieldKey: string; value: string | null | undefined }>
): string {
  const normalized = entries
    .map((entry): [string, string] => [entry.fieldKey, normalizeFieldValue(entry.value)])
    .sort(([a], [b]) => a.localeCompare(b))
  const json = JSON.stringify(normalized)
  return createHash('sha256').update(json).digest('hex')
}

/**
 * Bug fix: `computeIdentityHash([])` (zero `is_identity=1` fields) hashes an
 * empty array — a *constant* value regardless of the student's actual data.
 * Every student then collides on `UNIQUE(group_id, identity_hash)` and each
 * "add student" silently overwrites the one existing row instead of
 * inserting a new one (data loss, reported directly by a user hitting it in
 * practice via the group_field-management UI, which — unlike the CSV import
 * wizard — never forced picking an identity field before this fix).
 *
 * Fallback: if no field is explicitly marked `is_identity`, use *every*
 * known field as the identity set instead of none. This can never produce a
 * constant hash across genuinely different students (any differing field
 * value changes the hash), at the cost of the same known tradeoff
 * docs/schema.md §4 already accepts for explicitly-chosen identity fields:
 * editing a re-uploaded CSV row's values (e.g. fixing a typo) is
 * indistinguishable from "a new student" and creates a duplicate rather
 * than updating in place. That tradeoff already existed for the explicit
 * case; this just extends the same fallback to the "nothing configured"
 * case instead of the strictly worse constant-hash failure mode.
 */
export function resolveIdentityFields<T extends { isIdentity: boolean }>(fields: T[]): T[] {
  const explicit = fields.filter((f) => f.isIdentity)
  return explicit.length > 0 ? explicit : fields
}

/**
 * There is no more manual "표시 필드"/"식별 필드" UI (teacher feedback: the
 * concept was confusing and unnecessary to expose) — group_field roles are
 * now inferred automatically from conventional roster column names instead
 * of being picked by hand. These mirror the naming convention already relied
 * on elsewhere in this app (generation.ts's individual/list output filename
 * builders use the same 학년/반/번호 triplet).
 */
export const CONVENTIONAL_IDENTITY_KEYS = ['학년', '반', '번호'] as const
export const CONVENTIONAL_DISPLAY_KEYS = ['이름', '성명'] as const
