/**
 * Batch UI Types
 *
 * UI-specific types for the batches components.
 */

import type { BatchConfig, BatchProgress, BatchStatus } from '@craft-agent/shared/batches'

// ============================================================================
// List Item
// ============================================================================

/** A batch config enriched with live progress data for list display. */
export type BatchListItem = BatchConfig & { progress?: BatchProgress }

// ============================================================================
// Filter
// ============================================================================

export type BatchFilterKind = 'all' | 'pending' | 'running' | 'paused' | 'completed' | 'failed'

export interface BatchListFilter {
  kind: BatchFilterKind
}

/** Maps batch status to filter kind */
export const BATCH_STATUS_TO_FILTER_KIND: Record<string, BatchFilterKind> = {
  pending: 'pending',
  running: 'running',
  paused: 'paused',
  completed: 'completed',
  failed: 'failed',
}

// ============================================================================
// Display Names & Colors
// ============================================================================

export const BATCH_STATUS_DISPLAY: Record<BatchStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
}

export const BATCH_STATUS_COLOR: Record<BatchStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-foreground/8', text: 'text-foreground/60' },
  running: { bg: 'bg-info/10', text: 'text-info' },
  paused: { bg: 'bg-warning/10', text: 'text-warning' },
  completed: { bg: 'bg-success/10', text: 'text-success' },
  failed: { bg: 'bg-destructive/10', text: 'text-destructive' },
}
