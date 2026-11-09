import Sortable from 'sortablejs';
import { nextTick, onUnmounted, type Ref, watch } from 'vue';

export interface SongListDragOptions {
  /** 容器是否挂载且应当启用拖拽（如列表非空、位于当前 tab）。默认一直启用 */
  active?: Ref<boolean>;
  /** 是否禁用拖拽（如搜索过滤时） */
  disabled?: Ref<boolean>;
  /** 可作为拖拽单元的子元素选择器；不传则拖拽直接子元素 */
  draggable?: string;
  /** 仅当从此选择器元素（拖拽手柄）上按下时才开始拖拽；默认 '.drag-handle' */
  handle?: string;
  /** 不触发拖拽的元素选择器（如删除/操作按钮） */
  filter?: string;
  /** 拖拽结束回调，传入当前展示顺序下的原索引与目标索引 */
  onReorder: (from: number, to: number) => void;
}

/**
 * 在歌曲列表容器上接入 SortableJS 拖拽排序。
 * - 桌面端：从拖拽手柄（handle）按下直接拖拽
 * - 移动端：长按手柄 250ms 后进入拖拽（delayOnTouchOnly）
 * 容器出现/消失、启用/禁用均自动处理。
 */
export function useSongListDrag(
  containerRef: Ref<HTMLElement | null>,
  options: SongListDragOptions
): { init: () => void; destroy: () => void } {
  let sortable: Sortable | null = null;

  const isDisabled = (): boolean => options.disabled?.value ?? false;

  function init(): void {
    if (sortable || !containerRef.value) return;
    sortable = Sortable.create(containerRef.value, {
      animation: 150,
      delay: 250, // 触摸需长按 250ms 才进入拖拽；鼠标无需延迟直接拖
      delayOnTouchOnly: true, // 仅触摸启用长按，桌面鼠标拖拽不受影响
      draggable: options.draggable,
      handle: options.handle ?? '.drag-handle',
      filter: options.filter ?? '.song-item-operating',
      preventOnFilter: false,
      onEnd: (evt: any) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
        options.onReorder(oldIndex, newIndex);
      }
    });
    if (isDisabled()) sortable.option('disabled', true);
  }

  function destroy(): void {
    if (sortable) {
      sortable.destroy();
      sortable = null;
    }
  }

  watch(
    (): [boolean, boolean] => [options.active?.value ?? true, isDisabled()],
    ([active, disabled]) => {
      if (active && !disabled) {
        nextTick(init);
      } else {
        destroy();
      }
    },
    { immediate: true }
  );

  onUnmounted(destroy);

  return { init, destroy };
}
