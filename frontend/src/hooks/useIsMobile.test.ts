import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from './useIsMobile';

type Listener = (event: MediaQueryListEvent) => void;

function installMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;

  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach(listener => listener({ matches: next } as MediaQueryListEvent));
    },
  };
}

describe('useIsMobile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects the initial matchMedia result', () => {
    installMatchMediaMock(true);
    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const mock = installMatchMediaMock(false);
    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(false);

    act(() => {
      mock.setMatches(true);
    });

    expect(result.current).toBe(true);
  });

  it('queries using breakpoint - 1 as the max-width', () => {
    installMatchMediaMock(false);
    renderHook(() => useIsMobile(768));
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });
});
