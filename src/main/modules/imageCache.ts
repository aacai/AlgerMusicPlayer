// 网络图片（歌曲封面等）的本地 LRU 缓存。
// QQ / 网易云 CDN 不保证长缓存，切歌或重开播放页都会重新拉封面；
// 统一由主进程下载并落盘到磁盘缓存目录下的 images/，渲染进程用 local:// 加载。

import { createHash } from 'node:crypto';

import { app, ipcMain, net } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import type { CachedImageResult } from '../../shared/imageCache';
import { filePathToLocalUrl } from '../../shared/localUrl';
import { getStore } from './config';

const DIR_NAME = 'images';
const INDEX_FILE = 'index.json';
const MAX_ENTRIES = 300;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const INDEX_WRITE_DELAY_MS = 800;
const KEY_PATTERN = /^[0-9a-f]{32}\.[a-z0-9]+$/;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';

// 只接受图片 CDN 域名，避免这个 IPC 被用来请求任意地址
const ALLOWED_HOST_SUFFIXES = [
  '.qq.com',
  '.qlogo.cn',
  '.qpic.cn',
  '.gtimg.cn',
  '.126.net',
  '.127.net'
];

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif'
};

type ImageEntry = {
  file: string;
  size: number;
  lastAccessAt: number;
};

const entries = new Map<string, ImageEntry>();
const inflight = new Map<string, Promise<CachedImageResult>>();
let currentDir = '';
let indexTimer: NodeJS.Timeout | null = null;

function resolveDir(): string {
  const configured = String(getStore()?.get('set.diskCacheDir') ?? '').trim();
  const root =
    configured && path.isAbsolute(configured)
      ? path.normalize(configured)
      : path.join(app.getPath('userData'), 'cache');
  return path.join(root, DIR_NAME);
}

function ensureDir(): string {
  const next = resolveDir();
  if (next === currentDir) return currentDir;
  currentDir = next;
  entries.clear();
  fs.mkdirSync(currentDir, { recursive: true });
  loadIndex();
  pruneOrphans();
  return currentDir;
}

function loadIndex(): void {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(currentDir, INDEX_FILE), 'utf8')) as {
      entries?: Record<string, Partial<ImageEntry>>;
    };
    for (const [key, value] of Object.entries(raw.entries ?? {})) {
      if (!KEY_PATTERN.test(String(value?.file ?? ''))) continue;
      const file = String(value.file);
      const stat = fs.statSync(path.join(currentDir, file), { throwIfNoEntry: false });
      if (!stat?.isFile()) continue;
      entries.set(key, {
        file,
        size: stat.size,
        lastAccessAt: Number(value.lastAccessAt) || stat.mtimeMs
      });
    }
  } catch {
    // 索引缺失/损坏时按空缓存处理，下面的 pruneOrphans 会清掉无主文件
  }
}

function pruneOrphans(): void {
  try {
    for (const name of fs.readdirSync(currentDir)) {
      const full = path.join(currentDir, name);
      if (name.endsWith('.tmp')) {
        void fs.promises.unlink(full).catch(() => {});
        continue;
      }
      if (!KEY_PATTERN.test(name)) continue;
      if ([...entries.values()].some((entry) => entry.file === name)) continue;
      void fs.promises.unlink(full).catch(() => {});
    }
  } catch {
    // 目录不可读时忽略，等下次请求再试
  }
}

function flushIndex(): void {
  if (indexTimer) {
    clearTimeout(indexTimer);
    indexTimer = null;
  }
  if (!currentDir) return;
  const payload = JSON.stringify({ entries: Object.fromEntries(entries) });
  void fs.promises.writeFile(path.join(currentDir, INDEX_FILE), payload).catch(() => {});
}

function scheduleIndexWrite(): void {
  if (indexTimer) clearTimeout(indexTimer);
  indexTimer = setTimeout(flushIndex, INDEX_WRITE_DELAY_MS);
  indexTimer.unref?.();
}

function evict(): void {
  let total = 0;
  for (const entry of entries.values()) total += entry.size;
  while (entries.size > MAX_ENTRIES || total > MAX_TOTAL_BYTES) {
    let oldestKey = '';
    let oldest: ImageEntry | null = null;
    for (const [key, entry] of entries) {
      if (!oldest || entry.lastAccessAt < oldest.lastAccessAt) {
        oldest = entry;
        oldestKey = key;
      }
    }
    if (!oldest) break;
    entries.delete(oldestKey);
    total -= oldest.size;
    void fs.promises.unlink(path.join(currentDir, oldest.file)).catch(() => {});
  }
}

function sniffExtension(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return '.png';
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return '.gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return '.webp';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
    buffer.subarray(8, 12).toString('ascii') === 'avif'
  ) {
    return '.avif';
  }
  return null;
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}

async function download(key: string, url: string): Promise<CachedImageResult> {
  try {
    const response = await net.fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!response.ok) {
      return { ok: false, error: `图片下载失败（HTTP ${response.status}）` };
    }
    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_FILE_BYTES) {
      return { ok: false, error: '图片过大' };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      return { ok: false, error: '图片内容为空' };
    }
    if (buffer.length > MAX_FILE_BYTES) {
      return { ok: false, error: '图片过大' };
    }
    const extension = sniffExtension(buffer) ?? EXT_BY_CONTENT_TYPE[contentType];
    if (!extension) {
      return { ok: false, error: '不支持的图片格式' };
    }
    const dir = ensureDir();
    const file = `${key}${extension}`;
    const target = path.join(dir, file);
    const temp = `${target}.tmp`;
    await fs.promises.writeFile(temp, buffer);
    await fs.promises.rename(temp, target);
    entries.set(key, { file, size: buffer.length, lastAccessAt: Date.now() });
    evict();
    scheduleIndexWrite();
    return { ok: true, url: filePathToLocalUrl(target), cached: false };
  } catch (error) {
    console.warn('[image-cache] 下载失败:', url.slice(0, 120), error);
    return { ok: false, error: '图片下载失败' };
  }
}

async function getCachedImage(rawUrl: string): Promise<CachedImageResult> {
  const url = String(rawUrl ?? '').trim();
  if (!url || url.length > 2048) {
    return { ok: false, error: '无效的图片地址' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: '无效的图片地址' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: '不支持的图片地址' };
  }
  if (!isAllowedHost(parsed.hostname)) {
    return { ok: false, error: '不支持的图片来源' };
  }

  ensureDir();
  const key = createHash('sha256').update(url).digest('hex').slice(0, 32);
  const hit = entries.get(key);
  if (hit) {
    const file = path.join(currentDir, hit.file);
    if (fs.existsSync(file)) {
      hit.lastAccessAt = Date.now();
      scheduleIndexWrite();
      return { ok: true, url: filePathToLocalUrl(file), cached: true };
    }
    entries.delete(key);
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const task = download(key, url).finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

export function initializeImageCache(): void {
  ensureDir();
  ipcMain.handle('image-cache:get', (_, url: string) => getCachedImage(url));
  app.on('before-quit', flushIndex);
}
