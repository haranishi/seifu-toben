/** NDLは応答の取得完了後に数秒空け、同時リクエストを避けるよう求めている。 */
export const NDL_REQUEST_GAP_MS = 3000;

export function createNdlFetcher({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => performance.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let queue = Promise.resolve();
  let nextRequestAt = 0;

  return (url) => {
    const request = queue.then(async () => {
      const delay = nextRequestAt - now();
      if (delay > 0) await sleep(delay);
      try {
        const response = await fetchImpl(url);
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`国会会議録APIが応答しませんでした（HTTP ${response.status}）`);
        }
        // JSON本文の受領まで待ってから、次の取得までの間隔を測る。
        return await response.json();
      } finally {
        nextRequestAt = now() + NDL_REQUEST_GAP_MS;
      }
    });
    // 失敗も次のリクエストまで待つ。キュー自体は失敗で詰まらせない。
    queue = request.catch(() => {});
    return request;
  };
}
