// 体感時間の計測：ページを開いてから、最初の画面のデータが表示されるまでの時間を測り、
// バックエンド（/api/perf/client）に送って Render のログに出す。
// performance.now() はページの読み込み開始からの経過時間なので、
// 計測するのは「ページを読み込んで最初に表示した画面」の1回だけにする（画面遷移後は測らない）。

import { authFetch } from '../api/client';

export type PerfPage = 'courses' | 'tasks';

export type ApiTimingSummary = {
  api_count: number;
  api_wall_ms: number;
  server_ms: number;
  apis: string[];
};

type ResourceLike = {
  name: string;
  startTime: number;
  responseEnd: number;
  serverTiming?: ReadonlyArray<{ name: string; duration: number }>;
};

// 読み込まれたリソースのうち /api/ への通信だけを集計する（テストしやすいよう純粋関数にしている）
export function summarizeApiTimings(entries: ResourceLike[], origin: string): ApiTimingSummary {
  const apiEntries = entries.filter((e) => {
    try {
      const url = new URL(e.name);
      return url.origin === origin && url.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  });
  if (apiEntries.length === 0) {
    return { api_count: 0, api_wall_ms: 0, server_ms: 0, apis: [] };
  }
  const start = Math.min(...apiEntries.map((e) => e.startTime));
  const end = Math.max(...apiEntries.map((e) => e.responseEnd));
  const serverMs = apiEntries.reduce((sum, e) => {
    const total = e.serverTiming?.find((t) => t.name === 'total');
    return sum + (total?.duration ?? 0);
  }, 0);
  return {
    api_count: apiEntries.length,
    api_wall_ms: end - start,
    server_ms: serverMs,
    apis: apiEntries.map((e) => new URL(e.name).pathname),
  };
}

let reported = false;

export function reportInitialLoad(page: PerfPage): void {
  if (reported) return;
  reported = true;

  // setState の後、React が描画して画面に出るのを待ってから測る（2フレーム待つ）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // 裏のタブで開いた場合は描画が止まり、体感時間として意味がないので送らない
      if (document.visibilityState !== 'visible') return;

      const totalMs = performance.now();
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const summary = summarizeApiTimings(entries, window.location.origin);
      const payload = { page, total_ms: totalMs, ...summary };

      console.info('[perf-client]', payload);
      void authFetch('/api/perf/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // 計測の送信に失敗しても、画面の動作には影響させない
      });
    });
  });
}
