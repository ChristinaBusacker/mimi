import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { open, stat } from 'node:fs/promises';
import { updateCrc32 } from './stored-zip';

const MAX_BYTES = 512 * 1024 * 1024 + 16 * 1024 * 1024;
const MAX_ENTRIES = 252; // 250 original assets, manifest and a little headroom
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;

interface ZipEntry { name: string; offset: number; length: number; checksum: number }

function invalid(reason: string): never {
  throw new BadRequestException(`Ungültiges Composer-ZIP: ${reason}`);
}

/** Reads only ZIP32 STORED archives, as emitted by storedZip. Never extracts paths to disk. */
export class ComposerZipReader {
  private constructor(private readonly path: string, private readonly entries: Map<string, ZipEntry>) {}

  static async open(path: string): Promise<ComposerZipReader> {
    const size = (await stat(path)).size;
    if (size > MAX_BYTES) throw new PayloadTooLargeException('ZIP exceeds the 512 MiB archive limit.');
    if (size < 22) invalid('End-of-central-directory missing.');
    const file = await open(path, 'r');
    try {
      const end = await read(file, size - 22, 22);
      if (end.readUInt32LE(0) !== 0x06054b50 || end.readUInt16LE(20) !== 0 ||
          end.readUInt16LE(4) !== 0 || end.readUInt16LE(6) !== 0 ||
          end.readUInt16LE(8) !== end.readUInt16LE(10)) invalid('Unsupported ZIP directory.');
      const count = end.readUInt16LE(10);
      if (count > MAX_ENTRIES) throw new PayloadTooLargeException('Too many ZIP entries.');
      const dirLength = end.readUInt32LE(12);
      const dirOffset = end.readUInt32LE(16);
      if (dirOffset + dirLength !== size - 22) invalid('Central directory boundaries do not match.');
      const entries = new Map<string, ZipEntry>();
      let cursor = dirOffset;
      let previousEnd = 0;
      for (let index = 0; index < count; index++) {
        if (cursor + 46 > size - 22) invalid('Truncated central directory.');
        const header = await read(file, cursor, 46);
        if (header.readUInt32LE(0) !== 0x02014b50 || header.readUInt16LE(10) !== 0 ||
            header.readUInt32LE(20) !== header.readUInt32LE(24) ||
            header.readUInt16LE(8) !== 0x0808) invalid('Unsupported compression, flags or ZIP64.');
        const compressed = header.readUInt32LE(20);
        const nameSize = header.readUInt16LE(28);
        const extra = header.readUInt16LE(30);
        const comment = header.readUInt16LE(32);
        const localOffset = header.readUInt32LE(42);
        if (compressed > MAX_ENTRY_BYTES || (nameSize === 0 || nameSize > 200)) invalid('Entry too large or invalid name.');
        if (extra || comment || header.readUInt16LE(34) || header.readUInt16LE(36)) invalid('Unsupported ZIP metadata.');
        const name = (await read(file, cursor + 46, nameSize)).toString('utf8');
        if (!/^(?:manifest\.json|assets\/[a-z0-9-]{36}\.[a-z0-9]+)$/.test(name) || entries.has(name))
          invalid(`Unexpected or duplicate ZIP entry: ${name}`);
        const local = await read(file, localOffset, 30);
        if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== 0x0808 ||
            local.readUInt16LE(8) !== 0 || local.readUInt16LE(26) !== nameSize ||
            local.readUInt16LE(28) !== 0) invalid(`Invalid local header for ${name}.`);
        if ((await read(file, localOffset + 30, nameSize)).toString('utf8') !== name)
          invalid(`Local file name mismatch: ${name}`);
        const dataStart = localOffset + 30 + nameSize;
        const endPosition = dataStart + compressed + 16;
        if (endPosition > dirOffset || localOffset < previousEnd) invalid(`Invalid entry boundaries: ${name}`);
        const descriptor = await read(file, dataStart + compressed, 16);
        if (descriptor.readUInt32LE(0) !== 0x08074b50 ||
            descriptor.readUInt32LE(4) !== header.readUInt32LE(16) ||
            descriptor.readUInt32LE(8) !== compressed || descriptor.readUInt32LE(12) !== compressed)
          invalid(`Invalid checksum descriptor: ${name}`);
        entries.set(name, { name, offset: dataStart, length: compressed, checksum: header.readUInt32LE(16) });
        previousEnd = endPosition;
        cursor += 46 + nameSize;
      }
      if (cursor !== dirOffset + dirLength || !entries.has('manifest.json')) invalid('Missing manifest or invalid ZIP index.');
      if (entries.get('manifest.json')!.length > MAX_MANIFEST_BYTES) invalid('Manifest is too large.');
      return new ComposerZipReader(path, entries);
    } finally { await file.close(); }
  }

  names(): string[] { return [...this.entries.keys()]; }

  /** Bounded memory: reads one asset at a time, validates CRC32 before returning it. */
  async bytes(name: string): Promise<Buffer> {
    const entry = this.entries.get(name);
    if (!entry) invalid(`File not found in archive: ${name}`);
    const file = await open(this.path, 'r');
    try {
      const bytes = await read(file, entry.offset, entry.length);
      if (((updateCrc32(0xffffffff, bytes) ^ 0xffffffff) >>> 0) !== entry.checksum)
        invalid(`CRC32 mismatch: ${name}`);
      return bytes;
    } finally { await file.close(); }
  }

  async sha256(name: string): Promise<string> {
    return createHash('sha256').update(await this.bytes(name)).digest('hex');
  }
}

async function read(file: Awaited<ReturnType<typeof open>>, offset: number, length: number): Promise<Buffer> {
  const result = Buffer.allocUnsafe(length);
  let count = 0;
  while (count < length) {
    const { bytesRead } = await file.read(result, count, length - count, offset + count);
    if (!bytesRead) invalid('Unexpected end of ZIP file.');
    count += bytesRead;
  }
  return result;
}
