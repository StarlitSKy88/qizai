import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import VideoBackground from '../../src/components/VideoBackground';

describe('VideoBackground', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;
  let now: number;

  beforeEach(() => {
    vi.useFakeTimers();
    rafCallbacks = new Map();
    rafId = 0;
    now = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function advanceFrames(count: number, msPerFrame = 16) {
    for (let i = 0; i < count; i++) {
      now += msPerFrame;
      vi.advanceTimersByTime(msPerFrame);
      const cbs = Array.from(rafCallbacks.values());
      rafCallbacks.clear();
      cbs.forEach(cb => cb(now));
    }
  }

  it('renders a <video> element with the cloudfront URL and translate-y-[17%]', () => {
    const { container } = render(<VideoBackground />);
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe(
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4'
    );
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain('min-h-screen');
    expect(wrap.className).toContain('bg-black');
    expect(wrap.className).toContain('overflow-hidden');
    const styleAttr = video?.getAttribute('style') ?? '';
    expect(styleAttr).toContain('translateY(17%)');
  });

  it('starts opacity at 0 then fades in to 1 over 500ms on loadeddata', () => {
    const { container } = render(<VideoBackground />);
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });

    // Trigger loadeddata
    video.dispatchEvent(new Event('loadeddata'));

    // After ~32 frames (~500ms at 16ms/frame)
    advanceFrames(32, 16);

    const op = parseFloat(video.style.opacity);
    expect(op).toBeGreaterThanOrEqual(0.99);
  });

  it('fades out when remaining < 0.55s, and does not re-trigger', () => {
    const { container } = render(<VideoBackground />);
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });
    video.dispatchEvent(new Event('loadeddata'));
    advanceFrames(32, 16);

    // Trigger timeUpdate near end
    Object.defineProperty(video, 'currentTime', { value: 9.6, configurable: true });
    video.dispatchEvent(new Event('timeupdate'));

    // First fade-out attempt: 32 frames should bring opacity back near 0
    advanceFrames(32, 16);
    const op1 = parseFloat(video.style.opacity);
    expect(op1).toBeLessThan(0.05);

    // Second timeUpdate should NOT re-trigger
    Object.defineProperty(video, 'currentTime', { value: 9.7, configurable: true });
    video.dispatchEvent(new Event('timeupdate'));
    advanceFrames(32, 16);
    const op2 = parseFloat(video.style.opacity);
    expect(op2).toBeLessThan(0.05);
  });

  it('on ended, resets currentTime to 0 and starts a new fade-in', () => {
    const { container } = render(<VideoBackground />);
    const video = container.querySelector('video') as HTMLVideoElement;
    const playMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });
    Object.defineProperty(video, 'play', { value: playMock, configurable: true });
    Object.defineProperty(video, 'currentTime', { value: 0, configurable: true, writable: true });

    video.dispatchEvent(new Event('loadeddata'));
    advanceFrames(32, 16);

    video.dispatchEvent(new Event('ended'));
    advanceFrames(7, 16); // 100ms

    expect(video.currentTime).toBe(0);
    expect(playMock).toHaveBeenCalled();

    // After fade-in
    advanceFrames(32, 16);
    const op = parseFloat(video.style.opacity);
    expect(op).toBeGreaterThanOrEqual(0.99);
  });
});