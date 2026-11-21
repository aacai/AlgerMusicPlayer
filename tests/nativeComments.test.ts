import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchNativeCommentReplies,
  fetchNativeComments,
  installNativeCommentsApi
} from '@/services/nativeComments';

const respond = (body: unknown, statusCode = 200) =>
  JSON.stringify({ statusCode, body: JSON.stringify(body) });

const qqComment = {
  commentid: 'c1',
  rootcommentid: 'c1',
  nick: '粉丝',
  avatarurl: 'http://q.qlogo.cn/avatar',
  rootcommentcontent: '好听\\n真的',
  time: 1700000000,
  praisenum: 12
};

describe('Android 原生评论通道', () => {
  const lxHttpRequest = vi.fn((url: string): string => {
    if (url.includes('client_search_cp')) {
      return respond({
        data: {
          song: {
            list: [{ id: 123, name: 'Cruel Summer', singer: [{ name: 'Taylor Swift' }] }]
          }
        }
      });
    }
    if (url.includes('fcg_global_comment_h5.fcg')) {
      return respond({
        comment: {
          commenttotal: 1,
          commentlist: url.includes('cmd=6') ? [qqComment] : [qqComment]
        }
      });
    }
    if (url.includes('/api/search/get/web')) {
      return respond({ result: { songs: [{ id: 456, name: 'Cruel Summer' }] } });
    }
    if (url.includes('/api/v1/resource/comments/')) {
      return respond({
        total: 1,
        comments: [
          {
            commentId: 99,
            user: { nickname: '网易用户', avatarUrl: 'http://p1.music.126.net/a' },
            content: '不错',
            time: 1700000000,
            likedCount: 3
          }
        ],
        hotComments: []
      });
    }
    if (url.includes('comment/floor/get')) {
      return respond({
        code: 200,
        data: {
          totalCount: 1,
          hasMore: false,
          comments: [{ commentId: 100, user: { nickname: '回复者' }, content: '同感' }]
        }
      });
    }
    return respond({});
  });

  beforeEach(() => {
    (globalThis as { algerNative?: unknown }).algerNative = { lxHttpRequest };
  });

  it('能通过原生桥拿到 QQ 音乐评论', async () => {
    const result = await fetchNativeComments('qq', 'Cruel Summer', 'Taylor Swift', 0);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.songId).toBe(123);
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        nick: '粉丝',
        content: '好听\n真的',
        liked: 12,
        avatar: 'https://q.qlogo.cn/avatar'
      });
    }
    expect(lxHttpRequest).toHaveBeenCalled();
  });

  it('网易云按传入的歌曲 id 拉取评论', async () => {
    const result = await fetchNativeComments('netease', 'Cruel Summer', 'Taylor Swift', 0, 456);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.songId).toBe(456);
      expect(result.items[0]).toMatchObject({ content: '不错', nick: '网易用户', liked: 3 });
      expect(result.items[0].avatar).toMatch(/^https:\/\//);
    }
  });

  it('能拿到网易云楼中楼回复', async () => {
    const result = await fetchNativeCommentReplies('netease', '99', 456, 0);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ nick: '回复者', content: '同感' });
      expect(result.hasMore).toBe(false);
    }
  });

  it('安装后补齐 window.api 的评论方法', () => {
    installNativeCommentsApi();

    const api = (globalThis as { api?: Record<string, unknown> }).api;
    expect(api?.getComments).toBe(fetchNativeComments);
    expect(api?.getCommentReplies).toBe(fetchNativeCommentReplies);
  });
});
