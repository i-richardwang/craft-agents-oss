/**
 * craft-agent batch list
 *
 * Lists all batches from batches.json with their status.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { BatchesFileConfigSchema, loadBatchState, computeProgress } from '@craft-agent/shared/batches'
import { printTable, colorStatus, colors as c } from '../format.ts'

export function cmdList(workspaceRoot: string, asJson: boolean): void {
  const configPath = join(workspaceRoot, 'batches.json')

  if (!existsSync(configPath)) {
    if (asJson) {
      console.log(JSON.stringify([]))
    } else {
      console.log(c.dim + 'No batches.json found in workspace.' + c.reset)
    }
    return
  }

  let raw: string
  try {
    raw = readFileSync(configPath, 'utf-8')
  } catch (e) {
    console.error('Error reading batches.json:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  const parsed = BatchesFileConfigSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    console.error('Invalid batches.json:', parsed.error.message)
    process.exit(1)
  }

  const { batches } = parsed.data

  if (asJson) {
    const out = batches.map(b => {
      const state = b.id ? loadBatchState(workspaceRoot, b.id) : null
      const progress = state ? computeProgress(state) : null
      return {
        id: b.id ?? '',
        name: b.name,
        enabled: b.enabled ?? true,
        status: state?.status ?? 'not started',
        total: progress?.totalItems ?? 0,
        completed: progress?.completedItems ?? 0,
        failed: progress?.failedItems ?? 0,
      }
    })
    console.log(JSON.stringify(out, null, 2))
    return
  }

  const rows = batches.map(b => {
    const state = b.id ? loadBatchState(workspaceRoot, b.id) : null
    const progress = state ? computeProgress(state) : null
    const status = state?.status ?? 'not started'
    const items = progress ? `${progress.completedItems}/${progress.totalItems}` : '-'
    const enabled = (b.enabled ?? true) ? 'yes' : 'no'
    return [b.id ?? '-', b.name, enabled, colorStatus(status), items]
  })

  printTable(['ID', 'NAME', 'ENABLED', 'STATUS', 'ITEMS'], rows)
}
