// 歌单链接导入：把 QQ 音乐 / 网易云的歌单分享链接（含短链）解析成按顺序排列的曲目。
// 与 Melo 的 PlaylistImport 一致；在主进程请求以绕过渲染进程的 CORS 限制。

import { ipcMain, net } from 'electron';

export type PlaylistEntry = { title: string; artist: string };
export type ImportedPlaylist = { id: string; name: string; entries: PlaylistEntry[] };
export type PlaylistImportResult =
  { ok: true; playlist: ImportedPlaylist } | { ok: false; error: string };

const QQ_ID = /(?:disstid=|playlist\/)(\d{4,})/;
const NETEASE_ID = /(?:playlist\?id=|playlist\/|toplist\/)(\d{4,})/;

async function getText(url: string, referer: string): Promise<{ finalUrl: string; body: string }> {
  const response = await net.fetch(url, {
    headers: {
      Referer: referer,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
    },
    signal: AbortSignal.timeout(20_000)
  });
  return { finalUrl: response.url || url, body: await response.text() };
}

function qqId(text: string): string | null {
  return QQ_ID.exec(text)?.[1] ?? null;
}

function neteaseId(text: string): string | null {
  return NETEASE_ID.exec(text)?.[1] ?? null;
}

async function fetchQqPlaylist(id: string): Promise<ImportedPlaylist> {
  const api =
    'https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg' +
    `?type=1&json=1&utf8=1&onlysong=0&disstid=${id}&format=json&g_tk=5381` +
    '&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0';
  const { body } = await getText(api, 'https://y.qq.com/');
  const root = JSON.parse(body.slice(body.indexOf('{')));
  const cd = root?.cdlist?.[0];
  if (!cd) throw new Error('歌单不存在或没有公开');

  const entries: PlaylistEntry[] = [];
  for (const item of cd.songlist ?? []) {
    const title = String(item.songname || item.name || '').trim();
    if (!title) continue;
    const artist = (item.singer ?? [])
      .map((singer: any) => String(singer?.name || '').trim())
      .filter(Boolean)
      .join(', ');
    entries.push({ title, artist });
  }
  if (entries.length === 0) throw new Error('这个歌单里没有歌曲');
  return { id: `qq:${id}`, name: String(cd.dissname || 'QQ 音乐歌单'), entries };
}

async function fetchNeteasePlaylist(id: string): Promise<ImportedPlaylist> {
  const { body } = await getText(
    `https://music.163.com/api/v6/playlist/detail?id=${id}&n=1000&s=0`,
    'https://music.163.com/'
  );
  const pl = JSON.parse(body)?.playlist;
  if (!pl) throw new Error('歌单不存在或没有公开');

  const entries: PlaylistEntry[] = [];
  for (const item of pl.tracks ?? []) {
    const title = String(item?.name ?? '').trim();
    if (!title) continue;
    const artist = (item.ar ?? [])
      .map((singer: any) => String(singer?.name ?? '').trim())
      .filter(Boolean)
      .join(', ');
    entries.push({ title, artist });
  }
  if (entries.length === 0) throw new Error('这个歌单里没有歌曲');
  return { id: `ne:${id}`, name: String(pl.name || '网易云歌单'), entries };
}

export async function fetchPlaylistLink(raw: string): Promise<ImportedPlaylist> {
  const link = raw.trim().replace(/&amp;/g, '&');
  if (!/^https?:\/\//.test(link)) {
    throw new Error('请粘贴以 http 开头的歌单链接');
  }

  const directQq = qqId(link);
  if (directQq) return fetchQqPlaylist(directQq);
  const directNe = neteaseId(link);
  if (directNe) return fetchNeteasePlaylist(directNe);

  const isNetease = link.includes('163cn') || link.includes('music.163');
  const page = await getText(link, isNetease ? 'https://music.163.com/' : 'https://y.qq.com/');

  const finalQq = qqId(page.finalUrl);
  if (finalQq) return fetchQqPlaylist(finalQq);
  const finalNe = neteaseId(page.finalUrl);
  if (finalNe) return fetchNeteasePlaylist(finalNe);

  const host = page.finalUrl.split('://')[1]?.split('/')[0] ?? '';
  const fromBody = host.includes('163') ? neteaseId(page.body) : qqId(page.body);
  if (!fromBody) throw new Error('没有在这个链接里找到歌单');
  return host.includes('163') ? fetchNeteasePlaylist(fromBody) : fetchQqPlaylist(fromBody);
}

export function initializePlaylistImport(): void {
  ipcMain.handle('local-playlist:import-link', async (_, link: string) => {
    try {
      return { ok: true, playlist: await fetchPlaylistLink(String(link ?? '')) };
    } catch (error: any) {
      return { ok: false, error: error?.message || '导入失败' };
    }
  });
}
