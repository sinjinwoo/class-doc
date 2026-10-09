import type { MouseEvent } from 'react'
import type { StudentGroup } from '../../../../shared/domain'
import { Badge, Button, Card } from '../ui'
import { cn, focusRing } from '../ui/utils'
import { DeleteIcon } from './icons'

export interface GroupCardProps {
  group: StudentGroup
  studentCount: number
  onOpen: () => void
  onDelete: () => void
}

// The whole card opens the group (teacher feedback: a separate "open" icon
// button next to the delete one wasn't discoverable) — delete stays as its
// own icon button and stops propagation so clicking it doesn't also trigger
// onOpen.
function GroupCard({ group, studentCount, onOpen, onDelete }: GroupCardProps): React.JSX.Element {
  function handleDeleteClick(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation()
    onDelete()
  }

  return (
    <Card
      title={group.name}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'cursor-pointer transition-colors duration-150 hover:border-line-strong hover:bg-surface-raised',
        focusRing
      )}
      action={
        <div className="flex items-center gap-2">
          <Badge status="neutral">{studentCount}명</Badge>
          <Button
            variant="ghost"
            size="icon"
            icon={<DeleteIcon className="h-4 w-4" />}
            aria-label={`${group.name} 삭제`}
            onClick={handleDeleteClick}
          />
        </div>
      }
    />
  )
}

export { GroupCard }
