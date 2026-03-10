/**
 * craft-agent batch status <id> [--items]
 *
 * Show progress for a batch by id.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { BatchesFileConfigSchema, loadBatchState, computeProgress } from '@craft-agent/shared/batches'
import { progressBar, colorStatus, printTable, colors as c } from '../format.ts'
import { findBatch } from './get.ts'

export function cmdStatus(workspaceRoot: string, idOrName: string, showItems: boolean, asJson: boolean): void {
  const configPath = join(workspaceRoot, 'batches.json')
  if (!existsSync(configPath)) {
    console.error('No batches.json found in workspace.')
    process.exit(1)
  }

  const raw = readFileSync(configPath, 'utf-8')
  const parsed = BatchesFileConfigSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    console.error('Invalid batches.json:', parsed.error.message)
    process.exit(1)
  }

  const batch = findBatch(parsed.data.batches, idOrName)
  if (!batch) {
    console.error(`Batch not found: ${idOrName}`)
    process.exit(1)
  }

  const batchId = batch.id
  if (!batchId) {
    console.error('Batch has no id — cannot load state.')
    process.exit(1)
  }

  const state = loadBatchState(workspaceRoot, batchId)
  if (!state) {
    if (asJson) {
      console.log(JSON.stringify({ id: batchId, status: 'not started' }))
    } else {
      console.log(`Batch ${c.bold}${batchId}${c.reset} has not been started yet.`)
    }
    return
  }

  const progress = computeProgress(state)

  if (asJson) {
    const out: Record<string, unknown> = { ...progress }
    if (showItems) {
      out['items'] = state.items
    }
    console.log(JSON.stringify(out, null, 2))
    return
  }

  const bar = progressBar(progress.completedItems, progress.totalItems)
  const pct = progress.totalItems > 0
    ? Math.round((progress.completedItems / progress.totalItems) * 100)
    : 0

  console.log(`${c.bold}${batch.name}${c.reset} (${batchId})`)
  console.log(`Status:    ${colorStatus(progress.status)}`)
  console.log(`Progress:  ${bar} ${pct}% (${progress.completedItems}/${progress.totalItems})`)
  console.log(`Completed: ${c.green}${progress.completedItems}${c.reset}  Failed: ${c.red}${progress.failedItems}${c.reset}  Running: ${c.cyan}${progress.runningItems}${c.reset}  Pending: ${c.dim}${progress.pendingItems}${c.reset}`)

  if (showItems) {
    console.log('')
    const rows = Object.entries(state.items).map(([id, item]) => [
      id,
      colorStatus(item.status),
      item.sessionId ?? '-',
      item.error ?? '',
    ])
    printTable(['ITEM ID', 'STATUS', 'SESSION', 'ERROR'], rows)
  }
}
