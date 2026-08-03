import type { GroupField, StudentWithValues, TemplateField } from '../../../../shared/domain'
import { STATIC_BINDING, TEACHER_NAME_BINDING } from '../../../../shared/domain'
import { Checkbox, Input, Table } from '../ui'
import { cn } from '../ui/utils'

export interface StudentValueTableProps {
  templateFields: TemplateField[]
  groupFields: GroupField[]
  students: StudentWithValues[]
  selectedStudentIds: Set<number>
  onToggleStudent: (studentId: number) => void
  onToggleAll: (checked: boolean) => void
  /** studentId -> templateFieldId -> the teacher's typed-in value for a "직접 입력" field. */
  staticValues: Record<number, Record<number, string>>
  onChangeStaticValue: (studentId: number, templateFieldId: number, value: string) => void
  /** The (single, local) teacher's own name — shown read-only for any field mapped to TEACHER_NAME_BINDING. */
  teacherName: string
}

// The generation-time preview/edit surface (teacher feedback: show the
// template's fields as columns with each selected student's data filled in,
// like a spreadsheet — not a bare checkbox list). Group-field-bound columns
// are read-only (the value already lives on the student record); "직접
// 입력" (STATIC_BINDING) columns are editable per student right here, since
// a field like "사유" legitimately differs per student and per generation
// run. Leaving one of those blank is fine — generation doesn't require it.
function StudentValueTable({
  templateFields,
  groupFields,
  students,
  selectedStudentIds,
  onToggleStudent,
  onToggleAll,
  staticValues,
  onChangeStaticValue,
  teacherName
}: StudentValueTableProps): React.JSX.Element {
  const groupFieldByKey = new Map(groupFields.map((f) => [f.fieldKey, f]))

  return (
    <Table dense>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell className="w-10">
            <div className="flex justify-center">
              <Checkbox
                checked={selectedStudentIds.size === students.length}
                onChange={(event) => onToggleAll(event.target.checked)}
                aria-label="전체 학생 선택"
              />
            </div>
          </Table.HeaderCell>
          {templateFields.map((templateField) => (
            // A modest, explicit width per field column — the previous
            // "no width at all" left a handful of short columns (이름/나이)
            // stretched arbitrarily wide across the table's full width, with
            // nothing to stop it; giving each one a stated preference keeps
            // any leftover space that does get distributed proportionate
            // and bounded instead.
            <Table.HeaderCell key={templateField.id} className="w-40 text-center">
              {templateField.fieldName}
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {students.map((student) => (
          <Table.Row key={student.id} selected={selectedStudentIds.has(student.id)}>
            <Table.Cell>
              <div className="flex justify-center">
                <Checkbox
                  checked={selectedStudentIds.has(student.id)}
                  onChange={() => onToggleStudent(student.id)}
                  aria-label={`학생 ${student.id} 선택`}
                />
              </div>
            </Table.Cell>
            {templateFields.map((templateField) => {
              if (templateField.binding === STATIC_BINDING) {
                return (
                  <Table.Cell key={templateField.id}>
                    <Input
                      aria-label={`${templateField.fieldName} 값`}
                      className="text-center"
                      value={staticValues[student.id]?.[templateField.id] ?? ''}
                      onChange={(event) =>
                        onChangeStaticValue(student.id, templateField.id, event.target.value)
                      }
                    />
                  </Table.Cell>
                )
              }
              if (templateField.binding === TEACHER_NAME_BINDING) {
                // Same value for every student (the teacher, not the
                // student, is what this field represents) — read-only here,
                // same as a mapped group-field value.
                return (
                  <Table.Cell
                    key={templateField.id}
                    className={cn(
                      'text-center',
                      teacherName && 'bg-space-indigo-950/40 font-medium text-space-indigo-100'
                    )}
                  >
                    {teacherName}
                  </Table.Cell>
                )
              }
              const groupField = groupFieldByKey.get(templateField.binding)
              const value = groupField ? (student.values[groupField.id] ?? '') : ''
              // Tinted + bolded when there's an actual value, so a student's
              // real data reads as distinct "filled in" content rather than
              // blending into the same plain text as headers/labels — an
              // empty cell stays untinted so blanks don't look like they're
              // hiding something.
              return (
                <Table.Cell
                  key={templateField.id}
                  className={cn(
                    'text-center',
                    value && 'bg-space-indigo-950/40 font-medium text-space-indigo-100'
                  )}
                >
                  {value}
                </Table.Cell>
              )
            })}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  )
}

export { StudentValueTable }
