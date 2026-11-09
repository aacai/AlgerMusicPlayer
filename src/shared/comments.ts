// 歌曲评论的共享类型：主进程抓取、preload 透传、渲染层展示共用

export type CommentProvider = 'qq' | 'netease';

export type CommentItem = {
  id: string;
  nick: string;
  avatar: string;
  /** Unix 毫秒 */
  time: number;
  content: string;
  liked: number;
  /** 回复某条评论时，被回复人的昵称 */
  replyTo?: string;
  /** 已随评论一起拿到的子回复（QQ 列表自带） */
  replies?: CommentItem[];
};

export type CommentsResult =
  | {
      ok: true;
      provider: CommentProvider;
      total: number;
      hot: CommentItem[];
      items: CommentItem[];
      /** 网易云解析出的歌曲 ID，用于继续拉取楼中楼 */
      songId?: number;
    }
  | { ok: false; error: string };

export type CommentRepliesResult =
  | {
      ok: true;
      provider: CommentProvider;
      total: number;
      items: CommentItem[];
      hasMore: boolean;
    }
  | { ok: false; error: string };
