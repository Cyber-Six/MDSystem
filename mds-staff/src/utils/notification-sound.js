/**
 * Notification sound utility — synthesises a short two-note chime using the
 * Web Audio API. No external audio files are required; works in all modern
 * browsers that support AudioContext.
 *
 * Location: mds-staff/src/utils/notification-sound.js
 */

// Minimum gap (ms) between successive chimes to avoid an audio pile-up when
// several notifications arrive in rapid succession.
const THROTTLE_MS = 800;
let lastPlayTime = 0;

/**
 * Play a short two-note notification chime.
 *
 * @param {number} volume - Gain multiplier in the range [0, 1]. Defaults to 1.
 */
export function playNotificationSound(volume = 1) {
  const clampedVolume = Math.min(1, Math.max(0, Number(volume) || 0));
  if (clampedVolume === 0) return;

  const now = Date.now();
  if (now - lastPlayTime < THROTTLE_MS) return;
  lastPlayTime = now;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const t = ctx.currentTime;

    // ── Note 1: A5 (880 Hz) → E5 (659 Hz), onset at t ──────────────────────
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.28 * clampedVolume, t);
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
    gain2.gain.linearRampToValueAtTime(0.22 * clampedVolume, t + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
    gain2.connect(ctx.destination);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1175, t + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(880, t + 0.58);
    osc2.connect(gain2);
    osc2.start(t + 0.12);
    osc2.stop(t + 0.68);

    // Release the AudioContext once playback finishes.
    osc2.onended = () => {
      try { ctx.close(); } catch (_) { /* ignore */ }
    };
  } catch (_) {
    // Web Audio API unavailable or blocked by the browser's autoplay policy —
    // silently skip so the rest of the notification flow is unaffected.
  }
}
