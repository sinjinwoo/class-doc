import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GroupField,
  StudentGroup,
  StudentWithValues,
  Template,
  TemplateField
} from '../../../shared/domain'
import type { GenerationProgressEvent, GenerationSummary } from '../../../shared/ipc-types'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ProgressBar,
  Select,
  Spinner,
  Table,
  useToast
} from '../components/ui'
import { FieldMappingTable } from '../components/mapping'

export interface MappingGenerationPageProps {
  teacherId: number
  initialTemplateId?: number
  initialGroupId?: number
}

interface LiveTally {
  success: number
  failure: number
}

function MappingGenerationPage({
  teacherId,
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
  const [studentDisplayFields, setStudentDisplayFields] = useState<GroupField[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [studentsError, setStudentsError] = useState<string | undefined>(undefined)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set())

  // Output destination — defaults to the app's own class-doc/output/ folder
  // (server-side, when omitted) unless the teacher explicitly picks one via
  // the native folder dialog.
  const [outputDir, setOutputDir] = useState<string | null>(null)

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<GenerationProgressEvent | null>(null)
  const [liveTally, setLiveTally] = useState<LiveTally>({ success: 0, failure: 0 })
  const [summary, setSummary] = useState<GenerationSummary | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)

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
      setStudentDisplayFields([])
      setSelectedStudentIds(new Set())
      setStudentsError(undefined)
      return
    }
    setLoadingStudents(true)
    setStudentsError(undefined)
    try {
      const [studentList, fields] = await Promise.all([
        window.api.studentListWithValues({ groupId }),
        window.api.groupFieldList({ groupId })
      ])
      setStudents(studentList)
      setStudentDisplayFields(fields)
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
    // Bug fix: must reset to `true` here, not just rely on `useRef(true)`'s
    // initial value. React 18/19 StrictMode (see main.tsx's <StrictMode>)
    // deliberately mounts every component twice in dev — mount, run effects,
    // immediately run their cleanup, then mount again — to surface exactly
    // this class of bug. `useRef`'s initial value only applies once, ever;
    // the *first* simulated cleanup set `mountedRef.current = false` and
    // nothing set it back to `true` for the real, currently-visible mount,
    // so every `if (mountedRef.current) ...` guard below (setRunning(false)
    // in handleGenerate's `finally`, setSummary, the progress-event handler)
    // silently no-op'd forever after that point — generation genuinely
    // completed on the backend, but the button stayed stuck in `loading`
    // and no completion state ever rendered, since the very state updates
    // that would show it were being dropped by this stale guard.
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      unsubscribeRef.current?.()
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

  async function handleChangeStatic(
    templateFieldId: number,
    defaultValue: string,
    required: boolean
  ): Promise<void> {
    // See handleChangeBinding's identical comment.
    if (groupId === undefined) return
    try {
      const updated = await window.api.templateFieldUpdateMapping({
        templateFieldId,
        groupId,
        defaultValue,
        required
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

  function studentDisplayName(student: StudentWithValues): string {
    const displayField = studentDisplayFields.find((f) => f.isDisplay)
    const raw = displayField ? student.values[displayField.id] : null
    return raw && raw.trim().length > 0 ? raw : `학생 ${student.id}`
  }

  async function handleGenerate(): Promise<void> {
    if (templateId === undefined || groupId === undefined || running) return
    if (selectedStudentIds.size === 0) return

    // Save-location picker is part of the "생성" click itself (not a
    // separate preliminary button) — cancelling the native folder dialog
    // cancels generation entirely, since the teacher hasn't confirmed where
    // the output should go.
    const picked = await window.api.generationPickOutputDir()
    if (!picked) return
    setOutputDir(picked)

    setRunning(true)
    setSummary(null)
    setProgress(null)
    setLiveTally({ success: 0, failure: 0 })
    unsubscribeRef.current = window.api.onGenerationProgress((event) => {
      if (!mountedRef.current) return
      setProgress(event)
      if (event.lastResult) {
        const succeeded = event.lastResult.status === 'SUCCESS'
        setLiveTally((current) => ({
          success: current.success + (succeeded ? 1 : 0),
          failure: current.failure + (succeeded ? 0 : 1)
        }))
      }
    })
    try {
      // Omit studentIds entirely when every student is selected (today's
      // default) so the request shape matches exactly what it always used
      // to be in the common case; only send an explicit subset when the
      // teacher deliberately excluded someone. Both are handled identically
      // by generation.ts's existing `payload.studentIds` filter.
      const allSelected = students.length > 0 && selectedStudentIds.size === students.length
      const result = await window.api.generationRun({
        templateId,
        groupId,
        ...(allSelected ? {} : { studentIds: Array.from(selectedStudentIds) }),
        outputDir: picked
      })
      if (mountedRef.current) setSummary(result)
      // Fires even if the teacher has already navigated away — the toast
      // provider lives above this page's mount/unmount, so a "generation
      // finished while you were elsewhere" notification is intentional, not
      // a stray update on an unmounted component.
      toast({
        type: result.failure > 0 ? 'warning' : 'success',
        message: `생성 완료: 성공 ${result.success} / 실패 ${result.failure} (총 ${result.total})`
      })
    } catch (e) {
      toast({
        type: 'error',
        message: '문서 생성에 실패했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    } finally {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
      if (mountedRef.current) setRunning(false)
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

  const canGenerate =
    templateId !== undefined && groupId !== undefined && !running && selectedStudentIds.size > 0
  const progressPercent =
    progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-lilac-ash-50">필드 매핑 및 문서 생성</h2>

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
            <p className="text-sm text-lilac-ash-300">
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
              <FieldMappingTable
                templateFields={templateFields}
                groupFields={groupFields}
                onChangeBinding={handleChangeBinding}
                onChangeStatic={handleChangeStatic}
              />

              <Card title="생성할 학생 선택">
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
                  <p className="text-sm text-lilac-ash-300">이 그룹에 등록된 학생이 없습니다.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Checkbox
                      checked={selectedStudentIds.size === students.length}
                      onChange={(event) => toggleAllStudents(event.target.checked)}
                    >
                      전체 선택 ({selectedStudentIds.size}/{students.length}명)
                    </Checkbox>
                    <div className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-3">
                      {students.map((student) => (
                        <Checkbox
                          key={student.id}
                          checked={selectedStudentIds.has(student.id)}
                          onChange={() => toggleStudent(student.id)}
                        >
                          {studentDisplayName(student)}
                        </Checkbox>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleGenerate} disabled={!canGenerate} loading={running}>
                  생성
                </Button>
                <span className="text-sm text-lilac-ash-300">
                  {running
                    ? '생성 버튼을 누르면 저장 위치를 선택하는 창이 뜹니다.'
                    : outputDir
                      ? `마지막 저장 위치: ${outputDir}`
                      : '생성 버튼을 누르면 저장할 위치를 선택합니다.'}
                </span>
              </div>

              {progress && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-lilac-ash-300">
                    {running
                      ? `${progress.currentStudentName} 처리 중 (${progress.completed}/${progress.total})`
                      : `완료 (${progress.completed}/${progress.total})`}{' '}
                    · 성공 {liveTally.success} · 실패 {liveTally.failure}
                  </span>
                </div>
              )}

              {!running && summary && (
                <Alert
                  type={summary.failure > 0 ? 'warning' : 'success'}
                  message={`생성 완료 — 성공 ${summary.success} / 실패 ${summary.failure} (총 ${summary.total})`}
                  detail={outputDir ? `${outputDir} 폴더에 저장되었습니다.` : undefined}
                />
              )}

              {/*
                Bug fix: this used to be gated on `running` alone
                (`{running && <ProgressBar .../>}`). `running` and `summary`
                are both flipped in the same handleGenerate() continuation
                with no intervening `await` (setSummary(result) happens right
                before the `finally` block's setRunning(false)), so React
                batches them into a single commit — the bar could disappear
                in the very same render that replaces it with the results
                Card, with no guaranteed frame where the teacher actually
                sees it reach 100%. Gating on `progress` instead (reset to
                null only when a *new* run starts, in handleGenerate's own
                setup) keeps the bar mounted at its last known value through
                that transition, so it visibly settles at 100% instead of
                just vanishing. This was investigated and fixed as the
                "progress bar never visibly fills / appears stuck" report —
                see this task's final report for how it was diagnosed (a
                real end-to-end Electron+React reproduction showed
                `generation:progress` events and their React re-renders both
                arrive/commit incrementally and well before generation:run's
                invoke resolves, which rules out cross-process IPC ordering
                as the cause; this render-gating issue was the one concrete,
                reproducible defect found in the surrounding UI code).
              */}
              {progress && (
                <ProgressBar
                  value={progressPercent}
                  showValue
                  label={running ? '문서 생성 중' : '문서 생성 완료'}
                />
              )}

              {summary && (
                <Card title="생성 결과">
                  <Table dense>
                    <Table.Head>
                      <Table.Row>
                        <Table.HeaderCell>구분</Table.HeaderCell>
                        <Table.HeaderCell>값</Table.HeaderCell>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      <Table.Row>
                        <Table.Cell>실행 번호</Table.Cell>
                        <Table.Cell>{summary.runId}</Table.Cell>
                      </Table.Row>
                      <Table.Row>
                        <Table.Cell>문서 유형</Table.Cell>
                        <Table.Cell>{summary.docType === 'LIST' ? '목록형' : '개별형'}</Table.Cell>
                      </Table.Row>
                      <Table.Row>
                        <Table.Cell>전체</Table.Cell>
                        <Table.Cell>{summary.total}</Table.Cell>
                      </Table.Row>
                      <Table.Row>
                        <Table.Cell>성공</Table.Cell>
                        <Table.Cell>{summary.success}</Table.Cell>
                      </Table.Row>
                      <Table.Row>
                        <Table.Cell>실패</Table.Cell>
                        <Table.Cell>{summary.failure}</Table.Cell>
                      </Table.Row>
                    </Table.Body>
                  </Table>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export { MappingGenerationPage }
