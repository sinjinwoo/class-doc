import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, FileDropzone, Modal, Table } from '../ui'
import { parseCsv } from './csvParse'

export interface CsvImportModalProps {
  open: boolean
  onClose: () => void
  onImport: (rows: Record<string, string>[], fieldKeys: string[]) => void
}

type Step = 'upload' | 'preview'

const PREVIEW_ROW_LIMIT = 50

function CsvImportModal({ open, onClose, onImport }: CsvImportModalProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('upload')
  const [parseError, setParseError] = useState<string | undefined>(undefined)
  const [fileName, setFileName] = useState<string | undefined>(undefined)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const wasOpenRef = useRef(false)

  // Reset the whole wizard only on the false -> true transition (a fresh open),
  // not on every re-render while already open.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep('upload')
      setParseError(undefined)
      setFileName(undefined)
      setHeaders([])
      setRows([])
    }
    wasOpenRef.current = open
  }, [open])

  async function handleFilesSelected(files: FileList): Promise<void> {
    const file = files[0]
    if (!file) return

    const text = await file.text()
    const parsed = parseCsv(text)
    setFileName(file.name)

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setParseError('CSV 파일에서 헤더 또는 데이터 행을 찾을 수 없습니다.')
      setHeaders([])
      setRows([])
      return
    }

    setParseError(undefined)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
  }

  const canProceedFromUpload = !parseError && headers.length > 0 && rows.length > 0

  function handleImport(): void {
    onImport(rows, headers)
    onClose()
  }

  function renderFooter(): ReactNode {
    if (step === 'upload') {
      return (
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={!canProceedFromUpload}
            onClick={() => setStep('preview')}
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
        <Button variant="primary" onClick={handleImport}>
          가져오기
        </Button>
      </>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="CSV 가져오기" footer={renderFooter()}>
      {step === 'upload' && (
        <div className="flex flex-col gap-3">
          <FileDropzone
            accept=".csv"
            onFilesSelected={handleFilesSelected}
            label="CSV 파일을 드래그하거나 클릭하여 선택하세요"
            hint="쉼표(,)로 구분된 CSV 파일"
          />
          {parseError && <Alert type="error" message={parseError} />}
          {!parseError && headers.length > 0 && (
            <p className="text-xs text-lilac-ash-300">
              {fileName ? `${fileName} · ` : ''}
              {headers.length}개 필드, {rows.length}행 감지됨
            </p>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-3">
          <Alert type="info" message={`총 ${rows.length}행을 가져옵니다.`} />
          <Table dense>
            {rows.length > PREVIEW_ROW_LIMIT && (
              <caption className="mb-2 text-left text-xs text-lilac-ash-400">
                상위 {PREVIEW_ROW_LIMIT}행 표시 중 (전체 {rows.length}행)
              </caption>
            )}
            <Table.Head>
              <Table.Row>
                {headers.map((header) => (
                  <Table.HeaderCell key={header}>{header}</Table.HeaderCell>
                ))}
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.slice(0, PREVIEW_ROW_LIMIT).map((row, index) => (
                <Table.Row key={index}>
                  {headers.map((header) => (
                    <Table.Cell key={header}>{row[header]}</Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </Modal>
  )
}

export { CsvImportModal }
