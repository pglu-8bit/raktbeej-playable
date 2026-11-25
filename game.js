(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var W = 800, H = 450, GY = 385;
  var cv = $('c'), cx = cv.getContext('2d');
  var yt = window.ytgame, ytReady = !!(yt && yt.IN_PLAYABLES_ENV && yt.game && yt.system);
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // =====================================================================
  //  Saved data (cloud save only)
  // =====================================================================
  var S = { best: 0, bestRound: 1, karma: 0, up: { vit: 0, spd: 0, catch: 0, fury: 0, dash: 0, crit: 0 }, hard: false, ach: {}, day: '', streak: 0, total: 0, sfx: true, mus: true, hap: true, tut: false };
  var UPS = [
    { id: 'vit', n: 'Vitality', d: '+1 maximum heart', max: 4 },
    { id: 'spd', n: 'Swiftness', d: 'Run 6% faster', max: 5 },
    { id: 'catch', n: 'Wide Catch', d: 'Bigger radius to catch blood', max: 5 },
    { id: 'fury', n: 'Fury Flow', d: 'Fury charges faster', max: 5 },
    { id: 'dash', n: 'Dash Mastery', d: 'Dash recharges sooner', max: 5 },
    { id: 'crit', n: 'Killer Instinct', d: '+8% critical hit chance (double damage)', max: 5 }
  ];
  function upCost(u) { return 25 * Math.pow(S.up[u.id] + 1, 1.6) | 0; }
  var ACH = [
    { id: 'blood', n: 'First Blood', d: 'Land a hit on Raktabeej' },
    { id: 'combo10', n: 'Chain of Blood', d: 'Collect 10 drops in a row' },
    { id: 'x8', n: 'Bloodlust', d: 'Reach a x8 multiplier' },
    { id: 'flawless', n: 'Untouched', d: 'Clear a round without taking damage' },
    { id: 'slayer', n: 'Mahakaal', d: 'Clear round 5' },
    { id: 'fury', n: 'Wrath of Kali', d: 'Wipe out 4 warriors with one Fury' },
    { id: 'catcher', n: 'Blood Collector', d: 'Collect 100 drops in total' },
    { id: 'dodge', n: 'Shadow Step', d: 'Dodge an attack with a dash' },
    { id: 'parry', n: 'Arrow Cutter', d: 'Slice an arrow in mid-air' },
    { id: 'crit', n: 'Critical Strike', d: 'Land a critical hit on Raktabeej' },
    { id: 'brute', n: 'Giant Slayer', d: 'Slay an armoured Brute' },
    { id: 'nm', n: 'Nightmare', d: 'Clear a round on Nightmare mode' },
    { id: 'quake', n: 'Earthshaker', d: 'Ground-pound 3 warriors at once' },
    { id: 'elite', n: 'Elite Slayer', d: 'Defeat an Elite Guard' }
  ];
  var TITLES = ['Raktabeej', 'The Crimson Tide', 'Bloodline of Ruin', 'Mahakaal Rises', 'The Thousand Drops', 'Eclipse of Blood', 'Demon of Echoes', 'Rakt Raja'];

  // =====================================================================
  //  State
  // =====================================================================
  var mode = 'menu'; // menu | play | win | over
  var P, B, en = [], drops = [], picks = [], proj = [], parts = [], floats = [], ghosts = [], rings = [], stains = [], toasts = [], banner = null;
  var round = 1, score = 0, roundStartScore = 0, t = 0, shake = 0, zoom = 0, hurtFlash = 0, whiteFlash = 0, freeze = 0, ts = 1, slowmo = 0, endT = 0;
  var endShown = false, combo = 0, comboT = 0, mult = 1, fury = 0, furyT = 0, furyKills = 0, magnetT = 0, slowT = 0, dmgTaken = 0, roundDrops = 0, phase = 1, shopFrom = 'menu';
  var mod = '', maxCombo = 0, MODS = { swift: 'SWIFT DEMONS', moon: 'BLOOD MOON', tide: 'CRIMSON TIDE' }, spikes = [], slashes = [], bladeT = 0, tipText = '', tipT = 0, tips = {}, earned = 0, stars = 0;
  var inp = { l: 0, r: 0, jump: false, atk: false, dash: false, fury: false };
  var paused = false, ytAudio = true, introT = 0;
  var emb = []; for (var ei = 0; ei < 45; ei++) emb.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(0.4, 1.4), v: rnd(10, 34), p: rnd(0, 6.28) });

  function maxHp() { return 5 + S.up.vit; }
  function makePlayer() { return { x: 120, y: GY, vy: 0, vx: 0, hp: maxHp(), dir: 1, ground: true, jumps: 0, atkT: 0, atkIdx: 0, chain: 0, cd: 0, done: true, inv: 0, dashT: 0, dashCd: 0, dodgeT: 0, shield: false, walk: 0, moving: false, sq: 0 }; }

  // =====================================================================
  //  Audio gate + haptics
  // =====================================================================
  RBAudio.setGate(function () { return { sfx: ytAudio && S.sfx && !paused, music: ytAudio && S.mus && !paused }; });
  var sfx = function (n, o) { RBAudio.play(n, o); };
  function buzz(p) { try { if (S.hap && !paused && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { RBAudio.unlock(); }); });

  // =====================================================================
  //  Canvas fit (letterboxed; state survives resize)
  // =====================================================================
  var scale = 1, ox = 0, oy = 0, dpr = 1;
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    scale = Math.min(w / W, h / H); ox = (w - W * scale) / 2; oy = (h - H * scale) / 2;
    if (!paused) draw();
  }
  window.addEventListener('resize', resize);

  // =====================================================================
  //  Pre-rendered art: glows, background layers
  // =====================================================================
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function glow(col, size) {
    var c = mk(size, size), g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, col); r.addColorStop(0.35, col.replace(/[\d.]+\)$/, '0.35)')); r.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = r; g.fillRect(0, 0, size, size); return c;
  }
  var gRed = glow('rgba(255,50,70,1)', 64), gGold = glow('rgba(255,210,90,1)', 64), gBlue = glow('rgba(110,190,255,1)', 64), gAura = glow('rgba(255,30,60,1)', 256), gMoon = glow('rgba(255,150,90,1)', 256);
  var gShade = glow('rgba(150,90,255,1)', 256), VN = ['Shadow Raktabeej', 'Raktabeej', 'Ember Raktabeej'], BCOL = ['#0c0a22', '#2a0610', '#3a1204'], BEYE = ['#b49bff', '#ff3030', '#ffb02a'];
  var bgSky, bgFar, bgMid, bgGround, vignette;
  function buildBg() {
    bgSky = mk(W, H); var g = bgSky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#12030c'); gr.addColorStop(0.55, '#4a0c1f'); gr.addColorStop(1, '#2a0710'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,230,200,.7)'; for (var i = 0; i < 60; i++) { g.fillRect(Math.random() * W, Math.random() * 230, 1.4, 1.4); }
    bgFar = mk(W + 80, H); g = bgFar.getContext('2d'); g.fillStyle = '#2b0813';
    g.beginPath(); g.moveTo(0, GY); g.lineTo(0, 300); [[90, 245], [180, 295], [290, 225], [400, 305], [520, 255], [640, 310], [740, 262], [W + 80, 305]].forEach(function (p) { g.lineTo(p[0], p[1]); }); g.lineTo(W + 80, GY); g.fill();
    bgMid = mk(W + 120, H); g = bgMid.getContext('2d'); g.fillStyle = '#18040b';
    g.fillRect(70, 300, 80, 90); g.beginPath(); g.moveTo(60, 300); g.lineTo(110, 235); g.lineTo(160, 300); g.fill(); g.fillRect(106, 215, 8, 24); g.fillRect(86, 270, 8, 30); g.fillRect(126, 270, 8, 30);
    g.fillRect(620, 320, 12, 70); for (i = 0; i < 3; i++) { g.beginPath(); g.ellipse(626 + (i - 1) * 24, 318 - i % 2 * 14, 30, 18, 0, 0, 6.28); g.fill(); }
    g.fillRect(380, 345, 6, 45); g.beginPath(); g.ellipse(383, 342, 22, 13, 0, 0, 6.28); g.fill();
    bgGround = mk(W, H - GY + 4); g = bgGround.getContext('2d'); gr = g.createLinearGradient(0, 0, 0, H - GY); gr.addColorStop(0, '#3d0b18'); gr.addColorStop(1, '#12030a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,170,90,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 1); g.lineTo(W, 1); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (i = 0; i < 12; i++) { g.beginPath(); g.moveTo(Math.random() * W, 6); g.lineTo(Math.random() * W, H); g.stroke(); }
    vignette = mk(W, H); g = vignette.getContext('2d'); gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.65)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  buildBg();

  // =====================================================================
  //  Small helpers: effects
  // =====================================================================
  function burst(x, y, n, col, sp) {
    for (var i = 0; i < n && parts.length < 260; i++) { var a = rnd(0, 6.28), s = rnd(40, sp || 220); parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0, max: rnd(0.35, 0.85), col: col || '#ff2a3a', r: rnd(1.8, 4) }); }
  }
  function sparks(x, y, dir, n) { for (var i = 0; i < n && parts.length < 260; i++) { var a = (dir > 0 ? 0 : Math.PI) + rnd(-0.9, 0.9), s = rnd(160, 420); parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: rnd(0.15, 0.32), col: '#fff3c4', r: 1.6, line: true }); } }
  function dust(x, n) { for (var i = 0; i < n && parts.length < 260; i++) parts.push({ x: x + rnd(-10, 10), y: GY - 2, vx: rnd(-70, 70), vy: -rnd(10, 60), life: 0, max: rnd(0.3, 0.6), col: 'rgba(210,170,150,.6)', r: rnd(2, 5), dustp: true }); }
  function floater(x, y, txt, col, big) { floats.push({ x: clamp(x, 40, W - 40), y: y, txt: txt, col: col || '#ffd166', life: 0, big: !!big }); }
  function toast(txt) { toasts.push({ txt: txt, t: 0 }); if (toasts.length > 3) toasts.shift(); }
  function tip(key, txt) { if (tips[key] || S.tut) return; tips[key] = 1; tipText = txt; tipT = 4; }
  function ring(x, y, col, max) { rings.push({ x: x, y: y, col: col, t: 0, max: max || 260 }); }

  // =====================================================================
  //  Gameplay
  // =====================================================================
  var ATK = [
    { dur: 0.22, reach: 100, dmg: 1, kb: 18, step: 55, a0: -2.4, a1: 0.9 },
    { dur: 0.22, reach: 105, dmg: 1, kb: 18, step: 55, a0: 1.1, a1: -2.2 },
    { dur: 0.34, reach: 128, dmg: 2, kb: 40, step: 80, a0: -3.0, a1: 1.4, heavy: true }
  ];
  var ET = { elite: { sp: 130, stop: 52, wind: 0.4, reach: 72, cd: 1.1, s: 1.25 }, brute: { sp: 52, stop: 56, wind: 0.75, reach: 80, cd: 2, s: 1.12 }, clone: { sp: 95, stop: 48, wind: 0.45, reach: 62, cd: 1.5, s: 0.8 }, fast: { sp: 170, stop: 44, wind: 0.3, reach: 58, cd: 1.1, s: 0.72 }, archer: { sp: 70, stop: 0, wind: 0.55, reach: 0, cd: 2.2, s: 0.8 } };

  function startGame(r) { round = r || 1; score = 0; fury = 30; P = makePlayer(); startRound(); }
  function startRound() {
    var hp = Math.round(Math.min(8 + round * 2, 30) * (S.hard ? 1.4 : 1));
    B = { x: W - 130, y: GY, hp: hp, max: hp, dir: -1, st: 'walk', tm: 0, cd: 2.4, flash: 0, walk: 0, vy: 0, alpha: 1, boss: true, stun: 0, rot: 0, dieT: 0 };
    en = []; spikes = []; drops = []; picks = []; proj = []; parts = []; floats = []; ghosts = []; rings = []; stains = [];
    P.x = 120; P.y = GY; P.vy = 0; P.vx = 0; P.hp = maxHp(); P.inv = 0.5; P.atkT = 0; P.cd = 0; P.done = true; P.shield = false; P.dashT = 0; P.chain = 0; P.ground = true; P.jumps = 0;
    roundStartScore = score; combo = 0; comboT = 0; mult = 1; furyKills = 0; furyT = 0; dmgTaken = 0; roundDrops = 0; magnetT = 0; bladeT = 0; slowT = 0; ts = 1; slowmo = 0; phase = 1; freeze = 0;
    mod = round >= 3 && Math.random() < 0.6 ? pick(['swift', 'moon', 'tide']) : ''; maxCombo = 0;
    banner = { t: 0, dur: 2.6, a: 'ROUND ' + round, b: TITLES[(round - 1) % TITLES.length] + (mod ? '  ·  ' + MODS[mod] : '') };
    mode = 'play'; endShown = false; closeAll(); $('ctrl').hidden = false; RBAudio.music('battle'); sfx('roar', { vol: 0.7 });
    if (!S.tut) { tipText = 'Slash Raktabeej! His blood will fly up. Catch it!'; tipT = 4; }
  }
  function closeAll() { ['menu', 'shop', 'trophies', 'over'].forEach(function (i) { $(i).hidden = true; }); }

  function spray(n) { for (var i = 0; i < n && drops.length < 18; i++) drops.push({ x: clamp(B.x + rnd(-20, 20), 20, W - 20), y: GY - 100, vx: rnd(-150, 150), vy: -rnd(300, 450), ph: rnd(0, 6.28) }); }
  function addFury(v) { var was = fury >= 100; fury = Math.min(100, fury + v); if (!was && fury >= 100) { floater(P.x, P.y - 120, 'FURY READY!', '#ffd166', true); sfx('pickup'); tip('fury', 'Fury is ready! Press L / E or the lightning button.'); } }
  function breakCombo() { combo = 0; mult = 1; comboT = 0; }
  function ach(id) { if (S.ach[id]) return; S.ach[id] = 1; S.karma += 40; var a = ACH.filter(function (x) { return x.id === id; })[0]; toast('Trophy: ' + a.n + '  (+40 karma)'); sfx('levelup'); saveProgress(); }

  function collect(d, bonus) {
    if (d.dead) return; d.dead = true; combo++; comboT = 2.6; if (combo > maxCombo) maxCombo = combo; if (combo % 12 === 0) { addFury(25); floater(P.x, P.y - 150, 'FRENZY! +FURY', '#ff9a3a', true); }
    var nm = 1 + Math.min(7, Math.floor(combo / 4));
    if (nm > mult) { floater(P.x, P.y - 130, 'x' + nm + ' COMBO!', '#ff9a3a', true); sfx('combo'); }
    mult = nm; if (mult >= 8) ach('x8'); if (combo >= 10) ach('combo10');
    var air = !P.ground, pts = Math.round((10 * mult + (air ? 15 : 0) + (bonus || 0)) * (mod === 'moon' ? 1.5 : 1));
    score += pts; roundDrops++; S.total++; if (S.total >= 100) ach('catcher');
    addFury(8 * (1 + S.up.fury * 0.2)); burst(d.x, d.y, 8, '#ffd166', 170); sfx('collect', { rate: 1 + Math.min(combo, 12) * 0.05 }); buzz(12);
    floater(d.x, d.y - 12, '+' + pts + (air ? ' AIR' : ''), '#ffe08a');
    if (roundDrops % 8 === 0 && P.hp < maxHp()) { P.hp++; floater(P.x, P.y - 100, '+♥', '#ff7a8a'); sfx('pickup'); }
  }
  function killEnemy(e) {
    if (e.dead) return; e.dead = true; score += 25; addFury(5); burst(e.x, e.y - 40, 12, '#7a0e20', 220); sfx('kill'); floater(e.x, e.y - 90, '+25');
    if (Math.random() < (P.hp <= 2 ? 0.3 : 0.13)) spawnPick(e.x, e.y - 50);
  }
  function spawnPick(x, y, kind) {
    var k = kind || pick(['heart', 'heart', 'heart', 'shield', 'shield', 'magnet', 'magnet', 'slow', 'slow', 'blade', 'blade']);
    if (k === 'heart' && P.hp >= maxHp() && !kind) k = 'shield';
    picks.push({ k: k, x: clamp(x, 30, W - 30), y: y, vy: -220, life: 10 });
  }
  function applyPick(p) {
    p.dead = true; sfx('pickup'); buzz(15);
    if (p.k === 'heart') { P.hp = Math.min(maxHp(), P.hp + 1); floater(P.x, P.y - 110, '+♥', '#ff7a8a'); }
    else if (p.k === 'shield') { P.shield = true; floater(P.x, P.y - 110, 'SHIELD', '#8fd0ff'); sfx('shield'); }
    else if (p.k === 'magnet') { magnetT = 7; floater(P.x, P.y - 110, 'BLOOD MAGNET', '#ffd166'); }
    else if (p.k === 'blade') { bladeT = 8; floater(P.x, P.y - 110, 'RAGE BLADE', '#ffb347'); sfx('fury', { vol: 0.5 }); }
    else if (p.k === 'slow') { slowT = 5; floater(P.x, P.y - 110, 'KAAL SLOW', '#b49bff'); }
    burst(p.x, p.y, 10, '#ffffff', 160);
  }

  function hitBoss(dmg, kb, heavy) {
    if (B.st === 'vanish' || B.st === 'appear' || B.st === 'dying') return;
    B.hp -= dmg; B.flash = 0.18; B.x = clamp(B.x + P.dir * kb, 20, W - 20);
    ach('blood'); score += 10 * mult * dmg; addFury(4 * dmg * (1 + S.up.fury * 0.2));
    spray((mod === 'tide' ? 2 : 0) + Math.min(2 + Math.floor(round / 3), 4) + (phase === 3 ? 1 : 0) + (heavy ? 1 : 0));
    burst(B.x, B.y - 70, 14, '#ff2a3a', 280); sparks(B.x - P.dir * 20, B.y - 70, -P.dir, 10);
    sfx(heavy ? 'hit_heavy' : 'hit'); buzz(heavy ? 50 : 28); shake = heavy ? 10 : 6; freeze = heavy ? 0.07 : 0.045; zoom = heavy ? 0.045 : 0.02;
    floater(B.x, B.y - 150, '-' + dmg, '#ffffff');
    tip('catch', 'Catch the falling blood! Walk into it, or slash it.');
    if (B.hp <= 0) { winRound(); return; }
    var np = B.hp > B.max * 2 / 3 ? 1 : B.hp > B.max / 3 ? 2 : 3; if (np !== phase) changePhase(np);
  }
  function changePhase(np) {
    phase = np; B.stun = 1.1; B.cd = 1.2; B.st = 'walk'; B.vy = 0; B.y = GY; shake = 14; sfx('roar'); buzz([80, 40, 80]); whiteFlash = 0.3; ring(B.x, GY - 40, 'rgba(255,40,60,', 320);
    banner = { t: 0, dur: 1.8, a: np === 2 ? 'BLOODLUST' : 'MAHAKAAL RAGE', b: np === 2 ? 'He slams the ground. Jump the shockwave!' : 'He vanishes and strikes from behind!' };
    spawnPick(B.x, GY - 150, 'heart'); if (np === 2 && round >= 2) spawnElite();
    if (np === 3) { RBAudio.music('boss'); spawnEnemy(60); spawnEnemy(W - 60); }
  }
  function winRound() {
    mode = 'win'; endT = 2.3; slowmo = 1.3; ts = 0.25; score += 300 * round; B.st = 'dying'; B.dieT = 0;
    en.forEach(function (e) { burst(e.x, e.y - 40, 12, '#7a0e20', 220); }); en = [];
    drops.forEach(function (d) { for (var i = 0; i < 6; i++) parts.push({ x: d.x, y: d.y, vx: rnd(-80, 80), vy: rnd(-120, 0), life: 0, max: 1.4, col: '#ffd166', r: 3, seek: true }); }); drops = []; proj = []; picks = [];
    burst(B.x, B.y - 60, 50, '#ff2a3a', 340); burst(B.x, B.y - 60, 30, '#ffd166', 300); ring(B.x, B.y - 60, 'rgba(255,200,90,', 420);
    stars = dmgTaken === 0 ? 3 : dmgTaken <= 2 ? 2 : 1; earned = Math.floor((score - roundStartScore) / 15) + 15 * round + (stars === 3 ? 25 : 0); if (S.hard) { earned = Math.floor(earned * 1.5); ach('nm'); } S.karma += earned;
    S.bestRound = Math.max(S.bestRound, round + 1); if (round >= 5) ach('slayer'); if (dmgTaken === 0) ach('flawless'); S.tut = true;
    finishBest(); sfx('win'); buzz([40, 40, 100]); RBAudio.music(null); saveProgress();
  }
  function gameOver() {
    mode = 'over'; endT = 1.4; stars = 0; earned = Math.floor((score - roundStartScore) / 25); S.karma += earned; finishBest(); sfx('lose'); buzz([140]); RBAudio.music(null); P.vy = -260; saveProgress();
  }
  function finishBest() { if (score > S.best) { S.best = score; sendBest(); } }

  function hurtPlayer(dir, dmg) {
    if (mode !== 'play') return;
    if (P.dashT > 0 || P.inv > 0 || furyT > 0) {
      if (P.dashT > 0 && P.dodgeT <= 0) { P.dodgeT = 0.6; ach('dodge'); floater(P.x, P.y - 110, 'DODGE!', '#9fe3ff', true); addFury(7); slowmo = 0.3; ts = 0.35; sfx('shield', { rate: 1.4, vol: 0.5 }); }
      return;
    }
    if (P.shield) { P.shield = false; sfx('shield'); burst(P.x, P.y - 40, 14, '#8fd0ff', 220); P.inv = 0.9; return; }
    P.hp -= dmg || 1; dmgTaken++; P.inv = 1.2; P.vy = -300; P.ground = false; P.x = clamp(P.x + dir * 45, 24, W - 24);
    breakCombo(); shake = 10; hurtFlash = 0.5; freeze = 0.06; sfx('hurt'); buzz([70]); burst(P.x, P.y - 50, 10, '#ff7a8a', 200);
    if (P.hp === 1) tip('low', 'Low health! Catch blood to heal, or grab a heart.');
    if (P.hp <= 0) gameOver();
  }

  function hurtEnemy(e, d) {
    e.hp -= d;
    if (e.hp <= 0) { if (e.k === 'brute') ach('brute'); if (e.k === 'elite') { score += 150; spawnPick(e.x, e.y - 50); floater(e.x, e.y - 110, 'ELITE SLAIN +150', '#ffd166', true); ach('elite'); } killEnemy(e); }
    else { e.flash = 0.18; e.x = clamp(e.x + P.dir * 34, 20, W - 20); burst(e.x, e.y - 50, 8, '#9aa0aa', 200); sfx('hit_heavy', { vol: 0.6 }); shake = 5; }
  }
  function pounded() {
    var n = 0; P.pound = false; shake = 12; zoom = 0.03; ring(P.x, GY - 10, 'rgba(255,200,90,', 220); dust(P.x, 14); sfx('slam', { vol: 0.7 }); buzz(40);
    drops.forEach(function (d) { if (Math.abs(d.x - P.x) < 130) collect(d, 8); });
    en.forEach(function (e) { if (!e.dead && e.rise <= 0.3 && Math.abs(e.x - P.x) < 100) { n++; hurtEnemy(e, 2); } });
    if (n >= 3) ach('quake');
    if (B.st !== 'dying' && Math.abs(B.x - P.x) < 110 && B.y >= GY - 5) hitBoss(2, 30, true);
  }
  function playerStrike() {
    var crit = Math.random() < S.up.crit * 0.08, bonus = (bladeT > 0 ? 1 : 0) + (crit ? 1 : 0);
    slashes.push({ x: P.x + P.dir * 40, y: P.y - 50, dir: P.dir, t: 0, h: !!ATK[P.atkIdx].heavy });
    var s = ATK[P.atkIdx], fx = P.x + P.dir * s.reach * 0.45, fy = P.y - 45, cr = 70 + S.up.catch * 8;
    drops.forEach(function (d) { var dx = d.x - fx, dy = d.y - fy; if (dx * dx + dy * dy < cr * cr) collect(d, 5); });
    proj.forEach(function (p) { if (p.k === 'arrow' && !p.dead && Math.abs(p.x - fx) < s.reach * 0.7 && Math.abs(p.y - fy) < 60) { p.dead = true; burst(p.x, p.y, 8, '#fff3c4', 200); score += 15; addFury(6); ach('parry'); floater(p.x, p.y - 20, 'PARRY!', '#fff3c4'); sfx('hit', { rate: 1.5, vol: 0.6 }); } });
    var hitAny = false;
    en.forEach(function (e) { if (e.dead || e.rise > 0.3) return; var dx = (e.x - P.x) * P.dir; if (dx > -15 && dx < s.reach && Math.abs(e.y - P.y) < 85) { hurtEnemy(e, s.dmg + bonus); sparks(e.x, e.y - 50, P.dir, 8); hitAny = true; } });
    var dxb = (B.x - P.x) * P.dir;
    if (dxb > -15 && dxb < s.reach + 20 && Math.abs(B.y - P.y) < 90) { hitBoss(s.dmg + bonus, s.kb, s.heavy); hitAny = true; if (crit) { floater(B.x, B.y - 175, 'CRIT!', '#ff9a3a', true); ach('crit'); } }
    if (hitAny) { freeze = Math.max(freeze, 0.03); }
  }
  function unleashFury() {
    furyT = 0.9; fury = 0; P.inv = Math.max(P.inv, 1.0); sfx('fury'); buzz([30, 30, 120]); whiteFlash = 0.5; zoom = 0.06; shake = 12; ring(P.x, P.y - 40, 'rgba(255,210,90,', 560);
  }
  function furyBlast() {
    var killed = 0;
    drops.forEach(function (d) { collect(d, 10); });
    en.forEach(function (e) { if (!e.dead) { killEnemy(e); killed++; } });
    proj = []; if (killed >= 4) ach('fury');
    if (B.st !== 'dying') { hitBoss(3, 60, true); B.stun = Math.max(B.stun, 0.8); }
    shake = 16; sfx('hit_heavy');
  }

  // ---- enemy AI ----
  function bossAI(dt) {
    var b = B; b.flash -= dt; b.walk += dt;
    if (b.stun > 0) { b.stun -= dt; return; }
    b.cd -= dt; b.tm -= dt;
    var dx = P.x - b.x, dist = Math.abs(dx), air = b.st === 'jump' || b.st === 'vanish' || b.st === 'appear' || b.st === 'crouch' || b.st === 'charge' || b.st === 'cwind';
    if (!air) b.dir = dx >= 0 ? 1 : -1;
    var spd = (62 + round * 6) * (phase === 3 ? 1.3 : 1) * (S.hard ? 1.15 : 1);
    switch (b.st) {
      case 'walk':
        if (dist > 100) b.x += b.dir * spd * dt;
        if (b.cd <= 0) {
          var r = Math.random();
          if (phase >= 2 && r > 0.88) { b.st = 'cast'; b.tm = 0.8; castSpikes(); }
          else if (r > (round % 3 === 2 ? 0.62 : 0.78) && round >= 2 && dist > 150) { b.st = 'cwind'; b.tm = 0.6; sfx('roar', { vol: 0.5 }); tip('charge', 'He charges! Jump or dash through, then strike him while he is tired.'); }
          else if (phase >= 2 && r < 0.35) { b.st = 'crouch'; b.tm = 0.55; }
          else if ((phase === 3 || (round % 3 === 0 && phase === 2)) && r < 0.55) { b.st = 'vanish'; b.tm = 0.35; sfx('dash'); }
          else if (dist <= 112 && Math.abs(P.y - b.y) < 80) { b.st = 'wind'; b.tm = 0.55 - (phase - 1) * 0.08; }
        }
        break;
      case 'wind': if (b.tm <= 0) { b.st = 'swing'; b.tm = 0.18; sfx('swing'); if (dist < 135 && Math.abs(P.y - b.y) < 85 && dx * b.dir > -10) hurtPlayer(b.dir, 1); } break;
      case 'swing': if (b.tm <= 0) { b.st = 'walk'; b.cd = Math.max(0.6, 1.4 - round * 0.06 - (phase - 1) * 0.2); } break;
      case 'crouch': if (b.tm <= 0) { b.st = 'jump'; b.vy = -720; } break;
      case 'jump':
        b.vy += 1800 * dt; b.y += b.vy * dt; b.x += clamp(dx, -1, 1) * 150 * dt;
        if (b.y >= GY && b.vy > 0) {
          b.y = GY; b.vy = 0; b.st = 'land'; b.tm = 0.5; shake = 13; sfx('slam'); buzz(60); dust(b.x, 14);
          proj.push({ k: 'wave', x: b.x - 24, vx: -300, life: 3 }, { k: 'wave', x: b.x + 24, vx: 300, life: 3 });
          if (Math.abs(P.x - b.x) < 50 && P.y >= GY - 30) hurtPlayer(P.x > b.x ? 1 : -1, 1);
        }
        break;
      case 'cast': if (b.tm <= 0) { b.st = 'walk'; b.cd = 1.1; } break;
      case 'cwind': if (b.tm <= 0) { b.st = 'charge'; b.tm = 0.55; sfx('dash'); } break;
      case 'charge':
        b.x += b.dir * 560 * dt; if (Math.random() < 0.6) dust(b.x, 1);
        if (Math.abs(P.x - b.x) < 56 && Math.abs(P.y - b.y) < 80) hurtPlayer(b.dir, 1);
        if (b.tm <= 0 || b.x <= 24 || b.x >= W - 24) { b.st = 'walk'; b.stun = 0.7; b.cd = 1.0; shake = 8; sfx('slam', { vol: 0.6 }); dust(b.x, 10); floater(b.x, b.y - 160, 'EXHAUSTED!', '#9fe3ff'); }
        break;
      case 'land': if (b.tm <= 0) { b.st = 'walk'; b.cd = 1.0; } break;
      case 'vanish': b.alpha = Math.max(0, b.tm / 0.35); if (b.tm <= 0) { b.x = clamp(P.x - P.dir * 120, 30, W - 30); b.st = 'appear'; b.tm = 0.3; burst(b.x, b.y - 60, 14, '#ff2a3a', 220); } break;
      case 'appear': b.alpha = 1 - Math.max(0, b.tm / 0.3); if (b.tm <= 0) { b.alpha = 1; b.st = 'wind'; b.tm = 0.4; } break;
    }
    b.x = clamp(b.x, 20, W - 20);
  }
  function spawnElite() {
    var ex = P.x > W / 2 ? 60 : W - 60; en.push({ x: ex, y: GY, k: 'elite', hp: 5, dir: -1, st: 'walk', tm: 0, cd: 1.2, flash: 0, walk: 0, rise: 0.7 });
    floater(ex, GY - 130, 'ELITE GUARD!', '#ff6ad0', true); sfx('roar', { vol: 0.6 }); tip('elite', 'An Elite Guard joins the fight. It takes 5 hits!');
  }
  function castSpikes() {
    var n = phase === 3 ? 6 : 4; tip('spike', 'Red marks on the ground: spikes erupt there. Move!');
    for (var i = 0; i < n; i++) spikes.push({ x: i === 0 ? P.x : clamp(P.x + rnd(-190, 190), 30, W - 30), tm: 0.95 + i * 0.12 });
  }
  function enemyAI(e, dt) {
    if (e.rise > 0) { e.rise -= dt; return; }
    e.cd -= dt; e.tm -= dt; e.flash -= dt; e.walk += dt;
    var def = ET[e.k], sp = (def.sp + round * 4) * (mod === 'swift' ? 1.3 : 1), dx = P.x - e.x, dist = Math.abs(dx); e.dir = dx >= 0 ? 1 : -1;
    if (e.st === 'walk') {
      if (e.k === 'archer') { if (dist < 220) e.x -= e.dir * sp * dt; else if (dist > 330) e.x += e.dir * sp * dt; if (e.cd <= 0) { e.st = 'wind'; e.tm = def.wind; } }
      else { if (dist > def.stop) e.x += e.dir * sp * dt; if (dist <= def.stop + 8 && e.cd <= 0 && Math.abs(P.y - e.y) < 70) { e.st = 'wind'; e.tm = def.wind; } }
    } else if (e.st === 'wind') {
      if (e.tm <= 0) {
        e.st = 'swing'; e.tm = 0.18;
        if (e.k === 'archer') { proj.push({ k: 'arrow', x: e.x + e.dir * 20, y: GY - 50, vx: e.dir * 380, life: 3 }); sfx('arrow'); }
        else { sfx('swing', { vol: 0.5 }); if (Math.abs(P.x - e.x) < def.reach && Math.abs(P.y - e.y) < 80 && dx * e.dir > -10) hurtPlayer(e.dir, e.k === 'brute' ? 2 : 1); }
      }
    } else if (e.st === 'swing') { if (e.tm <= 0) { e.st = 'walk'; e.cd = def.cd + rnd(0, 0.5); } }
    e.x = clamp(e.x, 20, W - 20);
  }
  function spawnEnemy(x) {
    var r = Math.random(), k = 'clone', archers = en.filter(function (e) { return e.k === 'archer'; }).length;
    var brutes = en.filter(function (e) { return e.k === 'brute'; }).length; if (round >= 4 && r < 0.14 && brutes < 2) k = 'brute'; else if (round >= 3 && r < 0.3 && archers < 2) k = 'archer'; else if (round >= 2 && r < 0.45) k = 'fast';
    en.push({ x: x, y: GY, k: k, hp: k === 'brute' ? 2 : 1, dir: -1, st: 'walk', tm: 0, cd: 1.2, flash: 0, walk: 0, rise: 0.7 });
  }

  // =====================================================================
  //  Update
  // =====================================================================
  var lastFuryUI = -1, lastCool = null, lastReady = null;
  function update(dt) {
    t += dt;
    if (freeze > 0) { freeze -= dt; return; }
    if (slowmo > 0) { slowmo -= dt; if (slowmo <= 0) ts = 1; }
    var dtg = dt * ts, dte = dtg * (slowT > 0 ? 0.5 : 1);
    shake = Math.max(0, shake - dt * 30); zoom = Math.max(0, zoom - dt * 0.12); hurtFlash = Math.max(0, hurtFlash - dt); whiteFlash = Math.max(0, whiteFlash - dt * 1.6);
    if (tipT > 0) tipT -= dt; if (banner) { banner.t += dt; if (banner.t > banner.dur) banner = null; }
    toasts.forEach(function (o) { o.t += dt; }); toasts = toasts.filter(function (o) { return o.t < 3; });

    if (mode === 'play') {
      if (comboT > 0) { comboT -= dtg; if (comboT <= 0) breakCombo(); }
      if (magnetT > 0) magnetT -= dtg; if (bladeT > 0) bladeT -= dtg; if (slowT > 0) slowT -= dtg;
      // --- player ---
      var mv = (inp.r - inp.l) * (furyT > 0 ? 0 : 1), spd = 235 * (1 + S.up.spd * 0.06);
      P.moving = !!mv && P.dashT <= 0;
      if (mv && P.atkT <= 0) { P.dir = mv; }
      if (P.dashT > 0) { P.dashT -= dtg; P.x += P.vx * dtg; if (Math.floor(t * 40) % 2 === 0) ghosts.push({ x: P.x, y: P.y, dir: P.dir, a: 0.5, walk: P.walk }); }
      else { P.x += mv * spd * dtg * (P.atkT > 0 ? 0.45 : 1); if (mv) P.walk += dtg; }
      P.x = clamp(P.x, 24, W - 24);
      if (inp.jump) { if (P.jumps < 2) { P.vy = P.jumps === 0 ? -620 : -540; P.jumps++; P.ground = false; if (P.jumps === 2) { sfx('dash', { vol: 0.5, rate: 1.3 }); burst(P.x, P.y, 6, '#ffe9c0', 120); tip('pound', 'Press S / the ▼ button in the air to ground-pound!'); } else dust(P.x, 4); } inp.jump = false; }
      if (inp.pound) { if (!P.ground && !P.pound && furyT <= 0) { P.pound = true; P.vy = 950; P.dashT = 0; sfx('dash', { rate: 0.7 }); } inp.pound = false; }
      P.vy += 1700 * dtg; P.y += P.vy * dtg;
      if (P.y >= GY) { if (P.pound) pounded(); if (!P.ground && P.vy > 200) { dust(P.x, 5); P.sq = 0.18; } P.y = GY; P.vy = 0; P.ground = true; P.jumps = 0; }
      P.sq = Math.max(0, P.sq - dtg * 1.2);
      P.cd -= dtg; P.inv -= dtg; P.dodgeT -= dtg; P.dashCd -= dtg; P.chain -= dtg;
      if (inp.dash) { if (P.dashCd <= 0 && furyT <= 0) { P.dashT = 0.18; P.vx = (mv || P.dir) * 640; if (mv) P.dir = mv; P.dashCd = 1.15 - S.up.dash * 0.12; P.inv = Math.max(P.inv, 0.05); sfx('dash'); dust(P.x, 6); P.atkT = 0; P.done = true; } inp.dash = false; }
      if (inp.fury) { if (fury >= 100 && furyT <= 0) unleashFury(); inp.fury = false; }
      if (furyT > 0) { var before = furyT; furyT -= dtg; if (before > 0.6 && furyT <= 0.6) furyBlast(); }
      if (inp.atk) { if (P.cd <= 0 && P.dashT <= 0 && furyT <= 0) { P.atkIdx = P.chain > 0 ? (P.atkIdx + 1) % 3 : 0; var a = ATK[P.atkIdx]; P.atkT = a.dur; P.done = false; P.cd = a.dur + 0.04; P.chain = a.dur + 0.4; sfx('swing', { rate: 0.9 + P.atkIdx * 0.12 }); if (mv) P.dir = mv; } inp.atk = false; }
      if (P.atkT > 0) {
        var A = ATK[P.atkIdx]; P.atkT -= dtg; P.x = clamp(P.x + P.dir * A.step * dtg, 24, W - 24);
        if (!P.done && P.atkT < A.dur * 0.55) { P.done = true; playerStrike(); }
      }
      // --- enemies ---
      if (B.st !== 'dying') bossAI(dte);
      if (round % 3 !== 1 && parts.length < 200 && Math.random() < 0.5 && B.alpha > 0.3) parts.push({ x: B.x + rnd(-22, 22), y: B.y - rnd(15, 110), vx: rnd(-20, 20), vy: -rnd(40, 100), life: 0, max: 0.6, col: round % 3 === 2 ? '#ff9a3a' : '#b49bff', r: 2.5 });
      en.forEach(function (e) { enemyAI(e, dte); });
      en = en.filter(function (e) { return !e.dead; });
      // --- projectiles ---
      proj.forEach(function (p) {
        p.x += p.vx * dte; p.life -= dte;
        if (p.k === 'wave') { if (Math.abs(p.x - P.x) < 24 && P.y >= GY - 28) hurtPlayer(p.vx > 0 ? 1 : -1, 1); if (Math.random() < 0.5) dust(p.x, 1); }
        else if (Math.abs(p.x - P.x) < 16 && Math.abs(p.y - (P.y - 45)) < 34) { hurtPlayer(p.vx > 0 ? 1 : -1, 1); p.dead = true; }
        if (p.x < -40 || p.x > W + 40 || p.life <= 0) p.dead = true;
      });
      proj = proj.filter(function (p) { return !p.dead; });
      spikes.forEach(function (s) {
        s.tm -= dte;
        if (!s.fired && s.tm <= 0) { s.fired = 1; shake = 8; sfx('slam', { vol: 0.5 }); dust(s.x, 6); if (Math.abs(P.x - s.x) < 28 && P.y >= GY - 70) hurtPlayer(P.x > s.x ? 1 : -1, 1); }
      });
      spikes = spikes.filter(function (s) { return s.tm > -0.35; });
      // --- blood drops ---
      drops.forEach(function (d) {
        d.vy += 170 * dte; var mxv = mod === 'moon' ? 120 : 70; if (d.vy > mxv) d.vy = mxv;
        d.vx *= Math.pow(0.4, dte); d.x = clamp(d.x + (d.vx + Math.sin(t * 3 + d.ph) * 22) * dte, 12, W - 12); d.y += d.vy * dte;
        if (magnetT > 0) { var mx = P.x - d.x, my = (P.y - 40) - d.y, md = Math.sqrt(mx * mx + my * my) || 1; d.x += mx / md * 230 * dtg; d.y += my / md * 230 * dtg; }
        var dx = d.x - P.x, dy = d.y - (P.y - 40), cr = 34 + S.up.catch * 8; if (furyT > 0.6) return;
        if (dx * dx + dy * dy < cr * cr) collect(d);
        else if (d.y >= GY - 4 && !d.dead) {
          d.dead = true; burst(d.x, GY, 10, '#a0101e', 160); stains.push({ x: d.x, a: 0.8 }); if (stains.length > 24) stains.shift(); breakCombo();
          if (en.length < (mod === 'tide' ? 11 : 8)) { spawnEnemy(d.x); sfx('clone'); buzz(20); if (en.length <= 2) floater(d.x, GY - 100, 'Another Raktabeej!', '#ff6a6a', true); tip('clone', 'A drop landed and spawned a warrior. Slash it!'); }
        }
      });
      drops = drops.filter(function (d) { return !d.dead; });
      // --- pickups ---
      picks.forEach(function (p) { p.vy += 700 * dtg; p.y = Math.min(GY - 12, p.y + p.vy * dtg); if (p.y >= GY - 12) p.vy = 0; p.life -= dtg; var dx = p.x - P.x, dy = p.y - (P.y - 30); if (dx * dx + dy * dy < 38 * 38) applyPick(p); if (p.life <= 0) p.dead = true; });
      picks = picks.filter(function (p) { return !p.dead; });
      // body overlap with a landing boss etc. handled in AI
    } else if (mode === 'win') {
      B.dieT += dtg; B.rot = Math.min(1.45, B.dieT * 1.5); B.alpha = clamp(1 - (B.dieT - 0.9) / 0.9, 0, 1);
      P.vy += 1700 * dtg; P.y = Math.min(GY, P.y + P.vy * dtg); P.inv = 9; if (!P.ground && P.y >= GY) { P.ground = true; }
      endT -= dt; if (endT <= 0 && !endShown) showEnd();
    } else if (mode === 'over') {
      P.vy += 1700 * dtg; P.y = Math.min(GY, P.y + P.vy * dtg); endT -= dt; if (endT <= 0 && !endShown) showEnd();
    }
    // universal particles
    parts.forEach(function (p) {
      p.life += dtg;
      if (p.seek) { var tx = P.x - p.x, ty = P.y - 50 - p.y, d = Math.sqrt(tx * tx + ty * ty) || 1; p.vx += tx / d * 900 * dtg; p.vy += ty / d * 900 * dtg; p.vx *= 0.96; p.vy *= 0.96; if (d < 20) p.life = p.max; }
      else if (!p.dustp) p.vy += 420 * dtg; else p.vy *= 0.95;
      p.x += p.vx * dtg; p.y += p.vy * dtg;
    });
    parts = parts.filter(function (p) { return p.life < p.max; });
    floats.forEach(function (f) { f.life += dt; f.y -= 30 * dt; }); floats = floats.filter(function (f) { return f.life < 1.3; });
    ghosts.forEach(function (g) { g.a -= dt * 2.4; }); ghosts = ghosts.filter(function (g) { return g.a > 0; });
    slashes.forEach(function (s) { s.t += dt; }); slashes = slashes.filter(function (s) { return s.t < 0.22; });
    rings.forEach(function (r) { r.t += dt; }); rings = rings.filter(function (r) { return r.t < 0.7; });
    emb.forEach(function (e) { e.y -= e.v * dt; e.x += Math.sin(t + e.p) * 10 * dt; if (e.y < -5) { e.y = H + 5; e.x = rnd(0, W); } });
    stains.forEach(function (s) { s.a = Math.max(0.12, s.a - dt * 0.02); });
    updateButtons();
    RBAudio.tick(dt);
  }
  function updateButtons() {
    var f = Math.round(fury); if (f !== lastFuryUI) { lastFuryUI = f; $('bF').style.setProperty('--f', f); }
    var rd = fury >= 100; if (rd !== lastReady) { lastReady = rd; $('bF').classList.toggle('ready', rd); }
    var cl = !!(P && P.dashCd > 0); if (cl !== lastCool) { lastCool = cl; $('bD').classList.toggle('cool', cl); }
  }

  // =====================================================================
  //  Drawing
  // =====================================================================
  function ease(x) { return x * x * (3 - 2 * x); }
  function deco(o) {
    var k = o.kind; if (!k || o.flash > 0) return; var w7 = Math.sin(t * 9);
    if (k === 'hero') {
      cx.fillStyle = '#c4122b'; cx.fillRect(-10, -54, 20, 4);
      cx.beginPath(); cx.moveTo(-9, -52); cx.quadraticCurveTo(-22, -54 + w7 * 4, -34, -46 + w7 * 7); cx.lineTo(-24, -50); cx.fill();
      cx.fillStyle = '#2a1a14'; cx.beginPath(); cx.arc(-2, -63, 6, 0, 6.28); cx.fill();
      cx.fillStyle = '#d49a32'; cx.fillRect(-9, -24, 18, 4);
      cx.fillStyle = '#c4122b'; cx.beginPath(); cx.moveTo(-8, -38); cx.lineTo(8, -38); cx.lineTo(0, -14); cx.fill();
      cx.fillStyle = '#ffc83d'; cx.beginPath(); cx.arc(-9, -37, 5, 0, 6.28); cx.fill();
      cx.fillStyle = '#1a0a08'; cx.fillRect(3, -51, 4, 3);
    } else if (k === 'boss') {
      cx.fillStyle = '#ffc83d'; cx.beginPath(); cx.moveTo(-9, -57); cx.lineTo(-7, -68); cx.lineTo(-3, -60); cx.lineTo(0, -71); cx.lineTo(3, -60); cx.lineTo(7, -68); cx.lineTo(9, -57); cx.fill();
      cx.fillStyle = '#4a0b17'; cx.beginPath(); cx.arc(-12, -36, 9, 0, 6.28); cx.arc(12, -36, 9, 0, 6.28); cx.fill();
      cx.fillStyle = '#ffc83d'; cx.fillRect(-12, -26, 24, 3);
      cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(1, -44); cx.lineTo(3, -39); cx.lineTo(5, -44); cx.fill();
      cx.globalCompositeOperation = 'lighter'; cx.fillStyle = 'rgba(255,40,50,' + (0.5 + 0.3 * Math.sin(t * 4)) + ')';
      cx.beginPath(); cx.moveTo(0, -32); cx.lineTo(5, -23); cx.lineTo(0, -12); cx.lineTo(-5, -23); cx.fill(); cx.globalCompositeOperation = 'source-over';
    } else if (k === 'brute' || k === 'elite') {
      cx.fillStyle = '#6b6f78'; cx.beginPath(); cx.arc(0, -52, 11.5, Math.PI, 0); cx.fill(); cx.fillRect(-12, -52, 24, 3);
      cx.fillStyle = '#3a0a14'; cx.beginPath(); cx.arc(-13, -36, 10, 0, 6.28); cx.arc(13, -36, 10, 0, 6.28); cx.fill();
    } else if (k === 'archer') {
      cx.fillStyle = '#1a0610'; cx.beginPath(); cx.moveTo(-12, -42); cx.lineTo(0, -66); cx.lineTo(12, -42); cx.lineTo(8, -38); cx.lineTo(-8, -38); cx.fill();
    } else if (k === 'fast') {
      cx.fillStyle = '#7a1020'; cx.beginPath(); cx.moveTo(-8, -56); cx.lineTo(-10, -70); cx.lineTo(-2, -59); cx.lineTo(2, -72); cx.lineTo(6, -58); cx.lineTo(12, -68); cx.lineTo(10, -54); cx.fill();
    }
  }
  function fig(x, y, s, dir, o) {
    cx.save(); cx.translate(x, y + (o.dy || 0));
    if (o.rot) cx.rotate(o.rot * dir);
    cx.scale(dir * s * (1 + (o.sq || 0)), s * (1 - (o.sq || 0)));
    cx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    var col = o.flash > 0 ? '#ffffff' : o.col, w = o.walk || 0, mv = o.moving ? 1 : 0, air = !!o.air, bob = Math.sin((o.idle || 0) * 3) * 1.6 * (1 - mv), hipY = -34 + bob;
    cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = 7;
    for (var l = 0; l < 2; l++) {
      var ph = w * 12 + (l ? Math.PI : 0), hx = l ? 4 : -4;
      var a = air ? (l ? 0.7 : -0.35) : (mv ? Math.sin(ph) * 0.75 : (l ? 0.1 : -0.1));
      var kx = hx + Math.sin(a) * 17, ky = hipY + Math.cos(a) * 17, a2 = air ? a * 0.3 : (mv ? a - 0.55 * Math.max(0, Math.cos(ph)) : a * 0.4);
      var fx = kx + Math.sin(a2) * 17, fy = Math.min(2, ky + Math.cos(a2) * 17);
      cx.beginPath(); cx.moveTo(hx, hipY); cx.lineTo(kx, ky); cx.lineTo(fx, fy); cx.stroke();
    }
    cx.save(); cx.translate(0, hipY); cx.rotate((o.lean || 0) + mv * 0.12);
    if (o.scarf) { cx.strokeStyle = '#c4122b'; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(-6, -36); var sw = (o.scarfV || 0) * 0.03; cx.bezierCurveTo(-16 - sw, -34 + Math.sin(t * 7) * 3, -28 - sw, -28 + Math.sin(t * 7 + 1) * 5, -40 - sw * 1.5, -26 + Math.sin(t * 7 + 2) * 6); cx.stroke(); cx.strokeStyle = col; cx.lineWidth = 7; }
    cx.beginPath(); cx.moveTo(-11, 0); cx.lineTo(11, 0); cx.lineTo(8, -38); cx.lineTo(-8, -38); cx.closePath(); cx.fill();
    cx.beginPath(); cx.arc(0, -49, 10, 0, 6.28); cx.fill();
    deco(o); if (o.horns) { cx.beginPath(); cx.moveTo(-8, -55); cx.lineTo(-16, -78); cx.lineTo(-2, -58); cx.moveTo(8, -55); cx.lineTo(16, -78); cx.lineTo(2, -58); cx.fill(); }
    // back arm
    var bA = o.wind ? -1.8 : 1.5 + Math.sin((o.idle || 0) * 3 + 1) * 0.1 + mv * Math.sin(w * 12) * 0.6;
    cx.lineWidth = 6; cx.beginPath(); cx.moveTo(-3, -33); cx.lineTo(-3 + Math.cos(bA) * 20, -33 + Math.sin(bA) * 20); cx.stroke();
    // extra boss arms with blades
    if (o.arms4) {
      [[-1.5 + Math.sin(t * 2) * 0.15, -30], [0.2 + Math.sin(t * 2.4) * 0.15, -20]].forEach(function (ar) {
        var ax = 4, ay = ar[1], ex = ax + Math.cos(ar[0]) * 20, ey = ay + Math.sin(ar[0]) * 20;
        cx.strokeStyle = col; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(ex, ey); cx.stroke();
        cx.strokeStyle = o.flash > 0 ? '#fff' : '#c9d2dc'; cx.lineWidth = 3.5; cx.beginPath(); cx.moveTo(ex, ey); cx.lineTo(ex + Math.cos(ar[0]) * 44, ey + Math.sin(ar[0]) * 44); cx.stroke();
      }); cx.strokeStyle = col;
    }
    // sword arm
    var aa = -0.6 + Math.sin((o.idle || 0) * 3) * 0.06, st = o.style || 0, sd = ATK[st] || ATK[0];
    if (o.stunned) aa = -2.7; else if (o.wind) aa = o.big ? -2.9 : -2.4; else if (o.sw != null) { aa = (o.big ? -2.9 : sd.a0) + ((o.big ? 1.2 : sd.a1) - (o.big ? -2.9 : sd.a0)) * ease(clamp(o.sw, 0, 1)); }
    var sx = 5, sy = -32, ex2 = sx + Math.cos(aa) * 21, ey2 = sy + Math.sin(aa) * 21;
    cx.strokeStyle = col; cx.lineWidth = 6.5; cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(ex2, ey2); cx.stroke();
    cx.strokeStyle = o.flash > 0 ? '#fff' : (o.blade || '#e6edf5'); cx.lineWidth = 4; cx.beginPath(); cx.moveTo(ex2, ey2); cx.lineTo(ex2 + Math.cos(aa) * 54, ey2 + Math.sin(aa) * 54); cx.stroke();
    if (o.sw != null && o.sw > 0.1 && o.sw < 0.95) {
      var a0 = o.big ? -2.9 : sd.a0, rev = sd.a1 < sd.a0 && !o.big; cx.strokeStyle = o.trail || 'rgba(255,235,205,.55)'; cx.lineWidth = 7;
      cx.beginPath(); cx.arc(sx, sy, 66, a0 + (aa - a0) * 0.35, aa, rev); cx.stroke();
    }
    cx.restore();
    if (o.eye) { cx.globalCompositeOperation = 'lighter'; cx.fillStyle = o.eye; cx.beginPath(); cx.arc(5, hipY - 49, 3, 0, 6.28); cx.fill(); cx.globalCompositeOperation = 'source-over'; }
    cx.restore();
  }
  function drawDrop(d) {
    var near = clamp(1 - (GY - d.y) / 260, 0.1, 1);
    cx.fillStyle = 'rgba(255,40,60,' + (0.28 * near) + ')'; cx.beginPath(); cx.ellipse(d.x, GY + 4, 10 + 18 * near, 3 + 4 * near, 0, 0, 6.28); cx.fill();
    cx.globalCompositeOperation = 'lighter'; cx.drawImage(gRed, d.x - 22, d.y - 22, 44, 44); cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = '#ff2a3a'; cx.beginPath(); cx.moveTo(d.x, d.y - 13); cx.quadraticCurveTo(d.x + 10, d.y, d.x, d.y + 8); cx.quadraticCurveTo(d.x - 10, d.y, d.x, d.y - 13); cx.fill();
    cx.fillStyle = 'rgba(255,255,255,.75)'; cx.beginPath(); cx.arc(d.x - 2.5, d.y - 1, 2, 0, 6.28); cx.fill();
  }
  var PICKCOL = { heart: '#ff4b6b', shield: '#8fd0ff', magnet: '#ffd166', slow: '#b49bff', blade: '#ffb347' }, PICKSYM = { heart: '♥', shield: '⛨', magnet: '✵', slow: '⌛', blade: '⚔' };
  function drawPick(p) {
    if (p.life < 2 && Math.floor(t * 10) % 2 === 0) return;
    var yy = p.y - 14 + Math.sin(t * 4 + p.x) * 3;
    cx.globalCompositeOperation = 'lighter'; cx.drawImage(p.k === 'shield' ? gBlue : gGold, p.x - 26, yy - 26, 52, 52); cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = 'rgba(20,4,10,.8)'; cx.beginPath(); cx.arc(p.x, yy, 13, 0, 6.28); cx.fill(); cx.strokeStyle = PICKCOL[p.k]; cx.lineWidth = 2; cx.stroke();
    cx.fillStyle = PICKCOL[p.k]; cx.font = '700 15px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(PICKSYM[p.k], p.x, yy + 1); cx.textBaseline = 'alphabetic';
  }
  function drawBgScene(px) {
    cx.drawImage(bgSky, 0, 0);
    var pr = clamp(1 + (phase - 1) * 0.12, 1, 1.3) + Math.sin(t * 1.2) * 0.02;
    cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.8; var ms = 230 * pr; cx.drawImage(gMoon, 640 - ms / 2, 105 - ms / 2, ms, ms); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = phase === 3 ? '#ff6a4a' : '#ffb27a'; cx.beginPath(); cx.arc(640, 105, 42 * pr, 0, 6.28); cx.fill();
    cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.07 + 0.03 * Math.sin(t * 0.8); cx.fillStyle = '#ff6a4a'; for (var gi = 0; gi < 5; gi++) { var gx = 640 + (gi - 2) * 70; cx.beginPath(); cx.moveTo(640, 105); cx.lineTo(gx - 60, GY); cx.lineTo(gx + 60, GY); cx.fill(); } cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    cx.drawImage(bgFar, -(px - W / 2) * 0.012 - 40, 0); cx.drawImage(bgMid, -(px - W / 2) * 0.03 - 60, 0);
    cx.globalAlpha = 0.18; var fx = (t * 12) % W; cx.fillStyle = '#ff9a8a'; cx.fillRect(0, GY - 40, W, 40); cx.globalAlpha = 1;
    cx.drawImage(bgGround, 0, GY);
    for (var li = 0; li < 5; li++) {
      var lx = 70 + li * 165 + Math.sin(t * 1.3 + li) * 5, ly = 70 + (li % 2) * 26;
      cx.strokeStyle = 'rgba(255,200,120,.35)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(lx, 0); cx.lineTo(lx, ly); cx.stroke();
      cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 5 + li); cx.drawImage(gGold, lx - 28, ly - 24, 56, 56); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
      cx.fillStyle = '#c4122b'; cx.beginPath(); cx.ellipse(lx, ly + 4, 9, 12, 0, 0, 6.28); cx.fill(); cx.fillStyle = '#ffc83d'; cx.fillRect(lx - 5, ly - 8, 10, 3); cx.fillRect(lx - 5, ly + 14, 10, 3);
    }
    stains.forEach(function (s) { cx.fillStyle = 'rgba(120,10,25,' + s.a + ')'; cx.beginPath(); cx.ellipse(s.x, GY + 6, 22, 4, 0, 0, 6.28); cx.fill(); });
    cx.globalCompositeOperation = 'lighter'; cx.fillStyle = 'rgba(255,150,80,.8)';
    emb.forEach(function (e) { cx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t + e.p)); cx.fillRect(e.x, e.y, e.s * 1.6, e.s * 1.6); }); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  }
  function shadow(x, w) { cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(x, GY + 3, w, 5, 0, 0, 6.28); cx.fill(); }

  function playerOpts() {
    var A = ATK[P.atkIdx], sw = P.atkT > 0 ? 1 - P.atkT / A.dur : null, o = { col: '#f4e9d0', moving: P.moving && P.ground, walk: P.walk, idle: t, kind: 'hero', air: !P.ground, sw: sw, style: P.atkIdx, scarf: true, scarfV: P.vx * (P.dashT > 0 ? 1 : 0) + (P.moving ? -P.dir * 200 : 0), lean: P.dashT > 0 ? 0.35 : 0, sq: P.sq };
    if (bladeT > 0) { o.blade = '#ffb347'; o.trail = 'rgba(255,150,40,.7)'; }
    if (furyT > 0) { o.col = '#fff1c0'; o.blade = '#ffd166'; o.sw = null; o.wind = true; o.trail = 'rgba(255,200,80,.6)'; }
    return o;
  }
  function drawScene(px) {
    drawBgScene(px);
    if (!P || !B) return;
    shadow(P.x, 20 - (GY - P.y) * 0.04); shadow(B.x, 36 * B.alpha); en.forEach(function (e) { shadow(e.x, 17); });
    if (B.alpha > 0.05) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.55 * B.alpha * (0.8 + 0.2 * Math.sin(t * 5)); cx.drawImage(round % 3 === 0 ? gShade : round % 3 === 2 ? gMoon : gAura, B.x - 130, B.y - 170, 260, 260); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    en.forEach(function (e) {
      var d = ET[e.k], r = e.rise > 0 ? 1 - e.rise / 0.7 : 1, sw = e.st === 'swing' ? 1 - e.tm / 0.18 : null;
      fig(e.x, e.y, d.s, e.dir, { kind: e.k, col: e.k === 'elite' ? '#5a0a30' : e.k === 'brute' ? '#3a1a24' : e.k === 'archer' ? '#3a0a20' : e.k === 'fast' ? '#5a0a14' : '#4a0b17', eye: '#ff5a5a', alpha: 0.35 + 0.65 * r, dy: (1 - r) * 40, moving: e.st === 'walk' && !(e.rise > 0), walk: e.walk, idle: t + e.x, wind: e.st === 'wind' && e.k !== 'archer', sw: e.k === 'archer' ? null : sw, flash: e.flash, lean: e.k === 'fast' ? 0.25 : 0 });
    });
    en.forEach(function (e) { if (e.k === 'elite' || e.k === 'brute') { var by = e.y - ET[e.k].s * 82, mh = e.k === 'elite' ? 5 : 2; cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(e.x - 16, by, 32, 4); cx.fillStyle = e.k === 'elite' ? '#ff6ad0' : '#ff6a6a'; cx.fillRect(e.x - 16, by, 32 * clamp(e.hp / mh, 0, 1), 4); } });
    var bsw = B.st === 'swing' ? 1 - B.tm / 0.18 : null;
    fig(B.x, B.y, 1.5, B.dir, { kind: 'boss', col: BCOL[round % 3], eye: BEYE[round % 3], horns: true, arms4: true, big: true, moving: B.st === 'walk', walk: B.walk, idle: t, wind: B.st === 'wind' || B.st === 'crouch' || B.st === 'cast' || B.st === 'cwind', sw: bsw, flash: B.flash, alpha: B.alpha, rot: B.rot, stunned: B.stun > 0, air: B.st === 'jump', sq: B.st === 'crouch' ? 0.2 : 0, dy: B.st === 'crouch' ? 6 : 0 });
    if (B.st === 'cwind') { cx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 25); cx.fillStyle = '#ff2a3a'; for (var ci = 1; ci < 6; ci++) { var cxp = B.x + B.dir * (60 + ci * 55); cx.beginPath(); cx.moveTo(cxp, GY - 30); cx.lineTo(cxp + B.dir * 22, GY - 16); cx.lineTo(cxp, GY - 2); cx.fill(); } cx.globalAlpha = 1; }
    spikes.forEach(function (s) {
      if (s.tm > 0) { var a = 0.35 + 0.35 * Math.sin(t * 20); cx.fillStyle = 'rgba(255,40,60,' + a + ')'; cx.beginPath(); cx.ellipse(s.x, GY + 4, 26, 6, 0, 0, 6.28); cx.fill(); cx.strokeStyle = 'rgba(255,90,90,' + a + ')'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(s.x, GY - 4); cx.lineTo(s.x, GY - 40); cx.stroke(); }
      else { var h = Math.max(0, 1 - (-s.tm) / 0.35) * 110; cx.fillStyle = '#8a0a1a'; cx.beginPath(); cx.moveTo(s.x - 16, GY); cx.lineTo(s.x, GY - h); cx.lineTo(s.x + 16, GY); cx.fill(); cx.globalCompositeOperation = 'lighter'; cx.drawImage(gRed, s.x - 34, GY - h - 10, 68, 68); cx.globalCompositeOperation = 'source-over'; }
    });
    ghosts.forEach(function (g) { fig(g.x, g.y, 1, g.dir, { col: '#bfa86a', alpha: g.a * 0.5, moving: true, walk: g.walk, lean: 0.35 }); });
    var blink = P.inv > 0 && mode === 'play' && Math.floor(t * 20) % 2 === 0;
    if (!blink) { var po = playerOpts(); if (mode === 'over') { po.rot = 1.4 * Math.min(1, (1.4 - endT) * 1.5); po.air = false; } fig(P.x, P.y, 1, P.dir, po); }
    if (P.shield) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.6 + 0.2 * Math.sin(t * 6); cx.drawImage(gBlue, P.x - 46, P.y - 90, 92, 92); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    if (furyT > 0) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.8; cx.drawImage(gGold, P.x - 80, P.y - 130, 160, 160); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    proj.forEach(function (p) {
      if (p.k === 'arrow') { cx.strokeStyle = '#ffd9a0'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - Math.sign(p.vx) * 26, p.y); cx.stroke(); cx.fillStyle = '#ff4b4b'; cx.beginPath(); cx.arc(p.x, p.y, 4, 0, 6.28); cx.fill(); }
      else { cx.fillStyle = 'rgba(255,40,60,.85)'; cx.beginPath(); cx.moveTo(p.x - 16, GY); cx.lineTo(p.x, GY - 38); cx.lineTo(p.x + 16, GY); cx.fill(); cx.globalCompositeOperation = 'lighter'; cx.drawImage(gRed, p.x - 30, GY - 50, 60, 60); cx.globalCompositeOperation = 'source-over'; }
    });
    drops.forEach(drawDrop); picks.forEach(drawPick);
  }
  function drawFx() {
    slashes.forEach(function (s) { var k = s.t / 0.22; cx.save(); cx.translate(s.x, s.y); cx.scale(s.dir, 1); cx.globalAlpha = Math.max(0, 1 - k); cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = s.h ? '#ffb347' : '#fff1dc'; cx.lineCap = 'round'; cx.lineWidth = (s.h ? 16 : 10) * (1 - k * 0.6); cx.beginPath(); cx.arc(-20, 0, s.h ? 95 : 70, -1.1 + k * 0.5, 1.1 + k * 0.3); cx.stroke(); cx.restore(); });
    cx.globalAlpha = 1;
    parts.forEach(function (p) {
      var a = 1 - p.life / p.max; cx.globalAlpha = a;
      if (p.line) { cx.strokeStyle = p.col; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); cx.stroke(); }
      else { cx.fillStyle = p.col; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.28); cx.fill(); }
    }); cx.globalAlpha = 1;
    rings.forEach(function (r) { var k = r.t / 0.7; cx.strokeStyle = r.col + (1 - k) + ')'; cx.lineWidth = 10 * (1 - k) + 2; cx.beginPath(); cx.arc(r.x, r.y, 20 + r.max * ease(k), 0, 6.28); cx.stroke(); });
    cx.textAlign = 'center';
    floats.forEach(function (f) { var k = f.life / 1.3; cx.globalAlpha = 1 - k * k; cx.fillStyle = f.col; cx.font = '700 ' + (f.big ? 22 : 15) + 'px system-ui,sans-serif'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 3; cx.strokeText(f.txt, f.x, f.y); cx.fillText(f.txt, f.x, f.y); }); cx.globalAlpha = 1;
  }
  function drawHud() {
    cx.textAlign = 'left'; cx.font = '24px system-ui,sans-serif';
    for (var i = 0; i < maxHp(); i++) { cx.fillStyle = i < P.hp ? '#ff3b55' : 'rgba(255,255,255,.22)'; cx.fillText('♥', 12 + i * 25, 32); }
    if (P.hp <= 1 && mode === 'play') { cx.fillStyle = 'rgba(255,0,40,' + (0.12 + 0.1 * Math.sin(t * 8)) + ')'; cx.fillRect(0, 0, W, H); }
    var y = 62, st = [];
    cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(12, 40, 120, 8); cx.fillStyle = fury >= 100 ? '#ffd166' : '#ff8a3a'; cx.fillRect(12, 40, 120 * clamp(fury / 100, 0, 1), 8); cx.strokeStyle = '#d49a32'; cx.lineWidth = 1; cx.strokeRect(12, 40, 120, 8); if (P.shield) st.push(['SHIELD', '#8fd0ff']); if (magnetT > 0) st.push(['MAGNET ' + Math.ceil(magnetT), '#ffd166']); if (slowT > 0) st.push(['KAAL ' + Math.ceil(slowT), '#b49bff']); if (bladeT > 0) st.push(['BLADE ' + Math.ceil(bladeT), '#ffb347']);
    cx.font = '700 11px system-ui,sans-serif'; st.forEach(function (s, k) { cx.fillStyle = s[1]; cx.fillText(s[0], 14, y + 12 * k + 6); });
    cx.textAlign = 'right'; cx.fillStyle = '#ffe9c0'; cx.font = '700 17px system-ui,sans-serif'; cx.fillText('Score ' + score, W - 12, 26);
    cx.font = '13px system-ui,sans-serif'; cx.fillStyle = '#f2cf9c'; cx.fillText('Round ' + round + (mod ? ' · ' + MODS[mod] : '') + ' · Warriors ' + en.length + ' · Best ' + Math.max(S.best, score), W - 12, 45);
    var bw = 270, bx = W / 2 - bw / 2;
    cx.textAlign = 'center'; cx.font = '700 13px Georgia,serif'; cx.fillStyle = '#ffd166'; cx.fillText(VN[round % 3].toUpperCase(), W / 2, 20);
    cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(bx, 26, bw, 11); var bg2 = cx.createLinearGradient(0, 26, 0, 37); bg2.addColorStop(0, phase === 3 ? '#ff7a3a' : '#ff4a5a'); bg2.addColorStop(1, phase === 3 ? '#b81a00' : '#8a0a1c'); cx.fillStyle = bg2; cx.fillRect(bx, 26, bw * clamp(B.hp / B.max, 0, 1), 11);
    cx.strokeStyle = '#d49a32'; cx.lineWidth = 1.5; cx.strokeRect(bx, 26, bw, 11); cx.fillStyle = 'rgba(255,220,150,.7)'; cx.fillRect(bx + bw / 3, 26, 1, 11); cx.fillRect(bx + bw * 2 / 3, 26, 1, 11);
    if (combo >= 2) {
      var sc = 1 + Math.max(0, comboT - 2.3) * 1.2; cx.save(); cx.translate(W / 2, 82); cx.scale(sc, sc); cx.fillStyle = mult >= 4 ? '#ff9a3a' : '#ffd166'; cx.font = '700 26px system-ui,sans-serif'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 4; var tx = 'x' + mult + '  ' + combo + ' CHAIN'; cx.strokeText(tx, 0, 0); cx.fillText(tx, 0, 0); cx.restore();
      cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(W / 2 - 60, 90, 120, 5); cx.fillStyle = '#ffd166'; cx.fillRect(W / 2 - 60, 90, 120 * clamp(comboT / 2.6, 0, 1), 5);
    }
    // fury bar
    if (banner) {
      var k = banner.t / banner.dur, a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1, sc2 = 1 + (1 - Math.min(1, k / 0.15)) * 0.4;
      cx.save(); cx.globalAlpha = clamp(a, 0, 1); cx.translate(W / 2, 175); cx.scale(sc2, sc2); cx.textAlign = 'center'; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.lineWidth = 6;
      cx.font = '400 54px Georgia,"Noto Serif Devanagari",serif'; cx.fillStyle = '#ffc83d'; cx.strokeText(banner.a, 0, 0); cx.fillText(banner.a, 0, 0);
      cx.font = '600 18px system-ui,sans-serif'; cx.fillStyle = '#fff1dc'; cx.lineWidth = 4; cx.strokeText(banner.b, 0, 30); cx.fillText(banner.b, 0, 30); cx.restore();
    }
    if (tipT > 0 && mode === 'play') { cx.globalAlpha = clamp(tipT, 0, 1); cx.textAlign = 'center'; cx.font = '700 16px system-ui,sans-serif'; cx.fillStyle = '#fff1dc'; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.lineWidth = 4; cx.strokeText(tipText, W / 2, 128); cx.fillText(tipText, W / 2, 128); cx.globalAlpha = 1; }
  }
  function drawToasts() {
    cx.textAlign = 'center'; cx.font = '700 15px system-ui,sans-serif';
    toasts.forEach(function (o, i) { var a = o.t < 0.3 ? o.t / 0.3 : o.t > 2.5 ? (3 - o.t) / 0.5 : 1; cx.globalAlpha = clamp(a, 0, 1); cx.fillStyle = 'rgba(30,6,14,.85)'; var w = cx.measureText(o.txt).width + 28; cx.fillRect(W / 2 - w / 2, 108 + i * 30, w, 24); cx.strokeStyle = '#d49a32'; cx.lineWidth = 1; cx.strokeRect(W / 2 - w / 2, 108 + i * 30, w, 24); cx.fillStyle = '#ffd166'; cx.fillText(o.txt, W / 2, 125 + i * 30); }); cx.globalAlpha = 1;
  }
  var mp, mb; // menu showcase
  function draw() {
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#12040a'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.setTransform(dpr * scale, 0, 0, dpr * scale, ox * dpr, oy * dpr);
    cx.save(); cx.beginPath(); cx.rect(0, 0, W, H); cx.clip();
    var z = 1 + zoom; cx.translate(W / 2, H / 2); cx.scale(z, z); cx.translate(-W / 2, -H / 2);
    if (shake > 0) cx.translate(rnd(-shake, shake) * 0.5, rnd(-shake, shake) * 0.5);
    if (mode === 'menu' || !P) {
      if (!mp) { mp = makePlayer(); mb = { x: 0 }; }
      drawBgScene(W / 2); shadow(250, 20); shadow(560, 36);
      cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.5; cx.drawImage(gAura, 430, GY - 170, 260, 260); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
      fig(250, GY, 1, 1, { kind: 'hero', col: '#f4e9d0', idle: t, scarf: true }); fig(560, GY, 1.5, -1, { kind: 'boss', col: '#2a0610', eye: '#ff3030', horns: true, arms4: true, big: true, idle: t + 2 });
      for (var i = 0; i < 5; i++) { var dd = { x: 330 + i * 40 + Math.sin(t + i) * 12, y: 140 + ((t * 28 + i * 70) % 230), ph: 0 }; drawDrop(dd); }
    } else { drawScene(P.x); }
    drawFx();
    cx.restore();
    cx.save(); cx.setTransform(dpr * scale, 0, 0, dpr * scale, ox * dpr, oy * dpr); cx.beginPath(); cx.rect(0, 0, W, H); cx.clip();
    cx.drawImage(vignette, 0, 0);
    if (P && mode !== 'menu' && phase === 3) { cx.fillStyle = 'rgba(120,0,20,' + (0.08 + 0.04 * Math.sin(t * 3)) + ')'; cx.fillRect(0, 0, W, H); }
    if (hurtFlash > 0) { cx.fillStyle = 'rgba(255,0,30,' + hurtFlash * 0.45 + ')'; cx.fillRect(0, 0, W, H); }
    if (whiteFlash > 0) { cx.fillStyle = 'rgba(255,240,200,' + whiteFlash * 0.7 + ')'; cx.fillRect(0, 0, W, H); }
    if (P && B && mode !== 'menu') drawHud();
    drawToasts();
    cx.restore();
  }

  // =====================================================================
  //  Menus, shop, trophies, end screens
  // =====================================================================
  function setBtn(id, on, label) { var b = $(id); b.setAttribute('aria-pressed', String(on)); b.textContent = label + ': ' + (on ? 'On' : 'Off'); }
  function refreshMenu() {
    $('stat').textContent = (S.best ? 'Best ' + S.best + ' · Round ' + S.bestRound + ' · ' : '') + 'Karma ' + S.karma;
    var c = $('cont'); c.hidden = S.bestRound <= 1; c.textContent = 'Continue · Round ' + S.bestRound;
    setBtn('musBtn', S.mus, 'Music'); setBtn('sfxBtn', S.sfx, 'Effects'); setBtn('hapBtn', S.hap, 'Vibration'); setBtn('nmBtn', S.hard, 'Nightmare');
  }
  function goMenu() { mode = 'menu'; endShown = false; closeAll(); $('ctrl').hidden = true; RBAudio.music('menu'); refreshMenu(); $('menu').hidden = false; $('play').focus(); }
  function renderShop() {
    $('karma').textContent = 'Karma: ' + S.karma + '   (earn more by clearing rounds)';
    var list = $('shopList'); list.textContent = '';
    UPS.forEach(function (u) {
      var lv = S.up[u.id], full = lv >= u.max, cost = upCost(u);
      var row = document.createElement('div'); row.className = 'item' + (full ? ' done' : '');
      var tx = document.createElement('div'); tx.className = 't';
      var b = document.createElement('b'); b.textContent = u.n; var sm = document.createElement('small'); sm.textContent = u.d;
      var pips = document.createElement('div'); pips.className = 'pips'; pips.textContent = new Array(lv + 1).join('●') + new Array(u.max - lv + 1).join('○');
      tx.appendChild(b); tx.appendChild(sm); tx.appendChild(pips);
      var btn = document.createElement('button'); btn.textContent = full ? 'Max' : 'Buy ' + cost; btn.disabled = full || S.karma < cost;
      btn.addEventListener('click', function () { if (S.up[u.id] >= u.max || S.karma < upCost(u)) return; S.karma -= upCost(u); S.up[u.id]++; sfx('levelup'); saveProgress(); renderShop(); });
      row.appendChild(tx); row.appendChild(btn); list.appendChild(row);
    });
  }
  function renderTrophies() {
    var n = ACH.filter(function (a) { return S.ach[a.id]; }).length; $('trophyStat').textContent = n + ' / ' + ACH.length + ' unlocked  (+40 karma each)';
    var list = $('trophyList'); list.textContent = '';
    ACH.forEach(function (a) {
      var got = !!S.ach[a.id], row = document.createElement('div'); row.className = 'item' + (got ? ' got' : '');
      var tx = document.createElement('div'); tx.className = 't'; var b = document.createElement('b'); b.textContent = (got ? '★ ' : '☆ ') + a.n; var sm = document.createElement('small'); sm.textContent = a.d; tx.appendChild(b); tx.appendChild(sm); row.appendChild(tx); list.appendChild(row);
    });
  }
  function openShop(from) { shopFrom = from; closeAll(); renderShop(); $('shop').hidden = false; }
  function openTrophies() { closeAll(); renderTrophies(); $('trophies').hidden = false; }
  function leaveShop() { if (shopFrom === 'end') showEnd(); else goMenu(); }
  function showEnd() {
    endShown = true; closeAll(); $('ctrl').hidden = true; RBAudio.music('menu');
    var win = mode === 'win';
    $('overT').textContent = win ? 'Raktabeej falls!  रक्तबीज पराजित' : 'You have fallen';
    $('stars').textContent = win ? new Array(stars + 1).join('★') + new Array(4 - stars).join('☆') : '';
    $('overP').textContent = 'Round ' + round + ' · Score ' + score + ' · Best ' + S.best + ' · Chain ' + maxCombo + ' · +' + earned + ' karma (total ' + S.karma + ')';
    var a = $('overA');
    if (win) { a.textContent = 'Next Round'; a.onclick = function () { sfx('ui'); round++; startRound(); }; }
    else { a.textContent = 'Retry Round ' + round; a.onclick = function () { sfx('ui'); score = roundStartScore; P = makePlayer(); startRound(); }; }
    $('overS').onclick = function () { sfx('ui'); openShop('end'); }; $('overM').onclick = function () { sfx('ui'); goMenu(); };
    $('over').hidden = false; a.focus();
  }
  $('play').addEventListener('click', function () { sfx('ui'); startGame(1); });
  $('cont').addEventListener('click', function () { sfx('ui'); startGame(S.bestRound); });
  $('shopBtn').addEventListener('click', function () { sfx('ui'); openShop('menu'); });
  $('trophyBtn').addEventListener('click', function () { sfx('ui'); openTrophies(); });
  $('shopBack').addEventListener('click', function () { sfx('ui'); leaveShop(); });
  $('trophyBack').addEventListener('click', function () { sfx('ui'); goMenu(); });
  $('musBtn').addEventListener('click', function () { S.mus = !S.mus; refreshMenu(); saveProgress(); });
  $('sfxBtn').addEventListener('click', function () { S.sfx = !S.sfx; refreshMenu(); saveProgress(); sfx('ui'); });
  $('hapBtn').addEventListener('click', function () { S.hap = !S.hap; refreshMenu(); saveProgress(); if (S.hap) buzz(30); });
  $('nmBtn').addEventListener('click', function () { S.hard = !S.hard; refreshMenu(); saveProgress(); sfx(S.hard ? 'roar' : 'ui', { vol: 0.6 }); });

  // =====================================================================
  //  Input
  // =====================================================================
  var KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'j', ArrowDown: 'p', s: 'p', S: 'p', w: 'j', W: 'j', ' ': 'j', j: 'a', J: 'a', x: 'a', X: 'a', z: 'a', Z: 'a', k: 'd', K: 'd', c: 'd', C: 'd', Shift: 'd', l: 'f', L: 'f', e: 'f', E: 'f', v: 'f', V: 'f' };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!$('shop').hidden) leaveShop(); else if (!$('trophies').hidden) goMenu(); return; } // Esc is never blocked
    var k = KEYS[e.key]; if (!k || mode !== 'play') return;
    e.preventDefault();
    if (k === 'l') inp.l = 1; else if (k === 'r') inp.r = 1; else if (!e.repeat) { if (k === 'j') inp.jump = true; else if (k === 'a') inp.atk = true; else if (k === 'd') inp.dash = true; else if (k === 'f') inp.fury = true; else if (k === 'p') inp.pound = true; }
  });
  document.addEventListener('keyup', function (e) { var k = KEYS[e.key]; if (k === 'l') inp.l = 0; else if (k === 'r') inp.r = 0; });
  cv.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && mode === 'play') inp.atk = true; });
  function bind(id, down, up) {
    var b = $(id);
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} b.classList.add('on'); down(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('on'); if (up) up(); }); });
  }
  bind('bL', function () { inp.l = 1; }, function () { inp.l = 0; }); bind('bR', function () { inp.r = 1; }, function () { inp.r = 0; });
  bind('bJ', function () { inp.jump = true; }); bind('bA', function () { inp.atk = true; }); bind('bD', function () { inp.dash = true; }); bind('bF', function () { inp.fury = true; }); bind('bP', function () { inp.pound = true; });

  // =====================================================================
  //  Loop (SDK pause stops everything)
  // =====================================================================
  var raf = 0, last = 0;
  function frame(now) {
    raf = 0; if (paused) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    update(dt); draw(); raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (!raf && !paused) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  // =====================================================================
  //  YouTube Playables SDK
  // =====================================================================
  function logYT(k) { try { if (ytReady && yt.health && yt.health[k]) yt.health[k](); } catch (e) {} }
  window.addEventListener('error', function () { logYT('logError'); });
  window.addEventListener('unhandledrejection', function () { logYT('logWarning'); });
  var loadSettled = false, lastSaved = '';
  function snapshot() { return JSON.stringify({ v: 2, S: S }); }
  function saveProgress() {
    if (!ytReady || !loadSettled) return;
    try { var s = snapshot(); if (s === lastSaved) return; lastSaved = s; Promise.resolve(yt.game.saveData(s)).catch(function () { lastSaved = ''; logYT('logWarning'); }); }
    catch (e) { lastSaved = ''; logYT('logWarning'); }
  }
  function sendBest() {
    if (!ytReady || !yt.engagement || !yt.engagement.sendScore) return;
    try { Promise.resolve(yt.engagement.sendScore({ value: Math.max(0, Math.floor(S.best)) })).catch(function () { logYT('logWarning'); }); } catch (e) {}
  }
  function intIn(v, lo, hi, d) { v = Math.floor(Number(v)); return isFinite(v) && v >= lo && v <= hi ? v : d; }
  function applySaved(str) { // accepts v1 (flat) and v2 saves, ignores anything damaged
    if (!str) return; var o; try { o = JSON.parse(str); } catch (e) { return; }
    if (!o || typeof o !== 'object') return; var d = o.S && typeof o.S === 'object' ? o.S : o;
    S.best = intIn(d.best, 0, Number.MAX_SAFE_INTEGER, 0); S.bestRound = intIn(d.bestRound, 1, 999, 1); S.karma = intIn(d.karma, 0, 1e9, 0); S.total = intIn(d.total, 0, 1e9, 0); S.streak = intIn(d.streak, 0, 9999, 0);
    S.day = typeof d.day === 'string' ? d.day.slice(0, 10) : ''; if (typeof d.sfx === 'boolean') S.sfx = d.sfx; if (typeof d.mus === 'boolean') S.mus = d.mus; if (typeof d.hap === 'boolean') S.hap = d.hap; S.tut = !!d.tut; S.hard = !!d.hard;
    if (d.up && typeof d.up === 'object') UPS.forEach(function (u) { S.up[u.id] = intIn(d.up[u.id], 0, u.max, 0); });
    if (d.ach && typeof d.ach === 'object') ACH.forEach(function (a) { if (d.ach[a.id]) S.ach[a.id] = 1; });
  }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dailyReward() {
    var today = dayKey(Date.now()); if (S.day === today) return;
    S.streak = S.day === dayKey(Date.now() - 864e5) ? S.streak + 1 : 1; S.day = today;
    var r = 20 + 10 * Math.min(S.streak, 7); S.karma += r; toast('Daily blessing: +' + r + ' karma  (day ' + S.streak + ' streak)'); saveProgress();
  }
  function pauseGame() {
    if (paused) return; paused = true; inp.l = inp.r = 0; inp.jump = inp.atk = inp.dash = inp.fury = inp.pound = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; } RBAudio.suspend(); saveProgress();
  }
  function resumeGame() { if (!paused) return; paused = false; RBAudio.resume(); startLoop(); }
  if (ytReady) {
    try {
      yt.system.onPause(pauseGame); yt.system.onResume(resumeGame);
      yt.system.onAudioEnabledChange(function (on) { ytAudio = !!on; RBAudio.tick(0); });
      if (yt.system.isAudioEnabled) ytAudio = !!yt.system.isAudioEnabled();
    } catch (e) {}
  }

  // =====================================================================
  //  Boot: splash visible -> firstFrameReady -> load save -> remove splash -> gameReady
  // =====================================================================
  function afterPaint(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  resize(); refreshMenu(); RBAudio.music('menu'); startLoop();
  afterPaint(function () {
    try { if (ytReady) yt.game.firstFrameReady(); } catch (e) {}
    var work = [];
    if (ytReady) work.push(Promise.resolve().then(function () { return yt.game.loadData(); }).then(applySaved, function () {}).then(function () { loadSettled = true; }));
    Promise.race([Promise.all(work), new Promise(function (r) { setTimeout(r, 4000); })]).then(function () {
      loadSettled = true; dailyReward(); refreshMenu();
      var sp = $('splash'); if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
      afterPaint(function () { try { if (ytReady) yt.game.gameReady(); } catch (e) {} });
    });
  });
})();
