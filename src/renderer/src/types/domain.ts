// Renderer-side domain types mirroring docs/schema.md.
// No IPC/DB wiring exists yet (better-sqlite3 not installed) — these types let
// UI screens be built against the finalized schema shape now, and wired to
// real `window.api.*` calls later without reshaping props.

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
