import { Readable } from 'node:stream';

/** ZIP32, stored entries (method 0), streamed via data descriptors. No extra npm dependency. */
export interface StoredZipEntry {
  name: string;
  chunks: AsyncIterable<Buffer> | Iterable<Buffer>;
  onChunk?: (chunk: Buffer) => void;
}

const TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});

export function updateCrc32(previous: number, bytes: Uint8Array): number {
  let crc = previous;
  for (const byte of bytes) crc = (crc >>> 8) ^ TABLE[(crc ^ byte) & 255];
  return crc >>> 0;
}

/** No filenames from uploads are used as archive paths. */
function entryName(name: string): Buffer {
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.startsWith('/') ||
      name.split('/').some((part) => part === '.' || part === '..' || !part)) {
    throw new Error(`Unsafe ZIP entry name: ${name}`);
  }
  const value = Buffer.from(name, 'utf8');
  if (value.length > 65535) throw new Error('ZIP path is too long.');
  return value;
}

export function storedZip(entries: AsyncIterable<StoredZipEntry>): Readable {
  return Readable.from(writeZip(entries));
}

async function* writeZip(entries: AsyncIterable<StoredZipEntry>): AsyncGenerator<Buffer> {
  const directory: Buffer[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let count = 0;

  for await (const entry of entries) {
    if (seen.has(entry.name)) throw new Error(`Duplicate ZIP entry: ${entry.name}`);
    seen.add(entry.name);
    if (++count > 65535) throw new Error('ZIP32 entry count exceeded.');
    const name = entryName(entry.name);
    const start = offset;
    if (start > 0xffffffff) throw new Error('ZIP32 size exceeded.');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // extraction version
    local.writeUInt16LE(0x0008 | 0x0800, 6); // data descriptor + UTF-8
    local.writeUInt16LE(0, 8); // stored, no compression
    local.writeUInt16LE(0x0021, 12); // 1980-01-01, deterministic timestamp
    local.writeUInt16LE(name.length, 26);
    yield local;
    yield name;
    offset += local.length + name.length;

    let crc = 0xffffffff;
    let length = 0;
    for await (const part of entry.chunks) {
      const chunk = Buffer.from(part);
      length += chunk.length;
      if (length > 0xffffffff || offset + chunk.length > 0xffffffff)
        throw new Error('ZIP32 size exceeded.');
      crc = updateCrc32(crc, chunk);
      entry.onChunk?.(chunk);
      yield chunk;
      offset += chunk.length;
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(length, 8);
    descriptor.writeUInt32LE(length, 12);
    yield descriptor;
    offset += descriptor.length;

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    central.writeUInt16LE(20, 6); // extract
    central.writeUInt16LE(0x0008 | 0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(length, 20);
    central.writeUInt32LE(length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(start, 42);
    name.copy(central, 46);
    directory.push(central);
  }

  const centralStart = offset;
  for (const record of directory) {
    yield record;
    offset += record.length;
  }
  if (offset > 0xffffffff) throw new Error('ZIP32 size exceeded.');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);
  yield end;
}
