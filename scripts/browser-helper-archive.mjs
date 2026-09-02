import { inflateRawSync } from "node:zlib";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const browserHelperFiles = ["content-bridge.js", "manifest.json", "service-worker.js"];
export const browserHelperDirectory = "scoutops-browser-helper";

const utf8Flag = 0x0800;
const storedMethod = 0;
const deterministicDosDate = 0x0021;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, content) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(utf8Flag, 6);
  header.writeUInt16LE(storedMethod, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(deterministicDosDate, 12);
  header.writeUInt32LE(crc32(content), 14);
  header.writeUInt32LE(content.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(name, content, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(utf8Flag, 8);
  header.writeUInt16LE(storedMethod, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(deterministicDosDate, 14);
  header.writeUInt32LE(crc32(content), 16);
  header.writeUInt32LE(content.length, 20);
  header.writeUInt32LE(content.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0o100644 * 0x10000, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

export function createBrowserHelperZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content);
    const local = localHeader(name, content);
    const central = centralHeader(name, content, localOffset);
    localParts.push(local, name, content);
    centralParts.push(central, name);
    localOffset += local.length + name.length + content.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function findEndRecord(archive) {
  const minimum = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1)
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  throw new Error("browser_helper_zip_end_record_missing");
}

export function readBrowserHelperZip(archive) {
  const endOffset = findEndRecord(archive);
  const count = archive.readUInt16LE(endOffset + 10);
  let centralOffset = archive.readUInt32LE(endOffset + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(centralOffset) !== 0x02014b50)
      throw new Error("browser_helper_zip_central_directory_invalid");
    const method = archive.readUInt16LE(centralOffset + 10);
    const compressedSize = archive.readUInt32LE(centralOffset + 20);
    const nameLength = archive.readUInt16LE(centralOffset + 28);
    const extraLength = archive.readUInt16LE(centralOffset + 30);
    const commentLength = archive.readUInt16LE(centralOffset + 32);
    const localOffset = archive.readUInt32LE(centralOffset + 42);
    const name = archive
      .subarray(centralOffset + 46, centralOffset + 46 + nameLength)
      .toString("utf8");
    if (archive.readUInt32LE(localOffset) !== 0x04034b50)
      throw new Error("browser_helper_zip_local_header_invalid");
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
    if (method !== storedMethod && method !== 8)
      throw new Error(`browser_helper_zip_method_unsupported:${method}`);
    entries.set(
      name,
      method === storedMethod ? Buffer.from(compressed) : inflateRawSync(compressed),
    );
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function browserHelperSourceEntries(root = process.cwd()) {
  const source = resolve(root, "browser-helper", browserHelperDirectory);
  return Promise.all(
    browserHelperFiles.map(async (file) => ({
      name: `${browserHelperDirectory}/${file}`,
      content: await readFile(join(source, file)),
    })),
  );
}

export async function buildBrowserHelperArchive(root = process.cwd()) {
  const output = resolve(root, "apps/web/public/browser-helper/scoutops-browser-helper.zip");
  const temporary = `${output}.tmp`;
  await mkdir(dirname(output), { recursive: true });
  await rm(temporary, { force: true });
  await writeFile(temporary, createBrowserHelperZip(await browserHelperSourceEntries(root)));
  await rm(output, { force: true });
  await rename(temporary, output);
  return output;
}

export async function assertBrowserHelperArchive(archivePath, root = process.cwd()) {
  const archive = readBrowserHelperZip(await readFile(archivePath));
  const source = await browserHelperSourceEntries(root);
  const expectedNames = source.map((entry) => entry.name).sort();
  const actualNames = [...archive.keys()].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames))
    throw new Error("browser_helper_zip_entries_mismatch");
  for (const entry of source)
    if (!archive.get(entry.name)?.equals(entry.content))
      throw new Error(`browser_helper_zip_source_mismatch:${entry.name}`);
  return archive;
}
