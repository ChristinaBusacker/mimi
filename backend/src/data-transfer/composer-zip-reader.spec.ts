import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storedZip } from './stored-zip';
import { ComposerZipReader } from './composer-zip-reader';

async function makeZip(changes?: (bytes: Buffer) => void) {
  const directory = await mkdtemp(join(tmpdir(), 'mimi-import-test-'));
  const path = join(directory, 'test.zip');
  const parts: Buffer[] = [];
  const stream = storedZip((async function* () {
    yield { name: 'assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png', chunks: [Buffer.from('hello')] };
    yield { name: 'manifest.json', chunks: [Buffer.from('{"format":"mimi-composer-archive","version":1}')] };
  })());
  for await (const chunk of stream) parts.push(Buffer.from(chunk));
  const bytes = Buffer.concat(parts);
  changes?.(bytes);
  await writeFile(path, bytes);
  return { path, directory };
}

describe('Composer ZIP reader', () => {
  it('reads the native streamed ZIP and verifies CRC', async () => {
    const { path, directory } = await makeZip();
    try {
      const zip = await ComposerZipReader.open(path);
      expect(zip.names()).toContain('manifest.json');
      expect((await zip.bytes('assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png')).toString()).toBe('hello');
      expect(await zip.sha256('assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png')).toHaveLength(64);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it('rejects corruption even when the ZIP index still parses', async () => {
    const { path, directory } = await makeZip((data) => {
      const index = data.indexOf(Buffer.from('hello'));
      data[index] ^= 0xff;
    });
    try {
      const zip = await ComposerZipReader.open(path);
      await expect(zip.bytes('assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png')).rejects.toThrow('CRC32');
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
