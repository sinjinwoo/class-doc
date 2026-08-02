import type { StudentGroup } from '../../types/domain'
import { Badge, Button, Card } from '../ui'
import { DeleteIcon, OpenIcon } from './icons'

export interface GroupCardProps {
  group: StudentGroup
  studentCount: number
  onOpen: () => void
  onDelete: () => void
}

function GroupCard({ group, studentCount, onOpen, onDelete }: GroupCardProps): React.JSX.Element {
  return (
    <Card
      title={group.name}
      action={
        <div className="flex items-center gap-2">
          <Badge status="neutral">{studentCount}명</Badge>
          <Button
            variant="ghost"
            size="icon"
            icon={<OpenIcon className="h-4 w-4" />}
            aria-label={`${group.name} 열기`}
            onClick={onOpen}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={<DeleteIcon className="h-4 w-4" />}
            aria-label={`${group.name} 삭제`}
            onClick={onDelete}
          />
        </div>
      }
    />
  )
}

export { GroupCard }
