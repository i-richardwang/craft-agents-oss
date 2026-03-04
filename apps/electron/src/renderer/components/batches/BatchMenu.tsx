/**
 * BatchMenu - Menu content for batch actions
 *
 * Shows Start/Pause/Resume actions based on batch status.
 * Uses MenuComponents context for dropdown/context menu rendering.
 */

import { Play, Pause, RotateCcw } from 'lucide-react'
import { useMenuComponents } from '@/components/ui/menu-context'
import type { BatchStatus } from '@craft-agent/shared/batches'

export interface BatchMenuProps {
  batchId: string
  status?: BatchStatus
  onStart?: () => void
  onPause?: () => void
  onResume?: () => void
}

export function BatchMenu({
  batchId,
  status = 'pending',
  onStart,
  onPause,
  onResume,
}: BatchMenuProps) {
  const { MenuItem } = useMenuComponents()

  return (
    <>
      {/* Start - available when pending, completed, or failed */}
      {(status === 'pending' || status === 'completed' || status === 'failed') && onStart && (
        <MenuItem onClick={onStart}>
          <Play className="h-3.5 w-3.5" />
          <span className="flex-1">Start</span>
        </MenuItem>
      )}

      {/* Pause - available when running */}
      {status === 'running' && onPause && (
        <MenuItem onClick={onPause}>
          <Pause className="h-3.5 w-3.5" />
          <span className="flex-1">Pause</span>
        </MenuItem>
      )}

      {/* Resume - available when paused */}
      {status === 'paused' && onResume && (
        <MenuItem onClick={onResume}>
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="flex-1">Resume</span>
        </MenuItem>
      )}
    </>
  )
}
