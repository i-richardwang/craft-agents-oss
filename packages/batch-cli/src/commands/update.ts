/**
 * craft-agent batch update <id> --json <json>
 *
 * Deep-merge a JSON patch into an existing batch config.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { BatchesFileConfigSchema, validateBatchesContent } from '@craft-agent/shared/batches'
import { findBatch } from './get.ts'
import { colors as c } from '../format.ts'

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }
  for (const [key, val] of Object.entries(source)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val) &&
        typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, val as Record<string, unknown>)
    } else {
      result[key] = val
    }
  }
  return result
}

export function cmdUpdate(workspaceRoot: string, idOrName: string, patch: string, asJson: boolean): void {
  const configPath = join(workspaceRoot, 'batches.json')
  if (!existsSync(configPath)) {
    console.error('No batches.json found in workspace.')
    process.exit(1)
  }

  let patchObj: Record<string, unknown>
  try {
    patchObj = JSON.parse(patch)
  } catch {
    console.error('Invalid JSON patch:', patch)
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

  const updated = deepMerge(batch as unknown as Record<string, unknown>, patchObj)
  const newBatches = parsed.data.batches.map(b => (b === batch ? updated : b))
  const newConfig = { ...parsed.data, batches: newBatches }
  const json = JSON.stringify(newConfig, null, 2)

  const validation = validateBatchesContent(json)
  if (!validation.valid) {
    console.error('Validation failed:')
    for (const err of validation.errors) {
      console.error(c.red + `  ${err.path}: ${err.message}` + c.reset)
    }
    process.exit(1)
  }

  writeFileSync(configPath, json + '\n', 'utf-8')

  if (asJson) {
    console.log(JSON.stringify(updated, null, 2))
  } else {
    console.log(c.green + `✓ Updated batch "${batch.name}"` + c.reset)
  }
}
