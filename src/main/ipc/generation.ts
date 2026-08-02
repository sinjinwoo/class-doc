import { dialog, type IpcMain, type IpcMainInvokeEvent } from 'electron'
import type Database from 'better-sqlite3'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDb } from '../db'
import { getOutputDir, getTemplateDir } from '../paths'
import { describeHwpError, loadHwpDocument } from '../rhwp/hwpCore'
import { dedupeFileName, sanitizeFileName } from '../util/fileNaming'
import type { TemplateRow } from '../db/mappers'
import { listGroupFields } from './groupFields'
import { listStudentsWithValues } from './students'
import { listTemplateFieldsForGroup } from './templateFields'
import {
  STATIC_BINDING,
  type GroupField,
  type StudentWithValues,
  type TemplateField
} from '../../shared/domain'
import {
  GENERATION_PROGRESS_CHANNEL,
  type GenerationProgressEvent,
  type GenerationRunRequest,
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
  groupFieldByKey: Map<string, GroupField>
): string {
  if (templateField.binding === STATIC_BINDING) {
    return templateField.defaultValue ?? ''
  }
  const groupField = groupFieldByKey.get(templateField.binding)
  if (!groupField) {
    // Re-validated here even though the mapping screen (Phase 4, out of this
    // task's scope) is expected to only ever offer valid bindings — the
    // group's group_field set can change (CSV re-upload, field deletion)
    // after a mapping was saved, per docs/schema.md §4's explicit
    // "생성 시점 재검증" requirement.
    throw new Error(
      `매핑된 필드 '${templateField.binding}'가 현재 그룹에 존재하지 않습니다. 매핑을 다시 지정해주세요.`
    )
  }
  // Missing/null value -> empty string, mirroring arcjotectire.md's "AUTO 값
  // 부재는 빈 문자열 주입" for this schema's equivalent case.
  return student.values[groupField.id] ?? ''
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
// falls back to the group's own name.
function buildListFileName(
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

interface RunContext {
  db: Database.Database
  runId: number
  outputDir: string
  templateDir: string
  templateRow: TemplateRow
  templateFields: TemplateField[]
  groupFields: GroupField[]
  groupFieldByKey: Map<string, GroupField>
  students: StudentWithValues[]
  usedFileNames: Set<string>
}

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

async function runIndividual(
  ctx: RunContext,
  onProgress: (event: GenerationProgressEvent) => void
): Promise<{ success: number; failure: number }> {
  let success = 0
  let failure = 0
  const total = ctx.students.length

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

      for (const templateField of ctx.templateFields) {
        const value = resolveFieldValue(templateField, student, ctx.groupFieldByKey)
        try {
          doc.setFieldValueByName(templateField.fieldName, value)
        } catch (e) {
          throw new Error(`필드 '${templateField.fieldName}' 값 설정 실패: ${describeHwpError(e)}`)
        }
      }

      const outBytes = doc.exportHwpx()
      const desiredName = buildIndividualFileName(
        student,
        ctx.groupFields,
        displayValue,
        ctx.templateRow.name
      )
      const finalName = dedupeFileName(ctx.outputDir, desiredName, ctx.usedFileNames)
      const outputPath = join(ctx.outputDir, finalName)
      writeFileSync(outputPath, outBytes)

      insertDocumentHistory(ctx.db, ctx.runId, student.id, displayValue, {
        status: 'SUCCESS',
        outputPath
      })
      success += 1
      onProgress({
        runId: ctx.runId,
        completed: i + 1,
        total,
        currentStudentName: displayValue,
        lastResult: { studentId: student.id, status: 'SUCCESS', outputPath, errorMessage: null }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : describeHwpError(e)
      insertDocumentHistory(ctx.db, ctx.runId, student.id, displayValue, {
        status: 'FAILURE',
        errorMessage: message
      })
      failure += 1
      onProgress({
        runId: ctx.runId,
        completed: i + 1,
        total,
        currentStudentName: displayValue,
        lastResult: {
          studentId: student.id,
          status: 'FAILURE',
          outputPath: null,
          errorMessage: message
        }
      })
    }
  }

  return { success, failure }
}

// TODO: `insertTableRow()`'s handling of field-name uniqueness when
// duplicating a row that itself contains fields is explicitly flagged as
// UNVERIFIED in SKILL.md §2/§4 and rhwp-api-notes.md's "아직 검증 안 된 것"
// list — no real table+field template has been spike-tested against it yet.
// This function is implemented structurally per arcjotectire.md's documented
// pipeline shape only ("insertTableRow(...)로 학생 수만큼 행 복제 → 행별 ROW
// 필드 주입"); do not trust it in production without that spike test first.
async function runList(
  ctx: RunContext,
  groupRow: { id: number; name: string },
  onProgress: (event: GenerationProgressEvent) => void
): Promise<{ success: number; failure: number }> {
  const groupName = groupRow.name

  try {
    // Defense-in-depth only — runGeneration() now rejects before ever
    // reaching runList() when repeat_row_json is missing (see its own
    // comment), so this should be unreachable in practice. Left in place in
    // case runList() is ever called from a second path in the future.
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
        const value = resolveFieldValue(templateField, student, ctx.groupFieldByKey)
        try {
          doc.setFieldValueByName(templateField.fieldName, value)
        } catch (e) {
          throw new Error(
            `필드 '${templateField.fieldName}' 값 설정 실패(행 ${i + 1}): ${describeHwpError(e)}`
          )
        }
      }
    }

    const outBytes = doc.exportHwpx()
    const desiredName = buildListFileName(
      ctx.students,
      ctx.groupFields,
      groupName,
      ctx.templateRow.name
    )
    const finalName = dedupeFileName(ctx.outputDir, desiredName, ctx.usedFileNames)
    const outputPath = join(ctx.outputDir, finalName)
    writeFileSync(outputPath, outBytes)

    insertDocumentHistory(ctx.db, ctx.runId, null, null, { status: 'SUCCESS', outputPath })
    onProgress({
      runId: ctx.runId,
      completed: 1,
      total: 1,
      currentStudentName: groupName,
      lastResult: { studentId: null, status: 'SUCCESS', outputPath, errorMessage: null }
    })
    return { success: 1, failure: 0 }
  } catch (e) {
    const message = e instanceof Error ? e.message : describeHwpError(e)
    insertDocumentHistory(ctx.db, ctx.runId, null, null, {
      status: 'FAILURE',
      errorMessage: message
    })
    onProgress({
      runId: ctx.runId,
      completed: 1,
      total: 1,
      currentStudentName: groupName,
      lastResult: { studentId: null, status: 'FAILURE', outputPath: null, errorMessage: message }
    })
    return { success: 0, failure: 1 }
  }
}

async function runGeneration(
  event: IpcMainInvokeEvent,
  payload: GenerationRunRequest
): Promise<GenerationSummary> {
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
    { id: number; name: string } | undefined
  if (!groupRow) {
    throw new Error('그룹을 찾을 수 없습니다.')
  }

  // Pre-flight validation, thrown *before* any generation_run/document_history
  // rows are written (same pattern as the templateRow/groupRow not-found
  // checks just above) — moved here from inside runList()'s own try/catch on
  // purpose. TemplateEditorPage.tsx's docType selector currently offers
  // 'LIST' as a freely selectable option with no warning, but there is no UI
  // anywhere in this app that ever writes `repeat_row_json` (confirmed:
  // template:save's reconcileTemplateFields never touches it, no other IPC
  // channel does either) — so every LIST-doc-type template is guaranteed to
  // fail this check, unconditionally, every single time. Previously this
  // check lived inside runList()'s try/catch, which *caught* the error and
  // resolved generation:run normally with `{ success: 0, failure: 1 }` — the
  // promise never rejected, so MappingGenerationPage.tsx's `catch` block
  // (the only place that surfaces `e.message` as toast `detail`) never ran;
  // the teacher only ever saw a bare "성공 0 / 실패 1" toast with no reason
  // shown anywhere in the UI, indistinguishable from "생성이 그냥 안 됨" with
  // no diagnostic. Throwing here instead makes `generation:run` reject, so
  // this specific, correctly-worded reason reaches the renderer's error
  // toast. This is a stopgap, not a fix for the underlying feature gap: full
  // LIST-type (표 반복, 여러 학생을 한 문서로 병합) support needs (a) new
  // TemplateEditorPage.tsx UX to let a teacher designate the repeating table
  // row (out of this task's file-ownership scope), and (b) a fix for
  // `insertTableRow()` not duplicating that row's fields into the new row
  // (confirmed separately during this task's reproduction spike — see the
  // final report), so `runList()`'s per-row `setFieldValueByName` calls
  // would currently all target the same single field regardless.
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

  const totalCount = templateRow.doc_type === 'LIST' ? 1 : students.length

  const runResult = db
    .prepare(
      `INSERT INTO generation_run
         (template_id, template_name_snapshot, group_id, group_name_snapshot, doc_type_snapshot, total_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      templateRow.id,
      templateRow.name,
      groupRow.id,
      groupRow.name,
      templateRow.doc_type,
      totalCount
    )
  const runId = Number(runResult.lastInsertRowid)

  const ctx: RunContext = {
    db,
    runId,
    // Teacher-chosen destination (via generation:pickOutputDir) takes
    // priority; falls back to the app's own class-doc/output/ folder when
    // they didn't pick one (today's original, still-default behavior).
    outputDir: payload.outputDir ?? getOutputDir(),
    templateDir: getTemplateDir(),
    templateRow,
    templateFields,
    groupFields,
    groupFieldByKey,
    students,
    usedFileNames: new Set<string>()
  }

  const onProgress = (progress: GenerationProgressEvent): void => {
    event.sender.send(GENERATION_PROGRESS_CHANNEL, progress)
  }

  const { success, failure } =
    templateRow.doc_type === 'LIST'
      ? await runList(ctx, groupRow, onProgress)
      : await runIndividual(ctx, onProgress)

  db.prepare(
    `UPDATE generation_run
     SET success_count = ?, failure_count = ?, finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  ).run(success, failure, runId)

  return {
    runId,
    docType: templateRow.doc_type as GenerationSummary['docType'],
    total: totalCount,
    success,
    failure
  }
}

export function register(ipcMain: IpcMain): void {
  ipcMain.handle('generation:run', async (event, payload: GenerationRunRequest) => {
    return runGeneration(event, payload)
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
