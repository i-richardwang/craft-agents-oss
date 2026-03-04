/**
 * Batches Atom
 *
 * Simple atom for storing batch list items.
 * AppShell populates this when batches are loaded from the workspace.
 * MainContentPanel reads from it for batch detail display.
 */

import { atom } from 'jotai'
import type { BatchListItem } from '../components/batches/types'

/**
 * Atom to store the current workspace's batches.
 */
export const batchesAtom = atom<BatchListItem[]>([])
