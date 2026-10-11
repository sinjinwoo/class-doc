import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, FileDropzone, Modal, Select, Table } from '../ui'
import { parseSpreadsheetFile } from '../groups/csvParse'

export interface ImportTarget {
  /** Key the imported rows are returned under. */
  key: string
  /** What the teacher sees (template field name / group field name). */
  label: string
}

export interface SpreadsheetImportModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Fields the file's columns can be matched to. */
  targets: ImportTarget[]
  /** Rows keyed by `ImportTarget.key`; rows with every matched value blank are already dropped. */
  onImport: (rows: Record<string, string>[]) => void
}

type Step = 'upload' | 'match'

const PREVIEW_ROW_LIMIT = 5
const SKIP = ''

const compact = (name: string): string => name.replace(/\s/g, '')

// Excel/CSV rows for the generation screen (group-less rows, or one-off
// students added to a group's document). Unlike the roster import
// (CsvImportModal), the target fields already exist here, so the second step
// lets the teacher pick which file column fills each field — pre-filled by
// name (whitespace-insensitive) so a file that already matches needs no work.
function SpreadsheetImportModal({
  open,
  onClose,
  title,
  targets,
  onImport
}: SpreadsheetImportModalProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('upload')
  const [parseError, setParseError] = useState<string | undefined>(undefined)
  const [fileName, setFileName] = useState<string | undefined>(undefined)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  /** target key -> file header (SKIP = leave blank). */
  const [columnByTarget, setColumnByTarget] = useState<Record<string, string>>({})
  const wasOpenRef = useRef(false)

  // Reset only on a fresh open (false -> true), same as CsvImportModal.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep('upload')
      setParseError(undefined)
      setFileName(undefined)
      setHeaders([])
      setRows([])
      setColumnByTarget({})
    }
    wasOpenRef.current = open
  }, [open])

  async function handleFilesSelected(files: FileList): Promise<void> {
    const file = files[0]
    if (!file) return
    setFileName(file.name)

    let parsed: { headers: string[]; rows: Record<string, string>[] }
    try {
      parsed = await parseSpreadsheetFile(file)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e))
      setHeaders([])
      setRows([])
      return
    }
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setParseError('파일에서 첫 줄(항목 이름) 또는 데이터 행을 찾을 수 없습니다.')
      setHeaders([])
      setRows([])
      return
    }

    setParseError(undefined)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    const auto: Record<string, string> = {}
    for (const target of targets) {
      auto[target.key] =
        parsed.headers.find((h) => compact(h) === compact(target.label)) ??
        parsed.headers.find((h) => compact(h) === compact(target.key)) ??
        SKIP
    }
    setColumnByTarget(auto)
  }

  const matchedTargets = targets.filter((t) => columnByTarget[t.key])
  const mappedRows = rows
    .map((row) => {
      const out: Record<string, string> = {}
      for (const target of matchedTargets) out[target.key] = row[columnByTarget[target.key]] ?? ''
      return out
    })
    .filter((row) => Object.values(row).some((v) => v.trim() !== ''))

  function handleImport(): void {
    onImport(mappedRows)
    onClose()
  }

  const columnOptions = [
    { value: SKIP, label: '(비워 두기)' },
    ...headers.map((h) => ({ value: h, label: h }))
  ]

  function renderFooter(): ReactNode {
    if (step === 'upload') {
      return (
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={!!parseError || headers.length === 0}
            onClick={() => setStep('match')}
          >
            다음
          </Button>
        </>
      )
    }
    return (
      <>
        <Button variant="ghost" onClick={() => setStep('upload')}>
          이전
        </Button>
        <Button variant="primary" disabled={mappedRows.length === 0} onClick={handleImport}>
          {mappedRows.length}건 추가
        </Button>
      </>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={title} footer={renderFooter()}>
      {step === 'upload' && (
        <div className="flex flex-col gap-3">
          <FileDropzone
            accept=".csv,.xlsx"
            onFilesSelected={handleFilesSelected}
            label="엑셀(.xlsx) 또는 CSV 파일을 드래그하거나 클릭하여 선택하세요"
            hint="첫 줄은 항목 이름이어야 합니다. 다음 단계에서 어느 열을 어느 필드에 넣을지 고를 수 있습니다. 엑셀은 첫 번째 시트를 읽습니다."
          />
          {parseError && <Alert type="error" message={parseError} />}
          {!parseError && headers.length > 0 && (
            <p className="text-xs text-ash-gray">
              {fileName ? `${fileName} · ` : ''}
              {headers.length}개 열, {rows.length}행 감지됨
            </p>
          )}
        </div>
      )}

      {step === 'match' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-silver-mist">
            각 필드에 넣을 파일의 열을 고르세요. 이름이 같은 열은 미리 골라 두었습니다.
          </p>
          <Table dense>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell className="w-1/2">필드</Table.HeaderCell>
                <Table.HeaderCell>파일의 열</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {targets.map((target) => (
                <Table.Row key={target.key}>
                  <Table.Cell className="text-bone-white">{target.label}</Table.Cell>
                  <Table.Cell>
                    <Select
                      aria-label={`${target.label}에 넣을 열`}
                      value={columnByTarget[target.key] ?? SKIP}
                      onChange={(event) =>
                        setColumnByTarget((current) => ({
                          ...current,
                          [target.key]: event.target.value
                        }))
                      }
                      options={columnOptions}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {matchedTargets.length === 0 ? (
            <Alert type="warning" message="연결된 필드가 없습니다. 하나 이상 골라 주세요." />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ash-gray">
                미리보기 (전체 {mappedRows.length}건 중{' '}
                {Math.min(PREVIEW_ROW_LIMIT, mappedRows.length)}
                건)
              </p>
              <Table dense>
                <Table.Head>
                  <Table.Row>
                    {matchedTargets.map((t) => (
                      <Table.HeaderCell key={t.key}>{t.label}</Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {mappedRows.slice(0, PREVIEW_ROW_LIMIT).map((row, index) => (
                    <Table.Row key={index}>
                      {matchedTargets.map((t) => (
                        <Table.Cell key={t.key}>{row[t.key]}</Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export { SpreadsheetImportModal }
