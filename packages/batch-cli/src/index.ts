#!/usr/bin/env bun
/**
 * craft-agent-batch CLI
 *
 * Standalone binary for batch processing commands.
 * Named craft-agent-batch to avoid conflicting with the private craft-agent CLI
 * that handles other domains (label, source, skill, automation, etc.).
 */

import { resolveWorkspaceRoot } from './workspace.ts'
import { cmdList } from './commands/list.ts'
import { cmdGet } from './commands/get.ts'
import { cmdValidate } from './commands/validate.ts'
import { cmdStatus } from './commands/status.ts'
import { cmdCreate } from './commands/create.ts'
import { cmdUpdate } from './commands/update.ts'
import { cmdEnable, cmdDisable } from './commands/enable.ts'
import { cmdDelete } from './commands/delete.ts'

const VERSION = '0.7.2'

const HELP = `
craft-agent-batch — Batch processing CLI

USAGE
  craft-agent-batch <command> [options]

COMMANDS
  list                          List all batches
  get <id>                      Show full config for a batch
  validate                      Validate batches.json
  status <id> [--items]         Show progress for a batch
  create --name ... --source ... --id-field ... --prompt ...
                                Create a new batch
  update <id> --json <json>     Patch an existing batch
  enable <id>                   Enable a batch
  disable <id>                  Disable a batch
  delete <id>                   Delete a batch

GLOBAL OPTIONS
  --workspace-root <path>       Explicit workspace root (default: auto-detect)
  --json                        Machine-readable JSON output
  --help, -h                    Show this help
  --version, -v                 Show version

EXAMPLES
  craft-agent-batch list
  craft-agent-batch get abc123
  craft-agent-batch validate
  craft-agent-batch status abc123 --items
  craft-agent-batch create --name "My batch" --source data.csv --id-field id --prompt "Process \$BATCH_ITEM_id"
  craft-agent-batch update abc123 --json '{"enabled":false}'
  craft-agent-batch enable abc123
  craft-agent-batch disable abc123
  craft-agent-batch delete abc123
`.trim()

const CREATE_HELP = `
craft-agent-batch create — Create a new batch

USAGE
  craft-agent-batch create [options]

REQUIRED
  --name <name>                 Display name for the batch
  --source <path>               Path to data source file (.csv, .json, .jsonl)
  --id-field <field>            Field name to use as unique item identifier
  --prompt <template>           Prompt template (use \$BATCH_ITEM_<field> placeholders)

OPTIONAL
  --concurrency <n>             Max concurrent sessions (default: 3)
  --model <id>                  Model ID for created sessions
  --connection <slug>           LLM connection slug
  --permission-mode <mode>      safe | ask | allow-all
  --label <label>               Label to apply (repeatable)
  --json                        Output created batch as JSON
`.trim()

function parseArgs(argv: string[]): {
  subcommand: string | undefined
  args: string[]
  flags: Record<string, string | boolean | string[]>
} {
  const args: string[] = []
  const flags: Record<string, string | boolean | string[]> = {}
  let i = 0

  while (i < argv.length) {
    const arg = argv[i]!
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const nextArg = argv[i + 1]
      if (nextArg !== undefined && !nextArg.startsWith('-')) {
        // Multi-value flags (--label can be repeated)
        if (key === 'label') {
          const existing = flags[key]
          if (Array.isArray(existing)) {
            existing.push(nextArg)
          } else {
            flags[key] = [nextArg]
          }
        } else {
          flags[key] = nextArg
        }
        i += 2
      } else {
        flags[key] = true
        i++
      }
    } else if (arg === '-h' || arg === '--help') {
      flags['help'] = true
      i++
    } else if (arg === '-v' || arg === '--version') {
      flags['version'] = true
      i++
    } else {
      args.push(arg)
      i++
    }
  }

  const [subcommand, ...rest] = args
  return { subcommand, args: rest, flags }
}

function main(): void {
  const rawArgs = process.argv.slice(2)
  const { subcommand, args, flags } = parseArgs(rawArgs)

  // Global flags
  if (flags['version']) {
    console.log(VERSION)
    return
  }

  if (!subcommand || flags['help']) {
    console.log(HELP)
    return
  }

  const workspaceRoot = resolveWorkspaceRoot(
    typeof flags['workspace-root'] === 'string' ? flags['workspace-root'] : undefined
  )
  const asJson = flags['json'] === true

  switch (subcommand) {
    case 'list':
      cmdList(workspaceRoot, asJson)
      break

    case 'get': {
      const id = args[0]
      if (!id) {
        console.error('Usage: craft-agent-batch get <id>')
        process.exit(1)
      }
      cmdGet(workspaceRoot, id, asJson)
      break
    }

    case 'validate':
      cmdValidate(workspaceRoot, asJson)
      break

    case 'status': {
      const id = args[0]
      if (!id) {
        console.error('Usage: craft-agent-batch status <id> [--items]')
        process.exit(1)
      }
      const showItems = flags['items'] === true
      cmdStatus(workspaceRoot, id, showItems, asJson)
      break
    }

    case 'create': {
      if (flags['help']) {
        console.log(CREATE_HELP)
        break
      }
      const name = flags['name']
      const source = flags['source']
      const idField = flags['id-field']
      const prompt = flags['prompt']
      if (!name || !source || !idField || !prompt ||
          typeof name !== 'string' || typeof source !== 'string' ||
          typeof idField !== 'string' || typeof prompt !== 'string') {
        console.error('Missing required flags: --name, --source, --id-field, --prompt')
        console.error('Run: craft-agent-batch create --help')
        process.exit(1)
      }

      const concurrencyRaw = flags['concurrency']
      const concurrency = typeof concurrencyRaw === 'string' ? parseInt(concurrencyRaw, 10) : undefined

      const permModeRaw = flags['permission-mode']
      const validModes = ['safe', 'ask', 'allow-all'] as const
      type PermMode = typeof validModes[number]
      const permissionMode = (typeof permModeRaw === 'string' && validModes.includes(permModeRaw as PermMode))
        ? permModeRaw as PermMode
        : undefined

      const labelFlag = flags['label']
      const labels = Array.isArray(labelFlag) ? labelFlag : (typeof labelFlag === 'string' ? [labelFlag] : undefined)

      cmdCreate(workspaceRoot, {
        name,
        source,
        idField,
        prompt,
        concurrency,
        model: typeof flags['model'] === 'string' ? flags['model'] : undefined,
        connection: typeof flags['connection'] === 'string' ? flags['connection'] : undefined,
        permissionMode,
        labels,
      }, asJson)
      break
    }

    case 'update': {
      const id = args[0]
      const json = flags['json']
      if (!id || typeof json !== 'string') {
        console.error('Usage: craft-agent-batch update <id> --json <json>')
        process.exit(1)
      }
      // Temporarily clear asJson since --json is used for the patch payload here
      cmdUpdate(workspaceRoot, id, json, false)
      break
    }

    case 'enable': {
      const id = args[0]
      if (!id) {
        console.error('Usage: craft-agent-batch enable <id>')
        process.exit(1)
      }
      cmdEnable(workspaceRoot, id, asJson)
      break
    }

    case 'disable': {
      const id = args[0]
      if (!id) {
        console.error('Usage: craft-agent-batch disable <id>')
        process.exit(1)
      }
      cmdDisable(workspaceRoot, id, asJson)
      break
    }

    case 'delete': {
      const id = args[0]
      if (!id) {
        console.error('Usage: craft-agent-batch delete <id>')
        process.exit(1)
      }
      cmdDelete(workspaceRoot, id, asJson)
      break
    }

    default:
      console.error(`Unknown subcommand: ${subcommand}`)
      console.error('')
      console.error('Run: craft-agent-batch --help')
      process.exit(1)
  }
}

main()
