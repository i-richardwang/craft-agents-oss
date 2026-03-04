/**
 * Batch Processor
 *
 * Core orchestrator for batch processing. Reads batch configurations,
 * loads data sources, manages concurrency, and dispatches items as
 * independent sessions via the onExecutePrompt callback.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { BATCHES_CONFIG_FILE, DEFAULT_MAX_CONCURRENCY, DEFAULT_MAX_RETRIES, BATCH_ITEM_ENV_PREFIX } from './constants.ts'
import { BatchesFileConfigSchema } from './schemas.ts'
import { loadBatchItems } from './data-source.ts'
import {
  loadBatchState,
  saveBatchState,
  createInitialBatchState,
  updateItemState,
  computeProgress,
  isBatchDone,
} from './batch-state-manager.ts'
import { expandEnvVars } from '../automations/utils.ts'
import { sanitizeForShell } from '../automations/security.ts'
import type {
  BatchConfig,
  BatchesFileConfig,
  BatchItem,
  BatchState,
  BatchProgress,
  BatchSystemOptions,
  BatchExecutePromptParams,
} from './types.ts'

export class BatchProcessor {
  private options: BatchSystemOptions

  /** Loaded batch items keyed by batchId → itemId → BatchItem */
  private batchItems: Map<string, Map<string, BatchItem>> = new Map()

  /** Active batch states keyed by batchId (in-memory mirror of persisted state) */
  private activeStates: Map<string, BatchState> = new Map()

  /** Reverse lookup: sessionId → { batchId, itemId } */
  private sessionToItem: Map<string, { batchId: string; itemId: string }> = new Map()

  constructor(options: BatchSystemOptions) {
    this.options = options
  }

  // ==========================================================================
  // Configuration Management
  // ==========================================================================

  /**
   * Load and validate batches.json from the workspace root.
   */
  loadConfig(): BatchesFileConfig | null {
    const configPath = join(this.options.workspaceRootPath, BATCHES_CONFIG_FILE)
    try {
      const content = readFileSync(configPath, 'utf-8')
      const raw = JSON.parse(content)
      const result = BatchesFileConfigSchema.safeParse(raw)
      if (!result.success) {
        this.options.onError?.('config', new Error(`Invalid batches.json: ${result.error.message}`))
        return null
      }

      // Auto-generate IDs for batches that don't have one
      for (const batch of result.data.batches) {
        if (!batch.id) {
          batch.id = randomBytes(3).toString('hex')
        }
      }

      return result.data as BatchesFileConfig
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null // No config file is fine
      }
      this.options.onError?.('config', error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  /**
   * Get a specific batch configuration by ID.
   */
  getBatchConfig(batchId: string): BatchConfig | undefined {
    const config = this.loadConfig()
    return config?.batches.find((b) => b.id === batchId)
  }

  /**
   * List all batch configurations with current progress.
   */
  listBatches(): Array<BatchConfig & { progress?: BatchProgress }> {
    const config = this.loadConfig()
    if (!config) return []

    return config.batches.map((batch) => {
      const state = this.activeStates.get(batch.id!) ?? loadBatchState(this.options.workspaceRootPath, batch.id!)
      return {
        ...batch,
        progress: state ? computeProgress(state) : undefined,
      }
    })
  }

  // ==========================================================================
  // Batch Lifecycle
  // ==========================================================================

  /**
   * Start a batch. Loads data, creates/resumes state, begins dispatching.
   */
  async start(batchId: string): Promise<BatchProgress> {
    const config = this.getBatchConfig(batchId)
    if (!config) {
      throw new Error(`Batch "${batchId}" not found in configuration`)
    }

    if (config.enabled === false) {
      throw new Error(`Batch "${batchId}" is disabled`)
    }

    // Load data source
    const items = loadBatchItems(config.source, this.options.workspaceRootPath)
    const itemMap = new Map<string, BatchItem>()
    for (const item of items) {
      itemMap.set(item.id, item)
    }
    this.batchItems.set(batchId, itemMap)

    // Create or resume state
    let state = loadBatchState(this.options.workspaceRootPath, batchId)

    if (state) {
      // Resume: mark running items back to pending (sessions may have been lost)
      for (const [itemId, itemState] of Object.entries(state.items)) {
        if (itemState.status === 'running') {
          updateItemState(state, itemId, { status: 'pending', sessionId: undefined })
        }
      }
      // Add any new items that appeared in the data source
      for (const item of items) {
        if (!(item.id in state.items)) {
          state.items[item.id] = { status: 'pending', retryCount: 0 }
          state.totalItems++
        }
      }
    } else {
      state = createInitialBatchState(batchId, items.map((i) => i.id))
    }

    state.status = 'running'
    state.startedAt = state.startedAt ?? Date.now()

    this.activeStates.set(batchId, state)
    saveBatchState(this.options.workspaceRootPath, state)

    // Start dispatching
    await this.dispatchNext(batchId)

    return computeProgress(state)
  }

  /**
   * Pause a batch. Running sessions continue but no new items are dispatched.
   */
  pause(batchId: string): BatchProgress {
    const state = this.activeStates.get(batchId)
    if (!state) {
      throw new Error(`Batch "${batchId}" is not active`)
    }

    state.status = 'paused'
    saveBatchState(this.options.workspaceRootPath, state)

    return computeProgress(state)
  }

  /**
   * Resume a paused batch.
   */
  async resume(batchId: string): Promise<BatchProgress> {
    const state = this.activeStates.get(batchId)
    if (!state) {
      throw new Error(`Batch "${batchId}" is not active`)
    }

    if (state.status !== 'paused') {
      throw new Error(`Batch "${batchId}" is not paused (status: ${state.status})`)
    }

    state.status = 'running'
    saveBatchState(this.options.workspaceRootPath, state)

    await this.dispatchNext(batchId)

    return computeProgress(state)
  }

  /**
   * Get progress for a batch.
   */
  getProgress(batchId: string): BatchProgress | null {
    const state = this.activeStates.get(batchId) ?? loadBatchState(this.options.workspaceRootPath, batchId)
    return state ? computeProgress(state) : null
  }

  /**
   * Get full state for a batch.
   */
  getState(batchId: string): BatchState | null {
    return this.activeStates.get(batchId) ?? loadBatchState(this.options.workspaceRootPath, batchId)
  }

  // ==========================================================================
  // Session Completion Callback
  // ==========================================================================

  /**
   * Handle session completion. Called by SessionManager when a session stops.
   * Returns true if the session belonged to a batch item.
   */
  onSessionComplete(sessionId: string, reason: 'complete' | 'interrupted' | 'error' | 'timeout'): boolean {
    const mapping = this.sessionToItem.get(sessionId)
    if (!mapping) return false

    const { batchId, itemId } = mapping
    const state = this.activeStates.get(batchId)
    if (!state) return false

    const config = this.getBatchConfig(batchId)
    const itemState = state.items[itemId]
    if (!itemState) return false

    if (reason === 'complete') {
      updateItemState(state, itemId, {
        status: 'completed',
        completedAt: Date.now(),
      })
    } else {
      // Check retry eligibility
      const shouldRetry = config?.execution?.retryOnFailure &&
        itemState.retryCount < (config.execution.maxRetries ?? DEFAULT_MAX_RETRIES)

      if (shouldRetry) {
        updateItemState(state, itemId, {
          status: 'pending',
          sessionId: undefined,
          retryCount: itemState.retryCount + 1,
          error: `${reason} (retry ${itemState.retryCount + 1})`,
        })
      } else {
        updateItemState(state, itemId, {
          status: 'failed',
          completedAt: Date.now(),
          error: reason,
        })
      }
    }

    this.sessionToItem.delete(sessionId)
    saveBatchState(this.options.workspaceRootPath, state)

    // Check completion
    if (isBatchDone(state)) {
      this.completeBatch(batchId)
    } else if (state.status === 'running') {
      // Dispatch next items to fill concurrency slots
      this.dispatchNext(batchId).catch((error) => {
        this.options.onError?.(batchId, error instanceof Error ? error : new Error(String(error)))
      })
    }

    // Notify progress
    const progress = computeProgress(state)
    this.options.onProgress?.(progress)

    return true
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  /**
   * Fill concurrency slots by dispatching pending items.
   */
  private async dispatchNext(batchId: string): Promise<void> {
    const state = this.activeStates.get(batchId)
    if (!state || state.status !== 'running') return

    const config = this.getBatchConfig(batchId)
    if (!config) return

    const maxConcurrency = config.execution?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY

    // Count currently running items
    let runningCount = 0
    for (const item of Object.values(state.items)) {
      if (item.status === 'running') runningCount++
    }

    // Find pending items and dispatch
    const pendingIds: string[] = []
    for (const [itemId, item] of Object.entries(state.items)) {
      if (item.status === 'pending') {
        pendingIds.push(itemId)
      }
    }

    const slotsAvailable = maxConcurrency - runningCount
    const toDispatch = pendingIds.slice(0, slotsAvailable)

    await Promise.allSettled(
      toDispatch.map((itemId) => this.dispatchItem(batchId, itemId, config))
    )
  }

  /**
   * Dispatch a single item: build env vars, expand prompt, create session.
   */
  private async dispatchItem(batchId: string, itemId: string, config: BatchConfig): Promise<void> {
    const state = this.activeStates.get(batchId)
    if (!state) return

    const itemMap = this.batchItems.get(batchId)
    const item = itemMap?.get(itemId)
    if (!item) {
      updateItemState(state, itemId, { status: 'skipped', error: 'Item not found in data source' })
      saveBatchState(this.options.workspaceRootPath, state)
      return
    }

    // Build environment variables from item fields
    const env = this.buildItemEnv(item)

    // Expand prompt template with item variables
    const expandedPrompt = expandEnvVars(config.action.prompt, env)

    // Mark as running
    updateItemState(state, itemId, {
      status: 'running',
      startedAt: Date.now(),
    })
    saveBatchState(this.options.workspaceRootPath, state)

    try {
      const params: BatchExecutePromptParams = {
        workspaceId: this.options.workspaceId,
        workspaceRootPath: this.options.workspaceRootPath,
        prompt: expandedPrompt,
        labels: config.action.labels,
        permissionMode: config.execution?.permissionMode,
        mentions: config.action.mentions,
        llmConnection: config.execution?.llmConnection,
        model: config.execution?.model,
      }

      const result = await this.options.onExecutePrompt(params)

      // Record session mapping for completion callback
      updateItemState(state, itemId, { sessionId: result.sessionId })
      this.sessionToItem.set(result.sessionId, { batchId, itemId })
      saveBatchState(this.options.workspaceRootPath, state)
    } catch (error) {
      updateItemState(state, itemId, {
        status: 'failed',
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      })
      saveBatchState(this.options.workspaceRootPath, state)
    }
  }

  /**
   * Build environment variables from a batch item's fields.
   * Each field becomes $BATCH_ITEM_{FIELD_NAME} with shell-safe values.
   */
  private buildItemEnv(item: BatchItem): Record<string, string> {
    const env: Record<string, string> = {}

    for (const [key, value] of Object.entries(item.fields)) {
      const envKey = `${BATCH_ITEM_ENV_PREFIX}${key.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`
      env[envKey] = sanitizeForShell(value)
    }

    // Also provide the item ID directly
    env[`${BATCH_ITEM_ENV_PREFIX}ID`] = sanitizeForShell(item.id)

    return env
  }

  /**
   * Mark a batch as completed and clean up active state.
   */
  private completeBatch(batchId: string): void {
    const state = this.activeStates.get(batchId)
    if (!state) return

    const progress = computeProgress(state)
    state.status = progress.failedItems > 0 ? 'failed' : 'completed'
    state.completedAt = Date.now()

    saveBatchState(this.options.workspaceRootPath, state)

    this.options.onBatchComplete?.(batchId, state.status)
    this.options.onProgress?.(computeProgress(state))
  }

  /**
   * Save all active batch states as paused. Called during cleanup.
   */
  dispose(): void {
    for (const [batchId, state] of this.activeStates) {
      if (state.status === 'running') {
        state.status = 'paused'
        saveBatchState(this.options.workspaceRootPath, state)
      }
    }
    this.activeStates.clear()
    this.sessionToItem.clear()
    this.batchItems.clear()
  }
}
