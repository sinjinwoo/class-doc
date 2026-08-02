import type { GroupField, TemplateField } from '../../../../shared/domain'
import { STATIC_BINDING } from '../../../../shared/domain'
import type { SelectOption } from '../ui'
import { Badge, Checkbox, Input, Select, Table } from '../ui'

export interface FieldMappingTableProps {
  templateFields: TemplateField[]
  groupFields: GroupField[]
  onChangeBinding: (templateFieldId: number, binding: string) => void
  onChangeStatic: (templateFieldId: number, defaultValue: string, required: boolean) => void
}

type RowStatus = 'mapped' | 'stale'

function getRowStatus(templateField: TemplateField, groupFields: GroupField[]): RowStatus {
  if (templateField.binding === STATIC_BINDING) return 'mapped'
  return groupFields.some((groupField) => groupField.fieldKey === templateField.binding)
    ? 'mapped'
    : 'stale'
}

// The select's options must always include the field's *current* binding,
// even when that binding is stale (references a group_field that no longer
// exists in `groupFields`) — otherwise a controlled <select> silently falls
// back to displaying its first option, which would misrepresent a stale
// mapping as if it were mapped to whatever field happens to be first.
function buildOptions(templateField: TemplateField, groupFields: GroupField[]): SelectOption[] {
  const options: SelectOption[] = groupFields.map((groupField) => ({
    value: groupField.fieldKey,
    label: groupField.fieldKey
  }))

  const isStale = getRowStatus(templateField, groupFields) === 'stale'
  if (isStale) {
    options.unshift({
      value: templateField.binding,
      label: `${templateField.binding} (그룹에 없음)`
    })
  }

  options.push({ value: STATIC_BINDING, label: '직접 입력' })

  return options
}

function FieldMappingTable({
  templateFields,
  groupFields,
  onChangeBinding,
  onChangeStatic
}: FieldMappingTableProps): React.JSX.Element {
  const mappedCount = templateFields.filter(
    (templateField) => getRowStatus(templateField, groupFields) === 'mapped'
  ).length

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-lilac-ash-300">
        {mappedCount}/{templateFields.length} 필드 매핑 완료
      </p>
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>필드명</Table.HeaderCell>
            <Table.HeaderCell>매핑 대상</Table.HeaderCell>
            <Table.HeaderCell>정적 값</Table.HeaderCell>
            <Table.HeaderCell>상태</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {templateFields.map((templateField) => {
            const status = getRowStatus(templateField, groupFields)
            const isStatic = templateField.binding === STATIC_BINDING

            return (
              <Table.Row key={templateField.id}>
                <Table.Cell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-lilac-ash-200">
                        {templateField.fieldName}
                      </span>
                      {templateField.scope === 'ROW' && <Badge status="neutral">반복</Badge>}
                    </div>
                    {status === 'stale' && (
                      <p className="text-xs text-almond-silk-300">
                        이 매핑이 가리키는 필드가 현재 그룹에 없습니다. 다시 매핑해 주세요.
                      </p>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Select
                    aria-label={`${templateField.fieldName} 매핑 대상`}
                    options={buildOptions(templateField, groupFields)}
                    value={templateField.binding}
                    onChange={(event) => onChangeBinding(templateField.id, event.target.value)}
                  />
                </Table.Cell>
                <Table.Cell>
                  {isStatic ? (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Input
                          aria-label={`${templateField.fieldName} 정적 값`}
                          value={templateField.defaultValue ?? ''}
                          onChange={(event) =>
                            onChangeStatic(
                              templateField.id,
                              event.target.value,
                              templateField.required
                            )
                          }
                        />
                      </div>
                      <Checkbox
                        checked={templateField.required}
                        onChange={(event) =>
                          onChangeStatic(
                            templateField.id,
                            templateField.defaultValue ?? '',
                            event.target.checked
                          )
                        }
                      >
                        필수
                      </Checkbox>
                    </div>
                  ) : (
                    <span className="text-lilac-ash-500">—</span>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {status === 'mapped' ? (
                    <Badge status="success">매핑완료</Badge>
                  ) : (
                    <Badge status="danger">그룹에 필드 없음</Badge>
                  )}
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>
    </div>
  )
}

export { FieldMappingTable }
