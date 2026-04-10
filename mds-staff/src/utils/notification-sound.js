/**
 * Notification sound utility — synthesises a short two-note chime using the
 * Web Audio API. No external audio files are required; works in all modern
 * browsers that support AudioContext.
 *
 * Location: mds-staff/src/utils/notification-sound.js
 *
 * Chrome's autoplay policy (https://developer.chrome.com/blog/autoplay/#web_audio)
 * requires an AudioContext to be resumed/created AFTER a user gesture. This module
 * keeps ONE shared AudioContext for the lifetime of the page and registers a
 * one-shot click/keydown listener that unlocks it on the first user interaction.
 * Sound is silently skipped if the context is still suspended (pre-gesture).
 */

// Minimum gap (ms) between successive chimes to avoid an audio pile-up when
// several notifications arrive in rapid succession.
const THROTTLE_MS = 800;
let lastPlayTime = 0;

// ── Shared AudioContext ──────────────────────────────────────────────────────
// One instance per page. Avoids creating a new context on every notification
// which would trigger Chrome's "AudioContext was not allowed to start" warning.
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

/**
 * Resume the shared AudioContext after a user gesture.
 * Call this inside any click / keydown handler to unlock audio playback.
 * Safe to call multiple times.
 */
export function resumeAudioContext() {
  try {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (_) { /* ignore */ }
}

// Auto-unlock on the very first user interaction so callers don't have to
// wire resumeAudioContext() manually. The listeners are removed after the
// first successful unlock (capture phase = fires before child handlers).
if (typeof document !== 'undefined') {
  const unlock = () => {
    resumeAudioContext();
    document.removeEventListener('click',   unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };
  document.addEventListener('click',   unlock, true);
  document.addEventListener('keydown', unlock, true);
}

// ── Internal chime player ────────────────────────────────────────────────────

function _playChime(ctx, vol) {
  const t = ctx.currentTime;

  // ── Note 1: A5 (880 Hz) → E5 (659 Hz), onset at t ──────────────────────
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

  // ── Note 2: D6 (1175 Hz) → A5 (880 Hz), onset at t + 120 ms ────────────
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

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Play a short two-note notification chime.
 *
 * Silently no-ops if:
 *  - volume is 0
 *  - called too soon after the previous chime (throttle)
 *  - the AudioContext hasn't been unlocked by a user gesture yet
 *  - the Web Audio API is unavailable
 *
 * @param {number} volume - Gain multiplier in the range [0, 1]. Defaults to 1.
 */
export function playNotificationSound(volume = 1) {
  const vol = Math.min(1, Math.max(0, Number(volume) || 0));
  if (vol === 0) return;

  const now = Date.now();
  if (now - lastPlayTime < THROTTLE_MS) return;
  lastPlayTime = now;

  try {
    const ctx = getCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      // Context not yet unlocked by user gesture — attempt a resume then play.
      // If the resume is blocked (still no gesture), the catch swallows it silently.
      ctx.resume().then(() => {
        if (ctx.state === 'running') _playChime(ctx, vol);
      }).catch(() => {});
      return;
    }

    if (ctx.state === 'running') {
      _playChime(ctx, vol);
    }
  } catch (_) {
    // Web Audio API unavailable or any unexpected error — silently skip.
  }
}
