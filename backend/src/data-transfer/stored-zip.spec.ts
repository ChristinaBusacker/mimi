import { describe, expect, it } from 'vitest';
import { storedZip, type StoredZipEntry } from './stored-zip';

async function archive(entries: StoredZipEntry[]): Promise<Buffer> {
  async function* sources(): AsyncGenerator<StoredZipEntry> { yield* entries; }
  const parts: Buffer[] = [];
  for await (const chunk of storedZip(sources())) parts.push(Buffer.from(chunk));
  return Buffer.concat(parts);
}

describe('Composer ZIP writer', () => {
  it('writes a valid ZIP32 central directory with stored files and data descriptors', async () => {
    const zip = await archive([
      { name: 'assets/abc.png', chunks: [Buffer.from('binary\0content')] },
      { name: 'manifest.json', chunks: [Buffer.from('{"version":1}')] },
    ]);
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 10)).toBe(2);
    let cursor = zip.readUInt32LE(end + 16);
    const names: string[] = [];
    for (let i = 0; i < 2; i++) {
      expect(zip.readUInt32LE(cursor)).toBe(0x02014b50);
      const nameLength = zip.readUInt16LE(cursor + 28);
      names.push(zip.toString('utf8', cursor + 46, cursor + 46 + nameLength));
      cursor += 46 + nameLength + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
    }
    expect(names).toEqual(['assets/abc.png', 'manifest.json']);
  });

  it('rejects traversal paths and duplicate archive members', async () => {
    await expect(archive([{ name: '../evil', chunks: [] }])).rejects.toThrow('Unsafe ZIP entry');
    await expect(archive([
      { name: 'manifest.json', chunks: [] },
      { name: 'manifest.json', chunks: [] },
    ])).rejects.toThrow('Duplicate ZIP entry');
  });
});
