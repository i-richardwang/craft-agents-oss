/**
 * craft-agent batch create
 *
 * Create a new batch and append it to batches.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { BatchesFileConfigSchema, validateBatchesContent } from '@craft-agent/shared/batches'
import type { BatchConfig } from '@craft-agent/shared/batches'
import { colors as c } from '../format.ts'

interface CreateOptions {
  name: string
  source: string
  idField: string
  prompt: string
  concurrency?: number
  model?: string
  connection?: string
  permissionMode?: 'safe' | 'ask' | 'allow-all'
  labels?: string[]
}

export function cmdCreate(workspaceRoot: string, opts: CreateOptions, asJson: boolean): void {
  const configPath = join(workspaceRoot, 'batches.json')

  let existing: { version?: number; batches: BatchConfig[] } = { batches: [] }
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = BatchesFileConfigSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.error('Invalid existing batches.json:', parsed.error.message)
      process.exit(1)
    }
    existing = parsed.data
  }

  const id = randomBytes(3).toString('hex')

  // Infer source type from extension
  const ext = opts.source.split('.').pop()?.toLowerCase() ?? 'csv'
  const sourceType = (['csv', 'json', 'jsonl'].includes(ext) ? ext : 'csv') as 'csv' | 'json' | 'jsonl'

  const newBatch: BatchConfig = {
    id,
    name: opts.name,
    enabled: true,
    source: {
      type: sourceType,
      path: opts.source,
      idField: opts.idField,
    },
    action: {
      type: 'prompt',
      prompt: opts.prompt,
      ...(opts.labels && opts.labels.length > 0 ? { labels: opts.labels } : {}),
    },
  }

  if (opts.concurrency !== undefined || opts.model || opts.connection || opts.permissionMode) {
    newBatch.execution = {
      ...(opts.concurrency !== undefined ? { maxConcurrency: opts.concurrency } : {}),
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.connection ? { llmConnection: opts.connection } : {}),
      ...(opts.permissionMode ? { permissionMode: opts.permissionMode } : {}),
    }
  }

  const updated = { ...existing, batches: [...existing.batches, newBatch] }
  const json = JSON.stringify(updated, null, 2)

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
    console.log(JSON.stringify(newBatch, null, 2))
  } else {
    console.log(c.green + `✓ Created batch "${opts.name}" (id: ${id})` + c.reset)
  }
}
