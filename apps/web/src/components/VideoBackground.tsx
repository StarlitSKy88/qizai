import { useRef, useEffect } from 'react';
import { HERO_VIDEO_LOCAL_URL, HERO_VIDEO_SOURCE_URL } from '../constants/videos';

const VIDEO_URL = HERO_VIDEO_LOCAL_URL;

const FADE_DURATION_MS = 500;
const FADE_OUT_TRIGGER_S = 0.55;
const RESET_DELAY_MS = 100;

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const opacityRef = useRef(0);
  const fadingOutRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const startOpacityRef = useRef(0);
  const targetOpacityRef = useRef(1);

  const cancelAnim = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const startFade = (toOpacity: number) => {
    cancelAnim();
    startTimeRef.current = performance.now();
    startOpacityRef.current = opacityRef.current;
    targetOpacityRef.current = toOpacity;

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / FADE_DURATION_MS, 1);
      const newOpacity = startOpacityRef.current + (targetOpacityRef.current - startOpacityRef.current) * t;
      opacityRef.current = newOpacity;
      if (videoRef.current) {
        videoRef.current.style.opacity = String(newOpacity);
      }
      if (t < 1) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
      }
    };
    rafIdRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedData = () => {
      fadingOutRef.current = false;
      startFade(1);
    };

    const onTimeUpdate = () => {
      if (fadingOutRef.current) return;
      const remaining = (video.duration || 0) - video.currentTime;
      if (remaining > 0 && remaining < FADE_OUT_TRIGGER_S) {
        fadingOutRef.current = true;
        startFade(0);
      }
    };

    const onEnded = () => {
      fadingOutRef.current = false;
      opacityRef.current = 0;
      if (videoRef.current) videoRef.current.style.opacity = '0';
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
        }
        startFade(1);
      }, RESET_DELAY_MS);
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      cancelAnim();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black overflow-hidden absolute inset-0 -z-10">
      <video
        ref={videoRef}
        src={VIDEO_URL}
        muted
        autoPlay
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'translateY(17%)', opacity: 0 }}
      />
    </div>
  );
}