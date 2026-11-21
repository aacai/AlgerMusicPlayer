/** 兼容 axios 包装与直接响应，避免把整个响应对象当成歌单数组 */
export const normalizePersonalizedPlaylists = (response: unknown): any[] => {
  const axiosPayload =
    response && typeof response === 'object' && 'data' in response
      ? (response as { data: unknown }).data
      : response;
  const body =
    axiosPayload && typeof axiosPayload === 'object' && 'data' in axiosPayload
      ? (axiosPayload as { data: unknown }).data
      : axiosPayload;
  const result =
    body && typeof body === 'object' && 'result' in body
      ? (body as { result: unknown }).result
      : body;
  return Array.isArray(result) ? result : [];
};
