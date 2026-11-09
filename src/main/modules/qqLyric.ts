// QQ 音乐歌词回退：网易云没有歌词（或本地歌曲没有内嵌歌词）时，按「歌名 歌手」
// 搜索 QQ 音乐，取 mid 后向 musicu 取 base64 编码的 LRC，再合并中文翻译。
// 逻辑与 Melo 的 LyricSource 一致，缓存落在 userData/QQ-LyricsCache。

import { createHash } from 'node:crypto';

import { app, ipcMain, net } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type QqLyricLine = {
  /** 毫秒 */
  time: number;
  text: string;
  /** 中文翻译，中文歌为空串 */
  trans: string;
};

export type QqLyricResult =
  | {
      ok: true;
      /** 缓存格式版本；旧缓存没有封面字段，命中后重新抓取 */
      v: 2;
      lines: QqLyricLine[];
      title: string;
      artist: string;
      mid: string;
      /** QQ 专辑封面，取不到时为空串 */
      cover: string;
    }
  | { ok: false; error: string };

const REQUEST_HEADERS = {
  Referer: 'https://y.qq.com/',
  'User-Agent': 'QQMusicMac/11.10.5'
};

const LRC_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?]/g;
const LRC_META = /^\[(ti|ar|al|by|offset|re|ve):.*?]$/;

let cacheDir: string | null = null;

function getCacheDir(): string {
  if (cacheDir) return cacheDir;
  const dir = path.join(app.getPath('userData'), 'QQ-LyricsCache');
  fs.mkdirSync(dir, { recursive: true });
  cacheDir = dir;
  return dir;
}

async function httpText(url: string): Promise<string | null> {
  try {
    const response = await net.fetch(url, {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.warn('[qqLyric] 请求失败:', url.slice(0, 120), error);
    return null;
  }
}

/** 解析 LRC：支持一行多个时间戳与 [offset:]；忽略元数据行。 */
export function parseLrc(lrc: string): QqLyricLine[] {
  const offsetMatch = /\[offset:\s*(-?\d+)]/.exec(lrc);
  const offset = offsetMatch ? Number(offsetMatch[1]) || 0 : 0;
  const out: QqLyricLine[] = [];

  for (const raw of lrc.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || LRC_META.test(line)) continue;

    const matches = [...line.matchAll(LRC_TAG)];
    if (matches.length === 0) continue;

    const text = line.replace(LRC_TAG, '').trim();
    if (!text || text === '//') continue;

    for (const match of matches) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const fracRaw = match[3] ?? '';
      const frac =
        fracRaw.length === 0
          ? 0
          : fracRaw.length === 1
            ? Number(fracRaw) * 100
            : fracRaw.length === 2
              ? Number(fracRaw) * 10
              : Number(fracRaw.slice(0, 3));
      out.push({ time: min * 60_000 + sec * 1000 + frac + offset, text, trans: '' });
    }
  }

  return out.sort((a, b) => a.time - b.time);
}

/** 把翻译 LRC 按时间戳并进原文；对不上的行保持空译文。 */
function mergeTranslation(lines: QqLyricLine[], translation: string | null): QqLyricLine[] {
  if (!translation?.trim()) return lines;
  const byTime = new Map<number, string>();
  for (const line of parseLrc(translation)) {
    if (line.text.includes('著作权')) continue;
    byTime.set(line.time, line.text);
  }
  if (byTime.size === 0) return lines;
  return lines.map((line) => ({ ...line, trans: byTime.get(line.time) ?? '' }));
}

type QqSong = {
  mid?: string;
  id?: number;
  name?: string;
  singer?: { name?: string }[];
  album?: { mid?: string };
};

/** 去掉括号内容与空白，用于歌名比对 */
function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[（([【].*?[）)\]】]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeSinger(text: string): string {
  return text.toLowerCase().replace(/[\s/&,，、]/g, '');
}

/** 候选排序：歌名完全一致 > 歌手匹配 > 有专辑封面 */
function rankSongs(list: QqSong[], title: string, artist: string): QqSong[] {
  const targetTitle = normalizeTitle(title);
  const targetArtist = normalizeSinger(artist);
  const score = (song: QqSong) => {
    let value = 0;
    if (targetTitle && normalizeTitle(song.name || '') === targetTitle) value += 10;
    const singers = normalizeSinger((song.singer || []).map((s) => s?.name || '').join(''));
    if (
      targetArtist &&
      singers &&
      (singers.includes(targetArtist) || targetArtist.includes(singers))
    ) {
      value += 6;
    }
    if (song.album?.mid) value += 1;
    return value;
  };
  return [...list].sort((a, b) => score(b) - score(a));
}

/** 搜索候选列表：单条结果可能是翻唱/无歌词版本，需要多试几条。 */
async function searchSongs(title: string, artist: string): Promise<QqSong[]> {
  const queries = [...new Set([`${title} ${artist}`.trim(), title].filter(Boolean))];
  const seen = new Set<string>();
  const songs: QqSong[] = [];
  for (const query of queries) {
    if (!query) continue;
    const url =
      'https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=' +
      encodeURIComponent(query) +
      '&format=json&p=1&n=10&cr=1&new_json=1';
    const body = await httpText(url);
    if (!body) continue;
    try {
      const list = (JSON.parse(body)?.data?.song?.list ?? []) as QqSong[];
      for (const song of list) {
        if (!song?.mid || seen.has(song.mid)) continue;
        seen.add(song.mid);
        songs.push(song);
      }
    } catch {
      // 接口偶尔返回 JSONP/异常结构，换下一个查询词
    }
    if (songs.length >= 10) break;
  }
  return rankSongs(songs, title, artist).slice(0, 8);
}

async function fetchLrc(mid: string, songId: number): Promise<string | null> {
  const data = JSON.stringify({
    req_0: {
      module: 'music.musichallSong.PlayLyricInfo',
      method: 'GetPlayLyricInfo',
      param: {
        songMID: mid,
        songID: songId,
        qrc_t: 0,
        roma_t: 0,
        trans_t: 0,
        type: 0,
        interval: 192
      }
    },
    comm: { uin: '', guid: '677739061', ct: '11', cv: '0', format: 'json' }
  });
  const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=' + encodeURIComponent(data);
  const body = await httpText(url);
  if (!body) return null;
  try {
    const base64 = JSON.parse(body)?.req_0?.data?.lyric;
    if (typeof base64 !== 'string' || !base64) return null;
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/** 外文歌的中文翻译放在 lyric_download.fcg 的 contentts 里；中文歌为空。 */
async function fetchTranslation(songId: number): Promise<string | null> {
  if (!songId) return null;
  const url =
    'https://c.y.qq.com/qqmusic/fcgi-bin/lyric_download.fcg' +
    `?version=15&miniversion=82&lrctype=4&musicid=${songId}`;
  const body = await httpText(url);
  if (!body) return null;
  const match = /<contentts[^>]*><!\[CDATA\[([\s\S]*?)]]><\/contentts>/.exec(body);
  const text = match?.[1]?.trim();
  return text || null;
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function cacheFile(title: string, artist: string): string {
  const key = createHash('sha1')
    .update(`${normalizeKey(title)}|${normalizeKey(artist)}`)
    .digest('hex');
  return path.join(getCacheDir(), `${key}.json`);
}

/** 主入口：带磁盘缓存，失败返回 ok:false 而不是抛异常。 */
export async function fetchQqLyric(title: string, artist: string): Promise<QqLyricResult> {
  const cleanTitle = title.trim();
  const cleanArtist = artist.trim();
  if (!cleanTitle) {
    return { ok: false, error: '歌名为空' };
  }

  const file = cacheFile(cleanTitle, cleanArtist);
  try {
    const cached = JSON.parse(await fs.promises.readFile(file, 'utf8')) as QqLyricResult;
    if (cached.ok && cached.v === 2 && cached.lines.length > 0) return cached;
    // 旧缓存（无版本号 / 负缓存）不再信任：搜索排序已改，重新抓取
  } catch {
    // 没有缓存或缓存损坏，走网络
  }

  const songs = await searchSongs(cleanTitle, cleanArtist);
  if (songs.length === 0) {
    return { ok: false, error: 'QQ 音乐没有搜到这首歌' };
  }

  for (const song of songs) {
    const mid = song.mid;
    if (!mid) continue;
    const songId = Number(song.id) || 0;
    const lrc = await fetchLrc(mid, songId);
    if (!lrc?.trim()) continue;

    const translation = await fetchTranslation(songId);
    const lines = mergeTranslation(parseLrc(lrc), translation);
    if (lines.length === 0) continue;

    const albumMid = song.album?.mid?.trim();
    const result: QqLyricResult = {
      ok: true,
      v: 2,
      lines,
      title: song.name?.trim() || cleanTitle,
      artist: (song.singer ?? [])
        .map((item) => item?.name ?? '')
        .filter(Boolean)
        .join('/'),
      mid,
      cover: albumMid ? `https://y.qq.com/music/photo_new/T002R500x500M000${albumMid}.jpg` : ''
    };
    await fs.promises.writeFile(file, JSON.stringify(result)).catch(() => {});
    return result;
  }

  return { ok: false, error: 'QQ 音乐没有这首歌的歌词' };
}

export function initializeQqLyric(): void {
  ipcMain.handle('qq-lyric:get', async (_, title: string, artist: string) => {
    try {
      return await fetchQqLyric(String(title ?? ''), String(artist ?? ''));
    } catch (error: any) {
      console.error('[qqLyric] 获取失败:', error);
      return { ok: false, error: error?.message || '获取歌词失败' } satisfies QqLyricResult;
    }
  });
}
