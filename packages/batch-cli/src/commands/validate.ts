/**
 * craft-agent batch validate
 *
 * Validates batches.json in the workspace.
 */

import { validateBatches } from '@craft-agent/shared/batches'
import { colors as c } from '../format.ts'

export function cmdValidate(workspaceRoot: string, asJson: boolean): void {
  const result = validateBatches(workspaceRoot)

  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
    if (!result.valid) process.exit(1)
    return
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log(c.green + '✓ batches.json is valid' + c.reset)
    return
  }

  for (const err of result.errors) {
    const path = err.path ? ` [${err.path}]` : ''
    console.error(c.red + `✗ ${err.file}${path}: ${err.message}` + c.reset)
    if ('suggestion' in err && err.suggestion) {
      console.error(c.dim + `  → ${err.suggestion}` + c.reset)
    }
  }

  for (const warn of result.warnings) {
    const path = warn.path ? ` [${warn.path}]` : ''
    console.warn(c.yellow + `⚠ ${warn.file}${path}: ${warn.message}` + c.reset)
    if ('suggestion' in warn && warn.suggestion) {
      console.warn(c.dim + `  → ${warn.suggestion}` + c.reset)
    }
  }

  if (result.errors.length > 0) {
    process.exit(1)
  }
}
