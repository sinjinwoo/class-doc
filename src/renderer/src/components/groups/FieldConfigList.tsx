import { useId } from 'react'
import { Checkbox, Radio, Table } from '../ui'

export interface FieldConfigEntry {
  fieldKey: string
  isDisplay: boolean
  isIdentity: boolean
}

export interface FieldConfigListProps {
  fields: FieldConfigEntry[]
  onChange: (fields: FieldConfigEntry[]) => void
}

function FieldConfigList({ fields, onChange }: FieldConfigListProps): React.JSX.Element {
  const radioGroupName = useId()

  function handleDisplayChange(fieldKey: string): void {
    onChange(fields.map((field) => ({ ...field, isDisplay: field.fieldKey === fieldKey })))
  }

  function handleIdentityChange(fieldKey: string, checked: boolean): void {
    onChange(
      fields.map((field) =>
        field.fieldKey === fieldKey ? { ...field, isIdentity: checked } : field
      )
    )
  }

  return (
    <Table dense>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>필드</Table.HeaderCell>
          <Table.HeaderCell>표시 필드</Table.HeaderCell>
          <Table.HeaderCell>식별 필드</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {fields.map((field) => (
          <Table.Row key={field.fieldKey}>
            <Table.Cell className="font-mono text-xs text-lilac-ash-200">
              {field.fieldKey}
            </Table.Cell>
            <Table.Cell>
              <Radio
                name={radioGroupName}
                checked={field.isDisplay}
                onChange={() => handleDisplayChange(field.fieldKey)}
                aria-label={`${field.fieldKey}를 표시 필드로 지정`}
              />
            </Table.Cell>
            <Table.Cell>
              <Checkbox
                checked={field.isIdentity}
                onChange={(event) => handleIdentityChange(field.fieldKey, event.target.checked)}
                aria-label={`${field.fieldKey}를 식별 필드로 지정`}
              />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  )
}

export { FieldConfigList }
