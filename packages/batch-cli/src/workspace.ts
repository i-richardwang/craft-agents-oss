/**
 * Workspace root resolution for batch-cli.
 *
 * Resolution order:
 * 1. --workspace-root <path> CLI flag (explicit)
 * 2. CRAFT_AGENT_WORKSPACE_ROOT env var
 * 3. Walk up from CWD looking for batches.json or .craft-agent/ dir
 * 4. Fall back to CWD
 */

import { existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

export function resolveWorkspaceRoot(explicitFlag?: string): string {
  if (explicitFlag) {
    return resolve(explicitFlag)
  }

  const envVar = process.env['CRAFT_AGENT_WORKSPACE_ROOT']
  if (envVar) {
    return resolve(envVar)
  }

  // Walk up from CWD
  let dir = process.cwd()
  while (true) {
    if (existsSync(join(dir, 'batches.json')) || existsSync(join(dir, '.craft-agent'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return process.cwd()
}
