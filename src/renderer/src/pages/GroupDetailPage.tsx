import { useCallback, useEffect, useState } from 'react'
import type { GroupField, StudentWithValues } from '../../../shared/domain'
import { Alert, Button, EmptyState, Spinner, useToast } from '../components/ui'
import { StudentTable } from '../components/groups/StudentTable'
import { StudentFormModal } from '../components/groups/StudentFormModal'
import { CsvImportModal } from '../components/groups/CsvImportModal'
import { FieldManageModal } from '../components/groups/FieldManageModal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'

export interface GroupDetailPageProps {
  groupId: number
  groupName: string
  onBack: () => void
}

function buildInitialValues(
  student: StudentWithValues,
  fields: GroupField[]
): Record<string, string> {
  const values: Record<string, string> = {}
  fields.forEach((field) => {
    values[field.fieldKey] = student.values[field.id] ?? ''
  })
  return values
}

function GroupDetailPage({ groupId, groupName, onBack }: GroupDetailPageProps): React.JSX.Element {
  const { toast } = useToast()
  const [fields, setFields] = useState<GroupField[]>([])
  const [students, setStudents] = useState<StudentWithValues[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [fieldManageModalOpen, setFieldManageModalOpen] = useState(false)
  const [studentModalOpen, setStudentModalOpen] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StudentWithValues | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(undefined)
    try {
      const [fieldList, studentList] = await Promise.all([
        window.api.groupFieldList({ groupId }),
        window.api.studentListWithValues({ groupId })
      ])
      setFields(fieldList)
      setStudents(studentList)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    // See GroupsPage.tsx's identical comment — standard fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const editingStudent = students.find((s) => s.id === editingStudentId) ?? null
  const displayField = fields.find((field) => field.isDisplay)
  const deleteTargetName = deleteTarget
    ? (displayField && deleteTarget.values[displayField.id]) || '이 학생'
    : ''

  function handleAddStudentClick(): void {
    setEditingStudentId(null)
    setStudentModalOpen(true)
  }

  function handleEditStudent(studentId: number): void {
    setEditingStudentId(studentId)
    setStudentModalOpen(true)
  }

  async function handleStudentSubmit(values: Record<string, string>): Promise<void> {
    try {
      await window.api.studentCreateOrUpdate({
        groupId,
        studentId: editingStudentId ?? undefined,
        values
      })
      toast({
        type: 'success',
        message: editingStudentId ? '학생 정보를 수정했습니다.' : '학생을 추가했습니다.'
      })
      setStudentModalOpen(false)
      setEditingStudentId(null)
      await load()
    } catch (e) {
      toast({
        type: 'error',
        message: '학생 정보를 저장하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  function handleDeleteStudentClick(studentId: number): void {
    const student = students.find((s) => s.id === studentId) ?? null
    setDeleteTarget(student)
  }

  async function handleConfirmDeleteStudent(): Promise<void> {
    if (!deleteTarget) return
    const studentId = deleteTarget.id
    setDeleteTarget(null)
    try {
      await window.api.studentDelete({ studentId })
      toast({ type: 'success', message: '학생을 삭제했습니다.' })
      await load()
    } catch (e) {
      toast({
        type: 'error',
        message: '학생을 삭제하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  async function handleCsvImport(
    rows: Record<string, string>[],
    fieldKeys: string[]
  ): Promise<void> {
    try {
      const result = await window.api.studentImportCsv({ groupId, rows, fieldKeys })
      toast({ type: 'success', message: `${result.imported}명의 학생 정보를 가져왔습니다.` })
      await load()
    } catch (e) {
      toast({
        type: 'error',
        message: 'CSV 가져오기에 실패했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onBack}>
            ← 그룹 목록
          </Button>
          <h2 className="text-lg font-semibold text-lilac-ash-50">{groupName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setFieldManageModalOpen(true)}>
            필드 관리
          </Button>
          <Button variant="secondary" onClick={() => setCsvModalOpen(true)}>
            CSV 가져오기
          </Button>
          <Button onClick={handleAddStudentClick}>학생 추가</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert type="error" message="학생 명단을 불러오지 못했습니다." detail={loadError} />
          <Button variant="secondary" onClick={load}>
            다시 시도
          </Button>
        </div>
      ) : fields.length === 0 ? (
        <EmptyState
          title="아직 등록된 학생 필드가 없습니다"
          description="CSV 파일을 가져오거나 학생을 한 명 추가하면, 이름/학년/반 같은 필드가 자동으로 설정됩니다. '필드 관리'에서 직접 필드를 추가할 수도 있습니다."
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setFieldManageModalOpen(true)}>
                필드 관리
              </Button>
              <Button variant="secondary" onClick={() => setCsvModalOpen(true)}>
                CSV 가져오기
              </Button>
              <Button onClick={handleAddStudentClick}>학생 추가</Button>
            </div>
          }
        />
      ) : (
        <StudentTable
          fields={fields}
          students={students}
          onEditStudent={handleEditStudent}
          onDeleteStudent={handleDeleteStudentClick}
        />
      )}

      <CsvImportModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
      />

      <FieldManageModal
        open={fieldManageModalOpen}
        onClose={() => setFieldManageModalOpen(false)}
        groupId={groupId}
        fields={fields}
        onFieldsChanged={load}
      />

      <StudentFormModal
        open={studentModalOpen}
        onClose={() => {
          setStudentModalOpen(false)
          setEditingStudentId(null)
        }}
        fields={fields}
        mode={editingStudentId ? 'edit' : 'create'}
        initialValues={editingStudent ? buildInitialValues(editingStudent, fields) : undefined}
        onSubmit={handleStudentSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="학생 삭제"
        message={`'${deleteTargetName}' 학생 정보를 삭제하시겠습니까?`}
        detail="삭제된 학생 정보는 되돌릴 수 없습니다. 이미 생성된 문서 이력에는 영향이 없습니다."
        confirmLabel="삭제"
        onConfirm={handleConfirmDeleteStudent}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export { GroupDetailPage }
