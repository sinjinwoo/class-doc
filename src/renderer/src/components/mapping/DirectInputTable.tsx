import type { TemplateField } from '../../../../shared/domain'
import { Button, Input, Table } from '../ui'
import { DeleteIcon } from '../groups/icons'

export interface DirectInputRow {
  /** Renderer-only stable React key. */
  key: number
  /** Keyed by template field *name* (GenerationPrepareRequest.rows). */
  values: Record<string, string>
}

export interface DirectInputTableProps {
  templateFields: TemplateField[]
  rows: DirectInputRow[]
  onChangeValue: (rowKey: number, fieldName: string, value: string) => void
  onRemoveRow: (rowKey: number) => void
}

// Group-less generation's data surface ("그룹 없이 직접 입력"): one row per
// document, one editable column per template 누름틀 — no group roster and no
// mapping step, the template's own field names are the columns. Rows come
// from typing here or from an Excel/CSV import whose headers match the field
// names (see MappingGenerationPage).
function DirectInputTable({
  templateFields,
  rows,
  onChangeValue,
  onRemoveRow
}: DirectInputTableProps): React.JSX.Element {
  return (
    <Table dense>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell className="w-12 text-center">#</Table.HeaderCell>
          {templateFields.map((field) => (
            <Table.HeaderCell key={field.id} className="w-40 text-center">
              {field.fieldName}
            </Table.HeaderCell>
          ))}
          <Table.HeaderCell className="w-12" />
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((row, index) => (
          <Table.Row key={row.key}>
            <Table.Cell className="text-center text-ash-gray tabular-nums">{index + 1}</Table.Cell>
            {templateFields.map((field) => (
              <Table.Cell key={field.id}>
                <Input
                  aria-label={`${index + 1}번째 행 ${field.fieldName} 값`}
                  className="text-center"
                  value={row.values[field.fieldName] ?? ''}
                  onChange={(event) => onChangeValue(row.key, field.fieldName, event.target.value)}
                />
              </Table.Cell>
            ))}
            <Table.Cell>
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  icon={<DeleteIcon className="h-3.5 w-3.5" />}
                  aria-label={`${index + 1}번째 행 삭제`}
                  onClick={() => onRemoveRow(row.key)}
                />
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  )
}

export { DirectInputTable }
