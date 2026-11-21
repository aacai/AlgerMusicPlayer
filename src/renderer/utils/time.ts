/** 秒数格式化为 mm:ss（超过一小时为 h:mm:ss） */
export const secondToMinute = (s: number): string => {
  if (!s || s < 0) return '00:00';
  const hour = Math.floor(s / 3600);
  const minute = Math.floor((s % 3600) / 60);
  const second = Math.floor(s % 60);
  const pad = (n: number): string => (n > 9 ? `${n}` : `0${n}`);
  if (hour > 0) return `${hour}:${pad(minute)}:${pad(second)}`;
  return `${pad(minute)}:${pad(second)}`;
};
