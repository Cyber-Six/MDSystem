/**
 * Notification sound utility
 * ─────────────────────────────────────────────────────────────────────────────
 * Supports two playback modes:
 *
 *   1. Built-in synthesis  (id: 'synthesis')
 *      Generates a two-note chime via the Web Audio API.  Zero network cost,
 *      always available, works offline.
 *
 *   2. Custom audio file   (any other id)
 *      Plays a file from  public/sounds/<id>  e.g. /sounds/chime.mp3.
 *      Drop the file into  mds-staff/public/sounds/  and add an entry to
 *      AVAILABLE_SOUNDS below — no rebuild required.
 *
 * AVAILABLE_SOUNDS is the single source of truth for which sounds appear in
 * the Settings UI.  Add / remove entries freely.
 *
 * Chrome autoplay policy: an AudioContext must be resumed after the first user
 * gesture.  This module registers a one-shot click/keydown listener that
 * unlocks it automatically.  File-based playback uses HTMLAudioElement which
 * follows the same policy but recovers via the .play() promise.
 *
 * Location: mds-staff/src/utils/notification-sound.js
 */

// ── Sound manifest ─────────────────────────────────────────────────────────
// To add a custom sound:
//   1. Drop the audio file into  mds-staff/public/sounds/  (MP3, OGG or WAV)
//   2. Add an entry here:  { id: 'filename.mp3', label: 'My Sound' }
//   3. Save — no rebuild needed.
export const AVAILABLE_SOUNDS = [
  { id: 'synthesis', label: 'System Chime (Built-in)' },

  // ── Per-module pre-named files ─────────────────────────────────────────────
  // Drop a file with the exact name into  mds-staff/public/sounds/  and it
  // will play automatically for that module — no code change needed.
  { id: 'ack.mp3',                 label: 'Appointments' },
  { id: 'dee-dee-risa.mp3',        label: 'Requests'     },
  { id: 'fahhh.mp3',       label: 'Inventory'    },
  { id: 'bruh.mp3',                label: 'Health Chat'  },
  { id: 'tobol.mp3',             label: 'General'      },

  // ── Add more custom sounds below ──────────────────────────────────────────
  // { id: 'chime.mp3',      label: 'Chime'      },
  // { id: 'ping.mp3',       label: 'Ping'        },
  // { id: 'ding.wav',       label: 'Ding'        },
  // { id: 'pop.ogg',        label: 'Pop'         },
  // { id: 'soft-alert.mp3', label: 'Soft Alert'  },
];

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

// SECURITY: Only allow safe filenames — alphanumeric, dot, hyphen, underscore.
// This prevents path traversal when constructing the audio src URL.
const VALID_SOUND_FILE = /^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]{1,8}$/;

/**
 * Play a notification sound.
 *
 * @param {number} volume     - Gain multiplier [0, 1].  Defaults to 1.
 * @param {string} soundId    - Sound id from AVAILABLE_SOUNDS.
 *                              'synthesis' (default) uses Web Audio;
 *                              any other value plays  /sounds/<soundId>.
 * @param {string} fallbackId - Sound to play if <soundId> file is missing
 *                              or fails to load.  Defaults to 'synthesis'.
 *
 * Silently no-ops if:
 *  - volume is 0
 *  - called too soon after the previous chime (throttle)
 *  - AudioContext hasn't been unlocked yet (synthesis only)
 *  - the file name fails the security pattern check
 */
export function playNotificationSound(volume = 1, soundId = 'synthesis', fallbackId = 'synthesis') {
  const vol = Math.min(1, Math.max(0, Number(volume) || 0));
  if (vol === 0) return;

  const now = Date.now();
  if (now - lastPlayTime < THROTTLE_MS) return;
  lastPlayTime = now;

  // ── File-based playback ────────────────────────────────────────────────────
  if (soundId && soundId !== 'synthesis') {
    // SECURITY: validate filename before constructing URL
    if (!VALID_SOUND_FILE.test(soundId)) return;
    try {
      const audio = new Audio(`/sounds/${soundId}`);
      audio.volume = vol;
      // If the file is missing/unplayable, fall back to fallbackId.
      // We use the 'error' event (fires on 404 / bad format) rather than the
      // play() rejection (which fires on autoplay-policy blocks).
      audio.addEventListener('error', () => {
        if (fallbackId && fallbackId !== soundId) {
          _playSoundId(vol, fallbackId);
        }
      }, { once: true });
      audio.play().catch(() => {
        // Autoplay blocked — silently skip (don't fall back; user hasn't
        // gestured yet and the fallback would have the same problem).
      });
    } catch (_) { /* ignore */ }
    return;
  }

  // ── Synthesis (or fallback path) ───────────────────────────────────────────
  _playSynthesis(vol);
}

/** Internal: play synthesis chime. */
function _playSynthesis(vol) {
  try {
    const ctx = getCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
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

/** Internal: dispatch to the right playback mode without throttle-checking. */
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
  } catch (_) { /* ignore */ }
}
