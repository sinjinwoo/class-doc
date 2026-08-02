// Request/response/event shapes for every IPC channel exposed on
// `window.api`, plus the `Api` interface itself (the single source of truth
// for src/preload/index.ts's implementation and src/preload/index.d.ts's
// ambient `window.api` typing — both must structurally match this).
import type {
  DocumentHistoryStatus,
  GroupField,
  StudentGroup,
  StudentWithValues,
  Teacher,
  Template,
  TemplateDocType,
  TemplateField
} from './domain'

// ── teacher ─────────────────────────────────────────────────────────────
export interface TeacherCreateRequest {
  name: string
}
export interface TeacherUpdateRequest {
  id: number
  name: string
}

// ── groups ──────────────────────────────────────────────────────────────
export interface GroupListRequest {
  teacherId: number
}
export interface GroupCreateRequest {
  teacherId: number
  name: string
}
export interface GroupUpdateRequest {
  id: number
  name: string
}
export interface GroupDeleteRequest {
  id: number
}

// ── group fields ────────────────────────────────────────────────────────
export interface GroupFieldListRequest {
  groupId: number
}
export interface GroupFieldCreateRequest {
  groupId: number
  fieldKey: string
}
export interface GroupFieldDeleteRequest {
  groupId: number
  groupFieldId: number
}
export interface GroupFieldSetDisplayRequest {
  groupId: number
  groupFieldId: number
}
export interface GroupFieldSetIdentityRequest {
  groupId: number
  groupFieldId: number
  isIdentity: boolean
}

// ── students ────────────────────────────────────────────────────────────
export interface StudentListWithValuesRequest {
  groupId: number
}
export interface StudentCreateOrUpdateRequest {
  groupId: number
  studentId?: number
  values: Record<string, string>
}
export interface StudentDeleteRequest {
  studentId: number
}

// Mirrors CsvImportModal's onImport(rows, fieldConfig) callback shape exactly
// (src/renderer/src/components/groups/CsvImportModal.tsx +
// FieldConfigList.tsx's `FieldConfigEntry`).
export interface CsvFieldConfigEntry {
  fieldKey: string
  isDisplay: boolean
  isIdentity: boolean
}
export interface StudentImportCsvRequest {
  groupId: number
  rows: Record<string, string>[]
  fieldConfig: CsvFieldConfigEntry[]
}
export interface StudentImportCsvResult {
  imported: number
}

// ── templates ───────────────────────────────────────────────────────────
export interface TemplatePickFileResult {
  filePath: string
  fileName: string
  bytes: Uint8Array
}
export interface TemplateReadFileRequest {
  templateId: number
}
export interface TemplateReadFileResult {
  bytes: Uint8Array
  fileName: string
}
export interface TemplateSaveRequest {
  templateId?: number
  name?: string
  fileName: string
  docType: TemplateDocType
  bytes: Uint8Array
}
export interface TemplateDeleteRequest {
  templateId: number
}
export interface TemplateRenderPreviewRequest {
  templateId: number
  page: number
}
export interface TemplateRenderPreviewResult {
  svg: string
  pageCount: number
}

// ── template fields ─────────────────────────────────────────────────────
// v3 (docs/schema.md §4): mapping is now per-(template, group) pair, not
// template-global — every read/write of a template's field mapping must say
// which group's `group_field` set it's resolving/overriding against.
export interface TemplateFieldListRequest {
  templateId: number
  groupId: number
}
export interface TemplateFieldUpdateMappingRequest {
  templateFieldId: number
  groupId: number
  binding?: string
  defaultValue?: string | null
  required?: boolean
}

// ── generation ──────────────────────────────────────────────────────────
export interface GenerationRunRequest {
  templateId: number
  groupId: number
  studentIds?: number[]
  /** Teacher-chosen destination folder (via generationPickOutputDir); falls back to class-doc/output/ when omitted. */
  outputDir?: string
}
export interface GenerationSummary {
  runId: number
  docType: TemplateDocType
  total: number
  success: number
  failure: number
}
export interface GenerationProgressLastResult {
  studentId: number | null
  status: DocumentHistoryStatus
  outputPath: string | null
  errorMessage: string | null
}
export interface GenerationProgressEvent {
  runId: number
  completed: number
  total: number
  currentStudentName: string
  lastResult?: GenerationProgressLastResult
}

export const GENERATION_PROGRESS_CHANNEL = 'generation:progress' as const

// ── the full renderer-facing API surface ───────────────────────────────
export interface Api {
  teacherGet(): Promise<Teacher | null>
  teacherCreate(payload: TeacherCreateRequest): Promise<Teacher>
  teacherUpdate(payload: TeacherUpdateRequest): Promise<Teacher>

  groupList(payload: GroupListRequest): Promise<StudentGroup[]>
  groupCreate(payload: GroupCreateRequest): Promise<StudentGroup>
  groupUpdate(payload: GroupUpdateRequest): Promise<StudentGroup>
  groupDelete(payload: GroupDeleteRequest): Promise<void>

  groupFieldList(payload: GroupFieldListRequest): Promise<GroupField[]>
  groupFieldCreate(payload: GroupFieldCreateRequest): Promise<GroupField>
  groupFieldDelete(payload: GroupFieldDeleteRequest): Promise<void>
  groupFieldSetDisplay(payload: GroupFieldSetDisplayRequest): Promise<void>
  groupFieldSetIdentity(payload: GroupFieldSetIdentityRequest): Promise<void>

  studentListWithValues(payload: StudentListWithValuesRequest): Promise<StudentWithValues[]>
  studentCreateOrUpdate(payload: StudentCreateOrUpdateRequest): Promise<StudentWithValues>
  studentDelete(payload: StudentDeleteRequest): Promise<void>
  studentImportCsv(payload: StudentImportCsvRequest): Promise<StudentImportCsvResult>

  templateList(): Promise<Template[]>
  templatePickFile(): Promise<TemplatePickFileResult | null>
  templateReadFile(payload: TemplateReadFileRequest): Promise<TemplateReadFileResult>
  templateSave(payload: TemplateSaveRequest): Promise<Template>
  templateDelete(payload: TemplateDeleteRequest): Promise<void>
  templateRenderPreview(payload: TemplateRenderPreviewRequest): Promise<TemplateRenderPreviewResult>

  templateFieldList(payload: TemplateFieldListRequest): Promise<TemplateField[]>
  templateFieldUpdateMapping(payload: TemplateFieldUpdateMappingRequest): Promise<TemplateField>

  generationRun(payload: GenerationRunRequest): Promise<GenerationSummary>
  generationPickOutputDir(): Promise<string | null>
  onGenerationProgress(callback: (event: GenerationProgressEvent) => void): () => void
}
