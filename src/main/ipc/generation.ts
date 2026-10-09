import { randomUUID } from 'crypto'
import { dialog, type IpcMain, type IpcMainInvokeEvent } from 'electron'
import type Database from 'better-sqlite3'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDb } from '../db'
import { getTemplateDir } from '../paths'
import { describeHwpError, loadHwpDocument, type HwpDocument } from '../rhwp/hwpCore'
import { dedupeFileName, sanitizeFileName } from '../util/fileNaming'
import { mergeHwpxDocuments } from '../util/hwpxMerge'
import type { TemplateRow } from '../db/mappers'
import { listGroupFields } from './groupFields'
import { listStudentsWithValues } from './students'
import { listTemplateFieldsForGroup } from './templateFields'
import {
  STATIC_BINDING,
  TEACHER_NAME_BINDING,
  type GroupField,
  type StudentWithValues,
  type TemplateDocType,
  type TemplateField
} from '../../shared/domain'
import {
  GENERATION_PROGRESS_CHANNEL,
  type GenerationCommitRequest,
  type GenerationDiscardPreviewRequest,
  type GenerationPrepareRequest,
  type GenerationPreviewFailure,
  type GenerationPreviewSummary,
  type GenerationProgressEvent,
  type GenerationRenderPreviewPageRequest,
  type GenerationRenderPreviewPageResult,
  type GenerationSummary
} from '../../shared/ipc-types'

const SELECT_STUDENT_GROUP = 'SELECT id, name FROM student_group WHERE id = ?'

interface RepeatRowConfig {
  sectionIdx: number
  parentParaIdx: number
  controlIdx: number
  rowIdx: number
}

function resolveFieldValue(
  templateField: TemplateField,
  student: StudentWithValues,
  groupFieldByKey: Map<string, GroupField>,
  staticValues: Map<number, Map<number, string>>,
  teacherName: string
): string {
  if (templateField.binding === STATIC_BINDING) {
    // Per-student value typed into the student-picker table (pivoted
    // preview/edit table) takes priority; falls back to the template
    // field's own defaultValue, then empty — generation must succeed even
    // when a direct-input field was left blank.
    const override = staticValues.get(student.id)?.get(templateField.id)
    return override ?? templateField.defaultValue ?? ''
  }
  if (templateField.binding === TEACHER_NAME_BINDING) {
    return teacherName
  }
  const groupField = groupFieldByKey.get(templateField.binding)
  if (!groupField) {
    // Re-validated here even though the mapping screen is expected to only
    // ever offer valid bindings — the group's group_field set can change
    // (CSV re-upload, field deletion) after a mapping was saved, per
    // docs/schema.md §4's explicit "생성 시점 재검증" requirement.
    throw new Error(
      `매핑된 필드 '${templateField.binding}'가 현재 그룹에 존재하지 않습니다. 매핑을 다시 지정해주세요.`
    )
  }
  // Missing/null value -> empty string, mirroring arcjotectire.md's "AUTO 값
  // 부재는 빈 문자열 주입" for this schema's equivalent case.
  return student.values[groupField.id] ?? ''
}

interface RhwpFieldListEntry {
  name: string
  location: { sectionIndex: number; paraIndex: number }
  startCharIdx: number
}

/**
 * Sets every template field's resolved value on `doc` — except a field whose
 * resolved value is empty gets its click-here *control* removed entirely
 * (`removeFieldAt`) instead of being set to `''`. This distinction matters:
 * a HWP click-here field's "empty" state isn't blank — it displays its own
 * `guide` hint again (that's the whole point of a click-here placeholder),
 * so `setFieldValueByName(name, '')` left the original 누름틀 placeholder
 * text visibly unchanged in the generated document (reported directly:
 * "값을 입력하지 않으면... 누름틀 그대로 보임"). Removing the field control
 * converts it to plain (genuinely empty) text instead, verified against the
 * real registered template — `Contents/section0.xml` for a removed field
 * drops the `<hp:fieldBegin>/<hp:fieldEnd>` wrapper entirely, leaving a bare
 * `<hp:t></hp:t>`.
 *
 * Only reachable for DOC-scope (plain-paragraph) fields, not ROW-scope
 * fields inside a repeated table cell — those would need
 * `removeFieldAtInCell` with cell-position parameters this app doesn't
 * currently track, but that path is unreachable anyway (LIST-doctype
 * generation is rejected pre-flight whenever `repeat_row_json` is unset,
 * which it always is — see prepareGeneration's own comment).
 *
 * Field list positions are re-read fresh before each individual removal
 * (rather than reused from one snapshot) since removing one field could in
 * principle shift a not-yet-removed field's position if they ever shared a
 * paragraph — cheap insurance for a case this template didn't happen to
 * exercise (every field here has its own paragraph).
 */
function applyFieldValues(
  doc: HwpDocument,
  templateFields: TemplateField[],
  student: StudentWithValues,
  groupFieldByKey: Map<string, GroupField>,
  staticValues: Map<number, Map<number, string>>,
  teacherName: string
): void {
  const toRemove: string[] = []

  for (const templateField of templateFields) {
    const value = resolveFieldValue(templateField, student, groupFieldByKey, staticValues, teacherName)
    if (value === '') {
      toRemove.push(templateField.fieldName)
      continue
    }
    try {
      doc.setFieldValueByName(templateField.fieldName, value)
    } catch (e) {
      throw new Error(`필드 '${templateField.fieldName}' 값 설정 실패: ${describeHwpError(e)}`)
    }
  }

  for (const fieldName of toRemove) {
    const fields = JSON.parse(doc.getFieldList()) as RhwpFieldListEntry[]
    const field = fields.find((f) => f.name === fieldName)
    // Already gone (or never existed under this name) — nothing to remove.
    if (!field) continue
    try {
      doc.removeFieldAt(field.location.sectionIndex, field.location.paraIndex, field.startCharIdx)
    } catch (e) {
      throw new Error(`필드 '${fieldName}' 제거 실패: ${describeHwpError(e)}`)
    }
  }
}

function getDisplayValue(student: StudentWithValues, groupFields: GroupField[]): string {
  const displayField = groupFields.find((f) => f.isDisplay)
  const raw = displayField ? student.values[displayField.id] : null
  return raw && raw.trim().length > 0 ? raw : `학생${student.id}`
}

// Best-effort filename convention per arcjotectire.md ("개별형
// `학년-반-번호_이름_템플릿명.hwpx`") — none of 학년/반/번호 are guaranteed to
// exist as fields for any given group (docs/schema.md §7), so this only uses
// whichever of them are actually present, falling back to just the display
// value (or `학생<id>` if that's missing too) when none are.
function buildIndividualFileName(
  student: StudentWithValues,
  groupFields: GroupField[],
  displayValue: string,
  templateName: string
): string {
  const conventionalKeys = ['학년', '반', '번호']
  const parts = conventionalKeys
    .map((key) => groupFields.find((f) => f.fieldKey === key))
    .filter((f): f is GroupField => f !== undefined)
    .map((f) => (student.values[f.id] ?? '').trim())
    .filter((v) => v.length > 0)

  const prefix = parts.length > 0 ? `${parts.join('-')}_` : ''
  return sanitizeFileName(`${prefix}${displayValue}_${templateName}.hwpx`)
}

// Best-effort filename convention per arcjotectire.md ("목록형
// `학년-반_템플릿명.hwpx`") — uses the first student's 학년/반 values (a
// group is not guaranteed to be exactly one class, docs/schema.md §1), else
// falls back to the group's own name. Shared by prepareList() (LIST
// doc-type output) and prepareIndividual() (the merged multi-student
// INDIVIDUAL-doctype output, docs/hwpx-merge-plan.md) — both produce one
// file representing multiple students, so the same "which class is this"
// naming applies.
function buildBatchFileName(
  students: StudentWithValues[],
  groupFields: GroupField[],
  groupName: string,
  templateName: string
): string {
  const gradeField = groupFields.find((f) => f.fieldKey === '학년')
  const classField = groupFields.find((f) => f.fieldKey === '반')
  const first = students[0]
  const gradeValue = first && gradeField ? (first.values[gradeField.id] ?? '').trim() : ''
  const classValue = first && classField ? (first.values[classField.id] ?? '').trim() : ''
  const prefix = gradeValue && classValue ? `${gradeValue}-${classValue}` : groupName
  return sanitizeFileName(`${prefix}_${templateName}.hwpx`)
}

// Everything prepareIndividual()/prepareList() need that doesn't depend on
// where (or whether) the result ends up on disk — no `db`/`outputDir` here
// on purpose, since nothing is written or recorded until generation:commit.
interface PrepareContext {
  templateDir: string
  templateRow: TemplateRow
  templateFields: TemplateField[]
  groupFields: GroupField[]
  groupFieldByKey: Map<string, GroupField>
  groupName: string
  students: StudentWithValues[]
  staticValues: Map<number, Map<number, string>>
  teacherName: string
}

interface PreparedEntry {
  studentId: number | null
  displayValue: string | null
}

// The full result of a prepare pass: the bytes to (maybe) write, the name to
// write them under, and per-student success/failure bookkeeping — everything
// generation:commit needs, with no disk/DB access yet. `bytes: null` means
// every student failed (nothing to preview or commit).
interface PreparedRunResult {
  bytes: Uint8Array | null
  desiredFileName: string | null
  successEntries: PreparedEntry[]
  failures: GenerationPreviewFailure[]
}

// Builds every selected student's exported bytes in memory, then merges them
// into a single multi-section HWPX file — see docs/hwpx-merge-plan.md ("여러
// 학생 문서를 하나로 병합") and src/main/util/hwpxMerge.ts for the zip/XML-level
// merge itself. This replaces the original "one file per student" behavior
// outright (the documented requirement, not an added option) — a class of 30
// now produces one 30-page document instead of 30 separate files.
async function prepareIndividual(
  ctx: PrepareContext,
  previewId: string,
  onProgress: (event: GenerationProgressEvent) => void
): Promise<PreparedRunResult> {
  const total = ctx.students.length
  const prepared: Array<{ student: StudentWithValues; displayValue: string; bytes: Uint8Array }> = []
  const failures: GenerationPreviewFailure[] = []

  for (let i = 0; i < ctx.students.length; i++) {
    const student = ctx.students[i]
    const displayValue = getDisplayValue(student, ctx.groupFields)

    try {
      // Template bytes are re-read + re-loaded fresh for every student (per
      // arcjotectire.md's pipeline) — a shared HwpDocument instance would
      // otherwise carry over field values from the previous student into the
      // next export.
      const bytes = readFileSync(join(ctx.templateDir, ctx.templateRow.file_name))
      const doc = await loadHwpDocument(new Uint8Array(bytes))

      applyFieldValues(
        doc,
        ctx.templateFields,
        student,
        ctx.groupFieldByKey,
        ctx.staticValues,
        ctx.teacherName
      )

      prepared.push({ student, displayValue, bytes: doc.exportHwpx() })
      onProgress({ previewId, completed: i + 1, total, currentStudentName: displayValue })
    } catch (e) {
      const message = e instanceof Error ? e.message : describeHwpError(e)
      failures.push({ studentId: student.id, displayValue, message })
      onProgress({ previewId, completed: i + 1, total, currentStudentName: displayValue })
    }
  }

  if (prepared.length === 0) {
    return { bytes: null, desiredFileName: null, successEntries: [], failures }
  }

  const bytes = await mergeHwpxDocuments(prepared.map((p) => p.bytes))
  const desiredFileName =
    prepared.length === 1
      ? buildIndividualFileName(
          prepared[0].student,
          ctx.groupFields,
          prepared[0].displayValue,
          ctx.templateRow.name
        )
      : buildBatchFileName(
          prepared.map((p) => p.student),
          ctx.groupFields,
          ctx.groupName,
          ctx.templateRow.name
        )

  return {
    bytes,
    desiredFileName,
    successEntries: prepared.map((p) => ({ studentId: p.student.id, displayValue: p.displayValue })),
    failures
  }
}

// TODO: `insertTableRow()`'s handling of field-name uniqueness when
// duplicating a row that itself contains fields is explicitly flagged as
// UNVERIFIED in SKILL.md §2/§4 and rhwp-api-notes.md's "아직 검증 안 된 것"
// list — no real table+field template has been spike-tested against it yet.
// This function is implemented structurally per arcjotectire.md's documented
// pipeline shape only ("insertTableRow(...)로 학생 수만큼 행 복제 → 행별 ROW
// 필드 주입"); do not trust it in production without that spike test first.
async function prepareList(ctx: PrepareContext): Promise<PreparedRunResult> {
  try {
    // Defense-in-depth only — prepareGeneration() now rejects before ever
    // reaching prepareList() when repeat_row_json is missing (see its own
    // comment), so this should be unreachable in practice. Left in place in
    // case prepareList() is ever called from a second path in the future.
    if (!ctx.templateRow.repeat_row_json) {
      throw new Error(
        '이 템플릿에는 표 반복 행 설정이 없습니다. 목록형 생성을 사용하려면 먼저 템플릿에 반복 행 위치를 설정해야 합니다.'
      )
    }
    const repeatConfig = JSON.parse(ctx.templateRow.repeat_row_json) as RepeatRowConfig

    const bytes = readFileSync(join(ctx.templateDir, ctx.templateRow.file_name))
    const doc = await loadHwpDocument(new Uint8Array(bytes))

    const docFields = ctx.templateFields.filter((f) => f.scope === 'DOC')
    const rowFields = ctx.templateFields.filter((f) => f.scope === 'ROW')

    for (const templateField of docFields) {
      // A DOC-scope field in a LIST document is document-wide, not tied to
      // any one student — only a literal static value makes sense here.
      // Binding a DOC-scope field to a group_field (a per-student value)
      // would be ambiguous (which student's value?), so it's rejected
      // rather than silently picking one. This restriction isn't stated
      // explicitly in the plan/docs; it's a judgment call made to avoid
      // guessing at undocumented semantics.
      if (templateField.binding !== STATIC_BINDING) {
        throw new Error(
          `목록형 문서의 공통 필드 '${templateField.fieldName}'는 정적 값(직접 입력)만 지원합니다.`
        )
      }
      try {
        doc.setFieldValueByName(templateField.fieldName, templateField.defaultValue ?? '')
      } catch (e) {
        throw new Error(`필드 '${templateField.fieldName}' 값 설정 실패: ${describeHwpError(e)}`)
      }
    }

    for (let i = 0; i < ctx.students.length; i++) {
      const student = ctx.students[i]
      if (i > 0) {
        doc.insertTableRow(
          repeatConfig.sectionIdx,
          repeatConfig.parentParaIdx,
          repeatConfig.controlIdx,
          repeatConfig.rowIdx + i,
          true
        )
      }
      for (const templateField of rowFields) {
        const value = resolveFieldValue(
          templateField,
          student,
          ctx.groupFieldByKey,
          ctx.staticValues,
          ctx.teacherName
        )
        try {
          doc.setFieldValueByName(templateField.fieldName, value)
        } catch (e) {
          throw new Error(
            `필드 '${templateField.fieldName}' 값 설정 실패(행 ${i + 1}): ${describeHwpError(e)}`
          )
        }
      }
    }

    const bytes2 = doc.exportHwpx()
    const desiredFileName = buildBatchFileName(
      ctx.students,
      ctx.groupFields,
      ctx.groupName,
      ctx.templateRow.name
    )

    return {
      bytes: bytes2,
      desiredFileName,
      successEntries: [{ studentId: null, displayValue: null }],
      failures: []
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : describeHwpError(e)
    return {
      bytes: null,
      desiredFileName: null,
      successEntries: [],
      failures: [{ studentId: null, displayValue: null, message }]
    }
  }
}

interface CachedPreview {
  templateRow: TemplateRow
  groupRow: { id: number; name: string }
  docType: TemplateDocType
  prepared: PreparedRunResult
  /** Already loaded from `prepared.bytes` so renderPreviewPage doesn't re-parse on every page request; null when `prepared.bytes` is null. */
  doc: HwpDocument | null
  pageCount: number
}

// In-memory only — a preview that's never committed or explicitly discarded
// just lives here until the app quits (single local teacher, no multi-user
// concern; a Map is a reasonable trade-off against the complexity of a TTL
// sweep for this app's scale). Keyed by `previewId` (see generation:prepare).
const previewCache = new Map<string, CachedPreview>()

function insertDocumentHistory(
  db: Database.Database,
  runId: number,
  studentId: number | null,
  studentNameSnapshot: string | null,
  result: { status: 'SUCCESS'; outputPath: string } | { status: 'FAILURE'; errorMessage: string }
): void {
  if (result.status === 'SUCCESS') {
    db.prepare(
      `INSERT INTO document_history (run_id, student_id, student_name_snapshot, output_path, status)
       VALUES (?, ?, ?, ?, 'SUCCESS')`
    ).run(runId, studentId, studentNameSnapshot, result.outputPath)
  } else {
    db.prepare(
      `INSERT INTO document_history (run_id, student_id, student_name_snapshot, output_path, status, error_message)
       VALUES (?, ?, ?, NULL, 'FAILURE', ?)`
    ).run(runId, studentId, studentNameSnapshot, result.errorMessage)
  }
}

async function prepareGeneration(
  event: IpcMainInvokeEvent,
  payload: GenerationPrepareRequest
): Promise<GenerationPreviewSummary> {
  const db = getDb()

  const templateRow = db
    .prepare(
      'SELECT id, name, file_name, doc_type, repeat_row_json, created_at, updated_at FROM template WHERE id = ?'
    )
    .get(payload.templateId) as TemplateRow | undefined
  if (!templateRow) {
    throw new Error('템플릿을 찾을 수 없습니다.')
  }

  const groupRow = db.prepare(SELECT_STUDENT_GROUP).get(payload.groupId) as
    | { id: number; name: string }
    | undefined
  if (!groupRow) {
    throw new Error('그룹을 찾을 수 없습니다.')
  }

  // Pre-flight validation, thrown before anything is prepared/cached — see
  // the historical note this used to carry in runList()'s own try/catch:
  // TemplateEditorPage.tsx's docType selector currently offers 'LIST' as a
  // freely selectable option with no warning, but there is no UI anywhere in
  // this app that ever writes `repeat_row_json` (confirmed:
  // template:save's reconcileTemplateFields never touches it, no other IPC
  // channel does either) — so every LIST-doc-type template is guaranteed to
  // fail this check, unconditionally, every single time.
  if (templateRow.doc_type === 'LIST' && !templateRow.repeat_row_json) {
    throw new Error(
      '이 템플릿은 목록형(여러 학생을 한 문서로 병합)으로 등록되어 있지만, 아직 지원되지 않는 기능입니다. 템플릿을 개별형으로 다시 등록해 사용해 주세요.'
    )
  }

  // v3 (docs/schema.md §4): must resolve the mapping *for this group*, not
  // the template-global base mapping — a saved template_field_override for
  // (templateRow.id, groupRow.id) would otherwise be silently ignored and
  // generation would use stale/wrong bindings.
  const templateFields = listTemplateFieldsForGroup(db, templateRow.id, groupRow.id)
  const groupFields = listGroupFields(db, groupRow.id)
  const groupFieldByKey = new Map(groupFields.map((f) => [f.fieldKey, f]))

  const allStudents = listStudentsWithValues(db, groupRow.id)
  const studentIdFilter = payload.studentIds ? new Set(payload.studentIds) : undefined
  const students = studentIdFilter
    ? allStudents.filter((s) => studentIdFilter.has(s.id))
    : allStudents

  const staticValues = new Map<number, Map<number, string>>(
    Object.entries(payload.staticValues ?? {}).map(([studentId, byField]) => [
      Number(studentId),
      new Map(Object.entries(byField).map(([fieldId, value]) => [Number(fieldId), value]))
    ])
  )

  // Same "single local teacher profile" query as teacher:get (src/main/ipc/teacher.ts)
  // — TEACHER_NAME_BINDING always means *the* teacher, not a per-group/per-template one.
  const teacherRow = db.prepare('SELECT name FROM teacher ORDER BY id LIMIT 1').get() as
    | { name: string }
    | undefined

  const previewId = randomUUID()
  const ctx: PrepareContext = {
    templateDir: getTemplateDir(),
    templateRow,
    templateFields,
    groupFields,
    groupFieldByKey,
    groupName: groupRow.name,
    students,
    staticValues,
    teacherName: teacherRow?.name ?? ''
  }

  const onProgress = (progress: GenerationProgressEvent): void => {
    event.sender.send(GENERATION_PROGRESS_CHANNEL, progress)
  }

  const prepared =
    templateRow.doc_type === 'LIST'
      ? await prepareList(ctx)
      : await prepareIndividual(ctx, previewId, onProgress)

  let doc: HwpDocument | null = null
  let pageCount = 0
  if (prepared.bytes) {
    doc = await loadHwpDocument(prepared.bytes)
    pageCount = doc.pageCount()
  }

  previewCache.set(previewId, {
    templateRow,
    groupRow,
    docType: templateRow.doc_type as TemplateDocType,
    prepared,
    doc,
    pageCount
  })

  const total = templateRow.doc_type === 'LIST' ? 1 : students.length

  return {
    previewId,
    docType: templateRow.doc_type as TemplateDocType,
    total,
    success: prepared.successEntries.length,
    failure: prepared.failures.length,
    pageCount,
    failures: prepared.failures
  }
}

function renderPreviewPage(
  payload: GenerationRenderPreviewPageRequest
): GenerationRenderPreviewPageResult {
  const cached = previewCache.get(payload.previewId)
  if (!cached || !cached.doc) {
    throw new Error('미리보기를 찾을 수 없습니다. 생성을 다시 눌러주세요.')
  }
  const page = Math.min(Math.max(payload.page, 0), cached.pageCount - 1)
  return { svg: cached.doc.renderPageSvg(page), pageCount: cached.pageCount }
}

function commitGeneration(payload: GenerationCommitRequest): GenerationSummary {
  const cached = previewCache.get(payload.previewId)
  if (!cached) {
    throw new Error('미리보기가 만료되었거나 이미 저장되었습니다. 생성을 다시 눌러주세요.')
  }
  // One-shot: remove immediately so a duplicate commit (double click, retry)
  // can't write the same batch twice.
  previewCache.delete(payload.previewId)

  const db = getDb()
  const { templateRow, groupRow, docType, prepared } = cached
  const success = prepared.successEntries.length
  const failure = prepared.failures.length
  const total = docType === 'LIST' ? 1 : success + failure

  const runResult = db
    .prepare(
      `INSERT INTO generation_run
         (template_id, template_name_snapshot, group_id, group_name_snapshot, doc_type_snapshot, total_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(templateRow.id, templateRow.name, groupRow.id, groupRow.name, docType, total)
  const runId = Number(runResult.lastInsertRowid)

  let outputPath: string | null = null
  if (prepared.bytes && prepared.desiredFileName) {
    const outputDir = payload.outputDir
    const finalName = dedupeFileName(outputDir, prepared.desiredFileName)
    outputPath = join(outputDir, finalName)
    writeFileSync(outputPath, prepared.bytes)
  }

  for (const entry of prepared.successEntries) {
    // `outputPath` is guaranteed non-null here: successEntries is only ever
    // non-empty when prepared.bytes was non-null, which is exactly the
    // condition that wrote outputPath above.
    insertDocumentHistory(db, runId, entry.studentId, entry.displayValue, {
      status: 'SUCCESS',
      outputPath: outputPath as string
    })
  }
  for (const f of prepared.failures) {
    insertDocumentHistory(db, runId, f.studentId, f.displayValue, {
      status: 'FAILURE',
      errorMessage: f.message
    })
  }

  db.prepare(
    `UPDATE generation_run
     SET success_count = ?, failure_count = ?, finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  ).run(success, failure, runId)

  return { runId, docType, total, success, failure }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('generation:prepare', async (event, payload: GenerationPrepareRequest) => {
    return prepareGeneration(event, payload)
  })

  ipcMain.handle('generation:renderPreviewPage', (_event, payload: GenerationRenderPreviewPageRequest) => {
    return renderPreviewPage(payload)
  })

  ipcMain.handle('generation:commit', (_event, payload: GenerationCommitRequest) => {
    return commitGeneration(payload)
  })

  ipcMain.handle('generation:discardPreview', (_event, payload: GenerationDiscardPreviewRequest) => {
    previewCache.delete(payload.previewId)
  })

  ipcMain.handle('generation:pickOutputDir', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: '문서를 저장할 폴더 선택',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })
}
