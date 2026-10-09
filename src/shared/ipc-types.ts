// Request/response/event shapes for every IPC channel exposed on
// `window.api`, plus the `Api` interface itself (the single source of truth
// for src/preload/index.ts's implementation and src/preload/index.d.ts's
// ambient `window.api` typing — both must structurally match this).
import type {
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

// Mirrors CsvImportModal's onImport(rows, fieldKeys) callback shape exactly
// (src/renderer/src/components/groups/CsvImportModal.tsx). Field roles
// (표시/식별 필드) are no longer picked by the teacher — the main process
// derives them automatically from conventional column names
// (autoAssignFieldRoles in src/main/ipc/groupFields.ts).
export interface StudentImportCsvRequest {
  groupId: number
  rows: Record<string, string>[]
  fieldKeys: string[]
}
export interface StudentImportCsvResult {
  imported: number
}
/** An .xlsx roster, parsed in main into the same shape as the renderer's CSV parser. */
export interface StudentParseSpreadsheetRequest {
  bytes: Uint8Array
}
export interface StudentParseSpreadsheetResult {
  headers: string[]
  rows: Record<string, string>[]
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
// v4: generation is a two-phase prepare/commit flow (teacher feedback: show
// a preview of the merged result before writing anything to disk) — see
// src/main/ipc/generation.ts's in-memory preview cache, keyed by the
// `previewId` this phase mints. Nothing is written to disk or the DB
// (`generation_run`/`document_history`) until `generationCommit` — an
// abandoned preview (teacher clicks "수정하기", or navigates away) leaves no
// trace, via `generationDiscardPreview`.
export interface GenerationPrepareRequest {
  templateId: number
  groupId: number
  studentIds?: number[]
  /**
   * Per-student overrides for STATIC_BINDING ("직접 입력") template fields,
   * entered directly into the student-picker table (studentId -> {
   * templateFieldId -> value }). Ephemeral — typed fresh before each
   * generation attempt, not persisted anywhere — so a missing entry for a
   * given student/field just falls back to that template field's
   * defaultValue (commonly empty; generation must still succeed with a
   * blank value).
   */
  staticValues?: Record<number, Record<number, string>>
}
export interface GenerationPreviewFailure {
  studentId: number | null
  displayValue: string | null
  message: string
}
export interface GenerationPreviewSummary {
  previewId: string
  docType: TemplateDocType
  total: number
  success: number
  failure: number
  /** Rendered page count of the prepared preview document; 0 when every student failed (nothing to preview or commit). */
  pageCount: number
  failures: GenerationPreviewFailure[]
}
export interface GenerationRenderPreviewPageRequest {
  previewId: string
  page: number
}
export interface GenerationRenderPreviewPageResult {
  svg: string
  pageCount: number
}
export interface GenerationCommitRequest {
  previewId: string
  /** Teacher-chosen destination folder (via generationPickOutputDir). */
  outputDir: string
}
export interface GenerationDiscardPreviewRequest {
  previewId: string
}
export interface GenerationSummary {
  runId: number
  docType: TemplateDocType
  total: number
  success: number
  failure: number
}
export interface GenerationProgressEvent {
  previewId: string
  completed: number
  total: number
  currentStudentName: string
}

export const GENERATION_PROGRESS_CHANNEL = 'generation:progress' as const

// ── the full renderer-facing API surface ───────────────────────────────
// ── app ─────────────────────────────────────────────────────────────────
export interface AppUpdateStatus {
  currentVersion: string
  /** Set only when a newer release than currentVersion is published. */
  update: { version: string; url: string } | null
}

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

  studentListWithValues(payload: StudentListWithValuesRequest): Promise<StudentWithValues[]>
  studentCreateOrUpdate(payload: StudentCreateOrUpdateRequest): Promise<StudentWithValues>
  studentDelete(payload: StudentDeleteRequest): Promise<void>
  studentImportCsv(payload: StudentImportCsvRequest): Promise<StudentImportCsvResult>
  studentParseSpreadsheet(
    payload: StudentParseSpreadsheetRequest
  ): Promise<StudentParseSpreadsheetResult>

  templateList(): Promise<Template[]>
  templatePickFile(): Promise<TemplatePickFileResult | null>
  templateReadFile(payload: TemplateReadFileRequest): Promise<TemplateReadFileResult>
  templateSave(payload: TemplateSaveRequest): Promise<Template>
  templateDelete(payload: TemplateDeleteRequest): Promise<void>
  templateRenderPreview(payload: TemplateRenderPreviewRequest): Promise<TemplateRenderPreviewResult>

  templateFieldList(payload: TemplateFieldListRequest): Promise<TemplateField[]>
  templateFieldUpdateMapping(payload: TemplateFieldUpdateMappingRequest): Promise<TemplateField>

  generationPrepare(payload: GenerationPrepareRequest): Promise<GenerationPreviewSummary>
  generationRenderPreviewPage(
    payload: GenerationRenderPreviewPageRequest
  ): Promise<GenerationRenderPreviewPageResult>
  generationCommit(payload: GenerationCommitRequest): Promise<GenerationSummary>
  generationDiscardPreview(payload: GenerationDiscardPreviewRequest): Promise<void>
  generationPickOutputDir(): Promise<string | null>
  onGenerationProgress(callback: (event: GenerationProgressEvent) => void): () => void

  /** Local http://127.0.0.1 URL of the self-hosted rhwp-studio (the editor iframe). */
  studioGetUrl(): Promise<string>

  /** Notify-only update check (once per run; silent on failure/offline). */
  appGetUpdateStatus(): Promise<AppUpdateStatus>
  /** Opens the newer release's page in the default browser. */
  appOpenUpdatePage(): Promise<void>
  /** Opens the class-doc data folder (DB/templates/outputs) in Explorer. */
  appOpenDataFolder(): Promise<void>
}
