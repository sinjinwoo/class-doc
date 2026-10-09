import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import type { GroupField } from '../../../../shared/domain'
import { Button, Input, Modal, Table, useToast } from '../ui'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { DeleteIcon } from './icons'

export interface FieldManageModalProps {
  open: boolean
  onClose: () => void
  groupId: number
  fields: GroupField[]
  /** Re-fetches this group's fields (and students, per GroupDetailPage's `load()`) after any mutation below. */
  onFieldsChanged: () => Promise<void>
}

// A dedicated "필드 관리" surface: add/delete a group's dynamic fields. The
// student-list "이름" column and CSV re-upload identity matching are now
// derived automatically from conventional column names (see
// autoAssignFieldRoles in src/main/ipc/groupFields.ts) — there's no more
// per-field 표시/식별 toggle to expose here.
function FieldManageModal({
  open,
  onClose,
  groupId,
  fields,
  onFieldsChanged
}: FieldManageModalProps): React.JSX.Element {
  const { toast } = useToast()

  const [newFieldKey, setNewFieldKey] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GroupField | null>(null)

  const sortedFields = [...fields].sort(
    (a, b) =>
      (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)
  )

  async function handleAddField(): Promise<void> {
    const key = newFieldKey.trim()
    if (!key || adding) return
    if (fields.some((field) => field.fieldKey === key)) {
      toast({ type: 'error', message: `'${key}' 필드는 이미 존재합니다.` })
      return
    }
    setAdding(true)
    try {
      await window.api.groupFieldCreate({ groupId, fieldKey: key })
      toast({ type: 'success', message: `'${key}' 필드를 추가했습니다.` })
      setNewFieldKey('')
      await onFieldsChanged()
    } catch (e) {
      toast({
        type: 'error',
        message: '필드를 추가하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    } finally {
      setAdding(false)
    }
  }

  function handleNewFieldKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddField()
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteTarget) return
    const field = deleteTarget
    setDeleteTarget(null)
    try {
      await window.api.groupFieldDelete({ groupId, groupFieldId: field.id })
      toast({ type: 'success', message: `'${field.fieldKey}' 필드를 삭제했습니다.` })
      await onFieldsChanged()
    } catch (e) {
      toast({
        type: 'error',
        message: '필드를 삭제하지 못했습니다.',
        detail: e instanceof Error ? e.message : String(e)
      })
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="필드 관리"
        footer={
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {sortedFields.length === 0 ? (
            <p className="text-sm text-ash-gray">
              아직 등록된 필드가 없습니다. 아래에서 필드를 추가하세요.
            </p>
          ) : (
            <Table dense>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>필드</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">삭제</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {sortedFields.map((field) => (
                  <Table.Row key={field.id}>
                    <Table.Cell className="font-mono text-xs text-silver-mist">
                      {field.fieldKey}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        icon={<DeleteIcon className="h-4 w-4" />}
                        aria-label={`${field.fieldKey} 필드 삭제`}
                        onClick={() => setDeleteTarget(field)}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}

          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <Input
                label="새 필드 이름"
                value={newFieldKey}
                onChange={(event) => setNewFieldKey(event.target.value)}
                onKeyDown={handleNewFieldKeyDown}
                placeholder="예: 메모"
                disabled={adding}
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleAddField}
              loading={adding}
              disabled={!newFieldKey.trim()}
            >
              필드 추가
            </Button>
          </div>
          <p className="text-xs text-ash-gray">
            필드를 삭제하면 모든 학생의 해당 값이 함께 삭제되며, 되돌릴 수 없습니다.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="필드 삭제"
        message={`'${deleteTarget?.fieldKey ?? ''}' 필드를 삭제하시겠습니까?`}
        detail="이 필드에 저장된 모든 학생의 값이 함께 삭제되며, 되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

export { FieldManageModal }
