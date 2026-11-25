// Hearth & Ladle — tiny synthesized sound effects (WebAudio, no assets).
// Every sound is a few oscillator notes; nothing is loaded from the network.

let ctx = null;
let muted = false;

function audio() {
  if (ctx === null) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  pickup() { tone(520, 0.09, 'sine', 0.12, 0, 760); },
  place() { tone(300, 0.08, 'triangle', 0.12, 0, 210); },
  chop() { tone(180, 0.06, 'square', 0.08, 0, 120); },
  chopped() { tone(420, 0.12, 'triangle', 0.12, 0, 640); },
  sizzle() { tone(1400, 0.25, 'sawtooth', 0.03, 0, 900); },
  done() { tone(880, 0.14, 'sine', 0.14); tone(1320, 0.18, 'sine', 0.12, 0.09); },
  serve() { tone(660, 0.1, 'sine', 0.14); tone(880, 0.1, 'sine', 0.14, 0.08); tone(1174, 0.22, 'sine', 0.14, 0.16); },
  error() { tone(160, 0.18, 'sawtooth', 0.1, 0, 110); },
  burn() { tone(220, 0.3, 'square', 0.09, 0, 140); tone(220, 0.3, 'square', 0.09, 0.35, 140); },
  order() { tone(980, 0.12, 'sine', 0.1); tone(1240, 0.14, 'sine', 0.09, 0.1); },
  tick() { tone(1050, 0.05, 'sine', 0.07); },
  rush() { tone(523, 0.12, 'triangle', 0.12); tone(659, 0.12, 'triangle', 0.12, 0.1); tone(784, 0.2, 'triangle', 0.12, 0.2); },
  toggleMute() {
    muted = !muted;
    return muted;
  },
  isMuted() { return muted; },
};
