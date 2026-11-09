// 本地命名歌单：一个歌单里的条目只记「歌名 + 歌手」，播放时再和本地曲库匹配

export type LocalPlaylistEntry = {
  title: string;
  artist: string;
};

export type LocalPlaylist = {
  id: string;
  name: string;
  entries: LocalPlaylistEntry[];
  createdAt: number;
};

/** 歌单列表里的一行：本地有就是可播放的条目，没有则 track 为空 */
export type LocalPlaylistRow = {
  entry: LocalPlaylistEntry;
  track: import('./localMusic').LocalMusicEntry | null;
};
