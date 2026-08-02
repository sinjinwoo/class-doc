import type { Template } from '../../../../shared/domain'
import { Badge, Button, Card } from '../ui'
import { DeleteIcon, OpenIcon } from '../groups/icons'

export interface TemplateCardProps {
  template: Template
  onOpen: () => void
  onDelete: () => void
}

// Mirrors GroupCard's prop pattern (src/renderer/src/components/groups/GroupCard.tsx)
// — group has no directly reusable component of its own here since templates
// carry different metadata (doc type badge instead of a member count).
function TemplateCard({ template, onOpen, onDelete }: TemplateCardProps): React.JSX.Element {
  return (
    <Card
      title={template.name}
      action={
        <div className="flex items-center gap-2">
          <Badge status={template.docType === 'LIST' ? 'warning' : 'neutral'}>
            {template.docType === 'LIST' ? '목록형' : '개별형'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            icon={<OpenIcon className="h-4 w-4" />}
            aria-label={`${template.name} 열기`}
            onClick={onOpen}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={<DeleteIcon className="h-4 w-4" />}
            aria-label={`${template.name} 삭제`}
            onClick={onDelete}
          />
        </div>
      }
    >
      <p className="truncate font-mono text-xs text-lilac-ash-400">{template.fileName}</p>
    </Card>
  )
}

export { TemplateCard }
