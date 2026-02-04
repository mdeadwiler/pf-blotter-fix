import { useCallback, useRef, useEffect } from 'react';

// Sound effects using Web Audio API (no external files needed)
export function useSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(true);

  useEffect(() => {
    // Load preference from localStorage
    const stored = localStorage.getItem('quantblottersim_sound');
    enabledRef.current = stored !== 'false';
  }, []);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!enabledRef.current) return;
    
    try {
      const ctx = getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch {
      // Audio not supported
    }
  }, [getContext]);

  const playFill = useCallback(() => {
    // Pleasant ascending chime for fills
    playTone(523, 0.1, 'sine'); // C5
    setTimeout(() => playTone(659, 0.1, 'sine'), 50); // E5
    setTimeout(() => playTone(784, 0.15, 'sine'), 100); // G5
  }, [playTone]);

  const playReject = useCallback(() => {
    // Low descending tone for rejects
    playTone(330, 0.15, 'square'); // E4
    setTimeout(() => playTone(262, 0.2, 'square'), 100); // C4
  }, [playTone]);

  const playNew = useCallback(() => {
    // Quick blip for new order
    playTone(440, 0.05, 'sine'); // A4
  }, [playTone]);

  const playCancel = useCallback(() => {
    // Soft low tone for cancel
    playTone(294, 0.1, 'triangle'); // D4
  }, [playTone]);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
    localStorage.setItem('quantblottersim_sound', String(enabled));
  }, []);

  const isEnabled = useCallback(() => enabledRef.current, []);

  return { playFill, playReject, playNew, playCancel, setEnabled, isEnabled };
}
