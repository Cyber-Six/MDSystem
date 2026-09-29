const loadSoundModule = () => {
  jest.resetModules();
  return require('./notification-sound');
};

describe('staff notification sound utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    global.Audio = jest.fn(() => ({ addEventListener: jest.fn(), play: jest.fn(() => Promise.resolve()) }));
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete global.Audio;
  });

  test('publishes the sound manifest and safely handles absent AudioContext support', () => {
    const { AVAILABLE_SOUNDS, resumeAudioContext } = loadSoundModule();
    expect(AVAILABLE_SOUNDS.map(({ id }) => id)).toContain('synthesis');
    expect(() => resumeAudioContext()).not.toThrow();
  });

  test('plays valid file sounds, rejects unsafe names, and throttles repetitions', () => {
    const { playNotificationSound } = loadSoundModule();
    playNotificationSound(2, 'gentle-bell.wav');
    const audio = global.Audio.mock.results[0].value;
    expect(global.Audio).toHaveBeenCalledWith('/sounds/gentle-bell.wav');
    expect(audio.volume).toBe(1);
    playNotificationSound(1, '../unsafe.wav');
    expect(global.Audio).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(801);
    playNotificationSound(0, 'soft-pop.wav');
    expect(global.Audio).toHaveBeenCalledTimes(1);
  });

  test('plays the synthesized fallback after a file error', () => {
    const gains = [];
    window.AudioContext = jest.fn(() => ({
      state: 'running', currentTime: 0, destination: {},
      createGain: () => { const gain = { gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() }, connect: jest.fn() }; gains.push(gain); return gain; },
      createOscillator: () => ({ frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }, connect: jest.fn(), start: jest.fn(), stop: jest.fn() }),
    }));
    const { playNotificationSound } = loadSoundModule();
    playNotificationSound(0.5, 'gentle-bell.wav', 'synthesis');
    global.Audio.mock.results[0].value.addEventListener.mock.calls[0][1]();
    expect(gains).toHaveLength(2);
  });
});
