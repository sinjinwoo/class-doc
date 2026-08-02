// snake_case DB row shapes <-> camelCase shared/domain.ts shapes. Centralized
// here so every ipc/*.ts file can focus on query logic instead of repeating
// this boilerplate per table.
import type {
  DocumentHistory,
  DocumentHistoryStatus,
  GenerationRun,
  GroupField,
  Student,
  StudentGroup,
  Teacher,
  Template,
  TemplateDocType,
  TemplateField,
  TemplateFieldScope
} from '../../shared/domain'

export interface TeacherRow {
  id: number
  name: string
  created_at: string
}
export function mapTeacher(row: TeacherRow): Teacher {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

export interface StudentGroupRow {
  id: number
  teacher_id: number
  name: string
  created_at: string
  updated_at: string
}
export function mapStudentGroup(row: StudentGroupRow): StudentGroup {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export interface GroupFieldRow {
  id: number
  group_id: number
  field_key: string
  display_order: number | null
  is_display: number
  is_identity: number
  created_at: string
}
export function mapGroupField(row: GroupFieldRow): GroupField {
  return {
    id: row.id,
    groupId: row.group_id,
    fieldKey: row.field_key,
    displayOrder: row.display_order,
    isDisplay: row.is_display === 1,
    isIdentity: row.is_identity === 1,
    createdAt: row.created_at
  }
}

export interface StudentRow {
  id: number
  group_id: number
  identity_hash: string
  created_at: string
  updated_at: string
}
export function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    groupId: row.group_id,
    identityHash: row.identity_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export interface TemplateRow {
  id: number
  name: string
  file_name: string
  doc_type: string
  repeat_row_json: string | null
  created_at: string
  updated_at: string
}
export function mapTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    fileName: row.file_name,
    docType: row.doc_type as TemplateDocType,
    repeatRowJson: row.repeat_row_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export interface TemplateFieldRow {
  id: number
  template_id: number
  field_name: string
  binding: string
  scope: string
  required: number
  default_value: string | null
  display_order: number | null
}
export function mapTemplateField(row: TemplateFieldRow): TemplateField {
  return {
    id: row.id,
    templateId: row.template_id,
    fieldName: row.field_name,
    binding: row.binding,
    scope: row.scope as TemplateFieldScope,
    required: row.required === 1,
    defaultValue: row.default_value,
    displayOrder: row.display_order
  }
}

export interface GenerationRunRow {
  id: number
  template_id: number | null
  template_name_snapshot: string
  group_id: number | null
  group_name_snapshot: string | null
  doc_type_snapshot: string
  total_count: number
  success_count: number
  failure_count: number
  started_at: string
  finished_at: string | null
}
export function mapGenerationRun(row: GenerationRunRow): GenerationRun {
  return {
    id: row.id,
    templateId: row.template_id,
    templateNameSnapshot: row.template_name_snapshot,
    groupId: row.group_id,
    groupNameSnapshot: row.group_name_snapshot,
    docTypeSnapshot: row.doc_type_snapshot as TemplateDocType,
    totalCount: row.total_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }
}

export interface DocumentHistoryRow {
  id: number
  run_id: number
  student_id: number | null
  student_name_snapshot: string | null
  output_path: string | null
  status: string
  error_message: string | null
  created_at: string
}
export function mapDocumentHistory(row: DocumentHistoryRow): DocumentHistory {
  return {
    id: row.id,
    runId: row.run_id,
    studentId: row.student_id,
    studentNameSnapshot: row.student_name_snapshot,
    outputPath: row.output_path,
    status: row.status as DocumentHistoryStatus,
    errorMessage: row.error_message,
    createdAt: row.created_at
  }
}
