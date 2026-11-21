// Android WebView 没有 Electron preload 注入的 window.api，
// 这里用 algerNative.lxHttpRequest 实现同一套评论接口，供 Melo 评论面板调用。

import type {
  CommentItem,
  CommentProvider,
  CommentRepliesResult,
  CommentsResult
} from '../../shared/comments';

type NativeBridge = {
  lxHttpRequest?: (url: string, options: string) => string;
};

type HttpPayload = {
  statusCode: number;
  body?: string;
};

const UA =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36';

function nativeBridge(): NativeBridge | undefined {
  return (globalThis as { algerNative?: NativeBridge }).algerNative;
}

export async function getHttpText(url: string, referer: string): Promise<string | null> {
  const bridge = nativeBridge();
  if (bridge?.lxHttpRequest) {
    try {
      const raw = bridge.lxHttpRequest(
        url,
        JSON.stringify({ method: 'GET', headers: { Referer: referer, 'User-Agent': UA } })
      );
      const payload = JSON.parse(raw) as HttpPayload;
      if (payload.statusCode >= 200 && payload.statusCode < 300) return payload.body || '';
      return null;
    } catch {
      return null;
    }
  }
  if (typeof fetch === 'function') {
    try {
      const response = await fetch(url, { headers: { Referer: referer, 'User-Agent': UA } });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }
  return null;
}

async function getJson<T>(url: string, referer: string): Promise<T | null> {
  const text = await getHttpText(url, referer);
  if (!text) return null;
  try {
    return JSON.parse(text.slice(text.indexOf('{'))) as T;
  } catch {
    return null;
  }
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '');
}

type QqSong = { id?: number; name?: string; singer?: { name?: string }[] };

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
    content: cleanQqText(item.rootcommentcontent),
    time: (Number(item.time) || 0) * 1000,
    liked: Number(item.praisenum) || 0
  };
}

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
      if (item.content && !roots.has(id)) roots.set(id, item);
      continue;
    }
    const subs = raw.middlecommentcontent ?? [];
    const sub = subs.find((entry) => entry.subcommentid === id) ?? subs[0];
    const content = cleanQqText(sub?.subcommentcontent);
    if (!content) continue;
    const reply: CommentItem = {
      ...toQqItem(raw),
      content,
      replyTo: String(sub?.replyednick || raw.rootcommentnick || '').replace(/^@/, '')
    };
    const bucket = replies.get(rootId) ?? [];
    if (!bucket.some((entry) => entry.id === reply.id)) bucket.push(reply);
    replies.set(rootId, bucket);
  }

  const result: CommentItem[] = [...roots.values()].map((root) => ({
    ...root,
    replies: replies.get(root.id) ?? []
  }));
  for (const [rootId, bucket] of replies) {
    if (!roots.has(rootId)) orphanReplies.push(...bucket);
  }
  return result.concat(orphanReplies);
}

const QQ_COMMENT_BASE =
  'https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg?g_tk=5381&loginUin=0&hostUin=0' +
  '&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0' +
  '&cid=205360772&reqtype=2&biztype=1';

async function fetchQqComments(
  songId: number,
  page: number
): Promise<{ total: number; items: CommentItem[] }> {
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
  const data = await getJson<{ comment?: { commentlist?: QqCommentRaw[] } }>(
    url,
    'https://y.qq.com/'
  );
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
): Promise<{ total: number; hot: CommentItem[]; items: CommentItem[] }> {
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

export async function fetchNativeComments(
  provider: CommentProvider,
  name: string,
  artist: string,
  page = 0,
  neteaseId?: number
): Promise<CommentsResult> {
  const title = name.trim();
  if (!title) return { ok: false, error: '没有歌曲信息' };

  try {
    if (provider === 'qq') {
      const songId = await findQqSong(title, artist);
      if (!songId) return { ok: false, error: 'QQ 音乐没有搜到这首歌' };
      const [comments, hot] = await Promise.all([
        fetchQqComments(songId, page),
        page === 0 ? fetchQqHotComments(songId) : Promise.resolve([])
      ]);
      return { ok: true, provider, total: comments.total, hot, items: comments.items, songId };
    }

    const songId = neteaseId ?? (await findNeteaseSongId(title, artist));
    if (!songId) return { ok: false, error: '网易云没有搜到这首歌' };
    const offset = page * 20;
    const comments = await fetchNeteaseComments(songId, offset);
    return {
      ok: true,
      provider,
      total: comments.total,
      hot: offset === 0 ? comments.hot : [],
      items: comments.items,
      songId
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '获取评论失败' };
  }
}

export async function fetchNativeCommentReplies(
  provider: CommentProvider,
  commentId: string,
  songId: number | undefined,
  offset = 0
): Promise<CommentRepliesResult> {
  if (provider === 'qq') return { ok: false, error: 'QQ 音乐的回复已随评论返回' };
  if (!songId || !commentId) return { ok: false, error: '缺少歌曲或评论信息' };

  const url =
    'https://music.163.com/api/resource/comment/floor/get' +
    `?parentCommentId=${encodeURIComponent(commentId)}` +
    `&threadId=R_SO_4_${songId}&id=${songId}&type=0&limit=20&offset=${offset}`;
  const data = await getJson<{
    code?: number;
    data?: { comments?: NeCommentRaw[]; totalCount?: number; hasMore?: boolean };
  }>(url, 'https://music.163.com/');
  if (!data?.data) return { ok: false, error: '获取回复失败' };
  return {
    ok: true,
    provider: 'netease',
    total: Number(data.data.totalCount) || 0,
    items: (data.data.comments ?? []).map(toNeItem).filter((item) => item.content),
    hasMore: Boolean(data.data.hasMore)
  };
}

/** 在 Android WebView 中补齐 Electron preload 才有的评论 API */
export function installNativeCommentsApi(): void {
  if (!nativeBridge()?.lxHttpRequest) return;
  const api = ((globalThis as { api?: Record<string, unknown> }).api ??= {}) as Record<
    string,
    unknown
  >;
  if (!api.getComments) api.getComments = fetchNativeComments;
  if (!api.getCommentReplies) api.getCommentReplies = fetchNativeCommentReplies;
}
