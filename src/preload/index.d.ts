import { ElectronAPI } from '@electron-toolkit/preload';

import type { AppUpdateState } from '../shared/appUpdate';

interface API {
  minimize: () => void;
  maximize: () => void;
  isMaximized: () => Promise<boolean>;
  onWindowMaximizedState: (callback: (maximized: boolean) => void) => () => void;
  toggleFullScreen: () => void;
  isFullScreen: () => Promise<boolean>;
  onWindowFullScreenState: (callback: (fullscreen: boolean) => void) => () => void;
  close: () => void;
  quitApp: () => void;
  dragStart: (data: any) => void;
  miniTray: () => void;
  miniWindow: () => void;
  restore: () => void;
  restart: () => void;
  resizeWindow: (width: number, height: number) => void;
  resizeMiniWindow: (showPlaylist: boolean) => void;
  openLyric: () => void;
  sendLyric: (data: any) => void;
  sendSong: (data: any) => void;
  unblockMusic: (id: number, data: any, enabledSources?: string[]) => Promise<any>;
  onLyricWindowClosed: (callback: () => void) => void;
  onLyricWindowReady: (callback: () => void) => void;
  getAppUpdateState: () => Promise<AppUpdateState>;
  checkAppUpdate: (manual?: boolean) => Promise<AppUpdateState>;
  downloadAppUpdate: () => Promise<AppUpdateState>;
  installAppUpdate: () => Promise<boolean>;
  openAppUpdatePage: () => Promise<boolean>;
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => void;
  removeAppUpdateListeners: () => void;
  onLanguageChanged: (callback: (locale: string) => void) => void;
  importCustomApiPlugin: () => Promise<{ name: string; content: string } | null>;
  importLxMusicScript: () => Promise<{ name: string; content: string } | null>;
  importMusicSourcePlugin: () => Promise<{ name: string; content: string; path?: string } | null>;
  fetchMusicSourcePlugin: (url: string) => Promise<{ name: string; content: string; url: string }>;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  getSearchSuggestions: (keyword: string) => Promise<any>;
  lxMusicHttpRequest: (request: { url: string; options: any; requestId: string }) => Promise<any>;
  lxMusicHttpCancel: (requestId: string) => Promise<void>;
  /** 扫描指定文件夹中的本地音乐文件 */
  scanLocalMusic: (folderPath: string) => Promise<{ files: string[]; count: number }>;
  /** 扫描指定文件夹中的本地音乐文件（包含修改时间） */
  scanLocalMusicWithStats: (
    folderPath: string
  ) => Promise<{ files: { path: string; modifiedTime: number }[]; count: number }>;
  /** 批量解析本地音乐文件元数据 */
  parseLocalMusicMetadata: (
    filePaths: string[]
  ) => Promise<import('../renderer/types/localMusic').LocalMusicMeta[]>;
  /** 默认曲库目录（~/Music/MELO），不存在时返回 null */
  getDefaultLocalMusicFolder: () => Promise<string | null>;
  /** 导入 QQ 音乐 / 网易云歌单链接 */
  importLocalPlaylist: (link: string) => Promise<
    | {
        ok: true;
        playlist: { id: string; name: string; entries: { title: string; artist: string }[] };
      }
    | { ok: false; error: string }
  >;
  /** QQ 音乐歌词回退：按歌名 + 歌手搜索，返回带时间轴的行 */
  getQqLyric: (
    title: string,
    artist: string
  ) => Promise<
    | {
        ok: true;
        lines: { time: number; text: string; trans: string }[];
        title: string;
        artist: string;
        mid: string;
        /** QQ 专辑封面 URL，取不到时为空串 */
        cover: string;
      }
    | { ok: false; error: string }
  >;
  /** 歌曲评论：provider=qq 或 netease；本地歌曲按歌名+歌手现搜 */
  getComments: (
    provider: 'qq' | 'netease',
    name: string,
    artist: string,
    page?: number,
    neteaseId?: number
  ) => Promise<
    | {
        ok: true;
        provider: 'qq' | 'netease';
        total: number;
        hot: import('../shared/comments').CommentItem[];
        items: import('../shared/comments').CommentItem[];
        songId?: number;
      }
    | { ok: false; error: string }
  >;
  /** 网易云楼中楼：QQ 的回复随评论列表一起返回 */
  getCommentReplies: (
    provider: 'qq' | 'netease',
    commentId: string,
    songId: number,
    offset?: number
  ) => Promise<import('../shared/comments').CommentRepliesResult>;
  /** 图片本地 LRU 缓存：命中返回 local:// 地址，失败时渲染进程回退远程地址 */
  cacheImage: (url: string) => Promise<import('../shared/imageCache').CachedImageResult>;
  // Download manager
  downloadAdd: (task: any) => Promise<string>;
  downloadAddBatch: (tasks: any) => Promise<{ batchId: string; taskIds: string[] }>;
  downloadPause: (taskId: string) => Promise<void>;
  downloadResume: (taskId: string) => Promise<void>;
  downloadCancel: (taskId: string) => Promise<void>;
  downloadCancelAll: () => Promise<void>;
  downloadGetQueue: () => Promise<any[]>;
  downloadSetConcurrency: (n: number) => void;
  downloadGetCompleted: () => Promise<any[]>;
  downloadDeleteCompleted: (filePath: string) => Promise<boolean>;
  downloadClearCompleted: () => Promise<boolean>;
  getEmbeddedLyrics: (filePath: string) => Promise<string | null>;
  downloadProvideUrl: (taskId: string, url: string) => Promise<void>;
  onDownloadProgress: (cb: (data: any) => void) => void;
  onDownloadStateChange: (cb: (data: any) => void) => void;
  onDownloadBatchComplete: (cb: (data: any) => void) => void;
  onDownloadRequestUrl: (cb: (data: any) => void) => void;
  removeDownloadListeners: () => void;
}

// 自定义IPC渲染进程通信接口
interface IpcRenderer {
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: (...args: any[]) => void) => () => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: API;
    ipcRenderer: IpcRenderer;
    $message: any;
  }
}
