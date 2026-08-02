import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { GroupField } from '../../../../shared/domain'
import { Button, Input, Modal } from '../ui'
import { PlusIcon } from './icons'

export interface StudentFormModalProps {
  open: boolean
  onClose: () => void
  fields: GroupField[]
  mode: 'create' | 'edit'
  initialValues?: Record<string, string>
  onSubmit: (values: Record<string, string>) => void
}

function StudentFormModal({
  open,
  onClose,
  fields,
  mode,
  initialValues,
  onSubmit
}: StudentFormModalProps): React.JSX.Element {
  const sortedFields = [...fields].sort(
    (a, b) =>
      (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)
  )
  const hasKnownFields = sortedFields.length > 0

  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {})
  // Only populated when this group has no group_field definitions yet (a brand-new
  // group — see docs/schema.md §4) — lets the teacher define field keys inline
  // before any group_field row exists to render inputs from. The first key added
  // here defaults to display+identity once the mounting page persists it as an
  // actual group_field (a reasonable default, not enforced by this component).
  const [inlineFieldKeys, setInlineFieldKeys] = useState<string[]>([])
  const [newFieldKey, setNewFieldKey] = useState('')
  const wasOpenRef = useRef(false)

  // Reset local edit state only on the false -> true transition (a fresh open),
  // not on every re-render while already open. `initialValues` is deliberately
  // excluded from the dependency array: it's an object prop whose identity a
  // caller may not memoize, and re-running this reset on every unrelated parent
  // render would wipe in-progress edits while the modal is open.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setValues(initialValues ?? {})
      setInlineFieldKeys([])
      setNewFieldKey('')
    }
    wasOpenRef.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleValueChange(fieldKey: string, value: string): void {
    setValues((current) => ({ ...current, [fieldKey]: value }))
  }

  function handleAddInlineField(): void {
    const key = newFieldKey.trim()
    if (!key) return
    if (inlineFieldKeys.includes(key)) return
    setInlineFieldKeys((current) => [...current, key])
    setNewFieldKey('')
  }

  function handleNewFieldKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddInlineField()
    }
  }

  function handleSubmit(): void {
    const submittedKeys = hasKnownFields
      ? sortedFields.map((field) => field.fieldKey)
      : inlineFieldKeys
    const submittedValues: Record<string, string> = {}
    submittedKeys.forEach((key) => {
      submittedValues[key] = values[key] ?? ''
    })
    onSubmit(submittedValues)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? '학생 추가' : '학생 정보 수정'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {mode === 'create' ? '추가' : '저장'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {hasKnownFields ? (
          sortedFields.map((field) => (
            <Input
              key={field.id}
              label={field.isDisplay ? `${field.fieldKey} *` : field.fieldKey}
              required={field.isDisplay}
              value={values[field.fieldKey] ?? ''}
              onChange={(event) => handleValueChange(field.fieldKey, event.target.value)}
            />
          ))
        ) : (
          <>
            {inlineFieldKeys.length === 0 && (
              <p className="text-xs text-lilac-ash-300">
                이 그룹에는 아직 필드가 없습니다. 아래에서 필드를 먼저 추가하세요.
              </p>
            )}
            {inlineFieldKeys.map((key, index) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Input
                  label={index === 0 ? `${key} *` : key}
                  required={index === 0}
                  value={values[key] ?? ''}
                  onChange={(event) => handleValueChange(key, event.target.value)}
                />
                {index === 0 && (
                  <p className="text-xs text-lilac-ash-400">
                    첫 필드는 표시 필드 및 식별 필드로 사용됩니다.
                  </p>
                )}
              </div>
            ))}
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <Input
                  label="새 필드 이름"
                  value={newFieldKey}
                  onChange={(event) => setNewFieldKey(event.target.value)}
                  onKeyDown={handleNewFieldKeyDown}
                  placeholder="예: 이름"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                icon={<PlusIcon className="h-4 w-4" />}
                aria-label="필드 추가"
                onClick={handleAddInlineField}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export { StudentFormModal }
