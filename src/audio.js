let ctx = null;
let master = null;
let _noiseBuf = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (e) {}
}

export function resumeAudio() {
  if (ctx?.state === 'suspended') ctx.resume();
}

// --- internal helpers ---

function n() { return ctx.currentTime; }

function getNoiseBuf() {
  if (_noiseBuf) return _noiseBuf;
  _noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = _noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return _noiseBuf;
}

// one-shot oscillator with gain envelope
function osc(type, freq, gainVal, attack, decay, freqEnd = null) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = n();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gainVal, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + attack + decay + 0.05);
}

// delayed osc
function oscAt(delay, type, freq, gainVal, attack, decay) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = n() + delay;
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gainVal, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + attack + decay + 0.05);
}

// filtered noise burst
function noiseShot(gainVal, attack, decay, filterType, filterFreq, filterQ = 1) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuf();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const t = n();
  f.type = filterType;
  f.frequency.value = filterFreq;
  f.Q.value = filterQ;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gainVal, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + attack + decay + 0.05);
}

// --- public sound functions ---

export function playCryoFire() {
  if (!ctx) return;
  // icy high-freq noise — shorter and quieter so rapid fire doesn't grate
  noiseShot(0.1, 0.003, 0.07, 'highpass', 2800);
  // subtle pitch sweep down
  osc('sine', 900, 0.06, 0.003, 0.09, 340);
}

export function playPulseFire() {
  if (!ctx) return;
  // sharp energy crack — the "pulse" character
  noiseShot(0.38, 0.002, 0.045, 'bandpass', 2200, 5);
  // impact body — sawtooth keeps harmonics so it doesn't sit in pure sub
  osc('sawtooth', 190, 0.28, 0.003, 0.1, 95);
  // subtle weight underneath — much quieter and higher than before
  osc('sine', 160, 0.18, 0.003, 0.08, 85);
}

export function playEmpFire() {
  if (!ctx) return;
  // electric sawtooth sweep
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const t = n();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(200, t);
  o.frequency.linearRampToValueAtTime(55, t + 0.38);
  f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2.5;
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  o.connect(f); f.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.46);
  // high zap crackle
  noiseShot(0.13, 0.002, 0.1, 'highpass', 3200);
}

export function playHit(isSynergy = false) {
  if (!ctx) return;
  if (isSynergy) {
    // impactful synergy strike — gold / crunchy
    noiseShot(0.32, 0.003, 0.1, 'bandpass', 1100, 3);
    osc('square', 260, 0.22, 0.003, 0.14);
  } else {
    noiseShot(0.16, 0.002, 0.055, 'bandpass', 950, 2);
  }
}

export function playEnemyDeath(frozen = false) {
  if (!ctx) return;
  if (frozen) {
    // glass shatter — sharp high noise + tinkle tones
    noiseShot(0.4, 0.003, 0.14, 'highpass', 3800);
    osc('sine', 2400, 0.18, 0.002, 0.1);
    osc('sine', 1900, 0.12, 0.006, 0.16);
  } else {
    // satisfying pop
    noiseShot(0.28, 0.003, 0.09, 'lowpass', 1600);
    osc('sine', 160, 0.28, 0.003, 0.1, 60);
  }
}

export function playPlayerHit() {
  if (!ctx) return;
  // low impact thud + harsh tone
  osc('sawtooth', 95, 0.38, 0.005, 0.2, 55);
  noiseShot(0.45, 0.005, 0.18, 'lowpass', 500);
}

export function playDodge() {
  if (!ctx) return;
  // quick upward swoosh — slick, evasive
  osc('sine', 520, 0.1, 0.003, 0.09, 1300);
}

export function playLevelUp() {
  if (!ctx) return;
  // ascending cyberpunk arpeggio — square wave
  [0, 0.09, 0.18, 0.28].forEach((delay, i) => {
    oscAt(delay, 'square', [440, 554, 659, 880][i], 0.18, 0.008, 0.2);
  });
}

export function playXp() {
  if (!ctx) return;
  // tiny high blip — quiet, pleasant
  osc('sine', 1400, 0.06, 0.003, 0.04);
}

export function playSurge() {
  if (!ctx) return;
  // two-tone alarm pulse x2
  [0, 0.22].forEach(d => {
    oscAt(d,        'square', 440, 0.14, 0.005, 0.07);
    oscAt(d + 0.09, 'square', 660, 0.14, 0.005, 0.07);
  });
}

export function playDeath() {
  if (!ctx) return;
  // descending tone
  osc('sawtooth', 440, 0.38, 0.005, 0.85, 58);
  // flatline beep after — delayed
  oscAt(0.72, 'sine', 440, 0.2, 0.02, 1.1);
}

let _bossMusicNodes = [];

export function startBossMusic() {
  if (!ctx) return;
  stopBossMusic();

  // deep bass drone
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = 'sawtooth';
  bass.frequency.value = 55;
  bassGain.gain.value = 0.1;
  bass.connect(bassGain); bassGain.connect(master);
  bass.start();

  // mid tension drone with tremolo LFO
  const mid = ctx.createOscillator();
  const midGain = ctx.createGain();
  const trem = ctx.createOscillator();
  const tremGain = ctx.createGain();
  mid.type = 'sawtooth';
  mid.frequency.value = 110;
  midGain.gain.value = 0.07;
  trem.type = 'sine';
  trem.frequency.value = 5.5;
  tremGain.gain.value = 0.04;
  trem.connect(tremGain); tremGain.connect(midGain.gain);
  mid.connect(midGain); midGain.connect(master);
  mid.start(); trem.start();

  // rhythmic pulse — square LFO gates a square osc
  const pulse = ctx.createOscillator();
  const pulseGain = ctx.createGain();
  const pulseLFO = ctx.createOscillator();
  const pulseLFOGain = ctx.createGain();
  pulse.type = 'square';
  pulse.frequency.value = 82;
  pulseGain.gain.value = 0;
  pulseLFO.type = 'square';
  pulseLFO.frequency.value = 2.75; // ~165bpm
  pulseLFOGain.gain.value = 0.06;
  pulseLFO.connect(pulseLFOGain); pulseLFOGain.connect(pulseGain.gain);
  pulse.connect(pulseGain); pulseGain.connect(master);
  pulse.start(); pulseLFO.start();

  // high eerie tone — slow vibrato
  const high = ctx.createOscillator();
  const highGain = ctx.createGain();
  const highVib = ctx.createOscillator();
  const highVibGain = ctx.createGain();
  high.type = 'sine';
  high.frequency.value = 440;
  highGain.gain.value = 0.035;
  highVib.type = 'sine';
  highVib.frequency.value = 0.4;
  highVibGain.gain.value = 8;
  highVib.connect(highVibGain); highVibGain.connect(high.frequency);
  high.connect(highGain); highGain.connect(master);
  high.start(); highVib.start();

  _bossMusicNodes = [bass, mid, trem, pulse, pulseLFO, high, highVib];
}

export function stopBossMusic() {
  _bossMusicNodes.forEach(node => { try { node.stop(); } catch (e) {} });
  _bossMusicNodes = [];
}

export function playBossWarning() {
  if (!ctx) return;
  // low ominous pulse x3, building
  [0, 0.35, 0.65].forEach((d, i) => {
    oscAt(d, 'sawtooth', 80 + i * 20, 0.28 + i * 0.06, 0.01, 0.22);
    oscAt(d, 'square',   160 + i * 40, 0.1, 0.01, 0.18);
  });
  // high alarm spike at end
  oscAt(0.88, 'square', 880, 0.18, 0.005, 0.14);
  oscAt(0.96, 'square', 1100, 0.14, 0.005, 0.1);
}

export function playBossPhaseTwo() {
  if (!ctx) return;
  // heavy distorted impact
  noiseShot(0.5, 0.005, 0.35, 'lowpass', 600);
  osc('sawtooth', 55, 0.45, 0.005, 0.4, 28);
  // rising alarm
  osc('square', 220, 0.22, 0.01, 0.5, 880);
}

export function playBossDeath() {
  if (!ctx) return;
  // big explosion noise
  noiseShot(0.6, 0.005, 0.5, 'lowpass', 900);
  // descending rumble
  osc('sawtooth', 180, 0.5, 0.005, 0.7, 28);
  // victory chime sequence
  [0.3, 0.45, 0.6, 0.78].forEach((d, i) => {
    oscAt(d, 'sine', [660, 880, 1100, 1320][i], 0.2, 0.005, 0.25);
  });
}
