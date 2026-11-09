// 歌曲评论：QQ 音乐 / 网易云。
// 本地歌曲没有真实平台 id，用「歌名 + 歌手」在两个平台各搜一次，取最匹配的曲目评论。

import { ipcMain, net } from 'electron';

import type {
  CommentItem,
  CommentProvider,
  CommentRepliesResult,
  CommentsResult
} from '../../shared/comments';

export type CommentPage = {
  total: number;
  items: CommentItem[];
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';

async function getJson<T>(url: string, referer: string): Promise<T | null> {
  try {
    const response = await net.fetch(url, {
      headers: { Referer: referer, 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) return null;
    const text = await response.text();
    // QQ 的部分接口会混入 JSONP / 前后缀，从第一个 { 开始截
    return JSON.parse(text.slice(text.indexOf('{'))) as T;
  } catch (error) {
    console.warn('[comments] 请求失败:', url.slice(0, 100), error);
    return null;
  }
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '');
}

type QqSong = {
  id?: number;
  mid?: string;
  name?: string;
  singer?: { name?: string }[];
};

/** 按歌名+歌手搜索 QQ 曲目 id */
async function findQqSong(name: string, artist: string): Promise<number | null> {
  const queries = [...new Set([`${name} ${artist}`.trim(), name].filter(Boolean))];
  const targetTitle = normalize(name);
  const targetArtist = normalize(artist);
  let best: { id: number; score: number } | null = null;
  for (const query of queries) {
    const url =
      'https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=' +
      encodeURIComponent(query) +
      '&format=json&p=1&n=10&cr=1&new_json=1';
    const data = await getJson<{ data?: { song?: { list?: QqSong[] } } }>(url, 'https://y.qq.com/');
    for (const song of data?.data?.song?.list ?? []) {
      const id = Number(song.id) || 0;
      if (!id) continue;
      let score = 0;
      if (targetTitle && normalize(song.name || '') === targetTitle) score += 10;
      const singers = normalize((song.singer ?? []).map((s) => s?.name || '').join(''));
      if (
        targetArtist &&
        singers &&
        (singers.includes(targetArtist) || targetArtist.includes(singers))
      ) {
        score += 6;
      }
      if (!best || score > best.score) best = { id, score };
    }
    if (best && best.score >= 16) break;
  }
  return best?.id ?? null;
}

type QqSubComment = {
  subcommentid?: string;
  subcommentcontent?: string;
  replynick?: string;
  replyednick?: string;
};

type QqCommentRaw = {
  commentid?: string;
  rootcommentid?: string;
  rootcommentnick?: string;
  nick?: string;
  avatarurl?: string;
  rootcommentcontent?: string;
  middlecommentcontent?: QqSubComment[];
  time?: number;
  praisenum?: number;
};

function cleanQqText(text: string | undefined): string {
  return String(text || '')
    .replace(/\[em\]e\d+\[\/em\]/g, '')
    .replace(/\\n/g, '\n');
}

function toQqItem(item: QqCommentRaw): CommentItem {
  return {
    id: String(item.commentid || ''),
    nick: String(item.nick || ''),
    avatar: String(item.avatarurl || '').replace(/^http:\/\//, 'https://'),
    // QQ 返回的是字面量 \n 和 [em]e400828[/em] 这类表情码，转成普通文本
    content: cleanQqText(item.rootcommentcontent),
    time: (Number(item.time) || 0) * 1000,
    liked: Number(item.praisenum) || 0
  };
}

// QQ 的列表把「回复」也当成普通评论返回：commentid != rootcommentid，
// 真正的回复文字在 middlecommentcontent 里，按 rootcommentid 归到主评论下面
function groupQqComments(list: QqCommentRaw[]): CommentItem[] {
  const roots = new Map<string, CommentItem>();
  const replies = new Map<string, CommentItem[]>();
  const orphanReplies: CommentItem[] = [];

  for (const raw of list) {
    const rootId = String(raw.rootcommentid || raw.commentid || '');
    const id = String(raw.commentid || '');
    if (!rootId || !id) continue;

    if (id === rootId) {
      const item = toQqItem(raw);
      if (!item.content) continue;
      if (!roots.has(id)) roots.set(id, item);
      continue;
    }

    const subs = raw.middlecommentcontent ?? [];
    const sub = subs.find((entry) => entry.subcommentid === id) ?? subs[0];
    const content = cleanQqText(sub?.subcommentcontent);
    if (!content) continue;
    const replyTo = String(sub?.replyednick || raw.rootcommentnick || '').replace(/^@/, '');
    const reply: CommentItem = {
      ...toQqItem(raw),
      content,
      replyTo
    };
    const bucket = replies.get(rootId) ?? [];
    if (!bucket.some((entry) => entry.id === reply.id)) bucket.push(reply);
    replies.set(rootId, bucket);
  }

  const result: CommentItem[] = [...roots.values()].map((root) => ({
    ...root,
    replies: replies.get(root.id) ?? []
  }));
  // 主评论翻在上一页时也把回复带出来，别丢内容
  for (const [rootId, bucket] of replies) {
    if (roots.has(rootId)) continue;
    for (const reply of bucket) orphanReplies.push(reply);
  }
  return result.concat(orphanReplies);
}

const QQ_COMMENT_BASE =
  'https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg?g_tk=5381&loginUin=0&hostUin=0' +
  '&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0' +
  '&cid=205360772&reqtype=2&biztype=1';

async function fetchQqComments(songId: number, page: number): Promise<CommentPage> {
  const url = `${QQ_COMMENT_BASE}&topid=${songId}&cmd=8&pagenum=${page}&pagesize=20`;
  const data = await getJson<{
    comment?: { commenttotal?: number; commentlist?: QqCommentRaw[] };
  }>(url, 'https://y.qq.com/');
  return {
    total: Number(data?.comment?.commenttotal) || 0,
    items: groupQqComments(data?.comment?.commentlist ?? [])
  };
}

async function fetchQqHotComments(songId: number): Promise<CommentItem[]> {
  const url = `${QQ_COMMENT_BASE}&topid=${songId}&cmd=6&pagenum=0&pagesize=15`;
  const data = await getJson<{
    comment?: { commentlist?: QqCommentRaw[] };
  }>(url, 'https://y.qq.com/');
  return groupQqComments(data?.comment?.commentlist ?? []);
}

type NeSong = { id?: number; name?: string; artists?: { name?: string }[] };

async function findNeteaseSongId(name: string, artist: string): Promise<number | null> {
  const url =
    'https://music.163.com/api/search/get/web?s=' +
    encodeURIComponent(`${name} ${artist}`.trim()) +
    '&type=1&limit=5';
  const data = await getJson<{ result?: { songs?: NeSong[] } }>(url, 'https://music.163.com/');
  const songs = data?.result?.songs ?? [];
  const targetTitle = normalize(name);
  const targetArtist = normalize(artist);
  const hit =
    songs.find(
      (song) =>
        normalize(song.name || '') === targetTitle &&
        normalize((song.artists ?? []).map((a) => a?.name || '').join('')).includes(targetArtist)
    ) ??
    songs.find((song) => normalize(song.name || '') === targetTitle) ??
    songs[0];
  return Number(hit?.id) || null;
}

type NeCommentRaw = {
  commentId?: number;
  user?: { nickname?: string; avatarUrl?: string };
  content?: string;
  time?: number;
  likedCount?: number;
  beReplied?: { user?: { nickname?: string }; content?: string }[];
};

function toNeItem(item: NeCommentRaw): CommentItem {
  return {
    id: String(item.commentId || ''),
    nick: String(item.user?.nickname || ''),
    avatar: String(item.user?.avatarUrl || '').replace(/^http:\/\//, 'https://'),
    content: String(item.content || ''),
    time: Number(item.time) || 0,
    liked: Number(item.likedCount) || 0,
    replyTo: item.beReplied?.[0]?.user?.nickname || undefined
  };
}

async function fetchNeteaseComments(
  songId: number,
  offset: number
): Promise<CommentPage & { hot: CommentItem[] }> {
  const url =
    `https://music.163.com/api/v1/resource/comments/R_SO_4_${songId}` +
    `?limit=20&offset=${offset}`;
  const data = await getJson<{
    total?: number;
    hotComments?: NeCommentRaw[];
    comments?: NeCommentRaw[];
  }>(url, 'https://music.163.com/');
  return {
    total: Number(data?.total) || 0,
    hot: (data?.hotComments ?? []).map(toNeItem).filter((item) => item.content),
    items: (data?.comments ?? []).map(toNeItem).filter((item) => item.content)
  };
}

type NeFloorData = {
  comments?: NeCommentRaw[];
  totalCount?: number;
  hasMore?: boolean;
};

async function fetchNeteaseReplies(
  songId: number,
  commentId: string,
  offset: number
): Promise<CommentRepliesResult> {
  const url =
    'https://music.163.com/api/resource/comment/floor/get' +
    `?parentCommentId=${encodeURIComponent(commentId)}` +
    `&threadId=R_SO_4_${songId}&id=${songId}&type=0&limit=20&offset=${offset}`;
  const data = await getJson<{ code?: number; data?: NeFloorData }>(url, 'https://music.163.com/');
  if (!data?.data) return { ok: false, error: '获取回复失败' };
  return {
    ok: true,
    provider: 'netease',
    total: Number(data.data.totalCount) || 0,
    items: (data.data.comments ?? []).map(toNeItem).filter((item) => item.content),
    hasMore: Boolean(data.data.hasMore)
  };
}

// 同一首歌短时间内重复打开评论面板，直接复用结果
const cache = new Map<string, { at: number; value: CommentsResult }>();
const CACHE_MS = 5 * 60_000;

export async function fetchComments(
  provider: CommentProvider,
  name: string,
  artist: string,
  page = 0,
  neteaseId?: number
): Promise<CommentsResult> {
  const title = name.trim();
  if (!title) return { ok: false, error: '没有歌曲信息' };

  const cacheKey = `${provider}|${title}|${artist}|${page}|${neteaseId ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  try {
    let result: CommentsResult;
    if (provider === 'qq') {
      const songId = await findQqSong(title, artist);
      if (!songId) return { ok: false, error: 'QQ 音乐没有搜到这首歌' };
      const [comments, hot] = await Promise.all([
        fetchQqComments(songId, page),
        page === 0 ? fetchQqHotComments(songId) : Promise.resolve([])
      ]);
      result = { ok: true, provider, total: comments.total, hot, items: comments.items, songId };
    } else {
      const songId = neteaseId ?? (await findNeteaseSongId(title, artist));
      if (!songId) return { ok: false, error: '网易云没有搜到这首歌' };
      const offset = page * 20;
      const comments = await fetchNeteaseComments(songId, offset);
      result = {
        ok: true,
        provider,
        total: comments.total,
        hot: offset === 0 ? comments.hot : [],
        items: comments.items,
        songId
      };
    }
    cache.set(cacheKey, { at: Date.now(), value: result });
    return result;
  } catch (error: any) {
    return { ok: false, error: error?.message || '获取评论失败' };
  }
}

const replyCache = new Map<string, { at: number; value: CommentRepliesResult }>();

export async function fetchCommentReplies(
  provider: CommentProvider,
  commentId: string,
  songId: number | undefined,
  offset = 0
): Promise<CommentRepliesResult> {
  if (provider === 'qq') return { ok: false, error: 'QQ 音乐的回复已随评论返回' };
  if (!songId || !commentId) return { ok: false, error: '缺少歌曲或评论信息' };

  const cacheKey = `${provider}|${songId}|${commentId}|${offset}`;
  const cached = replyCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  try {
    const result = await fetchNeteaseReplies(songId, commentId, offset);
    if (result.ok) replyCache.set(cacheKey, { at: Date.now(), value: result });
    return result;
  } catch (error: any) {
    return { ok: false, error: error?.message || '获取回复失败' };
  }
}

export function initializeComments(): void {
  ipcMain.handle(
    'comments:get',
    async (
      _,
      provider: CommentProvider,
      name: string,
      artist: string,
      page: number,
      neteaseId?: number
    ) => {
      return fetchComments(
        provider === 'netease' ? 'netease' : 'qq',
        String(name ?? ''),
        String(artist ?? ''),
        Number(page) || 0,
        Number(neteaseId) || undefined
      );
    }
  );

  ipcMain.handle(
    'comments:replies',
    async (_, provider: CommentProvider, commentId: string, songId: number, offset: number) => {
      return fetchCommentReplies(
        provider === 'qq' ? 'qq' : 'netease',
        String(commentId ?? ''),
        Number(songId) || undefined,
        Number(offset) || 0
      );
    }
  );
}
