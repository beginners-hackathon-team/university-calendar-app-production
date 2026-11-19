import { describe, expect, it } from 'vitest';
import { summarizeApiTimings } from './perf';

const ORIGIN = 'https://example.com';

describe('summarizeApiTimings', () => {
  it('同じオリジンの /api/ だけを集計する', () => {
    const summary = summarizeApiTimings(
      [
        { name: `${ORIGIN}/assets/index.js`, startTime: 0, responseEnd: 50 },
        { name: 'https://holidays-jp.github.io/api/v1/date.json', startTime: 10, responseEnd: 90 },
        {
          name: `${ORIGIN}/api/me`,
          startTime: 100,
          responseEnd: 400,
          serverTiming: [
            { name: 'db', duration: 200 },
            { name: 'total', duration: 210 },
          ],
        },
        {
          name: `${ORIGIN}/api/courses/2026-3?x=1`,
          startTime: 150,
          responseEnd: 700,
          serverTiming: [{ name: 'total', duration: 410 }],
        },
      ],
      ORIGIN,
    );

    expect(summary.api_count).toBe(2);
    expect(summary.api_wall_ms).toBe(600); // 100 から 700 まで
    expect(summary.server_ms).toBe(620); // total だけを足す
    expect(summary.apis).toEqual(['/api/me', '/api/courses/2026-3']);
  });

  it('API呼び出しがなければ0を返す', () => {
    expect(summarizeApiTimings([], ORIGIN)).toEqual({
      api_count: 0,
      api_wall_ms: 0,
      server_ms: 0,
      apis: [],
    });
  });
});
