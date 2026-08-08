#!/usr/bin/env node
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { access, mkdtemp, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAGIC = 'SCOUTOPS-BACKUP-V1';
const TAG_BYTES = 16;
const CHUNK_BYTES = 1024 * 1024;
const fail = (code, message) => Object.assign(new Error(message), { code });
export const digestFile = async (path) => { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); };
const key = (secret, salt) => {
  if (!secret || secret.length < 32) throw fail('backup_key_invalid', 'BACKUP_ENCRYPTION_KEY must contain at least 32 characters');
  return scryptSync(secret, salt, 32);
};

async function copyTransform(source, target, transform, start = 0, bytes = null) {
  const input = await open(source, 'r');
  const output = await open(target, 'a');
  const buffer = Buffer.allocUnsafe(CHUNK_BYTES);
  let position = start, remaining = bytes;
  try {
    while (remaining === null || remaining > 0) {
      const wanted = remaining === null ? buffer.length : Math.min(buffer.length, remaining);
      const { bytesRead } = await input.read(buffer, 0, wanted, position);
      if (!bytesRead) break;
      await output.write(transform.update(buffer.subarray(0, bytesRead)));
      position += bytesRead;
      if (remaining !== null) remaining -= bytesRead;
    }
    await output.write(transform.final());
  } finally { await input.close(); await output.close(); }
}

export async function createBundle({ source, output, secret }) {
  try { await stat(output); throw fail('backup_output_exists', 'refusing to overwrite an existing backup bundle'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const salt = randomBytes(16), iv = randomBytes(12), plaintextSha256 = await digestFile(source);
  const header = { algorithm: 'aes-256-gcm', salt: salt.toString('base64'), iv: iv.toString('base64'), plaintextSha256, sourceName: basename(source), createdAt: new Date().toISOString() };
  const prefix = Buffer.from(`${MAGIC}\n${JSON.stringify(header)}\n`, 'utf8');
  await writeFile(output, prefix, { flag: 'wx', mode: 0o600 });
  const cipher = createCipheriv('aes-256-gcm', key(secret, salt), iv);
  try {
    await copyTransform(source, output, cipher);
    const handle = await open(output, 'a'); try { await handle.write(cipher.getAuthTag()); } finally { await handle.close(); }
    return { algorithm: header.algorithm, plaintextSha256, bundleSha256: await digestFile(output), sizeBytes: (await stat(output)).size };
  } catch (error) { await rm(output, { force: true }); throw error; }
}

async function readHeader(bundle) {
  const handle = await open(bundle, 'r'); const buffer = Buffer.alloc(65536);
  try {
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    const first = text.indexOf('\n'), second = text.indexOf('\n', first + 1);
    if (first < 0 || second < 0 || text.slice(0, first) !== MAGIC) throw fail('backup_format_invalid', 'invalid backup bundle header');
    const header = JSON.parse(text.slice(first + 1, second));
    if (header.algorithm !== 'aes-256-gcm') throw fail('backup_algorithm_unsupported', 'unsupported backup algorithm');
    return { header, offset: Buffer.byteLength(text.slice(0, second + 1), 'utf8') };
  } finally { await handle.close(); }
}

export async function decryptBundle({ bundle, output, secret }) {
  try { await stat(output); throw fail('restore_output_exists', 'refusing to overwrite an existing restore output'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { header, offset } = await readHeader(bundle), info = await stat(bundle);
  if (info.size <= offset + TAG_BYTES) throw fail('backup_bundle_truncated', 'backup bundle is truncated');
  const handle = await open(bundle, 'r'); const tag = Buffer.alloc(TAG_BYTES);
  try { await handle.read(tag, 0, TAG_BYTES, info.size - TAG_BYTES); } finally { await handle.close(); }
  const decipher = createDecipheriv('aes-256-gcm', key(secret, Buffer.from(header.salt, 'base64')), Buffer.from(header.iv, 'base64'));
  decipher.setAuthTag(tag);
  await writeFile(output, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
  try {
    await copyTransform(bundle, output, decipher, offset, info.size - offset - TAG_BYTES);
    const plaintextSha256 = await digestFile(output);
    if (plaintextSha256 !== header.plaintextSha256) throw fail('backup_integrity_failed', 'restored plaintext hash does not match');
    return { algorithm: header.algorithm, plaintextSha256, integrity: 'verified', sizeBytes: (await stat(output)).size };
  } catch (error) { await rm(output, { force: true }); throw error; }
}

export async function verifyBundle({ bundle, secret }) {
  const dir = await mkdtemp(join(tmpdir(), 'scoutops-backup-verify-')), output = join(dir, 'verify.out');
  try { return await decryptBundle({ bundle, output, secret }); } finally { await rm(dir, { recursive: true, force: true }); }
}

async function selfTest() {
  const dir = await mkdtemp(join(tmpdir(), 'scoutops-backup-selftest-'));
  try {
    const source = join(dir, 'source.sql'), bundle = join(dir, 'backup.bundle'), restored = join(dir, 'restored.sql');
    const secret = randomBytes(48).toString('base64');
    await writeFile(source, 'ScoutOps M07-04 isolated restore fixture\n', { mode: 0o600 });
    const created = await createBundle({ source, output: bundle, secret });
    const recovered = await decryptBundle({ bundle, output: restored, secret });
    if (created.plaintextSha256 !== recovered.plaintextSha256) throw fail('backup_self_test_failed', 'hash mismatch');
    const tampered = join(dir, 'tampered.bundle'), rejected = join(dir, 'rejected.sql'), bytes = await readFile(bundle);
    bytes[Math.floor(bytes.length / 2)] ^= 1; await writeFile(tampered, bytes, { mode: 0o600 });
    let tamperRejected = false;
    try { await decryptBundle({ bundle: tampered, output: rejected, secret }); } catch { tamperRejected = true; }
    if (!tamperRejected) throw fail('backup_self_test_failed', 'tampered bundle was accepted');
    try { await access(rejected); throw fail('backup_self_test_failed', 'failed restore output was not cleaned'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { status: 'passed', algorithm: 'aes-256-gcm', integrity: 'verified', cleanup: 'passed' };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2), value = (name) => args[args.indexOf(name) + 1];
  try {
    let result;
    if (args.includes('--self-test')) result = await selfTest();
    else if (args.includes('--create')) result = await createBundle({ source: value('--source'), output: value('--output'), secret: process.env.BACKUP_ENCRYPTION_KEY });
    else if (args.includes('--decrypt')) result = await decryptBundle({ bundle: value('--bundle'), output: value('--output'), secret: process.env.BACKUP_ENCRYPTION_KEY });
    else if (args.includes('--verify')) result = await verifyBundle({ bundle: value('--bundle'), secret: process.env.BACKUP_ENCRYPTION_KEY });
    else throw fail('backup_command_required', 'use --self-test, --create, --verify or --decrypt');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? 'backup_recovery_failed', message: error.message })}\n`);
    process.exitCode = 1;
  }
}
