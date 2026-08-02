import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal } from '../ui'

export interface GroupFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string) => void
  initialName?: string
}

function GroupFormModal({
  open,
  onClose,
  onSubmit,
  initialName = ''
}: GroupFormModalProps): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const wasOpenRef = useRef(false)

  // Reset the field only on the false -> true transition (a fresh open), not on
  // every re-render while already open — otherwise an unrelated parent re-render
  // would clobber in-progress typing.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setName(initialName)
    }
    wasOpenRef.current = open
  }, [open, initialName])

  const trimmedName = name.trim()
  const isValid = trimmedName.length > 0

  function handleSubmit(): void {
    if (!isValid) return
    onSubmit(trimmedName)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && isValid) {
      handleSubmit()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialName ? '그룹 이름 변경' : '새 그룹 만들기'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" disabled={!isValid} onClick={handleSubmit}>
            저장
          </Button>
        </>
      }
    >
      <Input
        label="그룹 이름"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="예: 3학년 2반"
      />
    </Modal>
  )
}

export { GroupFormModal }
