import type { IpcMain } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from '../db'
import { mapTemplateField, type TemplateFieldRow } from '../db/mappers'
import type { TemplateField } from '../../shared/domain'
import type {
  TemplateFieldListRequest,
  TemplateFieldUpdateMappingRequest
} from '../../shared/ipc-types'

// v3 (docs/schema.md §4): "effective mapping" resolution — a
// `template_field_override` row for (template_field_id, group_id), if one
// exists, wins entirely (binding/required/default_value all come from that
// row); otherwise the base `template_field` row's own values are the
// fallback. This is a row-level fallback, not a per-column COALESCE — a
// per-column COALESCE would be wrong here because an override's
// `default_value` can legitimately be NULL on purpose (e.g. a group cleared
// a static value back out), and COALESCE would incorrectly fall through to
// the base row's default_value in that case. `ov.id IS NOT NULL` is the
// "does an override row exist at all" test.
const RESOLVE_TEMPLATE_FIELDS_FOR_TEMPLATE = `
  SELECT
    tf.id AS id,
    tf.template_id AS template_id,
    tf.field_name AS field_name,
    CASE WHEN ov.id IS NOT NULL THEN ov.binding ELSE tf.binding END AS binding,
    tf.scope AS scope,
    CASE WHEN ov.id IS NOT NULL THEN ov.required ELSE tf.required END AS required,
    CASE WHEN ov.id IS NOT NULL THEN ov.default_value ELSE tf.default_value END AS default_value,
    tf.display_order AS display_order
  FROM template_field tf
  LEFT JOIN template_field_override ov
    ON ov.template_field_id = tf.id AND ov.group_id = ?
  WHERE tf.template_id = ?
  ORDER BY tf.display_order IS NULL, tf.display_order, tf.id
`

const RESOLVE_TEMPLATE_FIELD_BY_ID = `
  SELECT
    tf.id AS id,
    tf.template_id AS template_id,
    tf.field_name AS field_name,
    CASE WHEN ov.id IS NOT NULL THEN ov.binding ELSE tf.binding END AS binding,
    tf.scope AS scope,
    CASE WHEN ov.id IS NOT NULL THEN ov.required ELSE tf.required END AS required,
    CASE WHEN ov.id IS NOT NULL THEN ov.default_value ELSE tf.default_value END AS default_value,
    tf.display_order AS display_order
  FROM template_field tf
  LEFT JOIN template_field_override ov
    ON ov.template_field_id = tf.id AND ov.group_id = ?
  WHERE tf.id = ?
`

const SELECT_TEMPLATE_FIELD_BASE =
  'SELECT id, template_id, field_name, binding, scope, required, default_value, display_order FROM template_field WHERE id = ?'

/**
 * Returns a template's fields with the mapping resolved for one specific
 * group: each field's binding/required/defaultValue come from that group's
 * `template_field_override` row if one exists, else fall back to the
 * template-global `template_field` row (see docs/schema.md §4, v3).
 *
 * Callers (notably generation.ts's runGeneration) must call this — not the
 * base `template_field` table directly — or a saved group-scoped override
 * would silently never be used.
 */
export function listTemplateFieldsForGroup(
  db: Database.Database,
  templateId: number,
  groupId: number
): TemplateField[] {
  const rows = db
    .prepare(RESOLVE_TEMPLATE_FIELDS_FOR_TEMPLATE)
    .all(groupId, templateId) as TemplateFieldRow[]
  return rows.map(mapTemplateField)
}

function resolveTemplateField(
  db: Database.Database,
  templateFieldId: number,
  groupId: number
): TemplateField {
  const row = db.prepare(RESOLVE_TEMPLATE_FIELD_BY_ID).get(groupId, templateFieldId) as
    TemplateFieldRow | undefined
  if (!row) {
    throw new Error('템플릿 필드를 찾을 수 없습니다.')
  }
  return mapTemplateField(row)
}

/**
 * Merge-patch update of a (template field, group) pair's mapping — only the
 * properties present on `payload` are changed, the rest are carried over
 * from whatever's currently effective for this group (an existing override,
 * or the template-global base row if this is the first override for this
 * group). This single handler backs both of FieldMappingTable's callback
 * shapes — `onChangeBinding(templateFieldId, binding)` sends `{
 * templateFieldId, groupId, binding }` only, `onChangeStatic(templateFieldId,
 * defaultValue, required)` sends `{ templateFieldId, groupId, defaultValue,
 * required }` only — via two thin preload wrapper functions around this one
 * IPC channel.
 *
 * Always writes a full `template_field_override` row (upsert), never patches
 * `template_field` directly (docs/schema.md §4, v3: the base row stays the
 * template-global fallback for groups that haven't mapped this field yet).
 */
export function updateTemplateFieldMapping(
  db: Database.Database,
  payload: TemplateFieldUpdateMappingRequest
): TemplateField {
  const { templateFieldId, groupId } = payload

  const baseRow = db.prepare(SELECT_TEMPLATE_FIELD_BASE).get(templateFieldId) as
    TemplateFieldRow | undefined
  if (!baseRow) {
    throw new Error('템플릿 필드를 찾을 수 없습니다.')
  }

  // Current effective (already-resolved) values for this group — the
  // starting point for the merge-patch, whether they came from a prior
  // override or the template-global base row.
  const current = resolveTemplateField(db, templateFieldId, groupId)

  const binding = payload.binding !== undefined ? payload.binding.trim() : current.binding
  if (!binding) {
    throw new Error('매핑 대상은 비어 있을 수 없습니다.')
  }
  const defaultValue =
    payload.defaultValue !== undefined ? payload.defaultValue : current.defaultValue
  const required = payload.required !== undefined ? payload.required : current.required

  db.prepare(
    `INSERT INTO template_field_override (template_field_id, group_id, binding, required, default_value)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(template_field_id, group_id) DO UPDATE SET
       binding = excluded.binding,
       required = excluded.required,
       default_value = excluded.default_value`
  ).run(templateFieldId, groupId, binding, required ? 1 : 0, defaultValue)

  return resolveTemplateField(db, templateFieldId, groupId)
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('templateField:list', (_event, payload: TemplateFieldListRequest) => {
    return listTemplateFieldsForGroup(getDb(), payload.templateId, payload.groupId)
  })

  ipcMain.handle(
    'templateField:updateMapping',
    (_event, payload: TemplateFieldUpdateMappingRequest) => {
      return updateTemplateFieldMapping(getDb(), payload)
    }
  )
}
