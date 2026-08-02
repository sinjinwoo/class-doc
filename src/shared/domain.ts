// Domain types mirroring docs/schema.md, shared between main (IPC payload
// validation / DB query result shaping) and renderer (component props).
//
// Originally lived at src/renderer/src/types/domain.ts back when no IPC/DB
// wiring existed yet; moved here once src/main/ipc/* needed the same shapes.

export interface Teacher {
  id: number
  name: string
  createdAt: string
}

export interface StudentGroup {
  id: number
  teacherId: number
  name: string
  createdAt: string
  updatedAt: string
}

// group_field: a column detected from a group's CSV header (or defined
// manually via an "add field" action before any student exists).
export interface GroupField {
  id: number
  groupId: number
  fieldKey: string
  displayOrder: number | null
  isDisplay: boolean
  isIdentity: boolean
  createdAt: string
}

export interface Student {
  id: number
  groupId: number
  identityHash: string
  createdAt: string
  updatedAt: string
}

export interface StudentFieldValue {
  id: number
  studentId: number
  groupFieldId: number
  value: string | null
}

// UI convenience shape: a student joined with its field values keyed by
// group_field id, as returned by a typical "list students in group" query.
export interface StudentWithValues extends Student {
  values: Record<number, string | null>
}

export type TemplateDocType = 'INDIVIDUAL' | 'LIST'

export interface Template {
  id: number
  name: string
  fileName: string
  docType: TemplateDocType
  // JSON-encoded repeat-row location for LIST-type templates (section/parent
  // paragraph/control/row indices for @rhwp/core's insertTableRow()). Its
  // exact shape is still unconfirmed pending a real spike test against a
  // table+field template (see docs/schema.md §7 and SKILL.md §2/§4) — this
  // app currently has no UI to populate it, so it is `null` for every
  // template created so far.
  repeatRowJson: string | null
  createdAt: string
  updatedAt: string
}

export type TemplateFieldScope = 'DOC' | 'ROW'

// Sentinel binding value meaning "use default_value as a literal, not a
// group_field lookup" — see docs/schema.md §4 (template_field.binding).
export const STATIC_BINDING = '__STATIC__' as const

export interface TemplateField {
  id: number
  templateId: number
  fieldName: string
  binding: string // group_field.fieldKey, or STATIC_BINDING
  scope: TemplateFieldScope
  required: boolean
  defaultValue: string | null
  displayOrder: number | null
}

export interface GenerationRun {
  id: number
  templateId: number | null
  templateNameSnapshot: string
  groupId: number | null
  groupNameSnapshot: string | null
  docTypeSnapshot: TemplateDocType
  totalCount: number
  successCount: number
  failureCount: number
  startedAt: string
  finishedAt: string | null
}

export type DocumentHistoryStatus = 'SUCCESS' | 'FAILURE'

export interface DocumentHistory {
  id: number
  runId: number
  studentId: number | null
  studentNameSnapshot: string | null
  outputPath: string | null
  status: DocumentHistoryStatus
  errorMessage: string | null
  createdAt: string
}
