import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadBatchItems } from './data-source.ts'
import type { BatchSource } from './types.ts'

describe('loadBatchItems', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'batch-data-source-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // =========================================================================
  // CSV
  // =========================================================================

  describe('CSV', () => {
    it('should parse basic CSV', () => {
      writeFileSync(join(tempDir, 'data.csv'), 'id,name,url\n1,Acme,https://acme.com\n2,Beta,https://beta.com\n')
      const items = loadBatchItems({ type: 'csv', path: 'data.csv', idField: 'id' }, tempDir)
      expect(items).toHaveLength(2)
      expect(items[0]!.id).toBe('1')
      expect(items[0]!.fields).toEqual({ id: '1', name: 'Acme', url: 'https://acme.com' })
      expect(items[1]!.id).toBe('2')
    })

    it('should handle quoted fields with commas', () => {
      writeFileSync(join(tempDir, 'data.csv'), 'id,name,desc\n1,"Acme, Inc.","A big company"\n')
      const items = loadBatchItems({ type: 'csv', path: 'data.csv', idField: 'id' }, tempDir)
      expect(items[0]!.fields.name).toBe('Acme, Inc.')
      expect(items[0]!.fields.desc).toBe('A big company')
    })

    it('should handle escaped quotes in CSV', () => {
      writeFileSync(join(tempDir, 'data.csv'), 'id,name\n1,"Say ""hello"""\n')
      const items = loadBatchItems({ type: 'csv', path: 'data.csv', idField: 'id' }, tempDir)
      expect(items[0]!.fields.name).toBe('Say "hello"')
    })

    it('should handle multiline quoted fields', () => {
      writeFileSync(join(tempDir, 'data.csv'), 'id,desc\n1,"line1\nline2"\n2,simple\n')
      const items = loadBatchItems({ type: 'csv', path: 'data.csv', idField: 'id' }, tempDir)
      expect(items).toHaveLength(2)
      expect(items[0]!.fields.desc).toBe('line1\nline2')
      expect(items[1]!.fields.desc).toBe('simple')
    })

    it('should skip empty lines', () => {
      writeFileSync(join(tempDir, 'data.csv'), 'id,name\n1,A\n\n2,B\n\n')
      const items = loadBatchItems({ type: 'csv', path: 'data.csv', idField: 'id' }, tempDir)
      expect(items).toHaveLength(2)
    })

    it('should handle CRLF line endings', () => {
      writeFileSync(join(tempDir, 'data.csv'), 'id,name\r\n1,A\r\n2,B\r\n')
      const items = loadBatchItems({ type: 'csv', path: 'data.csv', idField: 'id' }, tempDir)
      expect(items).toHaveLength(2)
    })
  })

  // =========================================================================
  // JSON
  // =========================================================================

  describe('JSON', () => {
    it('should parse JSON array', () => {
      writeFileSync(join(tempDir, 'data.json'), JSON.stringify([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ]))
      const items = loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)
      expect(items).toHaveLength(2)
      expect(items[0]!.id).toBe('a')
      expect(items[0]!.fields.name).toBe('Alpha')
    })

    it('should coerce non-string values to strings', () => {
      writeFileSync(join(tempDir, 'data.json'), JSON.stringify([
        { id: 'a', count: 42, active: true, extra: null },
      ]))
      const items = loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)
      expect(items[0]!.fields.count).toBe('42')
      expect(items[0]!.fields.active).toBe('true')
      expect(items[0]!.fields.extra).toBe('')
    })

    it('should throw for non-array JSON', () => {
      writeFileSync(join(tempDir, 'data.json'), '{"id": "a"}')
      expect(() => loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)).toThrow('must be an array')
    })

    it('should throw for non-object items', () => {
      writeFileSync(join(tempDir, 'data.json'), '["a", "b"]')
      expect(() => loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)).toThrow('must be an object')
    })
  })

  // =========================================================================
  // JSONL
  // =========================================================================

  describe('JSONL', () => {
    it('should parse JSONL', () => {
      writeFileSync(join(tempDir, 'data.jsonl'), '{"id":"a","name":"Alpha"}\n{"id":"b","name":"Beta"}\n')
      const items = loadBatchItems({ type: 'jsonl', path: 'data.jsonl', idField: 'id' }, tempDir)
      expect(items).toHaveLength(2)
      expect(items[0]!.id).toBe('a')
    })

    it('should skip empty lines in JSONL', () => {
      writeFileSync(join(tempDir, 'data.jsonl'), '{"id":"a"}\n\n{"id":"b"}\n\n')
      const items = loadBatchItems({ type: 'jsonl', path: 'data.jsonl', idField: 'id' }, tempDir)
      expect(items).toHaveLength(2)
    })

    it('should throw for invalid JSON lines', () => {
      writeFileSync(join(tempDir, 'data.jsonl'), '{"id":"a"}\nnot json\n')
      expect(() => loadBatchItems({ type: 'jsonl', path: 'data.jsonl', idField: 'id' }, tempDir)).toThrow('Invalid JSON at line 2')
    })
  })

  // =========================================================================
  // ID Field Validation
  // =========================================================================

  describe('idField validation', () => {
    it('should throw for missing idField', () => {
      writeFileSync(join(tempDir, 'data.json'), JSON.stringify([{ name: 'A' }]))
      expect(() => loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)).toThrow('missing idField "id"')
    })

    it('should throw for empty idField value', () => {
      writeFileSync(join(tempDir, 'data.json'), JSON.stringify([{ id: '' }]))
      expect(() => loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)).toThrow('empty idField')
    })

    it('should throw for duplicate idField values', () => {
      writeFileSync(join(tempDir, 'data.json'), JSON.stringify([{ id: 'a' }, { id: 'a' }]))
      expect(() => loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)).toThrow('Duplicate idField value "a"')
    })

    it('should throw for empty data source', () => {
      writeFileSync(join(tempDir, 'data.json'), '[]')
      expect(() => loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)).toThrow('empty')
    })
  })

  // =========================================================================
  // Path Resolution
  // =========================================================================

  describe('path resolution', () => {
    it('should resolve relative paths from workspace root', () => {
      writeFileSync(join(tempDir, 'data.json'), JSON.stringify([{ id: 'a' }]))
      const items = loadBatchItems({ type: 'json', path: 'data.json', idField: 'id' }, tempDir)
      expect(items).toHaveLength(1)
    })

    it('should support absolute paths', () => {
      const absPath = join(tempDir, 'data.json')
      writeFileSync(absPath, JSON.stringify([{ id: 'a' }]))
      const items = loadBatchItems({ type: 'json', path: absPath, idField: 'id' }, tempDir)
      expect(items).toHaveLength(1)
    })

    it('should throw for non-existent file', () => {
      expect(() => loadBatchItems({ type: 'json', path: 'missing.json', idField: 'id' }, tempDir)).toThrow()
    })
  })
})
