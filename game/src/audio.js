// Velvet Vault sound: every noise is synthesised with WebAudio at runtime —
// no audio files, nothing loaded. The context starts on the first click or
// key press (browsers insist), and M mutes the lot.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let lastTick = 0;

  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      context = null;
    }
  }

  function tone(freq, seconds, type, gain, when, slideTo) {
    if (!context || muted) return;
    const start = context.currentTime + (when || 0);
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + seconds);
    amp.gain.setValueAtTime(gain || 0.15, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(amp);
    amp.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'triangle', 0.12, 0);
    },
    /** Soft rising tick while a cone holds the thief; throttled by the caller. */
    seenTick(intensity) {
      if (!context) return;
      const now = context.currentTime;
      if (now - lastTick < 0.22) return;
      lastTick = now;
      tone(520 + intensity * 420, 0.09, 'square', 0.06, 0);
    },
    loot() {
      tone(880, 0.12, 'triangle', 0.16, 0);
      tone(1318, 0.2, 'triangle', 0.16, 0.09);
    },
    decoy() {
      tone(2400, 0.06, 'square', 0.08, 0);
      tone(3100, 0.1, 'square', 0.07, 0.05);
      tone(1900, 0.14, 'square', 0.06, 0.12);
    },
    emp() {
      tone(1400, 0.35, 'sawtooth', 0.12, 0, 90);
      tone(220, 0.3, 'square', 0.08, 0.05, 60);
    },
    lockdown() {
      for (let i = 0; i < 3; i += 1) {
        tone(740, 0.16, 'square', 0.14, i * 0.34);
        tone(520, 0.16, 'square', 0.14, i * 0.34 + 0.17);
      }
    },
    caught() {
      tone(392, 0.22, 'sawtooth', 0.16, 0);
      tone(311, 0.22, 'sawtooth', 0.16, 0.2);
      tone(233, 0.45, 'sawtooth', 0.18, 0.4, 110);
    },
    clear() {
      tone(523, 0.14, 'triangle', 0.16, 0);
      tone(659, 0.14, 'triangle', 0.16, 0.12);
      tone(784, 0.26, 'triangle', 0.18, 0.24);
    },
    win() {
      const notes = [523, 659, 784, 1046, 784, 1046, 1318];
      notes.forEach((freq, index) => tone(freq, 0.24, 'triangle', 0.16, index * 0.14));
    },
  };
}
