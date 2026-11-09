// 本地命名歌单 Store：持久化歌单、链接/文本导入、最近播放

import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { LocalPlaylist, LocalPlaylistEntry } from '@/types/localPlaylist';
import { parsePlaylistText } from '@/utils/localPlaylistUtils';

function newId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export const useLocalPlaylistStore = defineStore(
  'localPlaylist',
  () => {
    const playlists = ref<LocalPlaylist[]>([]);
    /** 最近播放的本地曲目 id，最多 20 条 */
    const recentIds = ref<string[]>([]);
    /** 用来给全部歌曲排序的歌单：条目、名称与来源链接（链接可为空，表示粘贴的是歌曲文本） */
    const sortEntries = ref<LocalPlaylistEntry[]>([]);
    const sortName = ref('');
    const sortLink = ref('');

    function findById(id: string): LocalPlaylist | undefined {
      return playlists.value.find((playlist) => playlist.id === id);
    }

    /**
     * 新增或覆盖歌单：同一个歌单链接再次导入是覆盖更新，不产生副本；
     * 名字重复时自动加 (2)、(3)
     */
    function upsert(playlist: LocalPlaylist): LocalPlaylist {
      const existingIndex = playlists.value.findIndex((item) => item.id === playlist.id);
      if (existingIndex >= 0) {
        playlists.value[existingIndex] = playlist;
        return playlist;
      }

      let uniqueName = playlist.name;
      let suffix = 2;
      while (playlists.value.some((item) => item.name === uniqueName)) {
        uniqueName = `${playlist.name} (${suffix++})`;
      }
      const created = { ...playlist, name: uniqueName };
      playlists.value.push(created);
      return created;
    }

    async function importFromLink(
      link: string,
      name = ''
    ): Promise<{ ok: boolean; error?: string; playlist?: LocalPlaylist }> {
      try {
        const result = await window.api.importLocalPlaylist(link);
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        const created = upsert({
          id: result.playlist.id,
          name: name.trim() || result.playlist.name,
          entries: result.playlist.entries,
          createdAt: Date.now()
        });
        return { ok: true, playlist: created };
      } catch (error: any) {
        return { ok: false, error: error?.message || '导入失败' };
      }
    }

    function importFromText(
      text: string,
      name = ''
    ): { ok: boolean; error?: string; playlist?: LocalPlaylist } {
      const entries = parsePlaylistText(text);
      if (entries.length === 0) {
        return { ok: false, error: '没解析出歌曲，每行一首「歌名 - 歌手」' };
      }
      const created = upsert({
        id: newId(),
        name: name.trim() || '粘贴的歌单',
        entries,
        createdAt: Date.now()
      });
      return { ok: true, playlist: created };
    }

    function removePlaylist(id: string): void {
      playlists.value = playlists.value.filter((playlist) => playlist.id !== id);
    }

    function renamePlaylist(id: string, name: string): void {
      const playlist = findById(id);
      const trimmed = name.trim();
      if (!playlist || !trimmed) return;
      playlist.name = trimmed;
    }

    /** 记录最近播放；重复播放只保留一条，队首最新 */
    function markRecent(id: string): void {
      recentIds.value = [id, ...recentIds.value.filter((item) => item !== id)].slice(0, 20);
    }

    return {
      playlists,
      recentIds,
      sortEntries,
      sortName,
      sortLink,
      findById,
      importFromLink,
      importFromText,
      removePlaylist,
      renamePlaylist,
      markRecent
    };
  },
  {
    persist: {
      key: 'local-playlist-store',
      storage: localStorage,
      pick: ['playlists', 'recentIds', 'sortEntries', 'sortName', 'sortLink']
    }
  }
);
