let ctx, master, verbConv, verbSend, verbWet;
const M = { density: 0.3, change: 0.1, chaos: 0.1 }; 

window.addEventListener("load", boot);
window.addEventListener("click",      resume, { once: true });
window.addEventListener("touchstart", resume, { once: true });
window.addEventListener("aol-search-step", e => {
  const d = e.detail || {};
  M.density = clamp(d.density ?? M.density, 0, 1);
  M.change  = clamp(d.change  ?? M.change,  0, 1);
  M.chaos   = clamp(d.chaos   ?? M.chaos,   0, 1);
});

const PITCHES = (() => {
  const C2 = 65.406;
  const out = [];
  for (let semitone = 0; semitone < 72; semitone++) {
    out.push(C2 * Math.pow(2, semitone / 12));
  }
  return out;
})();

const VOICE_COUNT = 14;
const voices = [];

function boot() {
  ctx    = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;

  verbConv = ctx.createConvolver();
  verbSend = ctx.createGain();
  verbWet  = ctx.createGain();
  buildIR(verbConv, 1.4, 2.5);
  verbSend.gain.value = 0.28;
  verbWet.gain.value  = 0.28;
  verbSend.connect(verbConv);
  verbConv.connect(verbWet);
  verbWet.connect(ctx.destination);
  master.connect(ctx.destination);

  for (let i = 0; i < VOICE_COUNT; i++) voices.push(makeVoice(i));
  tick();
}

function resume() {
  if (!ctx) return;
  ctx.resume().then(() => {
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 1.5);
  });
}

function makeVoice(i) {
  const t     = ctx.currentTime;
  const pitch = PITCHES[Math.floor(Math.random() * PITCHES.length)];

  const osc = ctx.createOscillator();
  osc.type  = "sawtooth";
  osc.frequency.value = pitch;

  const cutoff = 600 * Math.pow(10, Math.random() * Math.log10(10)); // log-uniform 600–6000
  const Q      = 0.5 + Math.random() * 4.5;

  const filt = ctx.createBiquadFilter();
  filt.type  = "lowpass";
  filt.frequency.value = cutoff;
  filt.Q.value = Q;

  const hp = ctx.createBiquadFilter();
  hp.type   = "highpass";
  hp.frequency.value = 80;

  const envNode = ctx.createGain();
  envNode.gain.value = 0.0001;

  const panNode = ctx.createStereoPanner();
  panNode.pan.value = (Math.random() * 2 - 1) * 0.75;

  osc.connect(hp);
  hp.connect(filt);
  filt.connect(envNode);
  envNode.connect(panNode);
  panNode.connect(master);
  panNode.connect(verbSend);

  osc.start(t);

  const pitchIdx = PITCHES.indexOf(pitch);

  return {
    osc, filt, envNode, panNode,
    pitch, pitchIdx, cutoff, Q,
    recentIdxs: [pitchIdx],
    maxMemory:  6 + Math.floor(Math.random() * 6), 
    nextHop:    t + 0.3 + Math.random() * 1.5,
    driftPhase: Math.random() * Math.PI * 2,
    driftRate:  0.03 + Math.random() * 0.18, 
    envTarget:  0.0001,
    silenced:     false,
    silenceUntil: 0,
  };
}

function pickNextPitch(v) {
  const { chaos } = M;

  const minJump = 1;
  const maxJump = Math.round(8 + chaos * 16);

  let candidate;
  let attempts = 0;

  do {
    const jump = minJump + Math.floor(Math.random() * (maxJump - minJump + 1));
    const sign = Math.random() < 0.5 ? 1 : -1;
    let newIdx = v.pitchIdx + sign * jump;

    newIdx = clamp(newIdx, 0, PITCHES.length - 1);

    if (newIdx === 0 || newIdx === PITCHES.length - 1) {
      newIdx = clamp(v.pitchIdx - sign * jump, 0, PITCHES.length - 1);
    }

    candidate = newIdx;
    attempts++;
  } while (v.recentIdxs.includes(candidate) && attempts < 20);

  v.recentIdxs.push(candidate);
  if (v.recentIdxs.length > v.maxMemory) v.recentIdxs.shift();

  return candidate;
}

function triggerNote(v, pitchIdx) {
  const t     = ctx.currentTime;
  const pitch = PITCHES[pitchIdx];


  v.osc.frequency.cancelScheduledValues(t);
  v.osc.frequency.setValueAtTime(pitch, t);

  const peak = v.envTarget > 0.001 ? v.envTarget : 0.03;
  v.envNode.gain.cancelScheduledValues(t);
  v.envNode.gain.setValueAtTime(0.0001, t);
  v.envNode.gain.linearRampToValueAtTime(peak, t + 0.008);

  v.pitch    = pitch;
  v.pitchIdx = pitchIdx;
}

let lastTs = 0;

function tick(ts = 0) {
  requestAnimationFrame(tick);
  if (!ctx || ctx.state !== "running") return;

  const dt = clamp((ts - lastTs) / 1000, 0, 0.08);
  lastTs = ts;

  const t = ctx.currentTime;
  const { density, change, chaos } = M;

  voices.forEach(v => {

    if (v.silenced) {
      if (t >= v.silenceUntil) {
        v.silenced = false;
        triggerNote(v, pickNextPitch(v));
        v.nextHop = t + hopInterval();
      }
      return;
    }

    const restChance = dt * (0.01 + (1 - density) * 0.04 + chaos * 0.02);
    if (Math.random() < restChance) {
      v.silenced     = true;
      v.silenceUntil = t + 0.4 + Math.random() * 2.5;
      v.envNode.gain.cancelScheduledValues(t);
      v.envNode.gain.setValueAtTime(v.envNode.gain.value, t);
      v.envNode.gain.linearRampToValueAtTime(0.0001, t + 0.12);
      return;
    }

    if (t >= v.nextHop) {
      triggerNote(v, pickNextPitch(v));
      v.nextHop = t + hopInterval();
    }

    v.driftPhase += dt * v.driftRate * Math.PI * 2;
    const drift = 0.5 + 0.5 * Math.sin(v.driftPhase);

    const baseAmp  = 0.018 + density * 0.045 + change * 0.02;
    const envTarget = baseAmp * (0.45 + drift * 0.65);
    v.envTarget    = envTarget;

    v.envNode.gain.setTargetAtTime(envTarget, t, 0.3);

    const breathCutoff = v.cutoff * (0.7 + change * 0.6 + chaos * 0.3);
    v.filt.frequency.setTargetAtTime(clamp(breathCutoff, 200, 8000), t, 0.5);
  });

  verbSend.gain.setTargetAtTime(0.12 + (1 - density) * 0.28, t, 1.0);
}

function hopInterval() {
  return Math.max(0.4, 0.4 + Math.random() * 2.1 - M.chaos * 0.8);
}

function buildIR(conv, dur, decay) {
  const rate = ctx.sampleRate;
  const len  = Math.ceil(rate * dur);
  const ir   = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  conv.buffer = ir;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }