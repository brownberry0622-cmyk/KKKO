(() => {
  'use strict';
  const grid = document.getElementById('games');
  const list = Array.isArray(window.ARCADE_GAMES) ? window.ARCADE_GAMES : [];
  document.getElementById('count').textContent = list.length;
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function jumpArt() {
    const art = create('div', 'jump-art');
    art.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) {
      const island = create('div', 'mini-island island-' + i);
      island.append(create('span', 'top'), create('span', 'left'), create('span', 'right'));
      if (i === 0) island.append(create('i', 'jumper'));
      else island.append(create('i', 'landing'));
      art.append(island);
    }
    return art;
  }
  function warArt() {
    const art = create('div', 'war-art');
    art.setAttribute('aria-hidden', 'true');
    art.append(create('span', 'war-moon'), create('span', 'war-wall'), create('span', 'war-flag'), create('span', 'war-flame'));
    return art;
  }
  for (const game of list) {
    const playable = game.ready === true && typeof game.url === 'string' && game.url.length > 0;
    const card = create(playable ? 'a' : 'article', 'game-card');
    if (playable) card.href = game.url;
    card.setAttribute('aria-label', game.title + (playable ? '，进入游戏' : '，敬请期待'));
    const cover = create('div', 'cover');
    const top = create('div', 'cover-top');
    top.append(create('span', 'badge', playable ? (game.badge || '即刻开玩') : '敬请期待'), create('span', 'cover-number', String(list.indexOf(game) + 1).padStart(2, '0')));
    cover.append(top);
    if (game.cover === 'jump') cover.append(jumpArt());
    else if (game.cover === 'war') cover.append(warArt());
    else if (game.cover === 'candy') cover.classList.add('cover-candy');
    else if (game.cover === 'hongwu') cover.classList.add('cover-hongwu');
    else if (game.cover === 'iso') cover.classList.add('cover-iso');
    else cover.append(create('div', 'generic-art', '✦'));
    cover.append(create('span', 'cover-caption', game.subtitle || game.title));
    const info = create('div', 'game-info');
    const title = create('div', 'game-title');
    title.append(create('h2', '', game.title), create('span', 'category', game.category || '小游戏'));
    info.append(title);
    if (!game.minimal) {
      info.append(create('p', 'description', game.description || ''));
      const bottom = create('div', 'game-bottom');
      let record = '准备好，开始新挑战';
      if (game.bestKey) {
        try { const best = Number(localStorage.getItem(game.bestKey)) || 0; if (best > 0) record = '个人最佳 ' + best + ' 分'; } catch (_) {}
      }
      bottom.append(create('span', 'record-note', record), create('span', 'play', playable ? '进入游戏 ↗' : '即将上线'));
      info.append(bottom);
    }
    card.append(cover, info);
    grid.append(card);
  }
  if (!list.length) grid.append(create('p', 'empty', '小游戏正在准备中，稍后再来看看。'));

  const videoGrid = document.getElementById('videos');
  const videos = Array.isArray(window.ARCADE_VIDEOS) ? window.ARCADE_VIDEOS : [];
  const videoToolbar = document.getElementById('video-toolbar');
  const videoCount = document.getElementById('video-count');
  if (videoCount) videoCount.textContent = videos.length;
  if (videoGrid) {
    if (!videos.length && videoToolbar) videoToolbar.hidden = true;
    videos.forEach((video, index) => {
      const playable = typeof video.url === 'string' && video.url.length > 0;
      const card = create(playable ? 'a' : 'article', 'game-card video-card');
      if (playable) card.href = video.url;
      card.setAttribute('aria-label', video.title + (playable ? '，播放短片' : '，敬请期待'));
      const cover = create('div', 'cover cover-video');
      if (video.cover) cover.style.backgroundImage = "url('" + video.cover + "')";
      const top = create('div', 'cover-top');
      top.append(create('span', 'badge', playable ? (video.badge || '播放短片') : '敬请期待'), create('span', 'cover-number', String(index + 1).padStart(2, '0')));
      cover.append(top, create('span', 'play-mark'), create('span', 'cover-caption', video.subtitle || video.title));
      const info = create('div', 'game-info');
      const title = create('div', 'game-title');
      title.append(create('h2', '', video.title), create('span', 'category', video.category || '短片'));
      info.append(title, create('p', 'description', video.description || ''));
      const bottom = create('div', 'game-bottom');
      bottom.append(create('span', 'record-note', video.duration || '短片'), create('span', 'play', playable ? '播放短片 ↗' : '即将上线'));
      info.append(bottom);
      card.append(cover, info);
      videoGrid.append(card);
    });
  }
})();
