/**
 * Batch Test Tool (batch_test)
 *
 * Session-scoped tool that enables the agent to test a batch by running
 * a random sample of items. Blocks until all sampled items complete.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { TestBatchResult } from '../batches/types.ts';

export type BatchTestFn = (batchId: string, sampleSize?: number) => Promise<TestBatchResult>;

// Tool result type - matches what the SDK expects
type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

function errorResponse(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

export interface BatchTestToolOptions {
  sessionId: string;
  /**
   * Lazy resolver for the batch test callback.
   * Called at execution time to get the current callback from the session registry.
   */
  getBatchTestFn: () => BatchTestFn | undefined;
}

export function createBatchTestTool(options: BatchTestToolOptions) {
  return tool(
    'batch_test',
    `Test a batch by running a random sample of items before committing to a full run.

Use this to validate prompt quality, output schema, and overall workflow before processing all items.

Parameters:
- batchId (required): The batch ID to test
- sampleSize (optional): Number of random items to sample (default: 3)

The test runs real sessions with the same configuration as production, but:
- Only processes a random sample of items
- Writes output to a separate file: {output-path}.test.jsonl
- State tracked separately — does not affect production batch state
- Blocks until all sampled items complete`,
    {
      batchId: z.string().describe('The batch ID to test'),
      sampleSize: z.number().int().min(1).optional().describe('Number of random items to test (default: 3)'),
    },
    async (args) => {
      const testFn = options.getBatchTestFn();
      if (!testFn) {
        return errorResponse('batch_test is not available in this context.');
      }

      try {
        const result = await testFn(args.batchId, args.sampleSize);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        if (error instanceof Error) {
          return errorResponse(`batch_test failed: ${error.message}`);
        }
        throw error;
      }
    }
  );
}
