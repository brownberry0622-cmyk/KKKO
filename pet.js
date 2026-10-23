/* ============ 牛牛桌宠 · 本地玩法引擎（无后端，纯浏览器运行） ============ */
(() => {
  'use strict';
  if (window.__NIUNIU__) return;
  window.__NIUNIU__ = true;

  /* ---------- 工具 ---------- */
  const $ = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  /* 不重复抽取：同类台词不连着说 */
  const lastPick = new Map();
  const pickNR = (key, arr) => {
    if (arr.length === 1) return arr[0];
    let i;
    do { i = Math.floor(Math.random() * arr.length); } while (arr[i] === lastPick.get(key));
    lastPick.set(key, arr[i]);
    return arr[i];
  };
  /* 记住用户的名字 */
  const NAME_KEY = 'niuniu-username';
  const userName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; } };
  const setName = n => { try { localStorage.setItem(NAME_KEY, n); } catch (_) {} };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : Number(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  /* ---------- 存档（牛币 / 装扮 / 成就 / 统计） ---------- */
  const STATS_KEY = 'niuniu-stats';
  const DEFAULT_STATS = { coins: 0, owned: [], worn: { hat: '', face: '', neck: '' }, counts: {}, achv: [], signDays: 0, lastSign: '' };
  let stats;
  try { stats = Object.assign({}, DEFAULT_STATS, JSON.parse(localStorage.getItem(STATS_KEY)) || {}); }
  catch (_) { stats = { ...DEFAULT_STATS }; }
  const saveStats = () => { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {} };

  /* ---------- 好感度与等级 ---------- */
  const AFFINITY_KEY = 'niuniu-affinity';
  const LEVELS = [[0, '初来乍到'], [20, '点头之交'], [60, '熟悉的伙伴'], [150, '好朋友'], [320, '挚友'], [600, '灵魂伙伴']];
  let affinity = store.get(AFFINITY_KEY, 0);
  const levelIndex = () => { let i = 0; LEVELS.forEach((l, j) => { if (affinity >= l[0]) i = j; }); return i; };
  const levelName = () => LEVELS[levelIndex()][1];

  /* ---------- 牛币 ---------- */
  const addCoins = n => { stats.coins = Math.max(0, stats.coins + n); saveStats(); renderHead(); };

  /* ---------- 成就 ---------- */
  const ACHV = [
    { id: 'meet',   name: '初次见面',   desc: '和牛牛说上第一句话', reward: 10, test: s => (s.counts.chat || 0) >= 1 },
    { id: 'pet10',  name: '摸头杀',     desc: '累计摸头 10 次',     reward: 15, test: s => (s.counts.pet || 0) >= 10 },
    { id: 'feed5',  name: '初级饲养员', desc: '累计喂食 5 次',      reward: 15, test: s => (s.counts.feed || 0) >= 5 },
    { id: 'chat15', name: '话痨牛友',   desc: '累计聊天 15 句',     reward: 20, test: s => (s.counts.chat || 0) >= 15 },
    { id: 'rps3',   name: '猜拳小能手', desc: '猜拳赢牛牛 3 次',    reward: 20, test: s => (s.counts.rpsWin || 0) >= 3 },
    { id: 'sign3',  name: '全勤打卡',   desc: '累计签到 3 天',      reward: 25, test: s => s.signDays >= 3 },
    { id: 'fashion',name: '时装精',     desc: '拥有 3 件装扮',      reward: 25, test: s => s.owned.length >= 3 },
    { id: 'max',    name: '牛牛挚友',   desc: '好感度达到 320',     reward: 50, test: () => affinity >= 320 }
  ];
  const checkAchv = () => {
    for (const a of ACHV) {
      if (stats.achv.includes(a.id)) continue;
      if (a.test(stats)) {
        stats.achv.push(a.id);
        stats.coins += a.reward;
        saveStats(); renderHead();
        setTimeout(() => { beHappy(); heart(); say(`🏆 解锁成就「${a.name}」！${a.desc}，奖励 ${a.reward} 牛币 🪙`); }, 250);
      }
    }
  };
  const bump = kind => { stats.counts[kind] = (stats.counts[kind] || 0) + 1; saveStats(); checkAchv(); };

  /* ---------- 每日签到 ---------- */
  const checkSign = () => {
    if (stats.lastSign === today()) return;
    stats.lastSign = today();
    stats.signDays++;
    stats.coins += 20;
    saveStats(); renderHead();
    setTimeout(() => { beHappy(); heart(); say(`📅 今日签到成功！累计 ${stats.signDays} 天，牛币 +20 🪙（现有 ${stats.coins}）`); }, 300);
  };

  /* ---------- 好感度变化（含签到与升级庆祝） ---------- */
  const addAffinity = n => {
    checkSign();
    const before = levelIndex();
    affinity += n;
    store.set(AFFINITY_KEY, affinity);
    const after = levelIndex();
    if (after > before) {
      stats.coins += 10; saveStats();
      beHappy(); heart();
      setTimeout(() => say(`🎉 好感升级！你和牛牛的关系变成了「${LEVELS[after][1]}」！牛币 +10 🪙`), 400);
    }
    renderHead();
  };

  /* ---------- 小奶牛 SVG（颜色由皮肤变量控制，装扮默认隐藏） ---------- */
  const COW_SVG = `
  <svg class="nn-svg" viewBox="0 0 140 132" aria-hidden="true">
    <!-- 尾巴 -->
    <g class="nn-tail">
      <path class="nn-tailfur" d="M104 84 q16 4 14 20 q-1 8 -9 10" fill="none" stroke-width="6" stroke-linecap="round"/>
      <circle class="nn-hoof" cx="108" cy="115" r="5"/>
    </g>
    <!-- 腿 -->
    <rect class="nn-fur nn-line" x="46" y="104" width="12" height="18" rx="6" stroke-width="2"/>
    <rect class="nn-fur nn-line" x="82" y="104" width="12" height="18" rx="6" stroke-width="2"/>
    <rect class="nn-hoof" x="48" y="115" width="8" height="7" rx="3.5"/>
    <rect class="nn-hoof" x="84" y="115" width="8" height="7" rx="3.5"/>
    <!-- 身体 -->
    <ellipse class="nn-fur nn-line" cx="70" cy="88" rx="37" ry="27" stroke-width="2.5"/>
    <path class="nn-spot" d="M46 78 q10 -8 20 0 q8 7 -1 14 q-12 8 -20 -1 q-4 -7 1 -13"/>
    <path class="nn-spot" d="M88 96 q8 -6 14 1 q4 6 -2 10 q-9 5 -14 -2 q-3 -5 2 -9"/>
    <!-- 项圈 + 铃铛 -->
    <rect class="nn-collar" x="52" y="66" width="36" height="8" rx="4"/>
    <g class="nn-bell">
      <circle cx="70" cy="79" r="7" fill="#f6c453" stroke="#d99a1e" stroke-width="1.5"/>
      <path d="M66 79 h8" stroke="#a8741a" stroke-width="1.5"/>
    </g>
    <!-- 耳朵 -->
    <g class="nn-ear-l"><ellipse class="nn-fur nn-line" cx="36" cy="32" rx="12" ry="8" stroke-width="2" transform="rotate(-24 36 32)"/><ellipse cx="37" cy="32" rx="6.5" ry="4" fill="#f3c1cd" transform="rotate(-24 37 32)"/></g>
    <g class="nn-ear-r"><ellipse class="nn-fur nn-line" cx="104" cy="32" rx="12" ry="8" stroke-width="2" transform="rotate(24 104 32)"/><ellipse cx="103" cy="32" rx="6.5" ry="4" fill="#f3c1cd" transform="rotate(24 103 32)"/></g>
    <!-- 头部整体（歪头/蹭手动画作用于此组） -->
    <g class="nn-head">
    <!-- 头 -->
    <circle class="nn-fur nn-line" cx="70" cy="42" r="30" stroke-width="2.5"/>
    <!-- 角 -->
    <path class="nn-horn" d="M52 18 q-8 -9 -3 -14 q7 -2 9 10" stroke-width="1.5"/>
    <path class="nn-horn" d="M88 18 q8 -9 3 -14 q-7 -2 -9 10" stroke-width="1.5"/>
    <!-- 头顶斑纹 -->
    <path class="nn-spot" d="M58 14 q10 -7 22 -1 q7 5 2 11 q-12 5 -24 0 q-6 -4 0 -10"/>
    <!-- 眼睛（普通） -->
    <g class="nn-eye"><circle cx="58" cy="42" r="4.6" fill="#2c2c2c"/><circle cx="59.6" cy="40.4" r="1.5" fill="#fff"/><circle cx="82" cy="42" r="4.6" fill="#2c2c2c"/><circle cx="83.6" cy="40.4" r="1.5" fill="#fff"/></g>
    <!-- 眼睛（开心 ^^） -->
    <g class="nn-eye-happy"><path d="M53 43 q5 -7 10 0" fill="none" stroke="#2c2c2c" stroke-width="3" stroke-linecap="round"/><path d="M77 43 q5 -7 10 0" fill="none" stroke="#2c2c2c" stroke-width="3" stroke-linecap="round"/></g>
    <!-- 眼睛（睡觉 ——） -->
    <g class="nn-eye-sleep"><path d="M53 42 q5 4 10 0" fill="none" stroke="#2c2c2c" stroke-width="3" stroke-linecap="round"/><path d="M77 42 q5 4 10 0" fill="none" stroke="#2c2c2c" stroke-width="3" stroke-linecap="round"/></g>
    <!-- 鼻镜 -->
    <ellipse cx="70" cy="57" rx="15" ry="10.5" fill="#f3b8c5"/>
    <ellipse cx="64" cy="57" rx="2.6" ry="3.4" fill="#d98aa0"/>
    <ellipse cx="76" cy="57" rx="2.6" ry="3.4" fill="#d98aa0"/>
    <!-- 嘴（吃东西时显示） -->
    <path class="nn-mouth" d="M65 64 q5 4 10 0" fill="none" stroke="#b5647c" stroke-width="2.4" stroke-linecap="round"/>
    <!-- 腮红 -->
    <ellipse cx="48" cy="52" rx="4" ry="2.6" fill="#f9cdd6" opacity=".8"/>
    <ellipse cx="92" cy="52" rx="4" ry="2.6" fill="#f9cdd6" opacity=".8"/>
    <!-- 装扮：小草帽 -->
    <g class="nn-wear nn-wear-straw" display="none">
      <ellipse cx="70" cy="17" rx="27" ry="7" fill="#f2d98f" stroke="#d8b96a" stroke-width="1.5"/>
      <path d="M53 17 q17 -17 34 0" fill="#f2d98f" stroke="#d8b96a" stroke-width="1.5"/>
      <path d="M56 14 q14 -9 28 0" fill="#c4678c"/>
    </g>
    <!-- 装扮：派对帽 -->
    <g class="nn-wear nn-wear-party" display="none">
      <polygon points="70,1 62,20 78,20" fill="#ff8f6b" stroke="#e57450" stroke-width="1.5"/>
      <circle cx="70" cy="2" r="3.5" fill="#f6c453"/>
      <path d="M65 13 h10 M66.5 8 h7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </g>
    <!-- 装扮：小皇冠 -->
    <g class="nn-wear nn-wear-crown" display="none">
      <polygon points="54,19 54,7 61,13 70,3 79,13 86,7 86,19" fill="#f6c453" stroke="#d99a1e" stroke-width="1.5"/>
      <circle cx="70" cy="11" r="2" fill="#e8646f"/>
      <circle cx="61" cy="14" r="1.5" fill="#7ce0d3"/>
      <circle cx="79" cy="14" r="1.5" fill="#7ce0d3"/>
    </g>
    <!-- 装扮：墨镜 -->
    <g class="nn-wear nn-wear-glasses" display="none">
      <rect x="49" y="36" width="17" height="11" rx="5" fill="#2c2c2c" opacity=".9"/>
      <rect x="74" y="36" width="17" height="11" rx="5" fill="#2c2c2c" opacity=".9"/>
      <path d="M66 40 q4 -3 8 0" fill="none" stroke="#2c2c2c" stroke-width="2.5"/>
      <path d="M53 39 l3 2 M78 39 l3 2" stroke="#ffffff" stroke-width="1.5" opacity=".7"/>
    </g>
    </g>
    <!-- 装扮：围巾 -->
    <g class="nn-wear nn-wear-scarf" display="none">
      <path d="M50 70 q20 8 40 0 l0 9 q-20 8 -40 0 z" fill="#e8646f" stroke="#d14b5c" stroke-width="1"/>
      <path d="M76 78 l7 13 l-8 3 l-5 -12" fill="#e8646f" stroke="#d14b5c" stroke-width="1"/>
    </g>
  </svg>`;

  /* ---------- 建 DOM ---------- */
  const root = $('div', 'nn-root');
  root.id = 'niuniu-pet';
  root.innerHTML = COW_SVG;

  const zzz = $('div', 'nn-zzz', '');
  zzz.append($('span', '', 'Z'), $('span', '', 'z'), $('span', '', 'z'));
  root.append(zzz);

  const tools = $('div', 'nn-tools');
  const chatBtn = $('button', 'nn-btn nn-pos-1', '💬'); chatBtn.title = '和牛牛聊天';
  const feedBtn = $('button', 'nn-btn nn-pos-2', '🍎'); feedBtn.title = '喂牛牛吃苹果';
  const skinBtn = $('button', 'nn-btn nn-pos-3', '🎨'); skinBtn.title = '给牛牛换皮肤';
  const shopBtn = $('button', 'nn-btn nn-pos-4', '🎁'); shopBtn.title = '牛牛装扮铺';
  tools.append(chatBtn, feedBtn, skinBtn, shopBtn);
  root.append(tools);

  const closeBtn = $('button', 'nn-btn nn-close nn-pos-x', '✕'); closeBtn.title = '让牛牛先歇会儿';
  root.append(closeBtn);

  const bubble = $('div', 'nn-bubble');
  root.append(bubble);

  /* 聊天面板 */
  const panel = $('div', 'nn-panel');
  const head = $('div', 'nn-panel-head');
  head.append($('span', 'nn-avatar', '🐄'));
  const title = $('div', 'nn-title');
  const titleB = $('b', '', '牛牛');
  const titleSmall = $('small', '', '');
  title.append(titleB, titleSmall);
  const panelX = $('button', 'nn-x', '✕'); panelX.title = '收起聊天';
  head.append(title, panelX);
  const msgs = $('div', 'nn-msgs');
  const inputRow = $('div', 'nn-inputrow');
  const input = document.createElement('input');
  input.type = 'text'; input.placeholder = '跟牛牛说点什么…（试试"猜拳"）'; input.maxLength = 120;
  const sendBtn = $('button', '', '发送');
  inputRow.append(input, sendBtn);
  panel.append(head, msgs, inputRow);
  root.append(panel);

  /* 装扮商店面板 */
  const shop = $('div', 'nn-panel');
  const shopHead = $('div', 'nn-panel-head');
  shopHead.append($('span', 'nn-avatar', '🎁'));
  const shopTitle = $('div', 'nn-title');
  shopTitle.append($('b', '', '牛牛装扮铺'), Object.assign($('small', '', ''), { id: 'nn-shop-coins' }));
  const shopX = $('button', 'nn-x', '✕'); shopX.title = '收起商店';
  shopHead.append(shopTitle, shopX);
  const items = $('div', 'nn-items');
  const shopNote = $('div', 'nn-shop-note', '给牛牛买点好看的吧！帽子、墨镜、围巾都能戴～');
  shop.append(shopHead, items, shopNote);
  root.append(shop);

  const restore = $('button', 'nn-restore', '🐄'); restore.title = '唤回牛牛';
  document.body.append(root, restore);

  const pet = root;
  const shopCoins = shopTitle.querySelector('#nn-shop-coins');
  const renderHead = () => {
    titleSmall.textContent = `好感 ${affinity} · ${levelName()} · 🪙${stats.coins}`;
    shopCoins.textContent = `牛币 🪙 ${stats.coins} · 已解锁装扮 ${stats.owned.length}/5`;
  };
  renderHead();

  /* ---------- 气泡（面板打开时改为进对应面板，避免重叠） ---------- */
  let bubbleTimer = null;
  let panelOpen = false, shopOpen = false;
  const say = (text, ms = 4600) => {
    if (!text) { bubble.classList.remove('show'); clearTimeout(bubbleTimer); return; }
    if (panelOpen) { pushMsg('cow', text); return; }
    if (shopOpen) { shopNote.textContent = text; return; }
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  };

  /* ---------- 粒子（爱心 / 音符） ---------- */
  const floatUp = (emoji, color) => {
    const h = $('span', 'nn-heart', emoji);
    h.style.left = (20 + Math.random() * 70) + 'px';
    h.style.bottom = (60 + Math.random() * 30) + 'px';
    h.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
    h.style.setProperty('--rot', (Math.random() * 50 - 25) + 'deg');
    if (color) h.style.color = color;
    root.append(h);
    setTimeout(() => h.remove(), 1300);
  };
  const heart = () => floatUp(pick(['💗', '💕', '💖', '❤️']));
  const note = () => floatUp(pick(['🎵', '🎶', '♪']), '#6f9fd8');

  /* ---------- 原地转圈（庆祝动作） ---------- */
  let spinTimer = null;
  const spin = () => {
    root.classList.remove('nn-spin'); void root.offsetWidth;
    root.classList.add('nn-spin');
    clearTimeout(spinTimer);
    spinTimer = setTimeout(() => root.classList.remove('nn-spin'), 1050);
  };

  /* ---------- 表情 ---------- */
  let happyTimer = null;
  const beHappy = () => {
    pet.classList.remove('nn-happy'); void pet.offsetWidth;
    pet.classList.add('nn-happy');
    clearTimeout(happyTimer);
    happyTimer = setTimeout(() => pet.classList.remove('nn-happy'), 1200);
  };

  /* ---------- 摸头（情境化反馈：基础池 + 连击 + 时段 + 稀有彩蛋 + 高好感专属） ---------- */
  const PET_LINES = [
    '哞～摸得好舒服！', '嘿嘿，牛牛最喜欢你啦～', '哞哞！再摸一下嘛～',
    '你的手好温暖呀～', '牛牛开心得要跳起来了！', '摸头杀！牛牛心动了💗',
    '哞～牛牛的角也要被摸亮啦！', '被摸头的时候，牛牛的世界都亮了～',
    '再来一次？牛牛假装没被摸够！', '哞～好感度又偷偷涨了哦！',
    '你的手是魔法吗？牛牛要融化了～', '摸牛头，好运到！今天一定顺利～',
    '牛牛的毛都被摸顺啦，谢谢你～', '耳朵抖了一下……好痒又好舒服！',
    '哞～这一摸，直接摸进牛牛心里了！', '感觉今天跑得都比平时快了！',
    '尾巴摇得停不下来了，都怪你～', '牛牛决定：今天你是本牛最重要的人！',
    '摸完头精神百倍，哞！', '你的手艺可以去开摸头店了，牛牛当招牌～',
    '铃铛都被摸得叮叮响啦🔔', '牛牛把这份温柔存进牛胃里了，永久保鲜！'
  ];
  /* 连击台词：6 秒内连续摸头触发 */
  const PET_COMBO = {
    3: ['三连摸！牛牛要被摸成球了！', '连着摸～牛牛觉得你就是全世界！', '哞哞哞！三连击，好感暴击！'],
    5: ['五连摸！！牛牛幸福到冒泡泡了～', '你是不是偷偷练过摸头？太专业了！', '哞——五连暴击！牛牛原地转圈圈！'],
    8: ['八连摸？！牛牛已经幸福得说不出话……哞。', '摸这么多，牛牛的角都要包浆了！', '停下停下，再摸牛牛要飞起来了！哞～']
  };
  /* 时段专属 */
  const PET_TIME = () => {
    const h = new Date().getHours();
    if (h >= 0 && h < 5) return ['夜深了还来摸牛牛……早点休息哦，牛牛守着你～', '凌晨的摸头格外温柔，晚安预备～'];
    if (h < 9) return ['早上的第一摸，一整天都会顺利哦！', '哞早！牛牛用摸头开启你的元气早晨～'];
    if (h < 12) return ['上午摸牛牛，工作学习效率翻倍！', '哞～上午的牛牛最精神，摸了不亏！'];
    if (h < 14) return ['午后来一摸，胜睡午觉半小时～', '吃饱了摸摸头，牛牛和你一起犯困～'];
    if (h < 18) return ['下午的摸头是续航充电宝！哞～', '坚持住！摸摸牛牛补充能量！'];
    if (h < 23) return ['晚上摸牛牛，梦里有草场和苹果～', '一天辛苦啦，牛牛的头上给你留了个位置～'];
    return ['夜深了还来摸牛牛……早点休息哦，牛牛守着你～', '凌晨的摸头格外温柔，晚安预备～'];
  };
  /* 稀有彩蛋（约 6% 概率，冒三颗爱心） */
  const PET_RARE = [
    '✨稀有事件！牛牛被摸出了彩虹色的心情！',
    '哞？！这一摸唤醒了牛牛体内的草原之魂！！',
    '叮咚！恭喜触发隐藏台词！你就是欧皇摸手！',
    '牛牛体内的小牛犊被摸醒了……哞嘤嘤！'
  ];
  /* 高好感专属（「好朋友」以上） */
  const PET_CLOSE = [
    '只有你能把牛牛摸得这么乖～', '牛牛闭着眼睛都知道是你来摸的！',
    '我们是好朋友嘛，头随便摸！哞～', '这个手感……牛牛已经刻进 DNA 里了！',
    '别的牛都在吃草，牛牛在等你摸头～'
  ];
  let petCombo = 0, petComboTimer = null;
  const petMe = () => {
    beHappy(); heart(); addAffinity(2); bump('pet');
    if (Math.random() < 0.35) note();          /* 开心到哼歌 */
    /* 连击计数：6 秒内连续摸头 */
    petCombo++;
    clearTimeout(petComboTimer);
    petComboTimer = setTimeout(() => { petCombo = 0; }, 6000);
    let line;
    const comboKey = PET_COMBO[petCombo] ? petCombo : (petCombo > 8 ? 8 : 0);
    if (comboKey === 5) spin();                /* 五连击庆祝：原地转一圈 */
    if (comboKey) {
      line = pickNR('petCombo' + comboKey, PET_COMBO[comboKey]);
      if (comboKey >= 8) { addAffinity(4); heart(); line += '（好感额外 +4！）'; }
    } else if (Math.random() < 0.06) {
      line = pickNR('petRare', PET_RARE); heart(); heart();
    } else if (affinity >= 150 && Math.random() < 0.3) {
      const n = userName();
      line = (n && Math.random() < 0.5 ? `${n}，` : '') + pickNR('petClose', PET_CLOSE);
    } else if (Math.random() < 0.18) {
      line = pickNR('petTime', PET_TIME());
    } else {
      line = pickNR('pet', PET_LINES);
    }
    say(line);
  };

  /* ---------- 喂食 ---------- */
  let feeding = false;
  const FEED_LINES = [
    '哞～苹果脆脆甜甜的，好吃！', '咔嚓咔嚓……谢谢款待！🍎', '牛牛吃得好饱，幸福感满满！',
    '这颗苹果是今天最好吃的！', '哞哞～吃 apples，做 happy 牛！', '啊呜——一口一个！🍎',
    '苹果味的爱，牛牛收到啦！', '再来一颗？开玩笑的，牛牛很节制……再来一颗吧！',
    '吃饱了的牛牛最有干劲！哞～', '这份心意牛牛记在好感度里了💗'
  ];
  const feed = () => {
    if (feeding) { say('唔……牛牛嘴里还有呢，等一下下！'); return; }
    feeding = true;
    const fruit = $('span', 'nn-heart', '🍎');
    fruit.style.left = '42px'; fruit.style.bottom = '46px';
    root.append(fruit);
    setTimeout(() => {
      fruit.remove();
      pet.classList.remove('nn-munch'); void pet.offsetWidth;
      pet.classList.add('nn-munch');
    }, 500);
    setTimeout(() => { pet.classList.remove('nn-munch'); feeding = false; }, 2100);
    beHappy(); heart(); addAffinity(3); bump('feed');
    say(pickNR('feed', FEED_LINES));
  };

  /* ---------- 本地聊天引擎 ---------- */
  const games = () => (Array.isArray(window.ARCADE_GAMES) ? window.ARCADE_GAMES : []).filter(g => g.ready && g.url);
  const gameIntro = () => {
    const list = games();
    if (!list.length) return '现在的游戏还在准备中哦，牛牛陪你等一等～';
    const g = pick(list);
    return `牛牛推荐你玩《${g.title}》！${g.category || ''}，就在下面的游戏卡片里，点开就能玩啦～`;
  };
  const timeNow = () => {
    const d = new Date(), h = d.getHours();
    const seg = h < 5 ? '深夜' : h < 9 ? '早上' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 23 ? '晚上' : '深夜';
    return `现在是${seg} ${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 哦。${h < 5 ? '这么晚还不睡，牛牛会担心的！' : h >= 22 ? '早点休息，牛牛给你说晚安～' : '劳逸结合，牛牛陪着你！'}`;
  };
  /* 猜拳小游戏 */
  const rpsReply = text => {
    const mine = /石头/.test(text) ? '石头' : /剪刀/.test(text) ? '剪刀' : /布/.test(text) ? '布' : null;
    if (!mine) return '跟牛牛猜拳吧！输入「石头」「剪刀」或「布」✊ 赢了有牛币拿哦～';
    const cow = pick(['石头', '剪刀', '布']);
    const emoji = { '石头': '✊', '剪刀': '✌️', '布': '✋' };
    let result, coin, aff;
    if (mine === cow) { result = '平局！'; coin = 2; aff = 1; }
    else if ((mine === '石头' && cow === '剪刀') || (mine === '剪刀' && cow === '布') || (mine === '布' && cow === '石头')) {
      result = '你赢啦！🎉'; coin = 5; aff = 3; bump('rpsWin');
    } else { result = '牛牛赢咯～'; coin = 1; aff = 2; }
    addCoins(coin); addAffinity(aff);
    return `牛牛出了${emoji[cow]}，你出了${emoji[mine]}——${result}牛币 +${coin} 🪙`;
  };
  const greet = () => {
    const n = userName();
    return pickNR('greet', [
      n ? `哞～${n}你好呀！今天也要开心哦！` : '哞～你好呀！我是牛牛🐄',
      n ? `${n}来啦！牛牛等你好久了～` : '哈喽！牛牛在这里等你很久啦～',
      n ? `欢迎回来，${n}！摸摸牛头，好运加倍～` : '你好你好！今天想玩点什么？',
      '哞哞～见到你真高兴！',
      n ? `嗨，${n}！要不要来局猜拳？` : '嗨嗨～要跟牛牛猜拳吗？',
      '你好你好，多多指教！牛牛向你鞠躬～哞！'
    ]);
  };
  const jokes = () => pickNR('joke', [
    '一头牛去上课，老师问它为什么迟到，它说：我走得太"牛"了，一路上被围观！哞～',
    '为什么牛不会玩捉迷藏？因为它总是"哞哞"地暴露自己！',
    '牛牛的座右铭：不"牛"不人生，哞～',
    '小牛问妈妈："为什么我们每天都要哞哞叫？"妈妈说："傻孩子，那是我们的母语！"',
    '草对牛说："你吃了我这么多，总得给我点什么吧。"牛想了想说："哞～给你个谢谢。"',
    '牛牛去理发店，理发师问剪什么发型，牛牛说："刘海留长一点，我要当刘海牛！"',
    '两只牛聊天，一只说："听说人类管厉害的人叫牛人。"另一只说："那人类得叫我们祖宗！"',
    '牛牛减肥失败的理由：草太好吃，这是草的问题，不是牛的问题！哞～'
  ]);
  const comforts = () => pickNR('comfort', [
    '辛苦啦……来摸摸牛牛的头，会变轻松一点的～',
    '深呼吸，哞～牛牛陪着你，玩个小游戏换换心情吧！',
    '抱抱你！不开心的时候，牛牛的耳朵借你揪着玩～',
    '哞……牛牛不懂大道理，但牛牛会一直在这里陪你！',
    '你已经很努力了！剩下的交给时间。想听个好笑的吗？说「笑话」就行～',
    '开心是一天，不开心也是一天，不如让牛牛陪你玩会儿猜拳？',
    '牛牛把今天的运气分你一半！哞～一定会好起来的！',
    '委屈就说出来，牛牛的耳朵可大了，专门用来听你说话～'
  ]);
  const RULES = [
    [/猜拳|石头|剪刀|布/, rpsReply],
    [/^(你好|您好|哈喽|嗨|hi|hello|早上好|下午好|晚上好)/i, greet],
    [/游戏|玩什么|推荐|无聊|好闲/, () => gameIntro()],
    [/笑|段子|搞笑/, jokes],
    [/你是谁|你叫什么|你的名字/, () => { const n = userName(); return n ? `我是牛牛呀，${n}的老朋友！负责陪聊、被摸头、吃苹果，还会猜拳和换装🐄` : '我叫牛牛，是这个小游戏花园的桌宠！负责陪聊、被摸头、吃苹果，还会猜拳和换装🍎'; }],
    [/牛|哞/, () => pickNR('niu', ['哞哞哞～你说到牛牛心里去了！', '没错，本牛牛在此！哞～', '哞～同类相认啦！', '牛牛听到"牛"字就精神了！', '对对对，说的就是本牛！哞！'])],
    [/几点|时间|现在/, () => timeNow()],
    [/吃|饿|苹果|草|饭/, () => pickNR('eat', ['说到吃，牛牛的眼睛就亮了！点旁边的 🍎 请我吃一个嘛～', '牛牛不挑食，苹果、青草都爱吃！哞～', '饿了吗？人类要按时吃饭哦，牛牛可以啃卡片下的游戏解馋～', '牛牛的食谱：青草 70%、苹果 25%、快乐 5%！', '别饿着肚子玩游戏哦，牛牛会心疼的～'])],
    [/商店|买|装扮|帽子|换装|衣服/, () => '点旁边的 🎁 打开牛牛装扮铺！牛币可以买草帽、皇冠、墨镜、围巾～'],
    [/牛币|金币|钱|余额/, () => `你现在有 ${stats.coins} 牛币 🪙。每天签到 +20、猜拳赢了 +5、解锁成就也有奖励！去 🎁 消费吧～`],
    [/签到|打卡/, () => stats.lastSign === today() ? `今天已经签过到啦～累计签到 ${stats.signDays} 天，明天再来！` : '今天还没签到哦！随便摸摸牛牛或聊句天，就自动签到啦📅'],
    [/成就|徽章/, () => stats.achv.length
      ? `已解锁 ${stats.achv.length}/${ACHV.length} 个成就：${stats.achv.map(id => (ACHV.find(a => a.id === id) || {}).name).filter(Boolean).join('、')}。继续加油！`
      : '还没有成就哦～摸摸头、喂喂苹果、聊聊天就会有的！'],
    [/天气|下雨|晴天|阴天/, () => pickNR('weather', ['牛牛住在网页里看不到外面的天空……不过你那里一定是晴天！☀️', '不管刮风下雨，牛牛都稳稳地待在角落陪你～', '下雨天和小游戏更配哦！哞～'])],
    [/爱|喜欢|抱|亲/, () => pickNR('love', ['哞～牛牛也超喜欢你的！💗', '抱抱！牛牛的毛蹭蹭你～', '好感度飙升中……哞哞！', '这句话牛牛要截图裱起来！', '牛牛的脸红得像苹果啦～'])],
    [/再见|拜拜|晚安|bye/i, () => pickNR('bye', ['拜拜～记得回来看牛牛哦！', '晚安！牛牛会在这里守着小游戏的～', '哞……好吧，牛牛等你下次再来！', '下次见面也要摸摸牛头哦，说好了！'])],
    [/难|伤心|不开心|emo|累|烦|压力/i, comforts],
    [/大栋/, () => '大栋是这里的主人呀！牛牛最喜欢大栋了，哞～'],
    [/几岁|年龄|多大/, () => pickNR('age', ['牛牛永远 1 岁！网页里的一天等于牛牛的一年，所以牛牛每天都在长大～', '按牛龄算……不许算！牛牛还是小牛犊！哞～'])],
    [/音乐|歌|唱/, () => pickNR('music', ['牛牛只会哼哞哞哞～要听吗？哞～哞哞～🎵', '牛牛最爱的歌是《哞力全开》！全场牛一起摇尾巴那种！', '给你唱一首：哞～哞哞～哞！（完毕，鼓掌👏）'])],
    [/电影|电视|动画/, () => pickNR('movie', ['牛牛最爱《牧场之夜》，里面的牛牛都会跳踢踏舞！', '牛牛看的都是纪录片：《草的前世今生》看了 800 遍～'])],
    [/工作|上班|上学|学习|作业|考试|加班/, () => pickNR('work', ['工作/学习再忙，也要记得喝水休息哦！牛牛给你充电🔋', '学累了吧？摸摸牛头充个电，再战一轮！', '牛牛不懂作业，但牛牛会陪着每一个奋斗的人类～', '加油加油！做完就奖励自己玩个小游戏！'])],
    [/运动|健身|跑步/, () => pickNR('sport', ['哞！牛牛每天的运动是在屏幕里蹦跶～', '一起动起来！牛牛给你喊加油：哞哞！冲呀！'])],
    [/编程|代码|程序|电脑|前端/, () => pickNR('code', ['牛牛是由代码组成的！你跟牛牛说话时，其实是在跟一行行代码聊天，酷吧？', '牛牛的毛是 CSS 画的，斑纹是 SVG 画的——所以摸牛头等于摸代码哦！'])],
    [/颜色|好看/, () => pickNR('color', ['牛牛最喜欢黄色啦，像太阳和黄油一样温暖～', '你眼睛里的颜色最好看！（牛牛真诚脸）哞～'])],
    [/冷知识|科普|知道吗/, () => pickNR('fact', ['你知道吗？牛其实没有上排门牙哦！', '牛的胃有四个房间，所以牛牛吃一顿能消化好久～', '牛睡觉的时候也会做梦，梦到好多好多青草地！', '牛能听出同伴的声音，哞～所以牛牛也认得你的语气哦！'])],
    [/你好吗|怎么样|心情/, () => pickNR('mood', ['牛牛今天心情超好！因为见到你啦～你呢？', '牛牛状态满分！尾巴摇得都快起飞了～', '牛牛很好！就是有点想吃苹果（暗示 🍎）'])],
    [/困|想睡|打瞌睡/, () => pickNR('sleepy', ['困了就早点休息～牛牛也会打盹等你（90 秒不理牛牛，牛牛就睡着啦）', '牛牛的呼噜声是：哞噜哞噜～你也早点睡哦！'])],
    [/奶茶|好吃|美食|零食/, () => pickNR('food', ['哞～牛牛不能喝奶茶，但是可以吃苹果！点 🍎 喂我～', '美食牛牛只在电视上见过……人类的世界太好吃了吧！'])],
    [/厉害|棒|聪明|可爱|好可爱/, () => pickNR('praise', ['嘿嘿，被夸奖了！牛牛尾巴都摇起来了～', '哪里哪里，牛牛只是可爱得比较明显～', '你才厉害！会找到牛牛这个宝藏桌宠的人最厉害！'])],
    [/笨|傻|呆/, () => pickNR('silly', ['哼！牛牛才不笨，牛牛只是可爱得比较明显！哞～', '牛牛假装没听见～哞哞！（耳朵其实红了）'])],
    [/会什么|功能|帮助|怎么玩|帮助我/, () => '牛牛会超多：① 聊天（问游戏/时间/笑话）② 猜拳（说"石头剪刀布"）③ 被摸头 ④ 吃苹果🍎 ⑤ 🎨 换皮肤 ⑥ 🎁 买装扮戴 ⑦ 每天签到赚牛币 ⑧ 解锁成就！'],
    [/谢谢|感谢|thanks/i, () => pickNR('thx', ['不客气！哞～', '能帮到你，牛牛今天很满足！', '哞哞～举手之劳啦！', '嘿嘿，被感谢的感觉真好，常来！'])],
    [/加油|努力/, () => '加油！学累了就来摸摸牛牛，休息一下再出发！哞～'],
  ];
  const FALLBACKS = [
    '哞……这个问题牛牛还在学习中，你换个问法试试？',
    '牛牛歪着头想了半天……没想明白🤔 不过牛牛会一直陪着你的！',
    '哞～牛牛的脑容量只有一个草团子那么大，问我游戏、猜拳、签到最在行啦！',
    '这个牛牛不太懂，但我可以陪你猜个拳？说「石头」「剪刀」或「布」就行～',
    '唔……牛牛没听懂，但牛牛假装听懂了！哞（悄悄说：试试问我「推荐游戏」）',
    '牛牛的耳朵动了一下……还是没抓到重点，换个说法试试？',
    '呜，这题超纲了！牛牛只会聊天、猜拳、推荐游戏和被摸头……',
    '哞？要不你先摸摸牛头冷静一下，然后再问一次？',
    '牛牛认真思考了 0.5 秒……还是不会！但牛牛会一直陪着你的～',
    '听不懂就卖萌：哞哞哞～💕 问我「能做什么」看看牛牛的全部技能吧！'
  ];
  const reply = text => {
    const nm = text.match(/我叫(.{1,10})/);
    if (nm) {
      const n = nm[1].replace(/[。，！？!,.~～\s].*$/, '').replace(/(牛牛|大栋|哦|呀|吧)/g, '').trim();
      if (n) {
        setName(n);
        beHappy(); heart(); addAffinity(2);
        return pickNR('named', [
          `记住啦！从今天起你就是「${n}」！哞～`,
          `「${n}」……这名字牛牛很喜欢！以后就这么叫你啦～`,
          `好的${n}！牛牛拿小本本记下来了📓`,
          `哇，认识你真高兴，${n}！牛牛再也不会忘记你啦～`
        ]);
      }
    }
    for (const [re, fn] of RULES) if (re.test(text)) return fn(text);
    return pickNR('fb', FALLBACKS);
  };

  /* ---------- 聊天面板 ---------- */
  const pushMsg = (who, text) => {
    const m = $('div', 'nn-msg ' + who, text);
    msgs.append(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  };
  const togglePanel = open => {
    panelOpen = open === undefined ? !panelOpen : open;
    panel.classList.toggle('open', panelOpen);
    if (panelOpen) {
      shopOpen = false; shop.classList.remove('open');
      bubble.classList.remove('show'); clearTimeout(bubbleTimer);
      renderHead();
      if (!msgs.children.length) pushMsg('cow', '哞～我是牛牛！可以问我「推荐游戏」，或者来局「猜拳」赢牛币🪙');
      input.focus();
    }
    resetIdle();
  };
  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    pushMsg('me', text);
    addAffinity(1); bump('chat'); beHappy();
    setTimeout(() => pushMsg('cow', reply(text)), 420 + Math.random() * 500);
    resetIdle();
  };
  chatBtn.addEventListener('click', () => togglePanel());
  panelX.addEventListener('click', () => togglePanel(false));
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  feedBtn.addEventListener('click', feed);

  /* ---------- 装扮商店 ---------- */
  const WARES = [
    { id: 'straw',   emoji: '👒', name: '小草帽', desc: '田园风必备',   price: 50, slot: 'hat' },
    { id: 'party',   emoji: '🥳', name: '派对帽', desc: '嗨起来！',     price: 40, slot: 'hat' },
    { id: 'crown',   emoji: '👑', name: '小皇冠', desc: '牛牛之王',     price: 80, slot: 'hat' },
    { id: 'glasses', emoji: '😎', name: '墨镜',   desc: '酷盖本盖',     price: 60, slot: 'face' },
    { id: 'scarf',   emoji: '🧣', name: '围巾',   desc: '冬天不怕冷',   price: 35, slot: 'neck' }
  ];
  const applyWear = () => {
    root.querySelectorAll('.nn-wear').forEach(el => { el.style.display = 'none'; });
    const w = stats.worn || {};
    const show = cls => { const el = root.querySelector('.nn-wear-' + cls); if (el) el.style.display = 'block'; };
    if (w.hat) show(w.hat);
    if (w.face) show(w.face);
    if (w.neck) show(w.neck);
  };
  const renderShop = () => {
    renderHead();
    items.textContent = '';
    for (const w of WARES) {
      const row = $('div', 'nn-item');
      const owned = stats.owned.includes(w.id);
      const worn = (stats.worn || {})[w.slot] === w.id;
      row.append($('span', 'nn-item-emoji', w.emoji));
      const name = $('div', 'nn-item-name', w.name);
      name.append($('small', '', owned ? w.desc : `${w.desc} · 🪙${w.price}`));
      row.append(name);
      const btn = $('button', worn ? 'worn' : owned ? 'owned' : '', worn ? '脱下' : owned ? '佩戴' : `🪙${w.price} 购买`);
      if (!owned && stats.coins < w.price) btn.classList.add('poor');
      btn.addEventListener('click', () => {
        if (!owned) {
          if (stats.coins < w.price) { shopNote.textContent = `牛币不够啦～还差 ${w.price - stats.coins} 🪙。明天签到、猜拳都能赚！`; return; }
          stats.coins -= w.price;
          stats.owned.push(w.id);
          stats.worn[w.slot] = w.id;
          saveStats(); applyWear(); renderShop(); renderHead();
          beHappy(); heart();
          shopNote.textContent = `买到「${w.name}」并给牛牛戴上啦！牛牛好开心～`;
        } else if (worn) {
          stats.worn[w.slot] = '';
          saveStats(); applyWear(); renderShop();
          shopNote.textContent = `把「${w.name}」收起来了。`;
        } else {
          stats.worn[w.slot] = w.id;
          saveStats(); applyWear(); renderShop();
          beHappy();
          shopNote.textContent = `牛牛戴上了「${w.name}」！好看吗？`;
        }
      });
      row.append(btn);
      items.append(row);
    }
  };
  const toggleShop = open => {
    shopOpen = open === undefined ? !shopOpen : open;
    shop.classList.toggle('open', shopOpen);
    if (shopOpen) {
      panelOpen = false; panel.classList.remove('open');
      bubble.classList.remove('show'); clearTimeout(bubbleTimer);
      renderShop();
    }
    resetIdle();
  };
  shopBtn.addEventListener('click', () => toggleShop());
  shopX.addEventListener('click', () => toggleShop(false));
  applyWear();

  /* ---------- 换肤 ---------- */
  const SKINS = [
    { id: 'lemon',   name: '奶油小黄牛' },
    { id: 'cow',     name: '经典黑白奶牛' },
    { id: 'coffee',  name: '焦糖咖啡牛' },
    { id: 'sakura',  name: '樱花粉牛' },
    { id: 'mint',    name: '薄荷清新牛' },
    { id: 'night',   name: '夜空蓝牛' }
  ];
  const SKIN_KEY = 'niuniu-skin';
  const getSkin = () => { try { return localStorage.getItem(SKIN_KEY) || ''; } catch (_) { return ''; } };
  const setSkin = id => { try { localStorage.setItem(SKIN_KEY, id); } catch (_) {} };
  const applySkin = i => {
    skinIndex = (i + SKINS.length) % SKINS.length;
    const skin = SKINS[skinIndex];
    root.dataset.skin = skin.id;
    setSkin(skin.id);
    return skin;
  };
  let skinIndex = Math.max(0, SKINS.findIndex(s => s.id === getSkin()));
  applySkin(skinIndex);
  const SKIN_LINES = ['这件新衣服好看吗？', '换好啦！牛牛转个圈～', '哞～牛牛也要美美的！', '新皮肤 get！✨', '这件颜色牛牛很喜欢！', '衣柜又多了一件！哞～', '快看快看，这条纹多帅！', '牛牛的时尚品味从不让人失望～'];
  skinBtn.addEventListener('click', () => {
    const skin = applySkin(skinIndex + 1);
    beHappy(); heart(); addAffinity(1); bump('skin');
    say(`换上「${skin.name}」啦！${pickNR('skin', SKIN_LINES)}`);
    resetIdle();
  });

  /* ---------- 隐藏 / 唤回 ---------- */
  closeBtn.addEventListener('click', () => {
    root.style.display = 'none';
    restore.classList.add('show');
    say('');
  });
  restore.addEventListener('click', () => {
    root.style.display = '';
    restore.classList.remove('show');
    beHappy(); say('哞～牛牛回来啦！');
  });

  /* ---------- 打瞌睡（90 秒无互动自动入睡，点一下唤醒） ---------- */
  let sleepTimer = null, sleeping = false;
  const resetIdle = () => {
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
      if (panelOpen || shopOpen || sleeping || root.style.display === 'none') return;
      sleeping = true;
      root.classList.add('nn-sleep');
      if (!panelOpen && !shopOpen) { bubble.textContent = 'Zzz…💤'; bubble.classList.add('show'); }
    }, 90000);
  };
  const wake = () => {
    if (sleeping) {
      sleeping = false;
      root.classList.remove('nn-sleep');
      say(pickNR('wake', ['唔…牛牛醒啦！', '哞？刚才梦到好多苹果…', '被你叫醒啦～精神百倍！', '哞！牛牛怎么睡着了……刚才梦到草原啦！']));
    }
    resetIdle();
  };

  /* ---------- 贴边检测：贴近左边缘时按钮/气泡/面板翻到右侧，避免被挤出屏幕 ---------- */
  const updateSide = () => {
    const rect = root.getBoundingClientRect();
    root.classList.toggle('nn-edge-left', rect.left < 100);
  };

  /* ---------- 拖拽（位移小于阈值则视为摸头） ---------- */
  let drag = null;
  root.addEventListener('pointerdown', e => {
    wake();
    if (e.target.closest('.nn-btn') || e.target.closest('.nn-panel')) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, startRight: window.innerWidth - root.getBoundingClientRect().right, startBottom: window.innerHeight - root.getBoundingClientRect().bottom };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; root.classList.add('nn-dragging'); }
    if (drag.moved) {
      const right = Math.max(4, Math.min(window.innerWidth - 130, drag.startRight - dx));
      const bottom = Math.max(4, Math.min(window.innerHeight - 130, drag.startBottom - dy));
      root.style.right = right + 'px';
      root.style.bottom = bottom + 'px';
      updateSide();
    }
  });
  root.addEventListener('pointerup', e => {
    if (!drag) return;
    root.classList.remove('nn-dragging');
    if (!drag.moved) petMe();
    drag = null;
    updateSide();
  });
  root.addEventListener('pointercancel', () => { root.classList.remove('nn-dragging'); drag = null; });

  /* ---------- 日常闲聊 ---------- */
  const IDLE_LINES = [
    '哞～要不要休息一下，喝口水？', '牛牛悄悄说：下面的小游戏都很好玩哦！',
    '站久了尾巴酸……哞。', '牛牛问你：今天过得开心吗？',
    '听说摸摸牛头，好运加倍！', '牛牛在帮你守着游戏花园呢～',
    '哞……牛牛想吃苹果了（暗示 🍎）', '跟牛牛猜拳吗？说「石头」就行！赢牛币哦～',
    '🎁 装扮铺新到了小皇冠，攒够牛币就来吧！', '牛牛刚学会一个新笑话，说「笑话」听听？',
    '你知道吗？牛的胃有四个房间！哞～', '今天也辛苦啦，牛牛给你比个心 💗',
    '牛牛数了数，你已经玩了一小会儿了，记得眨眨眼休息～', '牧场今日天气：晴，微风，适合玩游戏！',
    '牛牛偷偷告诉你：多签到，牛币多多哦～', '要是无聊的话，跟牛牛聊聊天也行呀～'
  ];
  setInterval(() => {
    if (document.hidden || panelOpen || shopOpen || sleeping || root.style.display === 'none') return;
    if (Math.random() < 0.55) say(pickNR('idle', IDLE_LINES));
  }, 38000);

  /* ---------- 开场 ---------- */
  updateSide();
  resetIdle();
  window.addEventListener('resize', updateSide);
  setTimeout(() => {
    const h = new Date().getHours();
    const greet = h < 5 ? '夜深啦' : h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : h < 23 ? '晚上好' : '夜深啦';
    say(`${greet}！我是牛牛🐄 摸摸我，或按 💬 聊天、🎁 逛装扮铺～`);
  }, 900);
})();
