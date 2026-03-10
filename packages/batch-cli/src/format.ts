/**
 * Output formatting helpers for batch-cli.
 */

const isTTY = process.stdout.isTTY

// ANSI colors (only when TTY)
const c = {
  reset: isTTY ? '\x1b[0m' : '',
  bold: isTTY ? '\x1b[1m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  red: isTTY ? '\x1b[31m' : '',
  cyan: isTTY ? '\x1b[36m' : '',
  blue: isTTY ? '\x1b[34m' : '',
  gray: isTTY ? '\x1b[90m' : '',
}

export { c as colors }

/** Print a simple aligned table. headers and rows must have same column count. */
export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log(c.dim + '(no items)' + c.reset)
    return
  }

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] ?? '').length))
  )

  const sep = '  '
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i]!)).join(sep)
  const divider = colWidths.map(w => '-'.repeat(w)).join(sep)

  console.log(c.bold + headerLine + c.reset)
  console.log(c.dim + divider + c.reset)
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(colWidths[i]!)).join(sep))
  }
}

/** Render a simple progress bar. */
export function progressBar(done: number, total: number, width = 20): string {
  if (total === 0) return '[' + ' '.repeat(width) + ']'
  const filled = Math.round((done / total) * width)
  return '[' + '='.repeat(filled) + ' '.repeat(width - filled) + ']'
}

/** Color a status string. */
export function colorStatus(status: string): string {
  switch (status) {
    case 'completed': return c.green + status + c.reset
    case 'failed':
    case 'skipped': return c.red + status + c.reset
    case 'running': return c.cyan + status + c.reset
    case 'pending': return c.dim + status + c.reset
    case 'paused': return c.yellow + status + c.reset
    default: return status
  }
}
