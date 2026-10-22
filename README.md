# 小游戏花园

双击根目录的 index.html，首先进入小游戏大厅，点击「跳一跳」后才会加载游戏。
游戏右下角「返回大厅」可以重新选择游戏。回到大厅后不再运行游戏动画和音效。

## 文件结构

- index.html：大厅入口
- style.css：大厅样式
- game.js：大厅卡片渲染，不包含游戏逻辑
- games.js：游戏列表注册表
- games/jump/：跳一跳独立页面、样式和逻辑
- games/gu-cheng-feng-huo/：孤城烽火（入口 index.html，v7 网页发布版；start.html 为旧 v6 本地版）
- games/sweet-match/：糖果派对（类开心消消乐三消游戏）
- games/hongwu/：洪武 · 兵起濠州（入口 index.html，序幕 prologue/、八章 chapter1~8/、终章 ending/）

## 新增小游戏

1. 把新游戏放到 games/游戏ID/，入口命名为 index.html。
2. 在根目录 games.js 的 ARCADE_GAMES 数组中添加一项：

    { id: 'snake', title: '贪吃蛇', subtitle: '经典挑战', description: '控制方向，收集食物。', category: '益智', url: 'games/snake/index.html', ready: true }

3. 给新游戏添加指向 ../../index.html 的返回大厅链接。

ready: false 会显示不可点击的预告卡片，不会进入未完成的游戏。
无需安装依赖、构建工具或服务器。线上部署时保持上述相对路径结构即可。
