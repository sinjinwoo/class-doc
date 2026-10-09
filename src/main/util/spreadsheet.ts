// Reads the first worksheet of an .xlsx file into the same `{ headers, rows }`
// shape the renderer's CSV parser produces (components/groups/csvParse.ts), so
// both formats feed the same import preview + `student:importCsv` upsert.
//
// The first non-empty row is the header row; columns with a blank header are
// dropped, and fully blank data rows are skipped. Every cell is flattened to
// display text (formula -> cached result, date -> YYYY-MM-DD, rich text ->
// plain text). Legacy .xls (BIFF) isn't supported by ExcelJS.
import { Workbook, type CellValue } from 'exceljs'

export interface ParsedSheet {
  headers: string[]
  rows: Record<string, string>[]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function cellToText(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    // ExcelJS returns dates as UTC-midnight Date objects for date-only cells.
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
  }
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
    if ('formula' in value || 'sharedFormula' in value) {
      return cellToText((value as { result?: CellValue }).result ?? null)
    }
    if ('text' in value) return String(value.text)
    if ('error' in value) return ''
    return ''
  }
  return String(value)
}

export async function parseXlsx(bytes: Uint8Array): Promise<ParsedSheet> {
  const workbook = new Workbook()
  try {
    // ExcelJS's typings want a Node Buffer; a view over the same bytes is enough.
    await workbook.xlsx.load(
      Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) as unknown as ArrayBuffer
    )
  } catch {
    throw new Error('엑셀 파일을 읽을 수 없습니다. .xlsx 형식인지 확인해 주세요.')
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) return { headers: [], rows: [] }

  const rowTexts: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    for (let col = 1; col <= sheet.columnCount; col += 1) {
      cells.push(cellToText(row.getCell(col).value).trim())
    }
    if (cells.some((cell) => cell.length > 0)) rowTexts.push(cells)
  })

  if (rowTexts.length === 0) return { headers: [], rows: [] }

  const [headerRow, ...dataRows] = rowTexts
  const columns = headerRow
    .map((header, index) => ({ header, index }))
    .filter((column) => column.header.length > 0)

  return {
    headers: columns.map((column) => column.header),
    rows: dataRows.map((cells) => {
      const row: Record<string, string> = {}
      for (const { header, index } of columns) row[header] = cells[index] ?? ''
      return row
    })
  }
}
