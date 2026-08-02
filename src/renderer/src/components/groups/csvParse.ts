// Dependency-free CSV parsing helper — the common case only, not full RFC4180
// (quoted fields must stay on a single physical line; newlines embedded inside a
// quoted field are not supported).
//
// Contract: whitespace-only/empty input returns { headers: [], rows: [] }. Input
// with a header line but no subsequent data lines returns the parsed `headers`
// with an empty `rows` array. Neither case is treated as an error here — the
// caller (CsvImportModal) decides how to surface "no headers" / "no data rows" as
// a user-facing error.
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}
