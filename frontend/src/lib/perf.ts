// 体感時間の計測：ページを開いてから、最初の画面のデータが表示されるまでの時間を測り、
// バックエンド（/api/perf/client）に送って Render のログに出す。
// performance.now() はページの読み込み開始からの経過時間なので、
// 計測するのは「ページを読み込んで最初に表示した画面」の1回だけにする（画面遷移後は測らない）。

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

// 受信API（/api/perf/client）が受け付ける apis の上限
const MAX_APIS = 50;

const PAGE_PATHS: Record<PerfPage, string> = { courses: '/courses', tasks: '/tasks' };

// 読み込みから計測までの間に一度でもタブが裏に回ったら、描画が止まって時間が伸びるので送らない。
// （裏にある間は requestAnimationFrame が止まり、表に戻ってから計測に進むことがある）
let wasHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') wasHidden = true;
  });
}

// ページを読み込んで最初に表示した画面。その画面のデータが表示されたときだけ測る
let firstPage: PerfPage | null = null;

// 画面がデータの取得を始めるときに呼ぶ。最初に呼んだ画面だけが計測の対象になる
export function startInitialLoad(page: PerfPage): void {
  if (firstPage === null) firstPage = page;
}

export function reportInitialLoad(page: PerfPage): void {
  // 最初の画面以外（読み込み後に移った画面）は、ユーザーの操作時間が混ざるので測らない
  if (reported || page !== firstPage) return;
  // 計測するのは最初の画面の1回だけ。送らなかった場合も、以降の画面では測らない
  reported = true;

  // 取得が終わる前に別の画面へ移っていたら、その表示は見えていないので送らない
  if (window.location.pathname !== PAGE_PATHS[page]) return;

  // setState の後、React が描画して画面に出るのを待ってから測る（2フレーム待つ）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (wasHidden) return;

      const totalMs = performance.now();
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const summary = summarizeApiTimings(entries, window.location.origin);
      const payload = {
        page,
        total_ms: totalMs,
        ...summary,
        apis: summary.apis.slice(0, MAX_APIS),
      };

      console.info('[perf-client]', payload);
      void sendReport(payload);
    });
  });
}

async function sendReport(payload: unknown): Promise<void> {
  try {
    // authFetch は 401 のときにログアウトして /login へ移動する。計測の送信でそれが起きないよう、
    // ここではトークンだけ付けて普通の fetch で送り、結果は見ない。
    // また lib/supabase は読み込んだ時点で初期化される（環境変数が無いと例外になる）ので、
    // このモジュールを読み込むだけでそれが起きないよう、送るときに初めて読み込む。
    const { supabase } = await import('./supabase');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch('/api/perf/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    // 計測の送信に失敗しても、画面の動作には影響させない
  }
}
