import type { MouseEvent } from 'react'
import type { Template } from '../../../../shared/domain'
import { Badge, Button, Card } from '../ui'
import { DeleteIcon } from '../groups/icons'

export interface TemplateCardProps {
  template: Template
  onOpen: () => void
  onDelete: () => void
}

// Mirrors GroupCard's whole-card-is-clickable pattern
// (src/renderer/src/components/groups/GroupCard.tsx) — a separate "open"
// icon button wasn't discoverable, per the same teacher feedback that
// changed GroupCard.
function TemplateCard({ template, onOpen, onDelete }: TemplateCardProps): React.JSX.Element {
  function handleDeleteClick(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation()
    onDelete()
  }

  return (
    <Card
      title={template.name}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className="cursor-pointer transition-colors duration-150 hover:border-space-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-space-indigo-400"
      action={
        <div className="flex items-center gap-2">
          <Badge status={template.docType === 'LIST' ? 'warning' : 'neutral'}>
            {template.docType === 'LIST' ? '목록형' : '개별형'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            icon={<DeleteIcon className="h-4 w-4" />}
            aria-label={`${template.name} 삭제`}
            onClick={handleDeleteClick}
          />
        </div>
      }
    >
      <p className="truncate font-mono text-xs text-lilac-ash-400">{template.fileName}</p>
    </Card>
  )
}

export { TemplateCard }
