/**
 * Notification sound utility for patient portal.
 *
 * Provides both synthesis and file-based playback so notification sound volume
 * behavior matches staff settings.
 */

export const AVAILABLE_SOUNDS = [
  { id: 'synthesis', label: 'System Chime (Built-in)' },
  { id: 'gentle-bell.wav', label: 'Gentle Bell' },
  { id: 'soft-pop.wav', label: 'Soft Pop' },
  { id: 'airy-ding.wav', label: 'Airy Ding' },
  { id: 'marimba-tap.wav', label: 'Marimba Tap' },
  { id: 'digital-blip.wav', label: 'Digital Blip' },
];

const THROTTLE_MS = 800;
let lastPlayTime = 0;

let sharedCtx = null;

function getCtx() {
  const AudioCtxClass =
    typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtxClass) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioCtxClass();
  }
  return sharedCtx;
}

export function resumeAudioContext() {
  try {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (_) {
    // ignore
  }
}

if (typeof document !== 'undefined') {
  const unlock = () => {
    resumeAudioContext();
    document.removeEventListener('click', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };
  document.addEventListener('click', unlock, true);
  document.addEventListener('keydown', unlock, true);
}

function _playChime(ctx, vol) {
  const t = ctx.currentTime;

  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0.28 * vol, t);
  gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  gain1.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, t);
  osc1.frequency.exponentialRampToValueAtTime(659, t + 0.38);
  osc1.connect(gain1);
  osc1.start(t);
  osc1.stop(t + 0.42);

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, t + 0.12);
  gain2.gain.linearRampToValueAtTime(0.22 * vol, t + 0.17);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
  gain2.connect(ctx.destination);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1175, t + 0.12);
  osc2.frequency.exponentialRampToValueAtTime(880, t + 0.58);
  osc2.connect(gain2);
  osc2.start(t + 0.12);
  osc2.stop(t + 0.68);
}

const VALID_SOUND_FILE = /^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]{1,8}$/;

export function playNotificationSound(volume = 1, soundId = 'synthesis', fallbackId = null) {
  const vol = Math.min(1, Math.max(0, Number(volume) || 0));
  if (vol === 0) return;

  const now = Date.now();
  if (now - lastPlayTime < THROTTLE_MS) return;
  lastPlayTime = now;

  if (soundId && soundId !== 'synthesis') {
    if (!VALID_SOUND_FILE.test(soundId)) return;
    try {
      const audio = new Audio(`/sounds/${soundId}`);
      audio.volume = vol;
      audio.addEventListener(
        'error',
        () => {
          if (fallbackId && fallbackId !== soundId) {
            _playSoundId(vol, fallbackId);
          }
        },
        { once: true },
      );
      audio.play().catch(() => {});
    } catch (_) {
      // ignore
    }
    return;
  }

  _playSynthesis(vol);
}

function _playSynthesis(vol) {
  try {
    const ctx = getCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') _playChime(ctx, vol);
        })
        .catch(() => {});
      return;
    }

    if (ctx.state === 'running') {
      _playChime(ctx, vol);
    }
  } catch (_) {
    // ignore
  }
}

function _playSoundId(vol, soundId) {
  if (!soundId || soundId === 'synthesis') {
    _playSynthesis(vol);
    return;
  }
  if (!VALID_SOUND_FILE.test(soundId)) return;
  try {
    const audio = new Audio(`/sounds/${soundId}`);
    audio.volume = vol;
    audio.play().catch(() => {});
  } catch (_) {
    // ignore
  }
}
