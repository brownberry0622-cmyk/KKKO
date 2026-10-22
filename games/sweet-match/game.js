/* 糖果派对 · 完整三消玩法
   特殊糖果：4连→条纹糖(清行/列)，L/T型→炸弹糖(3×3)，5连→彩虹糖(清同色)
   组合技：条纹+条纹=十字，条纹+炸弹=三行三列，炸弹+炸弹=5×5，
           彩虹+条纹=同色全变条纹，彩虹+炸弹=同色全变炸弹，彩虹+彩虹=清屏
   关卡目标：得分 / 冰块 / 收集，星级评价，解锁进度保存 */
(() => {
  'use strict';

  const ROWS = 8, COLS = 8, TYPES = 6;
  const BEST_KEY = 'sweet-match-best';
  const UNLOCK_KEY = 'candy-party-unlocked';
  const STARS_KEY = 'candy-party-stars';
  const COLOR_HEX = ['#e05c74', '#e8a23c', '#5cae62', '#3f8fd6', '#8a5cd0', '#ef7f4e'];

  const board = document.getElementById('board');
  const $score = document.getElementById('score');
  const $best = document.getElementById('best');
  const $level = document.getElementById('level');
  const $goalText = document.getElementById('goal-text');
  const $goalFill = document.getElementById('goal-fill');
  const $status = document.getElementById('status');
  const $toast = document.getElementById('toast');
  const $combo = document.getElementById('combo');
  const $overlay = document.getElementById('overlay');
  const $modal = document.getElementById('modal');
  const $soundBtn = document.getElementById('sound');
  const $levelsBtn = document.getElementById('levels');

  let grid = [];              // grid[r][c] = { type, special: null|'h'|'v'|'b'|'r', el } | null
  let ice = [], iceEls = [], iceTotal = 0;
  let cfg = null;             // 当前关卡配置
  let score = 0;              // 本关分数
  let level = 1;
  let moves = 0;
  let collected = [0, 0, 0, 0, 0, 0];
  let selected = null;
  let busy = false;
  let hintTimer = null;
  let toastTimer = null;

  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const inBoard = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

  /* ---------- 存档 ---------- */
  function getUnlocked() { try { return Math.max(1, Number(localStorage.getItem(UNLOCK_KEY)) || 1); } catch (_) { return 1; } }
  function setUnlocked(n) { try { localStorage.setItem(UNLOCK_KEY, String(n)); } catch (_) {} }
  function getStars() { try { return JSON.parse(localStorage.getItem(STARS_KEY)) || {}; } catch (_) { return {}; } }
  function saveStar(n, s) { const st = getStars(); st[n] = Math.max(st[n] || 0, s); try { localStorage.setItem(STARS_KEY, JSON.stringify(st)); } catch (_) {} }
  function getBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; } }
  function saveBest() { try { if (score > getBest()) localStorage.setItem(BEST_KEY, String(score)); } catch (_) {} }
  function refreshBest() { $best.textContent = Math.max(getBest(), score); }

  /* ---------- 关卡配置 ---------- */
  function levelConfig(n) {
    const kind = n % 3 === 1 ? 'score' : n % 3 === 2 ? 'ice' : 'collect';
    const baseMoves = Math.max(14, 24 - Math.floor((n - 1) / 2));
    if (kind === 'score') return { type: 'score', goal: 800 + (n - 1) * 400, moves: baseMoves + 2 };
    if (kind === 'ice') return { type: 'ice', iceCount: Math.min(24, 4 + n * 2), twoLayer: n >= 8, moves: baseMoves + 10 };
    return { type: 'collect', color: Math.floor(Math.random() * TYPES), need: Math.min(45, 10 + n * 2), moves: baseMoves + 5 };
  }
  function dotHtml(t) { return '<i class="dot" style="background:' + COLOR_HEX[t] + '"></i>'; }
  function goalDescHtml() {
    if (cfg.type === 'score') return '在 <b>' + cfg.moves + '</b> 步内拿到 <b>' + cfg.goal + '</b> 分';
    if (cfg.type === 'ice') return '在 <b>' + cfg.moves + '</b> 步内打碎全部 <b>' + iceTotal + '</b> 层冰块';
    return '在 <b>' + cfg.moves + '</b> 步内收集 <b>' + cfg.need + '</b> 颗 ' + dotHtml(cfg.color) + ' 糖果';
  }
  function goalMet() {
    if (cfg.type === 'score') return score >= cfg.goal;
    if (cfg.type === 'ice') return iceRemaining() === 0;
    return collected[cfg.color] >= cfg.need;
  }
  function calcStars() {
    const base = cfg.type === 'score' ? cfg.goal : 900 + level * 250;
    return score >= base * 2.2 ? 3 : score >= base * 1.5 ? 2 : 1;
  }

  /* ---------- 音效 ---------- */
  let actx = null, soundOn = false;
  function ensureAudio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function beep(freq, dur, type, vol) {
    if (!soundOn || !actx) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || .18, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  }
  const sfx = {
    select:  () => beep(620, .07, 'sine', .1),
    swapOk:  () => beep(440, .09, 'triangle', .14),
    fail:    () => beep(160, .16, 'sawtooth', .08),
    pop:     n => beep(320 + Math.min(n, 6) * 90, .13, 'sine', .16),
    special: () => { beep(660, .1, 'triangle', .14); setTimeout(() => beep(990, .12, 'triangle', .14), 80); },
    boom:    () => { beep(90, .3, 'square', .2); setTimeout(() => beep(60, .25, 'sawtooth', .14), 60); },
    stripe:  () => beep(760, .14, 'sawtooth', .1),
    rainbow: () => { [523, 659, 784, 988, 1175].forEach((f, i) => setTimeout(() => beep(f, .12, 'sine', .13), i * 70)); },
    ice:     () => beep(1400, .08, 'square', .08),
    level:   () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .18, 'triangle', .15), i * 110)); },
    over:    () => { [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, .22, 'sine', .14), i * 160)); }
  };
  $soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    ensureAudio();
    $soundBtn.classList.toggle('on', soundOn);
    $soundBtn.setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
    if (soundOn) sfx.swapOk();
  });

  /* ---------- 工具 ---------- */
  function toast(text, ms) {
    $toast.textContent = text;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), ms || 1600);
  }
  function showCombo(n) {
    $combo.textContent = 'x' + n + ' 连消!';
    $combo.classList.remove('show');
    void $combo.offsetWidth;
    $combo.classList.add('show');
  }
  function ptsPopup(x, y, text) {
    const el = document.createElement('span');
    el.id = 'score-pts';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
  function status(text, warn) {
    $status.textContent = '● ' + text;
    $status.classList.toggle('warn', !!warn);
  }

  /* ---------- 棋盘与糖果 ---------- */
  function classNameFor(g) {
    let cls = 'gem';
    cls += g.special === 'r' ? ' sp-r' : ' t' + g.type;
    if (g.special === 'h') cls += ' sp-h';
    if (g.special === 'v') cls += ' sp-v';
    if (g.special === 'b') cls += ' sp-b';
    return cls;
  }
  function place(el, r, c, extraRows) {
    el.style.transform = 'translate(' + (c * 100) + '%, ' + ((r - (extraRows || 0)) * 100) + '%)';
  }
  function createGem(r, c, type, special, spawnRows) {
    const el = document.createElement('div');
    el.className = classNameFor({ type, special: special || null });
    el.appendChild(document.createElement('i'));
    el._type = type;
    place(el, r, c, spawnRows);
    board.appendChild(el);
    grid[r][c] = { type, special: special || null, el };
    if (spawnRows) {
      requestAnimationFrame(() => requestAnimationFrame(() => place(el, r, c)));
    }
    return el;
  }
  function randType() { return Math.floor(Math.random() * TYPES); }
  function pickSafeType(r, c) {
    let t;
    do { t = randType(); }
    while (
      (c >= 2 && grid[r][c - 1] && grid[r][c - 2] && grid[r][c - 1].type === t && grid[r][c - 2].type === t) ||
      (r >= 2 && grid[r - 1][c] && grid[r - 2][c] && grid[r - 1][c].type === t && grid[r - 2][c].type === t)
    );
    return t;
  }
  function buildBoard() {
    board.innerHTML = '';
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let guard = 0;
    do {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = null;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) createGem(r, c, pickSafeType(r, c));
      guard++;
    } while (!findValidMove() && guard < 50);
  }

  /* ---------- 冰块 ---------- */
  function buildIce(conf) {
    document.querySelectorAll('.ice').forEach(e => e.remove());
    ice = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    iceEls = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    iceTotal = 0;
    if (conf.type !== 'ice') return;
    const cells = [];
    // 冰块从底部区域开始铺，重力补充让底部持续有消除机会
    for (let r = ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++) cells.push([r, c]);
    for (let i = 0; i < Math.min(conf.iceCount, cells.length); i++) {
      const [r, c] = cells[i];
      const layers = conf.twoLayer && Math.random() < .35 ? 2 : 1;
      ice[r][c] = layers;
      iceTotal += layers;
      const el = document.createElement('div');
      el.className = 'ice' + (layers === 2 ? ' l2' : '');
      el.appendChild(document.createElement('i'));
      place(el, r, c);
      board.appendChild(el);
      iceEls[r][c] = el;
    }
  }
  function updateIceEl(r, c) {
    const el = iceEls[r][c];
    if (!el) return;
    if (ice[r][c] <= 0) {
      el.classList.add('break');
      const e2 = el;
      setTimeout(() => e2.remove(), 350);
      iceEls[r][c] = null;
    } else {
      el.classList.toggle('l2', ice[r][c] === 2);
    }
  }
  function iceRemaining() {
    let s = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) s += ice[r][c];
    return s;
  }

  /* ---------- 匹配检测 ---------- */
  function findRuns() {
    const runs = [];
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const t = grid[r][c] && grid[r][c].type;
        let e = c + 1;
        while (e < COLS && grid[r][e] && grid[r][e].type === t) e++;
        if (t >= 0 && e - c >= 3) {
          const cells = [];
          for (let i = c; i < e; i++) cells.push({ r, c: i });
          runs.push({ type: t, cells, len: e - c, dir: 'h' });
        }
        c = e;
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const t = grid[r][c] && grid[r][c].type;
        let e = r + 1;
        while (e < ROWS && grid[e][c] && grid[e][c].type === t) e++;
        if (t >= 0 && e - r >= 3) {
          const cells = [];
          for (let i = r; i < e; i++) cells.push({ r: i, c });
          runs.push({ type: t, cells, len: e - r, dir: 'v' });
        }
        r = e;
      }
    }
    return runs;
  }

  /* 分析 runs：合并 L/T 交叉，决定生成哪种特殊糖果 */
  function analyzeRuns(runs, swaps) {
    const set = new Set();
    runs.forEach(run => run.cells.forEach(p => set.add(p.r + ',' + p.c)));
    const creations = [];
    const byType = {};
    runs.forEach(run => { (byType[run.type] = byType[run.type] || []).push(run); });
    for (const key in byType) {
      const t = Number(key);
      const list = byType[key];
      const used = new Array(list.length).fill(false);
      for (let i = 0; i < list.length; i++) {
        if (used[i]) continue;
        const comp = { cells: new Set(list[i].cells.map(p => p.r + ',' + p.c)), maxLen: list[i].len, dir: list[i].dir };
        used[i] = true;
        let merged = true;
        while (merged) {
          merged = false;
          for (let j = 0; j < list.length; j++) {
            if (used[j]) continue;
            if (list[j].cells.some(p => comp.cells.has(p.r + ',' + p.c))) {
              list[j].cells.forEach(p => comp.cells.add(p.r + ',' + p.c));
              comp.maxLen = Math.max(comp.maxLen, list[j].len);
              used[j] = true; merged = true;
            }
          }
        }
        let kind = null;
        if (comp.maxLen >= 5) kind = 'r';
        else if (comp.cells.size >= 5) kind = 'b';
        else if (comp.maxLen === 4) kind = comp.dir;
        if (!kind) continue;
        let pivotKey = null;
        if (swaps) {
          for (const s of swaps) {
            const k = s.r + ',' + s.c;
            if (comp.cells.has(k) && grid[s.r][s.c] && grid[s.r][s.c].type === t) { pivotKey = k; break; }
          }
        }
        if (!pivotKey) {
          for (const k of comp.cells) {
            const [r, c] = k.split(',').map(Number);
            if (grid[r][c] && grid[r][c].type === t) { pivotKey = k; break; }
          }
        }
        if (pivotKey) {
          const [r, c] = pivotKey.split(',').map(Number);
          creations.push({ r, c, kind });
        }
      }
    }
    return { set, creations };
  }

  function swapCells(r1, c1, r2, c2) {
    const a = grid[r1][c1], b = grid[r2][c2];
    grid[r1][c1] = b; grid[r2][c2] = a;
    if (a) place(a.el, r2, c2);
    if (b) place(b.el, r1, c1);
  }
  function trySwapMatch(r1, c1, r2, c2) {
    swapCells(r1, c1, r2, c2);
    const ok = findRuns().length > 0;
    swapCells(r1, c1, r2, c2);
    return ok;
  }
  function findValidMove() {
    // 彩虹糖与任意相邻糖果都可行
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const g = grid[r][c];
      if (g && g.special === 'r') {
        if (c + 1 < COLS && grid[r][c + 1]) return [{ r, c }, { r, c: c + 1 }];
        if (r + 1 < ROWS && grid[r + 1][c]) return [{ r, c }, { r: r + 1, c }];
      }
    }
    // 两个特殊糖果相邻即可组合
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const a = grid[r][c];
      for (const pair of [[r, c + 1], [r + 1, c]]) {
        const b = inBoard(pair[0], pair[1]) && grid[pair[0]][pair[1]];
        if (a && b && a.special && b.special && a.special !== 'r' && b.special !== 'r') return [{ r, c }, { r: pair[0], c: pair[1] }];
      }
    }
    // 普通颜色交换成三连
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      for (const pair of [[r, c + 1], [r + 1, c]]) {
        const r2 = pair[0], c2 = pair[1];
        if (!inBoard(r2, c2)) continue;
        const a = grid[r][c], b = grid[r2][c2];
        if (a && b && a.type >= 0 && b.type >= 0 && a.type !== b.type && trySwapMatch(r, c, r2, c2)) return [{ r, c }, { r: r2, c: c2 }];
      }
    }
    return null;
  }

  /* ---------- 消除执行 ---------- */
  function mostCommonColor() {
    const count = new Array(TYPES).fill(0);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const g = grid[r][c];
      if (g && g.type >= 0) count[g.type]++;
    }
    let best = 0;
    for (let t = 1; t < TYPES; t++) if (count[t] > count[best]) best = t;
    return best;
  }

  /* 被卷入消除区域的特殊糖果连锁引爆 */
  function expandActivations(set) {
    const queue = Array.from(set);
    while (queue.length) {
      const key = queue.pop();
      const [r, c] = key.split(',').map(Number);
      const g = inBoard(r, c) && grid[r][c];
      if (!g || !g.special || g._activated) continue;
      g._activated = true;
      const add = (rr, cc) => {
        if (!inBoard(rr, cc) || !grid[rr][cc]) return;
        const k = rr + ',' + cc;
        if (!set.has(k)) { set.add(k); queue.push(k); }
      };
      if (g.special === 'h') { sfx.stripe(); for (let c2 = 0; c2 < COLS; c2++) add(r, c2); }
      else if (g.special === 'v') { sfx.stripe(); for (let r2 = 0; r2 < ROWS; r2++) add(r2, c); }
      else if (g.special === 'b') { sfx.boom(); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc); }
      else if (g.special === 'r') { sfx.rainbow(); const t = mostCommonColor(); for (let r2 = 0; r2 < ROWS; r2++) for (let c2 = 0; c2 < COLS; c2++) if (grid[r2][c2] && grid[r2][c2].type === t) add(r2, c2); }
    }
  }

  /* 统一消除：连锁引爆 → 计分 → 碎冰/收集 → 动画 → 重力补充 */
  async function clearCells(set, combo, basePts, creations) {
    expandActivations(set);
    (creations || []).forEach(cr => set.delete(cr.r + ',' + cr.c));
    const mult = Math.min(Math.max(combo, 1), 5);
    const pts = Math.round((basePts + set.size * 10) * mult);
    score += pts;
    let sr = 0, sc = 0, n = 0;
    set.forEach(k => { const [r, c] = k.split(',').map(Number); sr += r; sc += c; n++; });
    if (n) {
      const rect = board.getBoundingClientRect();
      ptsPopup(
        rect.left + (sc / n + .5) * rect.width / COLS - 14,
        rect.top + (sr / n + .2) * rect.height / ROWS,
        '+' + pts
      );
    }
    set.forEach(k => {
      const [r, c] = k.split(',').map(Number);
      const g = grid[r][c];
      if (!g) return;
      g.el.classList.add('pop');
      if (g.type >= 0) collected[g.type]++;
    });
    sfx.pop(combo);
    await sleep(260);
    set.forEach(k => {
      const [r, c] = k.split(',').map(Number);
      if (ice[r][c] > 0) { ice[r][c]--; updateIceEl(r, c); sfx.ice(); }
      const g = grid[r][c];
      if (g) { g.el.remove(); grid[r][c] = null; }
    });
    // 重力下落 + 补充新糖
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c]) {
          const gem = grid[r][c];
          grid[r][c] = null;
          grid[write][c] = gem;
          place(gem.el, write, c);
          write--;
        }
      }
      const spawnCount = write + 1;
      for (let i = 0; i <= write; i++) createGem(i, c, randType(), null, spawnCount - i);
    }
    updateHUD();
    await sleep(260);
  }

  /* 连锁消除主循环 */
  async function cascade(swaps) {
    let combo = 0;
    while (true) {
      const runs = findRuns();
      if (!runs.length) break;
      combo++;
      if (combo >= 2) showCombo(combo);
      const an = analyzeRuns(runs, combo === 1 ? swaps : null);
      let base = 0;
      runs.forEach(run => base += run.len === 3 ? 30 : run.len === 4 ? 60 : 100);
      base += an.creations.length * 60;
      if (an.creations.length) sfx.special();
      await clearCells(an.set, combo, base, an.creations);
      an.creations.forEach(cr => {
        const g = grid[cr.r][cr.c];
        if (!g) return;
        g.special = cr.kind;
        if (cr.kind === 'r') g.type = -1;
        g.el.className = classNameFor(g);
        g.el.classList.add('born');
      });
    }
    return combo;
  }

  /* ---------- 特殊组合 ---------- */
  async function rainbowCombo(rp, op) {
    const other = grid[op.r][op.c];
    const set = new Set();
    set.add(rp.r + ',' + rp.c);
    sfx.rainbow();
    const addAll = (rr, cc) => { if (inBoard(rr, cc) && grid[rr][cc]) set.add(rr + ',' + cc); };
    if (other && other.special === 'r') {
      status('双彩虹，清屏派对!');
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) addAll(r, c);
    } else if (other && (other.special === 'h' || other.special === 'v')) {
      status('彩虹条纹，全屏齐射!');
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (grid[r][c] && grid[r][c].type === other.type) {
          addAll(r, c);
          if (other.special === 'h') for (let c2 = 0; c2 < COLS; c2++) addAll(r, c2);
          else for (let r2 = 0; r2 < ROWS; r2++) addAll(r2, c);
        }
      }
    } else if (other && other.special === 'b') {
      status('彩虹炸弹，连环爆破!');
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (grid[r][c] && grid[r][c].type === other.type) {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) addAll(r + dr, c + dc);
        }
      }
    } else if (other) {
      status('彩虹糖，同色全消!');
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (grid[r][c] && grid[r][c].type === other.type) addAll(r, c);
      }
    }
    await clearCells(set, 1, set.size * 5);
    await cascade();
  }

  async function specialCombo(a, b) {
    const ga = grid[a.r][a.c], gb = grid[b.r][b.c];
    const kinds = [ga.special, gb.special].sort().join('');
    const set = new Set();
    set.add(a.r + ',' + a.c);
    set.add(b.r + ',' + b.c);
    const add = (r, c) => { if (inBoard(r, c) && grid[r][c]) set.add(r + ',' + c); };
    const fullRow = r => { for (let c = 0; c < COLS; c++) add(r, c); };
    const fullCol = c => { for (let r = 0; r < ROWS; r++) add(r, c); };
    if (kinds === 'bh' || kinds === 'bv') {
      status('巨型十字!');
      for (let d = -1; d <= 1; d++) { fullRow(a.r + d); fullCol(a.c + d); }
    } else if (kinds === 'hv') {
      status('十字消除!');
      fullRow(a.r); fullCol(a.c);
    } else {
      status('大爆炸!');
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) add(a.r + dr, a.c + dc);
    }
    sfx.boom();
    await clearCells(set, 1, set.size * 8);
    await cascade();
  }

  /* ---------- 交互 ---------- */
  function cellFromEvent(e) {
    const rect = board.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
    return { r: Math.min(ROWS - 1, Math.floor(y / rect.height * ROWS)), c: Math.min(COLS - 1, Math.floor(x / rect.width * COLS)) };
  }
  function clearSelection() {
    if (selected) {
      const cell = grid[selected.r] && grid[selected.r][selected.c];
      if (cell) cell.el.classList.remove('sel');
      selected = null;
    }
  }
  function selectCell(r, c) {
    clearSelection();
    selected = { r, c };
    grid[r][c].el.classList.add('sel');
    sfx.select();
  }
  const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

  let dragStart = null, dragged = false;
  board.addEventListener('pointerdown', e => {
    ensureAudio();
    if (busy || !$overlay.hidden) return;
    const cell = cellFromEvent(e);
    if (!cell || !grid[cell.r][cell.c]) return;
    dragStart = cell; dragged = false;
  });
  board.addEventListener('pointermove', e => {
    if (!dragStart || busy || dragged) return;
    const rect = board.getBoundingClientRect();
    const cellSize = rect.width / COLS;
    const dx = e.clientX - rect.left - (dragStart.c + .5) * cellSize;
    const dy = e.clientY - rect.top - (dragStart.r + .5) * cellSize;
    if (Math.hypot(dx, dy) < cellSize * .38) return;
    dragged = true;
    let target;
    if (Math.abs(dx) > Math.abs(dy)) target = { r: dragStart.r, c: dragStart.c + (dx > 0 ? 1 : -1) };
    else target = { r: dragStart.r + (dy > 0 ? 1 : -1), c: dragStart.c };
    clearSelection();
    if (inBoard(target.r, target.c)) attemptSwap(dragStart, target);
    dragStart = null;
  });
  board.addEventListener('pointerup', e => {
    const start = dragStart;
    dragStart = null;
    if (busy || dragged || !start) return;
    const cell = cellFromEvent(e);
    if (!cell || !grid[cell.r][cell.c]) return;
    if (selected && adjacent(selected, cell)) {
      const from = selected;
      clearSelection();
      attemptSwap(from, cell);
    } else if (selected && selected.r === cell.r && selected.c === cell.c) {
      clearSelection();
    } else {
      selectCell(cell.r, cell.c);
    }
    resetHint();
  });

  /* ---------- 交换主流程 ---------- */
  async function attemptSwap(a, b) {
    busy = true;
    clearSelection();
    const ga = grid[a.r][a.c], gb = grid[b.r][b.c];
    const ra = ga.special === 'r', rb = gb.special === 'r';
    if (ra || rb) {
      useMove();
      sfx.swapOk();
      await sleep(150);
      await rainbowCombo(ra ? a : b, ra ? b : a);
      await cascade();
    } else if (ga.special && gb.special) {
      useMove();
      sfx.swapOk();
      await sleep(150);
      await specialCombo(a, b);
      await cascade();
    } else {
      swapCells(a.r, a.c, b.r, b.c);
      sfx.swapOk();
      await sleep(230);
      if (findRuns().length > 0) {
        useMove();
        await cascade([a, b]);
      } else {
        sfx.fail();
        status('这样换不掉哦', true);
        swapCells(a.r, a.c, b.r, b.c);
        await sleep(230);
        status('继续寻找三连');
      }
    }
    busy = false;
    if (!findValidMove()) {
      toast('没有可消除的组合，自动洗牌');
      await sleep(400);
      reshuffleTypes();
      await sleep(300);
    }
    checkLevelState();
    resetHint();
  }

  function useMove() {
    moves--;
    updateHUD();
  }

  /* 保留特殊糖果，仅重新分配普通糖果颜色 */
  function reshuffleTypes() {
    let guard = 0;
    do {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const g = grid[r][c];
        if (!g || g.special) continue;
        g.type = randType();
        g.el.className = classNameFor(g);
      }
      guard++;
    } while ((findRuns().length > 0 || !findValidMove()) && guard < 200);
    status('洗牌完毕，重新出发');
  }

  /* ---------- HUD 与关卡流程 ---------- */
  function updateHUD() {
    $score.textContent = score;
    $level.textContent = level;
    if (!cfg) return;
    let fill = 0;
    if (cfg.type === 'score') {
      $goalText.innerHTML = '本关目标 <b>' + cfg.goal + '</b> 分 · 剩余 <b>' + moves + '</b> 步';
      fill = score / cfg.goal;
    } else if (cfg.type === 'ice') {
      const rem = iceRemaining();
      $goalText.innerHTML = '打碎所有冰块 · 还剩 <b>' + rem + '</b> 层 · 剩余 <b>' + moves + '</b> 步';
      fill = iceTotal ? 1 - rem / iceTotal : 1;
    } else {
      const got = collected[cfg.color];
      $goalText.innerHTML = '收集 ' + dotHtml(cfg.color) + ' × <b>' + Math.max(0, cfg.need - got) + '</b> · 剩余 <b>' + moves + '</b> 步';
      fill = got / cfg.need;
    }
    $goalFill.style.width = Math.min(100, fill * 100) + '%';
  }

  function starHtml(s) {
    return '<div class="m-stars">' + '<b>★</b>'.repeat(s) + '<s>★</s>'.repeat(3 - s) + '</div>';
  }

  function showModal(eyebrow, titleHtml, bodyHtml, btnText, onOk) {
    $overlay.hidden = false;
    $modal.innerHTML = '';
    const eb = document.createElement('div'); eb.className = 'm-eyebrow'; eb.textContent = eyebrow;
    const h = document.createElement('h3'); h.innerHTML = titleHtml;
    const p = document.createElement('p'); p.innerHTML = bodyHtml;
    const actions = document.createElement('div'); actions.className = 'm-actions';
    const btn = document.createElement('button'); btn.className = 'btn-main'; btn.textContent = btnText;
    btn.addEventListener('click', () => { $overlay.hidden = true; onOk(); });
    actions.appendChild(btn);
    $modal.append(eb, h, p, actions);
  }

  function checkLevelState() {
    refreshBest();
    if (goalMet()) {
      const bonus = moves * 20;
      score += bonus;
      saveBest();
      sfx.level();
      const stars = calcStars();
      saveStar(level, stars);
      setUnlocked(Math.max(getUnlocked(), level + 1));
      showModal('过关啦', starHtml(stars) + '第 ' + level + ' 关完成!',
        '剩余 ' + moves + ' 步兑换奖励 <b style="color:#e0608a">+' + bonus + '</b> 分，本关得分 <b style="color:#c24f74">' + score + '</b>。<br>已解锁第 ' + (level + 1) + ' 关！',
        '进入第 ' + (level + 1) + ' 关', () => loadLevel(level + 1));
    } else if (moves <= 0) {
      sfx.over();
      saveBest();
      showModal('游戏结束', '派对暂停了',
        '步数用完，本关得分 <b style="color:#c24f74">' + score + '</b>。<br>差一点点，再来一次一定行！',
        '再来一次', () => loadLevel(level));
    }
  }

  function loadLevel(n) {
    level = n;
    cfg = levelConfig(n);
    score = 0;
    moves = cfg.moves;
    collected = [0, 0, 0, 0, 0, 0];
    buildBoard();
    buildIce(cfg);
    updateHUD();
    refreshBest();
    status('第 ' + n + ' 关');
    showModal('第 ' + n + ' 关', '准备开始', goalDescHtml() + '<br>交换相邻糖果，凑齐三连即可消除', '开始', () => { resetHint(); });
    resetHint();
  }

  /* ---------- 提示 ---------- */
  function showHint() {
    const move = findValidMove();
    if (!move) return;
    move.forEach(p => {
      const cell = grid[p.r][p.c];
      if (cell) cell.el.classList.add('hint');
    });
    status('试试亮起来的糖果');
    setTimeout(() => {
      move.forEach(p => { const cell = grid[p.r] && grid[p.r][p.c]; if (cell) cell.el.classList.remove('hint'); });
    }, 3500);
  }
  function resetHint() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(showHint, 6000);
  }

  /* ---------- 关卡选择 ---------- */
  $levelsBtn.addEventListener('click', () => {
    if (busy) return;
    const unlocked = getUnlocked(), stars = getStars();
    let html = '<div class="lv-grid">';
    const total = Math.max(unlocked, 6);
    for (let i = 1; i <= total; i++) {
      if (i <= unlocked) {
        const s = stars[i] || 0;
        html += '<button class="lv-btn" data-lv="' + i + '">' + i + '<small>' + (s ? '★'.repeat(s) : '·') + '</small></button>';
      } else {
        html += '<button class="lv-btn" disabled>🔒<small>·</small></button>';
      }
    }
    html += '</div>';
    showModal('关卡列表', '选择关卡', html, '关闭', () => {});
    $modal.querySelectorAll('.lv-btn[data-lv]').forEach(btn => {
      btn.addEventListener('click', () => { $overlay.hidden = true; loadLevel(Number(btn.dataset.lv)); });
    });
  });

  /* ---------- 启动 ---------- */
  function fitBoard() {
    const w = board.clientWidth;
    if (w > 40) board.style.height = w + 'px';
  }
  window.addEventListener('resize', fitBoard);
  window.addEventListener('load', fitBoard);
  fitBoard();
  setTimeout(fitBoard, 300);

  loadLevel(getUnlocked());
  toast('交换相邻糖果，凑齐三连!', 2200);

  /* 自动化测试钩子（不影响正常玩法） */
  window.__candyTest = {
    state: () => ({ grid, ice, cfg, score, moves, level, collected }),
    fns: { attemptSwap, loadLevel, findRuns, analyzeRuns, findValidMove, reshuffleTypes, checkLevelState }
  };
})();
