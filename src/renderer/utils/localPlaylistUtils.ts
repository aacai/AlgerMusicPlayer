// 本地歌单工具：文本解析、与本地曲库的归一化匹配、缺歌行生成

import type { LocalMusicEntry } from '@/types/localMusic';
import type { LocalPlaylist, LocalPlaylistEntry, LocalPlaylistRow } from '@/types/localPlaylist';

import { parseFileNameParts } from './localMusicUtils';

/** 归一化歌名/歌手：忽略大小写、空格与标点，便于和在线歌单对上 */
export function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** 把「Zedd, Jon Bellion」拆成小写词，用于歌手名不完全一致时的匹配 */
export function artistTokens(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => token.length > 1)
  );
}

/**
 * 解析粘贴的文本，每行一首；支持「歌名 - 歌手」「歌名<TAB>歌手」与仅歌名。
 * 行首序号（1. / 1、/ 1)）会被去掉。
 */
export function parsePlaylistText(text: string): LocalPlaylistEntry[] {
  const entries: LocalPlaylistEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    // 只去掉「1.」「1、」「1)」这类序号；不能吃空格，否则「7538 - 歌手」会把歌名截掉
    line = line.replace(/^\d{1,4}[.、,，)）]\s*/, '').trim();
    if (!line || line.startsWith('共')) continue;

    const cols = line.split('\t');
    if (cols.length >= 2) {
      const title = cols[0].trim();
      if (title) entries.push({ title, artist: cols[1].trim() });
      continue;
    }

    const sep = [' - ', ' – ', ' — '].find((item) => line.includes(item));
    if (sep) {
      const title = line.slice(0, line.indexOf(sep)).trim();
      if (title) {
        entries.push({ title, artist: line.slice(line.indexOf(sep) + sep.length).trim() });
      }
    } else {
      entries.push({ title: line, artist: '' });
    }
  }
  return entries;
}

type MatchIndex = {
  exact: Map<string, LocalMusicEntry>;
  byTitle: Map<string, LocalMusicEntry[]>;
};

/** 给整个本地曲库建索引：标题@歌手、歌手@标题、标题、文件名去后缀 */
export function buildMatchIndex(musicList: LocalMusicEntry[]): MatchIndex {
  const exact = new Map<string, LocalMusicEntry>();
  const byTitle = new Map<string, LocalMusicEntry[]>();

  for (const entry of musicList) {
    const title = normalizeKey(entry.title);
    const artist = normalizeKey(entry.artist);
    const stem = normalizeKey(parseFileNameParts(entry.filePath).title);
    for (const key of [`${title}@${artist}`, `${artist}@${title}`, title, stem]) {
      if (key.length > 1 && !exact.has(key)) {
        exact.set(key, entry);
      }
    }
    if (title) {
      const list = byTitle.get(title) ?? [];
      list.push(entry);
      byTitle.set(title, list);
    }
  }

  return { exact, byTitle };
}

/** 匹配一首歌：完全命中 → 歌手分词交集 → 标题唯一 → 文件名整体 */
export function matchEntry(entry: LocalPlaylistEntry, index: MatchIndex): LocalMusicEntry | null {
  const title = normalizeKey(entry.title);
  const artist = normalizeKey(entry.artist);

  const exactTitleArtist = index.exact.get(`${title}@${artist}`);
  if (exactTitleArtist) return exactTitleArtist;
  const exactArtistTitle = index.exact.get(`${artist}@${title}`);
  if (exactArtistTitle) return exactArtistTitle;

  if (title) {
    const candidates = index.byTitle.get(title) ?? [];
    const tokens = artistTokens(entry.artist);
    const tokenHit = candidates.find((candidate) => {
      if (tokens.size === 0) return false;
      const candidateTokens = artistTokens(candidate.artist);
      for (const token of candidateTokens) {
        if (tokens.has(token)) return true;
      }
      return false;
    });
    if (tokenHit) return tokenHit;
    if (candidates.length === 1) return candidates[0];
  }

  return index.exact.get(normalizeKey(`${entry.title} - ${entry.artist}`)) ?? null;
}

/** 歌单的完整列表：按歌单原顺序，本地没有的曲目 track 为空；重复条目只保留第一次 */
export function buildPlaylistRows(
  playlist: LocalPlaylist,
  musicList: LocalMusicEntry[],
  index: MatchIndex = buildMatchIndex(musicList)
): LocalPlaylistRow[] {
  const seen = new Set<string>();
  return playlist.entries.map((entry) => {
    const track = matchEntry(entry, index);
    if (!track) return { entry, track: null };
    if (seen.has(track.id)) return { entry, track: null };
    seen.add(track.id);
    return { entry, track };
  });
}

/** 歌单里本地实际存在的曲目，顺序与歌单一致 */
export function playlistTracks(rows: LocalPlaylistRow[]): LocalMusicEntry[] {
  return rows.map((row) => row.track).filter((track): track is LocalMusicEntry => !!track);
}

/** 歌单搜索：歌单条目、匹配到的本地曲目、文件名任一命中 */
export function filterPlaylistRows(rows: LocalPlaylistRow[], keyword: string): LocalPlaylistRow[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.entry.title.toLowerCase().includes(q) ||
      row.entry.artist.toLowerCase().includes(q) ||
      (row.track?.filePath ?? '').toLowerCase().includes(q)
  );
}
