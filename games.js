/* 新增小游戏：在数组中添加一项，并把入口放到 games/你的游戏/index.html。
   ready: true 表示已上线；false 表示预告，不会打开。
   url 使用相对于大厅 index.html 的路径，无需修改大厅渲染逻辑。
   minimal: true 表示极简卡片（封面 + 标题，不显示简介与底部栏）。 */
window.ARCADE_GAMES = [
  {
    id: 'jump',
    title: '跳一跳',
    subtitle: '一步之间',
    description: '按住蓄力，松开起跳。在漂浮的小岛之间，找到刚刚好的节奏。',
    category: '休闲 · 节奏',
    badge: '即刻开玩',
    url: 'games/jump/index.html',
    ready: true,
    cover: 'jump',
    bestKey: 'little-hops-best'
  },
  {
    id: 'gu-cheng-feng-huo',
    title: '孤城烽火',
    subtitle: '南霁云 · 全六章 · v7',
    description: '进入南霁云的孤城战场，体验六章战役、唐装陌刀、章节选择与终章决战。',
    category: '剧情 · 战斗',
    badge: '即刻开玩',
    url: 'games/gu-cheng-feng-huo/index.html',
    ready: true,
    cover: 'war',
    bestKey: ''
  },
  {
    id: 'sweet-match',
    title: '糖果派对',
    subtitle: '三消一刻',
    description: '交换相邻糖果，凑齐三连消除。连锁越多，派对越甜。',
    category: '益智 · 消除',
    badge: '即刻开玩',
    url: 'games/sweet-match/index.html',
    ready: true,
    cover: 'candy',
    bestKey: 'sweet-match-best'
  },
  {
    id: 'hongwu',
    title: '洪武',
    subtitle: '兵起濠州 · 1352—1368',
    description: '从一封投军信到立国大明。八章历史叙事战役：地图筹划、阵前下令、自走棋对决，听见每个人的选择。',
    category: '剧情 · 策略',
    badge: '即刻开玩',
    url: 'games/hongwu/index.html',
    ready: true,
    cover: 'hongwu',
    bestKey: ''
  },
  {
    id: 'iso-warehouse',
    title: '智慧仓库',
    subtitle: '无人值守 · 实时领料',
    description: '走进无人值守备件仓：刷脸进仓、LED 引导取料，通过计重、扫码与视觉校验后实时上报 WMS。',
    category: '模拟 · 管理',
    badge: '即刻开玩',
    url: 'games/iso-warehouse/index.html',
    ready: true,
    cover: 'iso',
    bestKey: ''
  }
];
