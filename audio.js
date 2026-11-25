/* RaktBeej audio. Sounds come from assets/sfx/<name>.mp3 and music from assets/music/<track>.mp3.
   If a file is missing, effects fall back to a built-in synthesised sound and music is simply skipped.
   Replace any file with your own using the same name. */
var RBAudio = (function () {
  'use strict';
  var SFX = ['swing', 'hit', 'hit_heavy', 'collect', 'combo', 'clone', 'hurt', 'kill', 'win', 'lose', 'dash', 'fury', 'pickup', 'roar', 'slam', 'arrow', 'ui', 'levelup', 'shield'];
  var gate = function () { return { sfx: true, music: true }; };
  var ctx = null, master = null, buffers = {}, loading = false, suspended = false;
  var MUSIC_VOL = 0.5;
  var el = null, want = null, cur = null, vol = 0, missing = {}, unlocked = false;

  function setGate(fn) { gate = fn; }
  function getCtx() {
    if (!ctx) {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ctx = new A(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && !suspended) { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function loadAll() {
    if (loading || !getCtx()) return; loading = true;
    SFX.forEach(function (n) {
      try {
        fetch('assets/sfx/' + n + '.mp3').then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
          .then(function (b) { return new Promise(function (res, rej) { ctx.decodeAudioData(b, res, rej); }); })
          .then(function (buf) { buffers[n] = buf; }).catch(function () {});
      } catch (e) {}
    });
  }
  function unlock() {
    if (unlocked) { getCtx(); return; }
    unlocked = true; getCtx(); loadAll();
    if (!el) { el = new Audio(); el.loop = true; el.preload = 'auto'; el.addEventListener('error', function () { if (cur) { missing[cur] = true; cur = null; } }); }
    syncMusic(true);
  }

  // ---- synth fallbacks (used only when the mp3 is missing) ----
  function tone(f, d, type, v, f2) {
    var c = getCtx(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, c.currentTime);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + d);
    g.gain.setValueAtTime(v || 0.1, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
    o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + d);
  }
  function noise(d, v, f) {
    var c = getCtx(); if (!c) return;
    var len = Math.floor(c.sampleRate * d), b = c.createBuffer(1, len, c.sampleRate), a = b.getChannelData(0);
    for (var i = 0; i < len; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    var s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = f; g.gain.value = v; s.connect(fl); fl.connect(g); g.connect(master); s.start();
  }
  function synth(n) {
    if (n === 'swing' || n === 'dash') noise(0.15, 0.35, 1800);
    else if (n === 'hit' || n === 'hit_heavy' || n === 'slam') { tone(140, 0.2, 'square', 0.12, 45); noise(0.12, 0.4, 900); }
    else if (n === 'collect' || n === 'combo' || n === 'pickup' || n === 'ui') tone(880, 0.1, 'sine', 0.1, 1320);
    else if (n === 'clone' || n === 'roar') tone(110, 0.5, 'sawtooth', 0.09, 55);
    else if (n === 'hurt' || n === 'lose') tone(250, 0.3, 'sawtooth', 0.12, 80);
    else tone(440, 0.15, 'triangle', 0.1, 220);
  }
  function play(name, o) {
    if (!gate().sfx) return; o = o || {};
    try {
      var c = getCtx(); if (!c) return; var b = buffers[name];
      if (!b) { synth(name); return; }
      var s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.playbackRate.value = o.rate || 1;
      g.gain.value = o.vol == null ? 1 : o.vol; s.connect(g); g.connect(master); s.start();
    } catch (e) {}
  }

  // ---- music: one <audio> element, fades between tracks ----
  function music(track) { want = track; }
  function syncMusic(force) {
    if (!el) return; var m = gate().music && !suspended;
    if (!m) { if (!el.paused) el.pause(); return; }
    if (want && cur === want && el.paused && !missing[cur]) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
    if (force && cur && el.paused && !missing[cur]) { var q = el.play(); if (q && q.catch) q.catch(function () {}); }
  }
  function tick(dt) {
    if (!el || !unlocked) return;
    var m = gate().music && !suspended;
    if (!m) { if (!el.paused) el.pause(); return; }
    if (want !== cur) {
      vol = Math.max(0, vol - dt / 0.5);
      if (vol <= 0 || !cur) {
        cur = want; vol = 0;
        if (cur && !missing[cur]) { el.src = 'assets/music/' + cur + '.mp3'; var p = el.play(); if (p && p.catch) p.catch(function () {}); }
        else { el.pause(); }
      }
    } else if (cur && !missing[cur]) {
      vol = Math.min(MUSIC_VOL, vol + dt / 0.8); if (el.paused) { var q = el.play(); if (q && q.catch) q.catch(function () {}); }
    }
    el.volume = Math.max(0, Math.min(1, vol));
  }
  function suspend() { suspended = true; try { if (ctx && ctx.suspend) ctx.suspend(); } catch (e) {} if (el && !el.paused) el.pause(); }
  function resume() { suspended = false; try { if (ctx && ctx.resume) ctx.resume(); } catch (e) {} syncMusic(); }
  return { setGate: setGate, unlock: unlock, play: play, music: music, tick: tick, suspend: suspend, resume: resume };
})();
