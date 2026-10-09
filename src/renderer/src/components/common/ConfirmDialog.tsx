import type { ReactNode } from 'react'
import { Button, Modal } from '../ui'
import type { ButtonVariant } from '../ui'

export interface ConfirmDialogProps {
  open: boolean
  title: ReactNode
  message: ReactNode
  detail?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: ButtonVariant
  onConfirm: () => void
  onCancel: () => void
}

// A thin, purpose-built composition of the shared `Modal`/`Button` — not a new
// design-system primitive, just the one confirm-before-destructive-action
// pattern every list page needs (group/template/student delete). Kept out of
// `components/ui` and `components/groups` intentionally since those two
// directories are the reviewed, prop-frozen design system for this pass.
function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  confirmVariant = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-sm text-bone-white">
        <p>{message}</p>
        {detail && <p className="text-xs text-ash-gray">{detail}</p>}
      </div>
    </Modal>
  )
}

export { ConfirmDialog }
