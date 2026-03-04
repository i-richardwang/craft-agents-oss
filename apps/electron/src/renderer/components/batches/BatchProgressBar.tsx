/**
 * BatchProgressBar
 *
 * Segmented progress bar showing completed (green), failed (red), and running (blue, pulse).
 * Bottom text shows processed/total and percentage.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { BatchProgress } from '@craft-agent/shared/batches'

export interface BatchProgressBarProps {
  progress: BatchProgress
  className?: string
}

export function BatchProgressBar({ progress, className }: BatchProgressBarProps) {
  const { totalItems, completedItems, failedItems, runningItems } = progress

  if (totalItems === 0) return null

  const completedPct = (completedItems / totalItems) * 100
  const failedPct = (failedItems / totalItems) * 100
  const runningPct = (runningItems / totalItems) * 100
  const processed = completedItems + failedItems
  const overallPct = Math.round((processed / totalItems) * 100)

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Segmented bar */}
      <div className="h-2 rounded-full bg-foreground/8 overflow-hidden flex">
        {completedPct > 0 && (
          <div
            className="bg-success transition-all duration-300"
            style={{ width: `${completedPct}%` }}
          />
        )}
        {failedPct > 0 && (
          <div
            className="bg-destructive transition-all duration-300"
            style={{ width: `${failedPct}%` }}
          />
        )}
        {runningPct > 0 && (
          <div
            className="bg-info animate-pulse transition-all duration-300"
            style={{ width: `${runningPct}%` }}
          />
        )}
      </div>

      {/* Bottom text */}
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{processed} / {totalItems} items</span>
        <span>{overallPct}%</span>
      </div>
    </div>
  )
}
