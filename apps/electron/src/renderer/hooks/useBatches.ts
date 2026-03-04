/**
 * useBatches
 *
 * Encapsulates all batch state management:
 * - Loading batches from IPC
 * - Start, pause, resume handlers
 * - Real-time progress updates (called from App.tsx event handler)
 * - Syncing batches to Jotai atom for cross-component access
 */

import { useState, useCallback, useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { toast } from 'sonner'
import { batchesAtom } from '@/atoms/batches'
import type { BatchListItem } from '@/components/batches/types'
import type { BatchProgress, BatchState } from '@craft-agent/shared/batches'

export interface UseBatchesResult {
  batches: BatchListItem[]
  handleStartBatch: (batchId: string) => void
  handlePauseBatch: (batchId: string) => void
  handleResumeBatch: (batchId: string) => void
  getBatchState: (batchId: string) => Promise<BatchState | null>
  updateBatchProgress: (progress: BatchProgress) => void
  handleBatchComplete: (batchId: string) => void
}

export function useBatches(
  activeWorkspaceId: string | null | undefined,
): UseBatchesResult {
  const [batches, setBatches] = useState<BatchListItem[]>([])

  // Sync batches to Jotai atom for cross-component access (MainContentPanel)
  const setBatchesAtom = useSetAtom(batchesAtom)
  useEffect(() => {
    setBatchesAtom(batches)
  }, [batches, setBatchesAtom])

  // Load batches from IPC
  const loadBatches = useCallback(async () => {
    if (!activeWorkspaceId) return
    try {
      const items = await window.electronAPI.listBatches(activeWorkspaceId)
      setBatches(items)
    } catch {
      setBatches([])
    }
  }, [activeWorkspaceId])

  // Initial load
  useEffect(() => {
    loadBatches()
  }, [loadBatches])

  // Update a single batch's progress in the list
  const updateBatchProgress = useCallback((progress: BatchProgress) => {
    setBatches(prev => prev.map(b =>
      b.id === progress.batchId ? { ...b, progress } : b
    ))
  }, [])

  // Handle batch completion - reload the full list
  const handleBatchComplete = useCallback((_batchId: string) => {
    loadBatches()
  }, [loadBatches])

  // Start a batch
  const handleStartBatch = useCallback((batchId: string) => {
    if (!activeWorkspaceId) return
    window.electronAPI.startBatch(activeWorkspaceId, batchId)
      .then((progress) => {
        updateBatchProgress(progress)
        toast.success('Batch started')
      })
      .catch((err: Error) => {
        toast.error(`Failed to start batch: ${err.message}`)
      })
  }, [activeWorkspaceId, updateBatchProgress])

  // Pause a batch
  const handlePauseBatch = useCallback((batchId: string) => {
    if (!activeWorkspaceId) return
    window.electronAPI.pauseBatch(activeWorkspaceId, batchId)
      .then((progress) => {
        updateBatchProgress(progress)
        toast.success('Batch paused')
      })
      .catch((err: Error) => {
        toast.error(`Failed to pause batch: ${err.message}`)
      })
  }, [activeWorkspaceId, updateBatchProgress])

  // Resume a batch
  const handleResumeBatch = useCallback((batchId: string) => {
    if (!activeWorkspaceId) return
    window.electronAPI.resumeBatch(activeWorkspaceId, batchId)
      .then((progress) => {
        updateBatchProgress(progress)
        toast.success('Batch resumed')
      })
      .catch((err: Error) => {
        toast.error(`Failed to resume batch: ${err.message}`)
      })
  }, [activeWorkspaceId, updateBatchProgress])

  // Get full batch state (with items)
  const getBatchState = useCallback(async (batchId: string): Promise<BatchState | null> => {
    if (!activeWorkspaceId) return null
    try {
      return await window.electronAPI.getBatchState(activeWorkspaceId, batchId)
    } catch {
      return null
    }
  }, [activeWorkspaceId])

  return {
    batches,
    handleStartBatch,
    handlePauseBatch,
    handleResumeBatch,
    getBatchState,
    updateBatchProgress,
    handleBatchComplete,
  }
}
