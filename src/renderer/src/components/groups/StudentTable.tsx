import type { GroupField, StudentWithValues } from '../../../../shared/domain'
import { Button, Table } from '../ui'
import { DeleteIcon, EditIcon } from './icons'

export interface StudentTableProps {
  fields: GroupField[]
  students: StudentWithValues[]
  onEditStudent: (studentId: number) => void
  onDeleteStudent: (studentId: number) => void
}

function StudentTable({
  fields,
  students,
  onEditStudent,
  onDeleteStudent
}: StudentTableProps): React.JSX.Element {
  const sortedFields = [...fields].sort(
    (a, b) =>
      (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)
  )

  return (
    <Table dense>
      <Table.Head>
        <Table.Row>
          {sortedFields.map((field) => (
            <Table.HeaderCell key={field.id}>{field.fieldKey}</Table.HeaderCell>
          ))}
          <Table.HeaderCell className="text-right">작업</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {students.map((student) => (
          <Table.Row key={student.id}>
            {sortedFields.map((field) => (
              <Table.Cell
                key={field.id}
                className={field.isDisplay ? 'font-medium text-lilac-ash-50' : undefined}
              >
                {student.values[field.id] ?? ''}
              </Table.Cell>
            ))}
            <Table.Cell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  icon={<EditIcon className="h-4 w-4" />}
                  aria-label="학생 정보 수정"
                  onClick={() => onEditStudent(student.id)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  icon={<DeleteIcon className="h-4 w-4" />}
                  aria-label="학생 삭제"
                  onClick={() => onDeleteStudent(student.id)}
                />
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  )
}

export { StudentTable }
