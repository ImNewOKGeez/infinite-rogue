let audioCtx = null;
let master = null;
let _noiseBuf = null;
let _enemyAudioWindowStart = 0;
let _enemyAudioCount = 0;

const ENEMY_AUDIO_WINDOW = 0.08;
const ENEMY_AUDIO_MAX = 6;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (!master) {
    master = audioCtx.createGain();
    master.gain.value = 0.35;
    master.connect(audioCtx.destination);
  }
  return audioCtx;
}

export function initAudio() {
  try {
    getAudioCtx();
  } catch (e) {}
}

export function resumeAudio() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
}

// --- internal helpers ---

function n() {
  return getAudioCtx().currentTime;
}

function allowEnemyAudio() {
  try {
    getAudioCtx();
  } catch (e) {
    return false;
  }
  const t = n();
  if (t - _enemyAudioWindowStart > ENEMY_AUDIO_WINDOW) {
    _enemyAudioWindowStart = t;
    _enemyAudioCount = 0;
  }
  if (_enemyAudioCount >= ENEMY_AUDIO_MAX) return false;
  _enemyAudioCount++;
  return true;
}

function getNoiseBuf() {
  if (_noiseBuf) return _noiseBuf;
  const ctx = getAudioCtx();
  _noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = _noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return _noiseBuf;
}

// one-shot oscillator with gain envelope
function osc(type, freq, gainVal, attack, decay, freqEnd = null) {
  const ctx = getAudioCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = n();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gainVal, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

// delayed osc
function oscAt(delay, type, freq, gainVal, attack, decay) {
  const ctx = getAudioCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = n() + delay;
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gainVal, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

// filtered noise burst
function noiseShot(gainVal, attack, decay, filterType, filterFreq, filterQ = 1) {
  const ctx = getAudioCtx();
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
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + attack + decay + 0.05);
}

// --- public sound functions ---

export function playCryoFire() {
  // icy high-freq noise — shorter and quieter so rapid fire doesn't grate
  noiseShot(0.1, 0.003, 0.07, 'highpass', 2800);
  // subtle pitch sweep down
  osc('sine', 900, 0.06, 0.003, 0.09, 340);
}

export function playCryoStormSound() {
  osc('triangle', 1200, 0.045, 0.01, 0.15, 850);
  osc('sine', 1600, 0.03, 0.01, 0.15, 1100);
}

export function playGlacialLanceSound() {
  osc('sine', 80, 0.14, 0.01, 0.4, 60);
  osc('sawtooth', 2000, 0.075, 0.01, 0.3, 400);
}

export function playPulseFire() {
  // sharp energy crack — the "pulse" character
  noiseShot(0.38, 0.002, 0.045, 'bandpass', 2200, 5);
  // impact body — sawtooth keeps harmonics so it doesn't sit in pure sub
  osc('sawtooth', 190, 0.28, 0.003, 0.1, 95);
  // subtle weight underneath — much quieter and higher than before
  osc('sine', 160, 0.18, 0.003, 0.08, 85);
}

export function playEMPSound() {
  noiseShot(0.2, 0.002, 0.08, 'bandpass', 1600, 3.5);
  osc('triangle', 320, 0.18, 0.003, 0.12, 120);
  osc('sine', 760, 0.07, 0.002, 0.08, 240);
}

export function playCascadeSound() {
  const ctx = getAudioCtx();
  const t = n();
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuf();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + 0.2);
  filter.Q.value = 3.5;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
  src.stop(t + 0.24);
}

export function playTriplePulseSound(stage) {
  const tones = {
    1: { freq: 600, gain: 0.16, decay: 0.15, end: 420 },
    2: { freq: 400, gain: 0.12, decay: 0.2, end: 250 },
    3: { freq: 250, gain: 0.1, decay: 0.3, end: 120 },
  };
  const tone = tones[stage] || tones[1];
  osc('triangle', tone.freq, tone.gain, 0.003, tone.decay, tone.end);
  noiseShot(stage === 1 ? 0.04 : stage === 2 ? 0.03 : 0.025, 0.002, tone.decay * 0.5, 'bandpass', tone.freq * 2, 2);
}

export function playArcSound() {
  const ctx = getAudioCtx();
  const t = n();
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const curve = new Float32Array(256);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 8);
  }
  shaper.curve = curve;
  shaper.oversample = '4x';
  o1.type = 'sawtooth';
  o2.type = 'square';
  o1.frequency.setValueAtTime(800, t);
  o2.frequency.setValueAtTime(830, t);
  o1.frequency.exponentialRampToValueAtTime(120, t + 0.15);
  o2.frequency.exponentialRampToValueAtTime(110, t + 0.15);
  lfo.type = 'sine';
  lfo.frequency.value = 40;
  lfoGain.gain.value = 55;
  filter.type = 'bandpass';
  filter.frequency.value = 1600;
  filter.Q.value = 2;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.16, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  lfo.connect(lfoGain);
  lfoGain.connect(o1.frequency);
  lfoGain.connect(o2.frequency);
  o1.connect(shaper);
  o2.connect(shaper);
  shaper.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  o1.start(t);
  o2.start(t);
  lfo.start(t);
  o1.stop(t + 0.18);
  o2.stop(t + 0.18);
  lfo.stop(t + 0.18);
}

export function playArcBladeSound() {
  osc('triangle', 800, 0.14, 0.002, 0.1, 400);
  noiseShot(0.035, 0.0015, 0.05, 'highpass', 2200);
}

export function playArcBladeReturnSound() {
  osc('sine', 400, 0.06, 0.002, 0.08, 600);
  noiseShot(0.018, 0.001, 0.03, 'bandpass', 900, 1.2);
}

export function playMolotovThrowSound() {
  osc('triangle', 300, 0.1, 0.003, 0.15, 150);
}

export function playMolotovLandSound() {
  const ctx = getAudioCtx();
  const t = n();

  const impactOsc = ctx.createOscillator();
  const impactGain = ctx.createGain();
  impactOsc.type = 'triangle';
  impactOsc.frequency.setValueAtTime(100, t);
  impactOsc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
  impactGain.gain.setValueAtTime(0.0001, t);
  impactGain.gain.linearRampToValueAtTime(0.18, t + 0.005);
  impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  impactOsc.connect(impactGain);
  impactGain.connect(master);
  impactOsc.start(t);
  impactOsc.stop(t + 0.14);

  const crackleOsc = ctx.createOscillator();
  const crackleGain = ctx.createGain();
  const crackleLfo = ctx.createOscillator();
  const crackleLfoGain = ctx.createGain();
  crackleOsc.type = 'square';
  crackleOsc.frequency.setValueAtTime(400, t);
  crackleLfo.type = 'square';
  crackleLfo.frequency.setValueAtTime(28, t);
  crackleLfoGain.gain.setValueAtTime(0.045, t);
  crackleGain.gain.setValueAtTime(0.0001, t);
  crackleGain.gain.linearRampToValueAtTime(0.05, t + 0.01);
  crackleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  crackleLfo.connect(crackleLfoGain);
  crackleLfoGain.connect(crackleGain.gain);
  crackleOsc.connect(crackleGain);
  crackleGain.connect(master);
  crackleOsc.start(t);
  crackleLfo.start(t);
  crackleOsc.stop(t + 0.2);
  crackleLfo.stop(t + 0.2);

  noiseShot(0.08, 0.002, 0.12, 'highpass', 1800, 1.5);
}

export function playBarrierAbsorbSound() {
  osc('triangle', 170, 0.24, 0.0015, 0.12, 120);
  osc('sine', 110, 0.12, 0.0015, 0.1, 85);
  noiseShot(0.09, 0.001, 0.08, 'bandpass', 700, 1.2);
}

export function playNovaDetonationSound() {
  const ctx = getAudioCtx();
  const t = n();
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuf();

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(300, t);
  noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.15);
  noiseFilter.Q.value = 2.5;

  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(300, t);
  tone.frequency.exponentialRampToValueAtTime(100, t + 0.15);

  const mix = ctx.createGain();
  const noiseGain = ctx.createGain();
  const toneGain = ctx.createGain();

  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.linearRampToValueAtTime(0.28, t + 0.004);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

  toneGain.gain.setValueAtTime(0.0001, t);
  toneGain.gain.linearRampToValueAtTime(0.18, t + 0.003);
  toneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

  src.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(mix);

  tone.connect(toneGain);
  toneGain.connect(mix);
  mix.connect(master);

  src.start(t);
  src.stop(t + 0.18);
  tone.start(t);
  tone.stop(t + 0.18);
}

export function playFrenzySound() {
  const ctx = getAudioCtx();
  const t = n();
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();

  o1.type = 'sawtooth';
  o2.type = 'square';
  o1.frequency.setValueAtTime(200, t);
  o2.frequency.setValueAtTime(220, t);
  o1.frequency.exponentialRampToValueAtTime(500, t + 0.2);
  o2.frequency.exponentialRampToValueAtTime(520, t + 0.2);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

  o1.connect(g);
  o2.connect(g);
  g.connect(master);
  o1.start(t);
  o2.start(t);
  o1.stop(t + 0.24);
  o2.stop(t + 0.24);
}

export function playHit(isSynergy = false) {
  if (!allowEnemyAudio()) return;
  if (isSynergy) {
    // impactful synergy strike — gold / crunchy
    noiseShot(0.32, 0.003, 0.1, 'bandpass', 1100, 3);
    osc('square', 260, 0.22, 0.003, 0.14);
  } else {
    noiseShot(0.16, 0.002, 0.055, 'bandpass', 950, 2);
  }
}

export function playEnemyDeath(frozen = false) {
  if (!allowEnemyAudio()) return;
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

export function playShatter() {
  if (!allowEnemyAudio()) return;
  noiseShot(0.48, 0.002, 0.12, 'highpass', 4200);
  noiseShot(0.22, 0.002, 0.08, 'bandpass', 1800, 5);
  osc('square', 1600, 0.12, 0.002, 0.08, 900);
  oscAt(0.035, 'sine', 2200, 0.1, 0.002, 0.09);
}

export function playPlayerHit() {
  // low impact thud + harsh tone
  osc('sawtooth', 95, 0.38, 0.005, 0.2, 55);
  noiseShot(0.45, 0.005, 0.18, 'lowpass', 500);
}

export function playDodge() {
  // quick upward swoosh — slick, evasive
  osc('sine', 520, 0.1, 0.003, 0.09, 1300);
}

export function playLevelUp() {
  // ascending cyberpunk arpeggio — square wave
  [0, 0.09, 0.18, 0.28].forEach((delay, i) => {
    oscAt(delay, 'square', [440, 554, 659, 880][i], 0.18, 0.008, 0.2);
  });
}

export function playDiscoverySound() {
  osc('triangle', 660, 0.09, 0.006, 0.09, 990);
  oscAt(0.08, 'sine', 990, 0.12, 0.005, 0.1);
  oscAt(0.16, 'triangle', 1320, 0.16, 0.005, 0.12);
  noiseShot(0.045, 0.002, 0.06, 'highpass', 2600);
}

export function playUIClick() {
  osc('triangle', 800, 0.045, 0.005, 0.06, 700);
}

export function playUIOpen() {
  osc('sine', 200, 0.05, 0.03, 0.12, 600);
}

export function playUIClose() {
  osc('sine', 600, 0.035, 0.002, 0.12, 200);
}

export function playUISelect() {
  osc('triangle', 600, 0.06, 0.004, 0.1, 500);
  osc('sine', 900, 0.04, 0.003, 0.1, 720);
}

export function playDeathSound() {
  osc('triangle', 300, 0.16, 0.01, 0.8, 60);
}

export function playAscensionOpen() {
  oscAt(0, 'sine', 400, 0.04, 0.05, 0.45);
  oscAt(0.05, 'triangle', 600, 0.045, 0.05, 0.45);
  oscAt(0.1, 'sine', 800, 0.035, 0.05, 0.45);
}

export function playXp() {
  // tiny high blip — quiet, pleasant
  osc('sine', 1400, 0.06, 0.003, 0.04);
}

export function playSurge() {
  // two-tone alarm pulse x2
  [0, 0.22].forEach(d => {
    oscAt(d, 'square', 440, 0.14, 0.005, 0.07);
    oscAt(d + 0.09, 'square', 660, 0.14, 0.005, 0.07);
  });
}

export function playDeath() {
  // descending tone
  osc('sawtooth', 440, 0.38, 0.005, 0.85, 58);
  // flatline beep after — delayed
  oscAt(0.72, 'sine', 440, 0.2, 0.02, 1.1);
}

let _bossMusicNodes = [];

export function startBossMusic() {
  const ctx = getAudioCtx();
  stopBossMusic();

  // deep bass drone
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = 'sawtooth';
  bass.frequency.value = 55;
  bassGain.gain.value = 0.1;
  bass.connect(bassGain);
  bassGain.connect(master);
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
  trem.connect(tremGain);
  tremGain.connect(midGain.gain);
  mid.connect(midGain);
  midGain.connect(master);
  mid.start();
  trem.start();

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
  pulseLFO.connect(pulseLFOGain);
  pulseLFOGain.connect(pulseGain.gain);
  pulse.connect(pulseGain);
  pulseGain.connect(master);
  pulse.start();
  pulseLFO.start();

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
  highVib.connect(highVibGain);
  highVibGain.connect(high.frequency);
  high.connect(highGain);
  highGain.connect(master);
  high.start();
  highVib.start();

  _bossMusicNodes = [bass, mid, trem, pulse, pulseLFO, high, highVib];
}

export function stopBossMusic() {
  _bossMusicNodes.forEach(node => {
    try {
      node.stop();
    } catch (e) {}
  });
  _bossMusicNodes = [];
}

export function playBossWarning() {
  // low ominous pulse x3, building
  [0, 0.35, 0.65].forEach((d, i) => {
    oscAt(d, 'sawtooth', 80 + i * 20, 0.28 + i * 0.06, 0.01, 0.22);
    oscAt(d, 'square', 160 + i * 40, 0.1, 0.01, 0.18);
  });
  // high alarm spike at end
  oscAt(0.88, 'square', 880, 0.18, 0.005, 0.14);
  oscAt(0.96, 'square', 1100, 0.14, 0.005, 0.1);
}

export function playBossPhaseTwo() {
  // heavy distorted impact
  noiseShot(0.5, 0.005, 0.35, 'lowpass', 600);
  osc('sawtooth', 55, 0.45, 0.005, 0.4, 28);
  // rising alarm
  osc('square', 220, 0.22, 0.01, 0.5, 880);
}

export function playBossDeath() {
  // big explosion noise
  noiseShot(0.6, 0.005, 0.5, 'lowpass', 900);
  // descending rumble
  osc('sawtooth', 180, 0.5, 0.005, 0.7, 28);
  // victory chime sequence
  [0.3, 0.45, 0.6, 0.78].forEach((d, i) => {
    oscAt(d, 'sine', [660, 880, 1100, 1320][i], 0.2, 0.005, 0.25);
  });
}
