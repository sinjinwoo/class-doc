import { useCallback, useEffect, useState } from 'react'
import type { StudentGroup } from '../../../shared/domain'
import { Alert, Button, EmptyState, Spinner, useToast } from '../components/ui'
import { GroupCard } from '../components/groups/GroupCard'
import { GroupFormModal } from '../components/groups/GroupFormModal'
import { ConfirmDialog } from '../components/common/ConfirmDialog'

export interface GroupsPageProps {
  teacherId: number
  onOpenGroup: (group: StudentGroup) => void
}

function GroupsPage({ teacherId, onOpenGroup }: GroupsPageProps): React.JSX.Element {
  const { toast } = useToast()
  const [groups, setGroups] = useState<StudentGroup[]>([])
  const [studentCounts, setStudentCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StudentGroup | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(undefined)
    try {
      const list = await window.api.groupList({ teacherId })
      // groupList doesn't return a student count, and there's no batch count
      // endpoint — but resolving all of them as part of the same load (rather
      // than firing them off after the grid renders) keeps every GroupCard's
      // count in sync with its first paint instead of visibly flashing "0"
      // and then jumping to the real number a moment later.
      const counts = await Promise.all(
        list.map(async (group) => {
          try {
            const students = await window.api.studentListWithValues({ groupId: group.id })
            return [group.id, students.length] as const
          } catch {
            // Best-effort only — a failed count fetch just leaves that card at 0.
            return [group.id, 0] as const
          }
        })
      )
      setGroups(list)
      setStudentCounts(Object.fromEntries(counts))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [teacherId])

  useEffect(() => {
    // Standard fetch-on-mount/on-teacherId-change pattern — `load` sets
    // loading state synchronously before its first `await`, which
    // react-hooks/set-state-in-effect (an experimental React Compiler
    // readiness rule) flags on principle, but there's no external-system
    // subscription to model this as instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function handleCreateClick(): void {
    setEditingGroup(null)
    setFormOpen(true)
  }

  async function handleSubmit(name: string): Promise<void> {
    try {
      if (editingGroup) {
        await window.api.groupUpdate({ id: editingGroup.id, name })
        toast({ type: 'success', message: '그룹 이름을 변경했습니다.' })
      } else {
        await window.api.groupCreate({ teacherId, name })
        toast({ type: 'success', message: '그룹을 만들었습니다.' })
      }
      setFormOpen(false)
      setEditingGroup(null)
      await load()
    } catch (e) {
      toast({
        type: 'error',
        message: '그룹을 저장하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteTarget) return
    const group = deleteTarget
    setDeleteTarget(null)
    try {
      await window.api.groupDelete({ id: group.id })
      toast({ type: 'success', message: `'${group.name}' 그룹을 삭제했습니다.` })
      await load()
    } catch (e) {
      toast({
        type: 'error',
        message: '그룹을 삭제하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-lilac-ash-50">그룹 관리</h2>
        <Button onClick={handleCreateClick}>새 그룹</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert type="error" message="그룹 목록을 불러오지 못했습니다." detail={loadError} />
          <Button variant="secondary" onClick={load}>
            다시 시도
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="아직 그룹이 없습니다"
          description="학생 명단을 관리할 첫 그룹을 만들어 보세요."
          action={<Button onClick={handleCreateClick}>새 그룹 만들기</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              studentCount={studentCounts[group.id] ?? 0}
              onOpen={() => onOpenGroup(group)}
              onDelete={() => setDeleteTarget(group)}
            />
          ))}
        </div>
      )}

      <GroupFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingGroup(null)
        }}
        onSubmit={handleSubmit}
        initialName={editingGroup?.name ?? ''}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="그룹 삭제"
        message={`'${deleteTarget?.name ?? ''}' 그룹을 삭제하시겠습니까?`}
        detail="이 그룹에 등록된 학생 명단도 함께 삭제되며, 되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export { GroupsPage }
