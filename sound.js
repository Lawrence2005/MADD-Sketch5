let audioCtx;
let masterGain;

let baseOsc;
let harmOsc;
let subOsc;

window.addEventListener("load", initSound);
window.addEventListener("click", unlockAudio, { once: true });

const scale = [0, 2, 4, 7, 9]; 

function initSound() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.35;
  masterGain.connect(audioCtx.destination);

  baseOsc = audioCtx.createOscillator();
  baseOsc.type = "triangle";

  harmOsc = audioCtx.createOscillator();
  harmOsc.type = "sine";

  subOsc = audioCtx.createOscillator();
  subOsc.type = "sine";

  const baseGain = audioCtx.createGain();
  const harmGain = audioCtx.createGain();
  const subGain = audioCtx.createGain();

  baseGain.gain.value = 0.4;
  harmGain.gain.value = 0.2;
  subGain.gain.value = 0.15;

  baseOsc.connect(baseGain);
  harmOsc.connect(harmGain);
  subOsc.connect(subGain);

  baseGain.connect(masterGain);
  harmGain.connect(masterGain);
  subGain.connect(masterGain);

  baseOsc.start();
  harmOsc.start();
  subOsc.start();

  requestAnimationFrame(updateSound);
}

function unlockAudio() {
  if (audioCtx && audioCtx.state !== "running") {
    audioCtx.resume();
  }
}

function updateSound() {
  if (!audioCtx) {
    requestAnimationFrame(updateSound);
    return;
  }

  const m = window.visualMetrics || {};

  const density = m.density ?? 0;
  const change = m.change ?? 0;

  const hour = m.currentEvent?.hour ?? 12;


  const rootFreq = map(hour, 0, 23, 110, 220); 


  const volume = map(density, 0, 1, 0.15, 0.55);
  masterGain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.08);


  const brightness = map(change, 0, 1, 0.8, 1.2);

  const idx = Math.floor(density * scale.length);
  const degree = scale[idx % scale.length];

  const freq = rootFreq * Math.pow(2, degree / 12);
  baseOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.08);
  harmOsc.frequency.setTargetAtTime(freq * 2 * brightness, audioCtx.currentTime, 0.08);
  subOsc.frequency.setTargetAtTime(freq * 0.5, audioCtx.currentTime, 0.08);

  requestAnimationFrame(updateSound);
}

function map(v, a1, a2, b1, b2) {
  const t = clamp((v - a1) / (a2 - a1), 0, 1);
  return b1 + (b2 - b1) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}