import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GroupField,
  StudentGroup,
  StudentWithValues,
  Template,
  TemplateField
} from '../../../shared/domain'
import type { GenerationPreviewSummary, GenerationProgressEvent } from '../../../shared/ipc-types'
import { Alert, Badge, Button, PageHeader, Select, Spinner, useToast } from '../components/ui'
import {
  FieldMappingTable,
  GenerationPreviewViewer,
  StudentValueTable
} from '../components/mapping'

export interface MappingGenerationPageProps {
  teacherId: number
  teacherName: string
  initialTemplateId?: number
  initialGroupId?: number
}

function MappingGenerationPage({
  teacherId,
  teacherName,
  initialTemplateId,
  initialGroupId
}: MappingGenerationPageProps): React.JSX.Element {
  const { toast } = useToast()

  const [templates, setTemplates] = useState<Template[]>([])
  const [groups, setGroups] = useState<StudentGroup[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | undefined>(undefined)
  const [templateId, setTemplateId] = useState<number | undefined>(initialTemplateId)
  const [groupId, setGroupId] = useState<number | undefined>(initialGroupId)

  const [templateFields, setTemplateFields] = useState<TemplateField[]>([])
  const [groupFields, setGroupFields] = useState<GroupField[]>([])
  const [loadingMapping, setLoadingMapping] = useState(false)
  const [mappingError, setMappingError] = useState<string | undefined>(undefined)

  // Student picker — lets the teacher generate for only some of the group's
  // students (e.g. one re-issued document) instead of always the whole
  // roster. Loaded as soon as a group is picked (independent of templateId)
  // since "which students" is a group-scoped question, not a template one.
  const [students, setStudents] = useState<StudentWithValues[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [studentsError, setStudentsError] = useState<string | undefined>(undefined)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set())

  // Per-student values for "직접 입력" (STATIC_BINDING) template fields,
  // typed directly into StudentValueTable's pivoted preview/edit table.
  // Ephemeral (not persisted) — reset whenever the template/group selection
  // changes (see the effect below).
  const [staticValues, setStaticValues] = useState<Record<number, Record<number, string>>>({})

  // Output destination — defaults to the app's own class-doc/output/ folder
  // (server-side, when omitted) unless the teacher explicitly picks one via
  // the native folder dialog.
  const [outputDir, setOutputDir] = useState<string | null>(null)

  // Two-phase generation flow (teacher feedback: preview the merged result
  // before anything is written to disk or recorded in generation_run/
  // document_history) — "생성" prepares an in-memory preview and switches to
  // `phase: 'preview'`; from there, "수정하기" discards it and returns here,
  // "생성하기" picks a folder and commits it for real. See generation.ts's
  // prepareGeneration/commitGeneration.
  const [phase, setPhase] = useState<'form' | 'preview'>('form')
  const [preview, setPreview] = useState<GenerationPreviewSummary | null>(null)
  // Which page of the preview is showing — lifted up here (rather than kept
  // inside GenerationPreviewViewer) so its prev/next controls can live at
  // the top of the page, next to the title, instead of underneath the image.
  const [previewPage, setPreviewPage] = useState(0)
  const [preparing, setPreparing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [progress, setProgress] = useState<GenerationProgressEvent | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)
  // Mirrors `preview?.previewId` so the unmount cleanup effect (which must
  // have an empty dependency array to only run once, on unmount) can read
  // the *latest* previewId without depending on `preview` itself.
  const previewIdRef = useRef<string | null>(null)

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true)
    setOptionsError(undefined)
    try {
      const [templateList, groupList] = await Promise.all([
        window.api.templateList(),
        window.api.groupList({ teacherId })
      ])
      setTemplates(templateList)
      setGroups(groupList)
    } catch (e) {
      setOptionsError(e instanceof Error ? e.message : String(e))
    } finally {
      setOptionsLoading(false)
    }
  }, [teacherId])

  useEffect(() => {
    // See GroupsPage.tsx's identical comment — standard fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOptions()
  }, [loadOptions])

  const loadMapping = useCallback(async () => {
    if (templateId === undefined || groupId === undefined) {
      setTemplateFields([])
      setGroupFields([])
      setMappingError(undefined)
      return
    }
    setLoadingMapping(true)
    setMappingError(undefined)
    try {
      const [tf, gf] = await Promise.all([
        // v3 (docs/schema.md §4): mapping is per-(template, group) now, not
        // template-global — groupId is required here. templateId/groupId are
        // both guaranteed defined at this point by the early return above.
        window.api.templateFieldList({ templateId, groupId }),
        window.api.groupFieldList({ groupId })
      ])
      setTemplateFields(tf)
      setGroupFields(gf)
    } catch (e) {
      setMappingError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingMapping(false)
    }
  }, [templateId, groupId])

  useEffect(() => {
    // See GroupsPage.tsx's identical comment — standard fetch-on-selection-change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMapping()
  }, [loadMapping])

  const loadStudents = useCallback(async () => {
    if (groupId === undefined) {
      setStudents([])
      setSelectedStudentIds(new Set())
      setStudentsError(undefined)
      return
    }
    setLoadingStudents(true)
    setStudentsError(undefined)
    try {
      const studentList = await window.api.studentListWithValues({ groupId })
      setStudents(studentList)
      // Default to all-selected — matches today's implicit "always generate
      // for the whole group" behavior, so a teacher who doesn't care about
      // this feature sees no change at all.
      setSelectedStudentIds(new Set(studentList.map((s) => s.id)))
    } catch (e) {
      setStudentsError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingStudents(false)
    }
  }, [groupId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStudents()
  }, [loadStudents])

  useEffect(() => {
    // A fresh template/group pairing means a fresh set of "직접 입력" values
    // to fill in — carrying over the previous selection's typed values would
    // silently misapply them to unrelated template fields/students.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaticValues({})
  }, [templateId, groupId])

  useEffect(() => {
    previewIdRef.current = preview?.previewId ?? null
  }, [preview])

  useEffect(() => {
    // Bug fix: must reset to `true` here, not just rely on `useRef(true)`'s
    // initial value. React 18/19 StrictMode (see main.tsx's <StrictMode>)
    // deliberately mounts every component twice in dev — mount, run effects,
    // immediately run their cleanup, then mount again — to surface exactly
    // this class of bug. `useRef`'s initial value only applies once, ever;
    // the *first* simulated cleanup set `mountedRef.current = false` and
    // nothing set it back to `true` for the real, currently-visible mount,
    // so every `if (mountedRef.current) ...` guard below silently no-op'd
    // forever after that point.
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      unsubscribeRef.current?.()
      // Leaving this page mid-preview (e.g. via the sidebar) without ever
      // clicking "수정하기"/"생성하기" would otherwise leak the cached
      // preview in the main process forever (it's only ever cleared by an
      // explicit discard or commit) — best-effort, nothing user-visible
      // depends on this succeeding.
      if (previewIdRef.current) {
        window.api.generationDiscardPreview({ previewId: previewIdRef.current }).catch(() => {})
      }
    }
  }, [])

  async function handleChangeBinding(templateFieldId: number, binding: string): Promise<void> {
    // Only reachable while FieldMappingTable is rendered, which requires
    // groupId to already be selected (see the render guard below) — this
    // check just satisfies groupId's type (number | undefined) for the v3
    // per-group mapping request shape (docs/schema.md §4).
    if (groupId === undefined) return
    try {
      const updated = await window.api.templateFieldUpdateMapping({
        templateFieldId,
        groupId,
        binding
      })
      setTemplateFields((current) => current.map((f) => (f.id === templateFieldId ? updated : f)))
    } catch (e) {
      toast({
        type: 'error',
        message: '매핑을 저장하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  function toggleStudent(studentId: number): void {
    setSelectedStudentIds((current) => {
      const next = new Set(current)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function toggleAllStudents(checked: boolean): void {
    setSelectedStudentIds(checked ? new Set(students.map((s) => s.id)) : new Set())
  }

  function handleChangeStaticValue(
    studentId: number,
    templateFieldId: number,
    value: string
  ): void {
    setStaticValues((current) => ({
      ...current,
      [studentId]: { ...current[studentId], [templateFieldId]: value }
    }))
  }

  async function handlePrepare(): Promise<void> {
    if (templateId === undefined || groupId === undefined || preparing) return
    if (selectedStudentIds.size === 0) return

    setPreparing(true)
    setProgress(null)
    unsubscribeRef.current = window.api.onGenerationProgress((event) => {
      if (!mountedRef.current) return
      setProgress(event)
    })
    try {
      // Omit studentIds entirely when every student is selected (today's
      // default) so the request shape matches exactly what it always used
      // to be in the common case; only send an explicit subset when the
      // teacher deliberately excluded someone.
      const allSelected = students.length > 0 && selectedStudentIds.size === students.length
      const result = await window.api.generationPrepare({
        templateId,
        groupId,
        ...(allSelected ? {} : { studentIds: Array.from(selectedStudentIds) }),
        staticValues
      })
      if (mountedRef.current) {
        setPreview(result)
        setPreviewPage(0)
        setPhase('preview')
      }
    } catch (e) {
      toast({
        type: 'error',
        message: '문서 생성에 실패했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    } finally {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
      if (mountedRef.current) setPreparing(false)
    }
  }

  async function handleEdit(): Promise<void> {
    if (!preview) return
    const previewId = preview.previewId
    setPreview(null)
    setPhase('form')
    try {
      await window.api.generationDiscardPreview({ previewId })
    } catch {
      // Best-effort cleanup only — the cached preview being left behind in
      // the main process has no user-visible effect (it's just abandoned,
      // same as the unmount-cleanup path above), so no toast on failure.
    }
  }

  async function handleCommit(): Promise<void> {
    if (!preview || committing) return

    // Save-location picker is part of the "생성하기" click itself (not a
    // separate preliminary button) — cancelling the native folder dialog
    // cancels the save and leaves the preview open to try again.
    const picked = await window.api.generationPickOutputDir()
    if (!picked) return
    setOutputDir(picked)

    setCommitting(true)
    try {
      const result = await window.api.generationCommit({
        previewId: preview.previewId,
        outputDir: picked
      })
      toast({
        type: result.failure > 0 ? 'warning' : 'success',
        message: `생성 완료: 성공 ${result.success} / 실패 ${result.failure} (총 ${result.total})`
      })
      if (mountedRef.current) {
        setPreview(null)
        setPhase('form')
      }
    } catch (e) {
      toast({
        type: 'error',
        message: '문서를 저장하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    } finally {
      if (mountedRef.current) setCommitting(false)
    }
  }

  const templateOptions = [
    { value: '', label: '템플릿을 선택하세요' },
    ...templates.map((t) => ({ value: String(t.id), label: t.name }))
  ]
  const groupOptions = [
    { value: '', label: '그룹을 선택하세요' },
    ...groups.map((g) => ({ value: String(g.id), label: g.name }))
  ]

  const canPrepare =
    templateId !== undefined && groupId !== undefined && !preparing && selectedStudentIds.size > 0

  if (phase === 'preview' && preview) {
    return (
      // Normal block flow, not forced to viewport height — the document is
      // the point of this screen so it's sized generously (see
      // GenerationPreviewViewer's Card, min-h-[70vh] — the same frame
      // TemplatePreviewPanel uses) and the page is simply allowed to scroll
      // around it on a short window, same as any other page here (Layout.tsx's
      // <main> already scrolls). Only the action buttons need to stay
      // reachable regardless of that scroll, which the fixed footer below
      // handles on its own — nothing above needs to be squeezed into an
      // exact-fit column for that.
      <div className="flex flex-col gap-4 pb-24">
        {/* Compact single-line header: back + title + success/failure — no
            longer a full Alert box, which cost a whole extra row for what's
            really just two numbers. */}
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button variant="ghost" className="-ml-3" onClick={handleEdit} disabled={committing}>
            ← 수정하기
          </Button>
          <h2 className="text-title font-normal text-bone-white">생성 결과 미리보기</h2>
          <div className="ml-auto flex items-center gap-2">
            <Badge status="success">성공 {preview.success}</Badge>
            {preview.failure > 0 && <Badge status="danger">실패 {preview.failure}</Badge>}
            <span className="text-xs text-ash-gray">총 {preview.total}</span>
          </div>
        </div>

        {preview.failures.length > 0 && (
          <div className="flex max-h-20 shrink-0 flex-col gap-1 overflow-y-auto rounded-panel border border-danger/35 bg-danger-surface px-4 py-3">
            <p className="text-xs font-medium text-danger">
              아래 학생은 매핑 오류로 제외되었습니다.
            </p>
            <ul className="flex flex-col gap-0.5 text-xs text-silver-mist">
              {preview.failures.map((f, i) => (
                <li key={f.studentId ?? i}>
                  {f.displayValue ?? `학생${f.studentId}`}: {f.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Page nav sits directly above the document, like a PDF viewer's
            own toolbar, instead of far away up in the header. */}
        {preview.pageCount > 1 && (
          <div className="flex shrink-0 items-center justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
              disabled={previewPage <= 0}
            >
              ← 이전 쪽
            </Button>
            <span className="text-sm text-silver-mist tabular-nums">
              {previewPage + 1} / {preview.pageCount} 쪽
            </span>
            <Button
              variant="secondary"
              onClick={() => setPreviewPage((p) => Math.min(preview.pageCount - 1, p + 1))}
              disabled={previewPage >= preview.pageCount - 1}
            >
              다음 쪽 →
            </Button>
          </div>
        )}

        {preview.pageCount > 0 ? (
          <GenerationPreviewViewer previewId={preview.previewId} page={previewPage} />
        ) : (
          <p className="shrink-0 text-sm text-ash-gray">생성 가능한 문서가 없습니다.</p>
        )}

        {/* Truly `fixed` to the window, not `sticky` within the page's own
            scroll — sticky's guarantee only holds as long as the flex/
            overflow chain above it never misbehaves, which is exactly what
            went wrong before. `fixed` pins it to the viewport unconditionally,
            regardless of how tall this page's content is or whether it
            scrolls. `left-64` matches Sidebar.tsx's fixed width so the bar
            spans exactly the main content area, not underneath the sidebar.
            The `pb-24` on the page root above reserves room so scrolled
            content never ends up hidden behind this bar. */}
        <div className="fixed inset-x-0 bottom-0 left-64 z-40 flex items-center gap-3 border-t border-line bg-void px-8 py-4">
          <Button variant="secondary" onClick={handleEdit} disabled={committing}>
            수정하기
          </Button>
          <Button onClick={handleCommit} disabled={preview.success === 0} loading={committing}>
            생성하기
          </Button>
          <span className="text-sm text-ash-gray">
            {committing
              ? '저장 위치를 선택하는 창이 뜹니다.'
              : '생성하기를 누르면 저장할 위치를 선택합니다.'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="문서 만들기"
        title="필드 매핑 및 문서 생성"
        description="템플릿의 누름틀마다 어떤 학생 정보를 넣을지 정하고, 선택한 학생들의 문서를 한 파일로 만듭니다."
      />

      {optionsError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert
            type="error"
            message="템플릿/그룹 목록을 불러오지 못했습니다."
            detail={optionsError}
          />
          <Button variant="secondary" onClick={loadOptions}>
            다시 시도
          </Button>
        </div>
      ) : optionsLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="템플릿"
              value={templateId !== undefined ? String(templateId) : ''}
              onChange={(event) =>
                setTemplateId(event.target.value ? Number(event.target.value) : undefined)
              }
              options={templateOptions}
            />
            <Select
              label="그룹"
              value={groupId !== undefined ? String(groupId) : ''}
              onChange={(event) =>
                setGroupId(event.target.value ? Number(event.target.value) : undefined)
              }
              options={groupOptions}
            />
          </div>

          {templateId === undefined || groupId === undefined ? (
            <p className="text-sm text-ash-gray">
              템플릿과 그룹을 모두 선택하면 필드 매핑을 볼 수 있습니다.
            </p>
          ) : mappingError ? (
            <div className="flex flex-col items-start gap-3">
              <Alert
                type="error"
                message="필드 매핑 정보를 불러오지 못했습니다."
                detail={mappingError}
              />
              <Button variant="secondary" onClick={loadMapping}>
                다시 시도
              </Button>
            </div>
          ) : loadingMapping ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <h3 className="text-heading font-normal text-bone-white">필드 매핑</h3>
                <FieldMappingTable
                  templateFields={templateFields}
                  groupFields={groupFields}
                  onChangeBinding={handleChangeBinding}
                />
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-heading font-normal text-bone-white">생성할 학생 선택</h3>
                {studentsError ? (
                  <div className="flex flex-col items-start gap-3">
                    <Alert
                      type="error"
                      message="학생 목록을 불러오지 못했습니다."
                      detail={studentsError}
                    />
                    <Button variant="secondary" onClick={loadStudents}>
                      다시 시도
                    </Button>
                  </div>
                ) : loadingStudents ? (
                  <div className="flex justify-center py-6">
                    <Spinner size="lg" />
                  </div>
                ) : students.length === 0 ? (
                  <p className="text-sm text-ash-gray">이 그룹에 등록된 학생이 없습니다.</p>
                ) : templateFields.length === 0 ? (
                  <p className="text-sm text-ash-gray">이 템플릿에는 누름틀 필드가 없습니다.</p>
                ) : (
                  <StudentValueTable
                    templateFields={templateFields}
                    groupFields={groupFields}
                    students={students}
                    selectedStudentIds={selectedStudentIds}
                    onToggleStudent={toggleStudent}
                    onToggleAll={toggleAllStudents}
                    staticValues={staticValues}
                    onChangeStaticValue={handleChangeStaticValue}
                    teacherName={teacherName}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handlePrepare} disabled={!canPrepare} loading={preparing}>
                  생성
                </Button>
                <span className="text-sm text-ash-gray">
                  {preparing
                    ? progress
                      ? `${progress.currentStudentName} 처리 중 (${progress.completed}/${progress.total})`
                      : '생성 중입니다...'
                    : outputDir
                      ? `마지막 저장 위치: ${outputDir}`
                      : '생성 버튼을 누르면 결과를 미리 볼 수 있습니다.'}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export { MappingGenerationPage }
