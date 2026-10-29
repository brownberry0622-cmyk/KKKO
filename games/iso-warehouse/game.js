/* =====================================================================
 * 智慧仓库 · 无人值守备件仓智能系统（模拟版）
 * 逻辑参照《操作培训手册_无人值守备件仓智能系统》：
 *   WMS 工单(ORDER/ASN) + 无单领料(MUL) → 刷脸进仓 → 匹配工单锁定库位
 *   → LED 引导灯(操作员三色通道：红/蓝/绿) → 取料 → 三种方式校验
 *   (计重/扫码/视觉识别) → 确认 → 扣减库存/灭灯/工单完成/上报 WMS
 *   异常：库存不足、检测不符 → 工单标红；支持部分结算。
 * 渲染：透视 3D 投影 + 渐变着色 + LED 光晕 + 软阴影。
 * ===================================================================== */
(function () {
  'use strict';

  // ---------- 场景布局 ----------
  var GW = 14, GH = 14;
  var RACK_X0 = 2, RACK_X1 = 11;
  var RACK_ROWS = [3, 6, 9, 12];
  var SLOT_CAP = 12;                    // 每库位容量（件）
  var DECK_Z = [0.13, 0.66, 1.19];    // 层板高度（降低约30%，减遮挡）
  var BOX_H = 0.42;                    // 料箱高度（同步降低）
  var GATE = { x: 1.2, y: -0.55 };      // 人脸门禁闸机（横跨南墙缺口）
  var STATION = { x: 10.9, y: 1.5 };    // 校验结算台
  var KIOSK = { x: 10.1, y: 2.5 };      // 作业终端
  var IDLE_SPOTS = [[3, 1], [6, 1], [13, 1]];   // 待命位在 y=1 服务通道（不邻货架，永不被取料征用），左/中/右分散
  // 校验台 / 门禁前的排队位（避免多人挤在同一格）
  var STATION_SPOTS = [{ x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }];   // 校验台南侧排队位（由西向东，台面 y∈[0.95,2.05] 不重叠）
  // 固定设施占用的网格格（校验台/作业终端），禁止通行，避免人员穿台
  var BLOCK_CELLS = { '10,1': true, '11,1': true, '10,2': true };
  var GATE_SPOTS = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }];   // 门内侧收货排队位
  // 人脸门禁进场流程：人员从南墙闸机外排队 → 走到闸机屏前刷脸位 → 刷脸验证（面朝北朝闸机屏）→ 通过后进门签到
  var GATE_OUT_SPOTS = [{ x: 0, y: -4 }, { x: 1, y: -4 }, { x: 2, y: -4 }];   // 闸机外（南墙外）场外待命区（拉远到 y=-4，让出场返回待命区的行程可见）
  var FACE_SPOTS = [{ x: 0, y: -1 }, { x: 1, y: -1 }, { x: 2, y: -1 }];          // 刷脸位（闸机紧外侧 y=-1，屏前，面朝北朝闸机屏）
  var RECEIVE_SPOTS = [{ x: 0, y: -3 }, { x: 1, y: -3 }, { x: 2, y: -3 }];   // 门外收货区（y=-3，供应商到货验收位，在刷脸位与场外待命区之间）

  // 物料主数据：管理方式 weight=计重 scan=扫码 vision=视觉
  var SKUS = [
    { sku: 'LS-6001', name: '六角螺栓', method: 'weight', color: '#8d99a8' },
    { sku: 'DJ-6002', name: '电机端盖', method: 'scan',   color: '#2e7fd6' },
    { sku: 'FB-6003', name: '阀体',     method: 'vision', color: '#ef8c1e' },
    { sku: 'XL-6004', name: '密封圈',   method: 'weight', color: '#3fae5a' },
    { sku: 'QD-6005', name: '皮带轮',   method: 'vision', color: '#9b6fd0' }
  ];
  var METHOD_TXT = { weight: '计重', scan: '扫码', vision: '视觉识别' };

  // 操作员三色通道（手册：红/蓝/绿，互不干扰）
  var CHANNELS = [
    { name: '王红', color: '#e05548' },
    { name: '李蓝', color: '#3b8de0' },
    { name: '张绿', color: '#37b464' }
  ];

  var UP_WALK = 600, UP_VERIFY = 800;

  // ---------- 状态 ----------
  var S;
  var money = 2500;
  function initState() {
    var slots = [];
    RACK_ROWS.forEach(function (y, ri) {
      for (var x = RACK_X0; x <= RACK_X1; x++) {
        var has = Math.random() < 0.62;
        slots.push({
          x: x, y: y, row: 'ABCD'[ri],
          sku: has ? Math.floor(Math.random() * SKUS.length) : null,
          qty: has ? 3 + Math.floor(Math.random() * 8) : 0,
          capacity: SLOT_CAP,                 // 库位容量（StorageSlot.capacity）
          reserved: 0,                         // 预留量（出库锁定未取 / 入库预留未上架）
          batch: has ? 'B' + (2401 + Math.floor(Math.random() * 90)) : '',
          lit: null   // LED 引导灯颜色（操作员通道色）
        });
      }
    });
    // ---- 统一业务数据模型（扩展，不破坏现有渲染/UI）----
    // Material：物料主数据 + 库存/可用/预留汇总（每帧由 refreshMaterial 重算）
    var materials = SKUS.map(function (s, i) {
      return { idx: i, sku: s.sku, name: s.name, method: s.method, color: s.color, stock: 0, available: 0, reserved: 0 };
    });
    // Task：独立任务实体（执行人员/目标库位/路径/阶段/进度），op 仍保留 order/slot/path 作快捷视图
    var tasks = [];
    // InventoryTransaction：结构化库存流水（入/出/调整 · 关联单据 · 量变 · 时间 · 结果）
    var ledger = [];
    // WarehouseEvent：结构化业务事件（类型/时间/对象ID/结果/错误），addLog 同时推送
    var events = [];
    // WmsReport：上报请求记录（状态/重试/请求/确认），与 order.wms 字符串并行（兼容旧 UI）
    var wmsReports = [];
    S = {
      t: 0, speed: 1, paused: false, seq: 1, taskSeq: 1, evtSeq: 1, ledgerSeq: 1, wmsSeq: 1,
      slots: slots, materials: materials, operators: [], orders: [],
      tasks: tasks, ledger: ledger, events: events, wmsReports: wmsReports,
      dispatchPaused: false,                  // 暂停派发开关（手动派发/异常处置时关闭自动派发）
      gateOpen: 0, gateTarget: 0,             // 闸机门当前开度(0=闭合..1=全开) / 目标开度（tick 渐变）
      stats: { inQty: 0, outQty: 0, mulQty: 0, failed: 0, done: 0, cancelled: 0,
               bucket: 0, buckets: [], bucketAcc: 0, logs: [] },
      upWalk: 0, upVerify: 0, orderTimer: 2
    };
    for (var i = 0; i < CHANNELS.length; i++) {
      var sp = IDLE_SPOTS[i], osp = GATE_OUT_SPOTS[i], face = FACE_SPOTS[i];
      var op = {
        id: 'OP-' + (i + 1), name: CHANNELS[i].name, color: CHANNELS[i].color,
        home: { x: sp[0], y: sp[1] },
        x: osp.x, y: osp.y, path: [], mode: 'goFace', work: null, timer: 0,
        order: null, slot: null, carry: null, step: 0, done: 0, flash: 0, recheck: false,
        taskId: null,                              // 绑定的 Task 实体 ID（无任务为 null）
        signed: false, faceRetry: 0,                // 是否刷脸签到通过 / 刷脸复扫计数
        faceDir: { dx: 0, dy: -1 }                    // 初始面朝南（闸机方向，准备刷脸）
      };
      op.path = bfs({ x: osp.x, y: osp.y }, face) || [];
      S.operators.push(op);
    }
    spawnOrder('out'); spawnOrder('in'); spawnOrder('out');
  }

  function slotAt(x, y) {
    if (y !== 3 && y !== 6 && y !== 9 && y !== 12) return null;
    if (x < RACK_X0 || x > RACK_X1) return null;
    return S.slots[(RACK_ROWS.indexOf(y) * (RACK_X1 - RACK_X0 + 1)) + (x - RACK_X0)];
  }
  function walkable(x, y) {
    // 网格内：货架格 + 固定设施格不可走
    if (x >= 0 && y >= 0 && x < GW && y < GH) return !slotAt(x, y) && !BLOCK_CELLS[x + ',' + y];
    // 南墙外闸机缓冲区（进场通道）：仅缺口段 x∈[0,2]、y∈[-4,-1] 可走，使人员能从闸机外场外待命区走到刷脸位
    if (x >= 0 && x <= 2 && y >= -4 && y <= -1) return true;
    return false;
  }
  // 库存口径：架上料 + 在途料（已取下、尚未校验结算的仍计入库存；校验成功才真正扣减）
  function skuTotal(idx) {
    var n = 0;
    S.slots.forEach(function (s) { if (s.sku === idx) n += s.qty; });
    S.operators.forEach(function (op) { if (op.carry && op.carry.sku === idx) n += op.carry.qty; });
    return n;
  }
  function addLog(msg, type) {
    S.stats.logs.unshift({ t: S.t, msg: msg, type: type || 'info' });
    if (S.stats.logs.length > 60) S.stats.logs.pop();
  }

  // ---------- 统一业务数据模型辅助函数 ----------
  // WarehouseEvent：结构化业务事件（类型/时间/对象ID/结果/错误）
  function addEvent(kind, objectId, result, error, detail) {
    var ev = { id: 'EVT-' + S.evtSeq++, kind: kind, t: S.t, objectId: objectId || null, result: result || 'ok', error: error || '', detail: detail || '' };
    S.events.unshift(ev);
    if (S.events.length > 500) S.events.pop();
    return ev;
  }
  // InventoryTransaction：库存流水（入/出/调整 · 关联单据 · 量变 · 时间 · 结果）
  function addLedger(kind, orderId, skuIdx, qty, slotLabelTxt, result, detail) {
    var tx = { id: 'TX-' + S.ledgerSeq++, kind: kind, orderId: orderId || null, sku: skuIdx, qty: qty, slot: slotLabelTxt || '', t: S.t, result: result || 'ok', detail: detail || '' };
    S.ledger.unshift(tx);
    if (S.ledger.length > 500) S.ledger.pop();
    return tx;
  }
  // Material 汇总重算：stock=架上+在途料，reserved=各库位预留，available=stock-reserved
  function refreshMaterial() {
    S.materials.forEach(function (m) { m.stock = 0; m.reserved = 0; });
    S.slots.forEach(function (s) {
      if (s.sku !== null) {
        S.materials[s.sku].stock += s.qty;
        S.materials[s.sku].reserved += s.reserved || 0;
      }
    });
    S.operators.forEach(function (op) { if (op.carry) S.materials[op.carry.sku].stock += op.carry.qty; });
    S.materials.forEach(function (m) { m.available = Math.max(0, m.stock - m.reserved); });
  }
  // 库位预留/释放（出库锁定数量、入库预留容量；预留不算可用，防并发超卖）
  function reserveSlot(slot, qty, isInbound) {
    if (!slot) return false;
    var avail = isInbound ? (slot.capacity - slot.qty - (slot.reserved || 0)) : (slot.qty - (slot.reserved || 0));
    if (avail < qty) return false;   // 可用容量/数量不足
    slot.reserved = (slot.reserved || 0) + qty;
    return true;
  }
  function releaseReserve(slot, qty) {
    if (!slot) return;
    slot.reserved = Math.max(0, (slot.reserved || 0) - qty);
  }
  // WmsReport：上报请求记录（状态/重试/请求日志/确认），与 order.wms 字符串并行兼容旧 UI
  function markWmsReport(orderId, status, detail) {
    var rep = S.wmsReports.find(function (r) { return r.orderId === orderId; });
    if (!rep) {
      rep = { id: 'WMS-' + S.wmsSeq++, orderId: orderId, status: 'pending', retries: 0, reqLog: [], confirmT: 0, detail: '' };
      S.wmsReports.unshift(rep);
      if (S.wmsReports.length > 100) S.wmsReports.pop();
    }
    rep.status = status;
    if (detail) rep.detail = detail;
    rep.reqLog.push({ t: S.t, status: status, detail: detail || '' });
    if (rep.reqLog.length > 10) rep.reqLog.shift();
    return rep;
  }
  // Task：创建/更新/关闭任务实体（独立于 op，op 保留 order/slot/path 作快捷视图）
  function createTask(order, op, slot, path, phase) {
    var tk = { id: 'TSK-' + S.taskSeq++, orderId: order.id, opId: op.id, slotId: slot ? slotLabel(slot) : null,
      path: (path || []).slice(), phase: phase || 'dispatched', progress: 0, createdAt: S.t, closedAt: null, result: '' };
    S.tasks.unshift(tk);
    if (S.tasks.length > 100) S.tasks.pop();
    op.taskId = tk.id;
    return tk;
  }
  function updateTask(op, phase, progress) {
    if (!op.taskId) return;
    var tk = S.tasks.find(function (t) { return t.id === op.taskId; });
    if (tk) { tk.phase = phase || tk.phase; if (progress !== undefined) tk.progress = progress; tk.path = op.path.slice(); }
  }
  function closeTask(op, result) {
    if (!op.taskId) return;
    var tk = S.tasks.find(function (t) { return t.id === op.taskId; });
    if (tk) { tk.phase = 'closed'; tk.closedAt = S.t; tk.result = result || 'ok'; }
    op.taskId = null;
  }

  // ---------- 寻路（带迭代护栏） ----------
  // 静止占位：正在作业/待命（不会移动）的操作员所在格视作临时障碍
  function occupiedStatic(x, y) {
    for (var i = 0; i < S.operators.length; i++) {
      var o = S.operators[i];
      if (o.mode === 'go' && o.path && o.path.length) continue;   // 移动中的人会自行让开
      if (Math.abs(o.x - x) < 0.55 && Math.abs(o.y - y) < 0.55) return true;
    }
    return false;
  }
  function bfs(from, to) {
    if (!(from && to)) return null;
    if (from.x === to.x && from.y === to.y) return [];
    var K = function (x, y) { return x + ',' + y; };
    var prev = {}, q = [{ x: from.x, y: from.y }];
    prev[K(from.x, from.y)] = null;
    var guard = 0;
    while (q.length) {
      if (++guard > 5000) return null;   // 护栏：网格只有 196 格，绝不该超过
      var p = q.shift();
      if (p.x === to.x && p.y === to.y) {
        var path = [], cur = p;
        while (cur) { path.unshift(cur); cur = prev[K(cur.x, cur.y)]; }
        path.shift();
        return path;
      }
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < 4; d++) {
        var nx = p.x + dirs[d][0], ny = p.y + dirs[d][1], k2 = K(nx, ny);
        // 绕开静止人员；终点格允许被占（由 blockedAt 在移动中处理让行）
        var isDest = (nx === to.x && ny === to.y);
        if (walkable(nx, ny) && !(k2 in prev) && (isDest || !occupiedStatic(nx, ny))) { prev[k2] = p; q.push({ x: nx, y: ny }); }
      }
    }
    return null;
  }
  function nearestAdj(cell, from) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var cands = dirs.map(function (d) { return { x: cell.x + d[0], y: cell.y + d[1] }; })
      .filter(function (p) { return walkable(p.x, p.y) && cellFree(p.x, p.y, from); });
    if (!cands.length) {
      // 退而求其次：所有相邻可行格（哪怕被占，也避免完全卡死）
      cands = dirs.map(function (d) { return { x: cell.x + d[0], y: cell.y + d[1] }; })
        .filter(function (p) { return walkable(p.x, p.y); });
    }
    if (!cands.length) return null;
    cands.sort(function (a, b) {
      return (Math.abs(a.x - from.x) + Math.abs(a.y - from.y)) -
             (Math.abs(b.x - from.x) + Math.abs(b.y - from.y));
    });
    return cands[0];
  }
  function nearestIdleCell(op) {
    return op.home;   // 每人专属待命位，不再共占
  }
  // 某操作员正在前往（或已占据）的目标格
  function opTargetCell(op) {
    if (op.path && op.path.length) return op.path[op.path.length - 1];
    return { x: Math.round(op.x), y: Math.round(op.y) };
  }
  // 判断某格是否被其他操作员占用或预订（避免多人叠在同一格）
  function cellFree(x, y, excludeOp) {
    for (var i = 0; i < S.operators.length; i++) {
      var o = S.operators[i];
      if (o === excludeOp) continue;
      if (Math.abs(o.x - x) < 0.55 && Math.abs(o.y - y) < 0.55) return false;   // 已占据
      var t = opTargetCell(o);
      if (Math.abs(t.x - x) < 0.55 && Math.abs(t.y - y) < 0.55) return false;   // 正前往
    }
    return true;
  }
  function freeSpot(list, op) {
    for (var i = 0; i < list.length; i++) if (cellFree(list[i].x, list[i].y, op)) return list[i];
    return list[0];
  }
  // 前方格是否需要让行：返回 null=通行 / 'static'=静止者占道 / 'moving'=对方更近 / 'headon'=对向相遇
  function blockedAt(op, node) {
    for (var i = 0; i < S.operators.length; i++) {
      var o = S.operators[i];
      if (o === op) continue;
      if (Math.abs(o.x - node.x) >= 0.55 || Math.abs(o.y - node.y) >= 0.55) continue;
      var oMoving = o.mode.indexOf('go') === 0 && o.path && o.path.length;
      if (oMoving) {
        var oN = o.path[0];
        // 对向换位（对方下一步就是我的当前格）：编号小者直行，大者横向避让
        if (Math.abs(oN.x - op.x) < 0.55 && Math.abs(oN.y - op.y) < 0.55) {
          if (op.id < o.id) return null;
          return 'headon';
        }
        // 对方也想到该格且离得更近（或同距但编号小）→ 我让行
        var dMe = Math.abs(op.x - node.x) + Math.abs(op.y - node.y);
        var dThem = Math.abs(o.x - node.x) + Math.abs(o.y - node.y);
        if (dThem < dMe - 0.05 || (Math.abs(dThem - dMe) <= 0.05 && op.id > o.id)) return 'moving';
      } else {
        return 'static';   // 静止作业/待命占道 → 等待其完成
      }
    }
    return null;
  }

  // ---------- 音效 ----------
  var actx = null;
  function beep(f, dur, type, vol) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.05, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (_) {}
  }

  // ---------- 通知 ----------
  var toastsEl = document.getElementById('toasts');
  function toast(msg, type) {
    var d = document.createElement('div');
    d.className = 'toast ' + (type || '');
    d.textContent = msg;
    toastsEl.appendChild(d);
    setTimeout(function () { d.style.opacity = '0'; d.style.transition = 'opacity .5s'; }, 2600);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
    while (toastsEl.children.length > 4) toastsEl.removeChild(toastsEl.children[0]);
  }

  // ---------- WMS 工单 ----------
  function makeOrderId(type) {
    if (type === 'mul') return 'MUL' + Date.now().toString().slice(-8);
    return (type === 'in' ? 'ASN' : 'ORDER') + '-24' + String(S.seq++).padStart(3, '0');
  }
  function spawnOrder(forceType) {
    var stock = 0;
    S.slots.forEach(function (s) { stock += s.qty; });
    var type = forceType || (stock < 70 ? 'in' : stock > 200 ? 'out' :
      (Math.random() < 0.55 ? 'out' : 'in'));
    var sku;
    if (type === 'in') {
      // 优先补低库存物料
      var low = SKUS.map(function (_, i) { return i; }).sort(function (a, b) { return skuTotal(a) - skuTotal(b); });
      sku = low[0];
      var free = S.slots.some(function (s) { return (s.sku === null || (s.sku === sku && s.qty < SLOT_CAP)) && !slotLocked(s); });
      if (!free) return null;
    } else {
      var weights = SKUS.map(function (_, i) { return skuTotal(i); });
      var tot = weights.reduce(function (a, b) { return a + b; }, 0);
      if (!tot) return null;
      var roll = Math.random() * tot, acc = 0; sku = 0;
      for (var si = 0; si < weights.length; si++) { acc += weights[si]; if (roll <= acc) { sku = si; break; } }
    }
    var o = {
      id: makeOrderId(type), type: type, sku: sku,
      qty: 4 + Math.floor(Math.random() * 5),
      done: 0, status: 'queued', op: null, slot: null, reason: '',
      wms: 'none', wmsT: 0,                          // 兼容旧 UI 的 WMS 简化状态
      createdAt: S.t, doneAt: null,                   // WorkOrder 创建/完成时间
      phase: 'created',                               // 业务阶段：created→reserved→dispatched→executing→verifying→settled→reported
      reservedQty: 0,                                 // 已预留数量（出库预占 / 入库预留库位容量）
      wmsRetries: 0, wmsFailed: false, cancelReason: ''  // WMS 重试/失败标记；取消原因
    };
    // 手册 3.8：库存不足 → 工单直接标记异常
    if (type !== 'in' && skuTotal(sku) === 0) {
      o.status = 'failed'; o.reason = '库存不足'; o.phase = 'failed';
      S.stats.failed++;
      addEvent('order_fail', o.id, 'fail', '库存不足', '创建即异常');
      addLog('工单 ' + o.id + ' 异常：物料 ' + SKUS[sku].sku + ' 无可用库存', 'fail');
    }
    S.orders.push(o);
    if (o.status !== 'failed') {
      addEvent('order_create', o.id, 'ok', '', (type === 'in' ? '入库ASN' : '出库ORDER') + ' ' + o.qty + ' 件');
      addLog('WMS 下发' + (type === 'in' ? '入库单' : type === 'mul' ? '无单领料' : '出库单') + ' ' + o.id + ' · ' + SKUS[sku].name + ' × ' + o.qty, 'wms');
    }
    return o;
  }
  function spawnMul() {
    var avail = SKUS.map(function (_, i) { return i; }).filter(function (i) { return skuTotal(i) > 0; });
    if (!avail.length) { toast('提示：仓内无可用库存，无法无单领料', 'warn'); return; }
    var sku = avail[Math.floor(Math.random() * avail.length)];
    var maxq = Math.min(6, skuTotal(sku));
    var o = { id: makeOrderId('mul'), type: 'mul', sku: sku, qty: 1 + Math.floor(Math.random() * maxq), done: 0, status: 'queued', op: null, slot: null, reason: '', wms: 'none', wmsT: 0,
      createdAt: S.t, doneAt: null, phase: 'created', reservedQty: 0, wmsRetries: 0, wmsFailed: false, cancelReason: '' };
    S.orders.push(o);
    addEvent('order_create', o.id, 'ok', '', '无单领料 ' + o.qty + ' 件');
    addLog('现场发起无单领料 ' + o.id + ' · ' + SKUS[sku].name + ' × ' + o.qty, 'wms');
    toast('已发起无单领料（需特殊权限）', 'ok');
    beep(680, 0.1, 'sine', 0.05);
  }
  // 部分结算：进行中工单退回待执行，已完成明细保留（手册 8.1）
  function partialSettle(orderId) {
    var o = S.orders.find(function (k) { return k.id === orderId; });
    if (!o || o.status !== 'active') return;
    if (o.type === 'mul') { toast('无单领料不支持部分结算', 'warn'); return; }
    S.operators.forEach(function (op) {
      if (op.order === o) {
        if (op.carry && op.slot) {   // 部分结算放行：在途未校验物料必须退回库位，避免库存凭空消失
          var s = op.slot;
          if (s.sku === null) { s.sku = op.carry.sku; if (!s.batch) s.batch = 'B' + (2401 + Math.floor(Math.random() * 90)); }
          s.qty = Math.min(SLOT_CAP, s.qty + op.carry.qty);
          addLedger('adjust', o.id, op.carry.sku, op.carry.qty, slotLabel(s), 'ok', '部分结算退回在途料');
          addLog('部分结算：在途物料 ' + op.carry.qty + ' 件退回 ' + slotLabel(s) + '，库存未扣减', 'warn');
        }
        op.carry = null;
        releaseOp(op);
      }
    });
    o.status = 'queued'; o.op = null; o.phase = 'partial';
    if (o.slot) { o.slot.lit = null; o.slot = null; }
    addEvent('partial_settle', o.id, 'ok', '', '已完成 ' + o.done + '/' + o.qty);
    addLog('工单 ' + o.id + ' 部分结算 → 待执行（已完成 ' + o.done + '/' + o.qty + '），系统自动开门放行', 'warn');
    toast('工单已部分结算，自动开门放行', 'ok');
    beep(520, 0.12, 'triangle', 0.05);
  }
  function releaseOp(op) {
    if (op.order && op.order.slot) op.order.slot.lit = null;
    // 释放该操作员占用的库位预留（异常/取消时资源回收）
    if (op.slot && op.slot.reserved > 0 && op.order) {
      releaseReserve(op.slot, Math.min(op.slot.reserved, op.order.reservedQty));
      op.order.reservedQty = Math.max(0, op.order.reservedQty - op.slot.reserved);
    }
    if (op.taskId) closeTask(op, 'released');
    op.order = null; op.slot = null; op.carry = null; op.recheck = false;
    op.path = []; op.mode = 'idle'; op.work = null; op.timer = 0;
  }
  // 取消工单（统一状态机：cancelled 状态，释放预留/在途料/库位锁定）
  function cancelOrder(orderId) {
    var o = S.orders.find(function (k) { return k.id === orderId; });
    if (!o) return;
    if (o.status === 'done' || o.status === 'failed' || o.status === 'cancelled') {
      toast('该工单状态不可取消', 'warn'); return;
    }
    S.operators.forEach(function (op) {
      if (op.order === o) {
        if (op.carry && op.slot) {   // 在途料退回库位
          var s = op.slot;
          if (s.sku === null) { s.sku = op.carry.sku; if (!s.batch) s.batch = 'B' + (2401 + Math.floor(Math.random() * 90)); }
          s.qty = Math.min(SLOT_CAP, s.qty + op.carry.qty);
          addLedger('adjust', o.id, op.carry.sku, op.carry.qty, slotLabel(s), 'ok', '取消退回在途料');
        }
        releaseOp(op);
      }
    });
    // 释放库位预留（未派发或已派发未取的预留量）
    if (o.slot && o.slot.reserved > 0) {
      releaseReserve(o.slot, Math.min(o.slot.reserved, o.reservedQty));
    }
    o.status = 'cancelled'; o.phase = 'cancelled'; o.cancelReason = '手动取消'; o.op = null; o.reservedQty = 0;
    if (o.slot) { o.slot.lit = null; o.slot = null; }
    S.stats.cancelled++;
    addEvent('order_cancel', o.id, 'ok', '', '手动取消，资源已释放');
    addLog('工单 ' + o.id + ' 已取消，预留/库位/在途料均已释放', 'warn');
    toast(o.id + ' 已取消', 'ok');
    beep(440, 0.1, 'sine', 0.04);
  }

  // ---------- 操作员状态机 ----------
  function opSpeed() { return 1.9 * Math.pow(1.15, S.upWalk); }
  function verifyTime(m) {
    var base = m === 'weight' ? 1.7 : m === 'scan' ? 1.4 : 1.9;
    return base * Math.pow(0.92, S.upVerify);
  }
  function slotLocked(s) {
    return S.operators.some(function (op) { return op.slot === s && op.mode !== 'idle'; });
  }
  function slotLabel(s) { return s.row + '-' + (s.y / 3) + '-' + (s.x - RACK_X0 + 1); }

  // ---------- 统一状态机（允许的转换）----------
  // WorkOrder.status:  created→queued→active→done/failed/cancelled（active 可经 partialSettle 回 queued）
  // WorkOrder.phase:    created→reserved→dispatched→(picked/received)→verifying→settled→reported；failed/cancelled 终态
  // WorkOrder.wms:      none→pending→sent/failed（failed 可重试，不重复扣库存）
  // Worker.mode:        idle/goFace/face/goEnter/goPick/pick/goStation/verify/confirm/goReceive/receive/goPlace/place/goOut/signout/goBack/goWait
  // 入库流程：场外idle→goReceive(门外收货)→receive→goFace→face→goStation→verify→confirm→goPlace→place→goOut→signout→goWait
  // 出库流程：场内idle→goPick→pick→goStation→verify→confirm→goOut→signout→goWait
  // Task.phase:         dispatched→picked/received→verifying→closed（result: ok/released/failed）
  // 派发前置：op.idle；入库工单派给场外!signed（先收货再刷脸进场），出库工单派给场内signed（已刷脸在场内）；库位可用、路径可达；不满足则留 queued 并写 o.reason
  function assignOrders() {
    if (S.dispatchPaused) return;   // 暂停派发开关（手动派发/异常处置时关闭）
    S.operators.forEach(function (op) {
      if (op.mode !== 'idle') return;   // 必须待命才能接单
      // 工单匹配：入库要场外!signed的人，出库要场内signed的人
      var o = S.orders.find(function (k) {
        if (k.status !== 'queued') return false;
        if (k.type === 'in' && op.signed) return false;   // 入库派给场外未签到者
        if (k.type !== 'in' && !op.signed) return false;   // 出库派给场内已签到者
        return true;
      });
      if (!o) return;
      // 匹配库位（手册 3.3：按物料编码锁定库位）
      var slot = null, need = o.qty - o.done, path = [], reservedThis = 0;
      if (o.type === 'in') {
        // 入库：找空库位或同料未满库位，预留容量
        slot = S.slots.find(function (s) { return (s.sku === null || (s.sku === o.sku && s.qty < s.capacity)) && !slotLocked(s); });
        if (!slot) { o.reason = '无可用库位'; return; }   // 留队列，显示原因
        var cap = Math.min(need, slot.capacity - slot.qty);
        if (!reserveSlot(slot, cap, true)) { o.reason = '库位容量预留失败'; return; }
        reservedThis = cap;
        o.reservedQty += cap; o.phase = 'reserved';
        var rp = freeSpot(RECEIVE_SPOTS, op);   // 入库：先走到门外收货区收货
        path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, rp) || [];
        if (!path.length && rp) { releaseReserve(slot, cap); o.reservedQty -= cap; o.reason = '路径不可达'; return; }
      } else {
        // 出库：找同料有库存库位，预留数量（防并发超卖）
        slot = S.slots.find(function (s) { return s.sku === o.sku && s.qty - (s.reserved || 0) > 0 && !slotLocked(s); });
        if (!slot) { o.reason = '无可用库存库位'; return; }
        var canReserve = Math.min(need, slot.qty - (slot.reserved || 0));
        if (!reserveSlot(slot, canReserve, false)) { o.reason = '库存预留失败'; return; }
        reservedThis = canReserve;
        o.reservedQty += canReserve; o.phase = 'reserved';
        var adj = nearestAdj(slot, op);
        path = adj ? (bfs({ x: Math.round(op.x), y: Math.round(op.y) }, adj) || []) : [];
        if (!path.length && adj) { releaseReserve(slot, canReserve); o.reservedQty -= canReserve; o.reason = '路径不可达，待通道空出'; return; }
      }
      o.status = 'active'; o.op = op.id; o.slot = slot; o.phase = 'dispatched'; o.reason = '';   // LED 引导灯在人员到达目标库位时才亮（见 stepOp 到达分支）
      op.order = o; op.slot = slot;
      createTask(o, op, slot, path, 'dispatched');
      addEvent('dispatch', o.id, 'ok', '', op.name + ' → ' + slotLabel(slot));
      addLog(op.name + (op.signed ? '在场内' : '在场外') + '，分配工单 ' + o.id + '，锁定库位 ' + slotLabel(slot) + '（预留 ' + reservedThis + ' 件），LED 引导', 'op');
      if (o.type === 'in') {
        op.mode = 'goReceive';   // 入库：先去门外收货区
      } else {
        op.mode = 'goPick';
      }
      op.path = path;
      beep(760, 0.08, 'sine', 0.04);
    });
    // 出库工单需要场内 idle+signed 的人；若场内无人待命 → 触发一个场外 idle+!signed 的人进场刷脸签到
    // （入库工单已由上面的 forEach 直接派给场外!signed的人去门外收货，无需触发进场）
    var pendingOut = S.orders.some(function (k) { return k.status === 'queued' && k.type !== 'in'; });
    if (pendingOut) {
      var hasIdleSigned = S.operators.some(function (op) { return op.mode === 'idle' && op.signed; });
      if (!hasIdleSigned) {
        var opOut = S.operators.find(function (op) { return op.mode === 'idle' && !op.signed; });
        if (opOut) {
          opOut.mode = 'goFace';
          opOut.faceDir = { dx: 0, dy: 1 };   // 面朝北（朝闸机屏），到屏前刷脸
          var fs = freeSpot(FACE_SPOTS, opOut);
          opOut.path = bfs({ x: Math.round(opOut.x), y: Math.round(opOut.y) }, fs) || [];
        }
      }
    }
  }

  function orderFail(op, reason) {
    var o = op.order;
    o.status = 'failed'; o.reason = reason; o.phase = 'failed';
    S.stats.failed++;
    addEvent('order_fail', o.id, 'fail', reason, op.name);
    if (op.slot) op.slot.lit = null;
    // 释放该工单占用的库位预留（异常时资源回收）
    if (op.slot && op.slot.reserved > 0) {
      releaseReserve(op.slot, Math.min(op.slot.reserved, o.reservedQty));
      o.reservedQty = Math.max(0, o.reservedQty - op.slot.reserved);
    }
    if (op.carry) { // 校验失败：在途料退回库位，库存不被扣减
      var s = op.slot;
      if (s) {
        if (s.sku === null) { s.sku = op.carry.sku; if (!s.batch) s.batch = 'B' + (2401 + Math.floor(Math.random() * 90)); }
        s.qty = Math.min(SLOT_CAP, s.qty + op.carry.qty);
        addLedger('adjust', o.id, op.carry.sku, op.carry.qty, slotLabel(s), 'fail', '校验失败退回在途料');
        addLog('工单 ' + o.id + '：在途物料退回 ' + slotLabel(s) + '，库存未扣减', 'info');
      }
      op.carry = null;
    }
    if (op.taskId) closeTask(op, 'failed');
    addLog('✘ 工单 ' + o.id + ' 异常：' + reason + '，已标红等待处理', 'fail');
    toast('✘ ' + o.id + ' 异常：' + reason, 'warn');
    beep(180, 0.2, 'sawtooth', 0.04);
    op.path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, nearestIdleCell(op)) || [];
    op.mode = 'goBack'; op.order = null; op.slot = null; op.work = null;
  }

  function stepOp(op, dt) {
    if (op.flash > 0) op.flash -= dt;
    if (op.mode === 'idle') return;
    var spd = opSpeed() * dt;
    if (op.mode.indexOf('go') === 0) {
      var guard = 0;
      while (spd > 0 && op.path.length) {
        if (++guard > 500) { op.path = []; break; }   // 护栏
        var n = op.path[0];
        var blk = blockedAt(op, n);
        if (blk) {
          if (blk === 'headon') {
            // 对向相遇：让行者优先横向避让一格（不回原格，避免与对向者再撞）；
            // 窄通道无避让格时向后退一格拉开间距，小编号者直行
            var mdx = Math.sign(Math.round(n.x) - Math.round(op.x));
            var mdy = Math.sign(Math.round(n.y) - Math.round(op.y));
            var sds = (mdy === 0) ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
            var yielded = false;
            for (var s2 = 0; s2 < 2; s2++) {
              var ax = Math.round(op.x) + sds[s2][0], ay = Math.round(op.y) + sds[s2][1];
              if (walkable(ax, ay) && !occupiedStatic(ax, ay) && cellFree(ax, ay, op)) {
                op.path.unshift({ x: ax, y: ay }); yielded = true; break;
              }
            }
            if (!yielded) {   // 两侧都不可避 → 后退一格让出通道
              var rx = Math.round(op.x) - mdx, ry = Math.round(op.y) - mdy;
              if (walkable(rx, ry) && !occupiedStatic(rx, ry) && cellFree(rx, ry, op)) {
                op.path.unshift({ x: rx, y: ry }); yielded = true;
              }
            }
          }
          break;   // 本帧原地等待（或已插入避让/后退步，下帧执行）
        }
        var dx = n.x - op.x, dy = n.y - op.y;
        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) op.faceDir = { dx: dx, dy: dy };
        var dist = Math.abs(dx) + Math.abs(dy);
        if (dist <= spd) { op.x = n.x; op.y = n.y; op.path.shift(); spd -= dist; }
        else { op.x += Math.sign(dx) * spd; op.y += Math.sign(dy) * spd; spd = 0; }
        if (dx || dy) op.step += spd * 9;
      }
      if (!op.path.length) {
        // 到位校验：必须真正走到目标库位邻格才能进入取料/上架（杜绝空路径“瞬移作业”）
        if ((op.mode === 'goPick' || op.mode === 'goPlace') && op.slot &&
            (Math.abs(op.x - op.slot.x) + Math.abs(op.y - op.slot.y)) > 2.05) {
          var radj = nearestAdj(op.slot, op);
          var np = radj ? (bfs({ x: Math.round(op.x), y: Math.round(op.y) }, radj) || []) : [];
          if (np.length) { op.path = np; return; }   // 路径中断 → 重新规划继续走
          orderFail(op, '目标库位路径不可达'); return;
        }
        if (op.mode === 'goPick') {
          if (!op.slot || op.slot.qty <= 0 || op.slot.sku !== op.order.sku) { orderFail(op, '库位库存异常'); return; }
          op.mode = 'work'; op.work = 'pick'; op.timer = 1.2;
          if (op.slot) op.slot.lit = op.color;   // 到达目标库位才亮 LED 引导灯
        } else if (op.mode === 'goReceive') {
          // 抵达门外收货区（y=-3）：供应商到货验收
          op.mode = 'work'; op.work = 'receive'; op.timer = 1.4;
          op.faceDir = { dx: 0, dy: -1 };   // 面朝南（场外，供应商来货方向）
        } else if (op.mode === 'goStation') {
          op.mode = 'work'; op.work = 'verify'; op.timer = verifyTime(SKUS[op.order.sku].method);
          op.faceDir = { dx: STATION.x - op.x, dy: STATION.y - op.y };   // 抵达后面向校验台，避免背对
        } else if (op.mode === 'goPlace') {
          op.mode = 'work'; op.work = 'place'; op.timer = 1.2;
          if (op.slot) op.slot.lit = op.color;   // 到达上架库位才亮灯
        } else if (op.mode === 'goBack') {
          op.mode = 'idle'; op.work = null;
        } else if (op.mode === 'goFace') {
          // 抵达闸机屏前刷脸位（门外 y=-1）：面朝北朝闸机屏，开始人脸识别
          op.mode = 'work'; op.work = 'face'; op.timer = 1.8;
          op.faceDir = { dx: 0, dy: 1 };
        } else if (op.mode === 'goEnter') {
          // 进门签到完成，在 home 待命位就位，等待工单分配
          op.mode = 'idle'; op.work = null;
          op.faceDir = { dx: 0, dy: 1 };
        } else if (op.mode === 'goOut') {
          // 抵达闸机屏前刷脸位（门外 y=-1）：面朝北朝闸机屏，刷脸签退
          op.mode = 'work'; op.work = 'signout'; op.timer = 1.6;
          op.faceDir = { dx: 0, dy: 1 };
        } else if (op.mode === 'goWait') {
          // 签退完成，走到场外待命区就位
          op.mode = 'idle'; op.work = null;
          op.faceDir = { dx: 0, dy: -1 };   // 场外面南待命
        }
      }
    } else if (op.mode === 'work') {
      op.timer -= dt;
      if (op.timer > 0) return;
      var o = op.order;
      if (op.work === 'face') {
        // 人脸识别（手册 2.2 进场签到）：95% 一次通过；偶发未命中复扫一次仍通过——模拟识别重试，不阻断进场
        if (op.faceRetry === 0 && Math.random() < 0.06) {
          op.faceRetry = 1; op.flash = 0.3;
          addLog('⚠ ' + op.name + ' 人脸识别未命中，正在复扫…', 'fail');
          beep(180, 0.12, 'sawtooth', 0.04);
          op.timer = 1.0;
          return;
        }
        op.signed = true; op.faceRetry = 0;
        addLog('✔ ' + op.name + ' 刷脸通过·进仓签到，已授权作业', 'ok');
        toast('✔ ' + op.name + ' 刷脸签到', 'ok');
        beep(660, 0.1, 'sine', 0.05);
        op.faceDir = { dx: 0, dy: 1 };   // 转身面北进仓
        if (o && o.type === 'in') {
          // 入库：带料刷脸通过后直接去校验台校验（不停 home 待命）
          var stp = freeSpot(STATION_SPOTS, op);
          op.path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, stp) || [];
          op.mode = 'goStation'; op.work = null;
        } else {
          // 普通进场（出库工单已在场内派发，或初始进场签到）：home 待命
          op.path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, nearestIdleCell(op)) || [];
          op.mode = 'goEnter'; op.work = null;
        }
        return;
      }
      if (op.work === 'signout') {
        // 刷脸签退出场（手册 2.2）：授权失效，走到场外待命区，等下一工单再进场
        op.signed = false; op.faceRetry = 0;
        addLog(op.name + ' 刷脸签退·出场，授权失效', 'op');
        toast(op.name + ' 签退出场', 'info');
        beep(440, 0.08, 'sine', 0.03);
        op.path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, freeSpot(GATE_OUT_SPOTS, op)) || [];
        op.mode = 'goWait'; op.work = null;
        return;
      }
      if (!o) { op.mode = 'idle'; op.work = null; return; }
      if (op.work === 'pick') {
        var take = Math.min(o.qty - o.done, op.slot.qty);
        op.slot.qty -= take; o.done += take;
        releaseReserve(op.slot, take);                  // 已取出，释放对应预留
        o.reservedQty = Math.max(0, o.reservedQty - take);
        if (op.slot.qty <= 0) { op.slot.sku = null; op.slot.batch = ''; op.slot.reserved = 0; }
        op.carry = { sku: o.sku, qty: take };
        updateTask(op, 'picked', o.done / o.qty);
        addEvent('pick', o.id, 'ok', '', op.name + ' 取 ' + take + ' 件 @ ' + slotLabel(op.slot));
        addLog(op.name + ' 在库位 ' + slotLabel(op.slot) + ' 取料 ' + take + ' 件（LED 引导）', 'op');
        var stp = freeSpot(STATION_SPOTS, op);
        op.path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, stp) || [];
        op.mode = 'goStation'; op.work = null;
      } else if (op.work === 'receive') {
        var recv = Math.max(1, Math.min(o.qty, SLOT_CAP - (op.slot.sku === o.sku ? op.slot.qty : 0)));
        op.carry = { sku: o.sku, qty: recv }; o.done = recv;
        S.stats.inQty += recv; S.stats.bucket += recv;   // 到货即计入入库量（在途料也算库存，上架时不再重复计，保证逐帧守恒）
        updateTask(op, 'received', o.done / o.qty);
        addEvent('receive', o.id, 'ok', '', op.name + ' 门外收 ' + recv + ' 件（供应商到货）');
        addLog(op.name + ' 在门外收货区接收 ' + SKUS[o.sku].name + ' ' + recv + ' 件（供应商到货），待刷脸进仓校验', 'op');
        // 门外收货完成 → 去刷脸位刷脸进仓（带料进场校验上架）
        var fs = freeSpot(FACE_SPOTS, op);
        op.path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, fs) || [];
        op.mode = 'goFace'; op.work = null;
      } else if (op.work === 'verify') {
        // 三种校验方式；检测不符 → 复检一次，再不符 → 工单异常（手册 3.8）
        updateTask(op, 'verifying', o.done / o.qty);
        if (op.recheck === false && Math.random() < 0.05) {
          op.recheck = 'once';
          op.flash = 0.25;
          addEvent('verify_retry', o.id, 'warn', '复检', op.name);
          addLog('⚠ ' + (SKUS[o.sku].method === 'weight' ? '电子秤数据不稳定，正在复测…' : '检测数量与订单不符，正在复检…'), 'fail');
          beep(200, 0.15, 'sawtooth', 0.04);
          op.timer = verifyTime(SKUS[o.sku].method) * 0.8;
          return;
        }
        if (op.recheck === 'once') {
          if (Math.random() < 0.35) { op.recheck = false; orderFail(op, '检测数量与订单不符'); return; }
          addLog('复检通过，继续结算', 'ok');
        }
        op.recheck = false;
        op.flash = 0.25;
        op.work = 'confirm'; op.timer = 0.6;
      } else if (op.work === 'confirm') {
        // 手册 3.7：确认后扣库存/灭灯/完成/上报 WMS（幂等防护：无在途料不结算）
        if (!op.carry) { op.mode = 'idle'; op.work = null; return; }
        if (o.type !== 'in') {
          // 出库：校验通过 → 扣库存/灭灯/完成/上报 WMS → 出场
          S.stats.outQty += op.carry.qty;
          if (o.type === 'mul') S.stats.mulQty += op.carry.qty;
          S.stats.bucket += op.carry.qty;
          money += o.type === 'mul' ? op.carry.qty * 14 : op.carry.qty * 20;
          addLedger('out', o.id, o.sku, op.carry.qty, slotLabel(op.slot), 'ok', '校验通过出库');   // 出库流水
          if (op.slot) op.slot.lit = null;
          if (o.done < o.qty) {
            o.status = 'queued'; o.op = null; o.slot = null; o.phase = 'partial';
            addLog('工单 ' + o.id + ' 本次出库 ' + op.carry.qty + ' 件（剩余 ' + (o.qty - o.done) + ' 件待执行）', 'warn');
          } else {
            o.status = 'done'; o.phase = 'settled'; o.doneAt = S.t; S.stats.done++;
            o.wms = 'pending'; o.wmsT = 1.6;   // 完成与上报分离：稍后收到（模拟）WMS 回执
            markWmsReport(o.id, 'pending', '出库完成，待上报');   // WMS 上报请求记录
            addEvent('settle', o.id, 'ok', '', '出库结算 ' + op.carry.qty + ' 件');
            addLog('✔ 工单 ' + o.id + ' 完成：校验通过，出库 ' + o.done + ' 件，库存已扣减，LED 熄灭（等待 WMS 上报）', 'ok');
            toast('✔ ' + o.id + ' 完成（待 WMS 上报）', 'ok');
            beep(880, 0.1, 'triangle', 0.05);
          }
          closeTask(op, 'ok');
          op.done++; op.carry = null; op.order = null; op.slot = null;
          op.path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, freeSpot(FACE_SPOTS, op)) || [];
          op.mode = 'goOut'; op.work = null;
        } else {
          // 入库：校验通过 → 去上架库位（不清 carry/order/slot，上架要用）
          updateTask(op, 'verifying', o.done / o.qty);
          addEvent('verify', o.id, 'ok', '', op.name + ' 入库校验通过');
          addLog('✔ ' + op.name + ' 入库校验通过，前往上架库位 ' + slotLabel(op.slot), 'ok');
          toast('✔ 入库校验通过', 'ok');
          beep(760, 0.08, 'sine', 0.04);
          var adj2 = nearestAdj(op.slot, op);
          op.path = adj2 ? (bfs({ x: Math.round(op.x), y: Math.round(op.y) }, adj2) || []) : [];
          op.mode = 'goPlace'; op.work = null;
        }
      } else if (op.work === 'place') {
        // 入库上架（手册 5.3）：到货量已在 receive 计入 inQty，此处移动料到库位 + 释放入库预留容量
        if (!op.carry) { op.mode = 'idle'; op.work = null; return; }   // 幂等防护
        var s3 = op.slot;
        if (s3.sku === null) { s3.sku = o.sku; s3.batch = 'B' + (2401 + Math.floor(Math.random() * 90)); }
        releaseReserve(s3, op.carry.qty);                  // 上架完成，释放入库预留容量
        s3.qty = Math.min(SLOT_CAP, s3.qty + op.carry.qty);
        money += op.carry.qty * 12;
        addLedger('in', o.id, o.sku, op.carry.qty, slotLabel(s3), 'ok', '上架入库');   // 入库流水
        o.status = 'done'; o.phase = 'settled'; o.doneAt = S.t; S.stats.done++;
        o.wms = 'pending'; o.wmsT = 1.6;   // 完成与上报分离：稍后收到（模拟）WMS 回执
        markWmsReport(o.id, 'pending', '入库完成，待上报');   // WMS 上报请求记录
        addEvent('settle', o.id, 'ok', '', '入库结算 ' + op.carry.qty + ' 件');
        if (op.slot) op.slot.lit = null;
        addLog('✔ 入库单 ' + o.id + ' 完成：上架 ' + op.carry.qty + ' 件至 ' + slotLabel(s3) + '（等待 WMS 上报）', 'ok');
        toast('✔ ' + o.id + ' 入库完成（待 WMS 上报）', 'ok');
        beep(840, 0.1, 'triangle', 0.05);
        closeTask(op, 'ok');
        op.done++; op.carry = null; op.order = null; op.slot = null;
        op.path = bfs({ x: Math.round(op.x), y: Math.round(op.y) }, freeSpot(FACE_SPOTS, op)) || [];
        op.mode = 'goOut'; op.work = null;
      }
    }
  }

  // ---------- 主循环 ----------
  function tick(dt) {
    S.t += dt;
    S.orderTimer -= dt;
    if (S.orderTimer <= 0) { spawnOrder(); S.orderTimer = 11 + Math.random() * 9; }
    assignOrders();
    refreshMaterial();   // 每帧重算 Material.stock/available/reserved（统一物料视图）
    S.operators.forEach(function (op) { stepOp(op, dt); });
    // WMS 模拟上报：与工单完成分离的独立状态，完成后延迟收到模拟回执；15% 失败率，最多重试3次，超限标 failed（不重复扣库存）
    S.orders.forEach(function (o) {
      if (o.wms === 'pending') {
        o.wmsT -= dt;
        if (o.wmsT <= 0) {
          if (Math.random() < 0.15 && o.wmsRetries < 3) {   // 15% 失败，自动重试
            o.wmsRetries++;
            markWmsReport(o.id, 'failed', '上报失败，第 ' + o.wmsRetries + ' 次重试');
            addEvent('wms_fail', o.id, 'fail', '上报失败', '重试 ' + o.wmsRetries + '/3');
            addLog('⚠ [模拟] WMS 上报失败：' + o.id + '，第 ' + o.wmsRetries + '/3 次重试中（库存已记账，不重复扣减）', 'fail');
            toast('⚠ WMS 上报失败，自动重试', 'warn');
            beep(200, 0.12, 'sawtooth', 0.04);
            o.wmsT = 1.6;   // 重置倒计时重试（库存不重复扣减）
          } else if (o.wmsRetries >= 3 && Math.random() < 0.5) {
            // 重试3次后仍可能失败 → 标 failed 待手动处理
            o.wms = 'failed'; o.wmsFailed = true;
            markWmsReport(o.id, 'failed', '重试超限，待手动处理');
            addEvent('wms_fail', o.id, 'fail', '重试超限', '待手动重报');
            addLog('✘ [模拟] WMS 上报失败：' + o.id + ' 重试超限，待手动重报（库存已记账）', 'fail');
            toast('✘ WMS 上报失败，待手动重报', 'warn');
          } else {
            o.wms = 'sent';
            markWmsReport(o.id, 'sent', '上报成功');
            addEvent('wms_ok', o.id, 'ok', '', 'WMS 确认');
            addLog('[模拟] WMS 回执：' + o.id + ' 已确认（' +
              (o.type === 'mul' ? '领料流水入账' : o.type === 'in' ? '入库过账' : '出库过账') + '）', 'wms');
            toast('[模拟] WMS 已确认 ' + o.id, 'ok');
          }
        }
      }
    });
    S.stats.bucketAcc += dt;
    if (S.stats.bucketAcc >= 15) {
      S.stats.bucketAcc -= 15;
      S.stats.buckets.push(S.stats.bucket);
      S.stats.bucket = 0;
      if (S.stats.buckets.length > 20) S.stats.buckets.shift();
    }
    // 闸机门开合目标：有人即将穿过/正在穿过门洞 → 开门；否则关门
    // 触发开门：goEnter（进门中）/goOut（出场中）；或刷脸/签退即将完成（timer<1.0 提前开门，门先开好再放人，避免人卡门前或穿门页）
    //           或 goWait 初期人仍紧邻闸机（y>-2.5，尚未走出闸机缓冲区）门保持开，等人离闸机远了再关，避免"人刚转身门就拍脸上"
    var needOpen = false;
    for (var oi = 0; oi < S.operators.length; oi++) {
      var oop = S.operators[oi];
      if (oop.mode === 'goEnter' || oop.mode === 'goOut') { needOpen = true; break; }
      if (oop.mode === 'work' && (oop.work === 'face' || oop.work === 'signout') && oop.timer < 1.0) { needOpen = true; break; }
      if (oop.mode === 'goWait' && oop.y > -2.5) { needOpen = true; break; }
    }
    S.gateTarget = needOpen ? 1 : 0;
    // 平滑过渡（开合约 0.5s 全行程）：门机干脆开合，避免长期半开状态视觉模糊
    var gstep = Math.min(1, dt * 4.8);
    S.gateOpen += (S.gateTarget - S.gateOpen) * gstep;
    if (Math.abs(S.gateOpen - S.gateTarget) < 0.002) S.gateOpen = S.gateTarget;
  }

  // =====================================================================
  // 透视 3D 渲染（画质增强版）
  // =====================================================================
  var canvas = document.getElementById('scene');
  var ctx = canvas.getContext('2d');
  var LW = window.innerWidth, LH = window.innerHeight;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    LW = window.innerWidth; LH = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(LW * DPR); canvas.height = Math.floor(LH * DPR);
    canvas.style.width = LW + 'px'; canvas.style.height = LH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (ORBIT) { ORBIT.sx0 = LW / 2; ORBIT.sy0 = LH * 0.43; updateCam(); }   // ORBIT 就绪后再调
  }

  // 环绕相机：以场景中心为锚点，鼠标拖动改 yaw/pitch，滚轮改 dist
  var LOOK = { x: 7, y: 7, z: 0.9 };   // 场景中心锚点（仓库世界中心 7,7）
  var ORBIT = { yaw: 8 * Math.PI / 180, pitch: 66 * Math.PI / 180, dist: 23, f: 1240, sx0: 540, sy0: 285 };  // 更接近垂直的上帝视角
  var VIEW  = { yaw: ORBIT.yaw, pitch: ORBIT.pitch, dist: ORBIT.dist, f: ORBIT.f };                            // 显示值（缓动逼近目标，防晕）
  var ORBIT_MIN = { yaw: -Math.PI, pitch: 12 * Math.PI / 180, dist: 10, f: 700 };
  var ORBIT_MAX = { yaw: Math.PI, pitch: 82 * Math.PI / 180, dist: 38, f: 1900 };
  var CAM = { x: 6, y: -11.5, z: 10.5, yaw: ORBIT.yaw, pitch: ORBIT.pitch, f: ORBIT.f, sx0: ORBIT.sx0, sy0: ORBIT.sy0 };
  var sinY, cosY, sinP, cosP;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function updateCam() {
    VIEW.yaw = clamp(VIEW.yaw, ORBIT_MIN.yaw, ORBIT_MAX.yaw);
    VIEW.pitch = clamp(VIEW.pitch, ORBIT_MIN.pitch, ORBIT_MAX.pitch);
    VIEW.dist = clamp(VIEW.dist, ORBIT_MIN.dist, ORBIT_MAX.dist);
    VIEW.f = clamp(VIEW.f, ORBIT_MIN.f, ORBIT_MAX.f);
    var cp = Math.cos(VIEW.pitch), sp = Math.sin(VIEW.pitch);
    CAM.x = LOOK.x + VIEW.dist * cp * Math.sin(VIEW.yaw);
    CAM.y = LOOK.y - VIEW.dist * cp * Math.cos(VIEW.yaw);
    CAM.z = LOOK.z + VIEW.dist * sp;
    CAM.yaw = VIEW.yaw; CAM.pitch = VIEW.pitch; CAM.f = VIEW.f;
    CAM.sx0 = ORBIT.sx0; CAM.sy0 = ORBIT.sy0;
    sinY = Math.sin(CAM.yaw); cosY = Math.cos(CAM.yaw);
    sinP = Math.sin(CAM.pitch); cosP = Math.cos(CAM.pitch);
  }
  // 缓动：显示值向目标值逼近，旋转更顺滑、松手有余韵，减轻眩晕
  function dampCam(dt) {
    var k = Math.min(1, (dt || 0.016) * 7);
    // 跟随：锚点平滑追随执行人员（选中工单的执行者优先，否则首个非待命人员）；关闭则回归场景中心
    var tgt = follow ? followOp() : null;
    if (tgt) { LOOK_TGT.x = tgt.x + 0.5; LOOK_TGT.y = tgt.y + 0.5; }
    else { LOOK_TGT.x = 7; LOOK_TGT.y = 7; }
    var lk = Math.min(1, (dt || 0.016) * 3);
    LOOK.x += (LOOK_TGT.x - LOOK.x) * lk;
    LOOK.y += (LOOK_TGT.y - LOOK.y) * lk;
    var dy = ORBIT.yaw - VIEW.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));   // 最短角差，避免跨 π 时反转
    VIEW.yaw += dy * k;
    VIEW.pitch += (ORBIT.pitch - VIEW.pitch) * k;
    VIEW.dist += (ORBIT.dist - VIEW.dist) * k;
    VIEW.f += (ORBIT.f - VIEW.f) * k;
    updateCam();
  }
  updateCam();
  function resetView() {
    ORBIT.yaw = 8 * Math.PI / 180; ORBIT.pitch = 66 * Math.PI / 180;
    ORBIT.dist = 23; ORBIT.f = 1240;
    VIEW.yaw = ORBIT.yaw; VIEW.pitch = ORBIT.pitch; VIEW.dist = ORBIT.dist; VIEW.f = ORBIT.f;   // 复位立即到位
    updateCam();
  }
  // 自适应分辨率：窗口变则 canvas 跟随，投影中心居中，画面始终锐利
  window.addEventListener('resize', resize);
  resize();

  // 镜头跟随（可选）：开启后锚点 LOOK 平滑追随执行人员；yaw/pitch/dist/f 仍由用户自由控制
  var follow = false;
  var LOOK_TGT = { x: LOOK.x, y: LOOK.y };
  function followOp() {
    if (focusOrder && focusOrder.op) {
      var p = S.operators.find(function (o) { return o.id === focusOrder.op; });
      if (p) return p;
    }
    for (var i = 0; i < S.operators.length; i++) if (S.operators[i].mode !== 'idle') return S.operators[i];
    return null;
  }

  function depthOf(px, py, pz) {
    var dx = px - CAM.x, dy = py - CAM.y, dz = pz - CAM.z;
    var y1 = -dx * sinY + dy * cosY;
    return y1 * cosP - dz * sinP;
  }
  function cam(px, py, pz) {
    var dx = px - CAM.x, dy = py - CAM.y, dz = pz - CAM.z;
    var x1 = dx * cosY + dy * sinY;
    var y1 = -dx * sinY + dy * cosY;
    var d = y1 * cosP - dz * sinP;
    if (d < 0.35) d = 0.35;
    var u = y1 * sinP + dz * cosP;
    return { x: CAM.sx0 + x1 * CAM.f / d, y: CAM.sy0 - u * CAM.f / d, d: d };
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function shade(hex, amt) {
    if (hex.charAt(0) !== '#') return hex;
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function quad(a, b, c, d, fill) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  // 轴对齐长方体：顶面 + 朝向相机的侧面（最多 2 个），支持 360° 环视
  function box3(x, y, z, w, d, h, colTop, colFront, colSide, outline) {
    var x1 = x + w, y1 = y + d, z1 = z + h;
    quad(cam(x, y1, z1), cam(x1, y1, z1), cam(x1, y, z1), cam(x, y, z1), colTop);
    var faces = [];
    if (CAM.y < y)  faces.push({ q: [cam(x, y, z), cam(x1, y, z), cam(x1, y, z1), cam(x, y, z1)], c: colFront });
    if (CAM.y > y1) faces.push({ q: [cam(x, y1, z), cam(x, y1, z1), cam(x1, y1, z1), cam(x1, y1, z)], c: colFront });
    if (CAM.x < x)  faces.push({ q: [cam(x, y, z), cam(x, y, z1), cam(x, y1, z1), cam(x, y1, z)], c: colSide });
    if (CAM.x > x1) faces.push({ q: [cam(x1, y, z), cam(x1, y1, z), cam(x1, y1, z1), cam(x1, y, z1)], c: colSide });
    for (var i = 0; i < faces.length; i++) {
      var f = faces[i];
      quad(f.q[0], f.q[1], f.q[2], f.q[3], f.c);
    }
    if (outline) {
      ctx.strokeStyle = 'rgba(35,45,68,.45)'; ctx.lineWidth = 1;
      for (var j = 0; j < faces.length; j++) {
        var q = faces[j].q;
        ctx.beginPath();
        for (var k = 0; k < q.length; k++) { k ? ctx.lineTo(q[k].x, q[k].y) : ctx.moveTo(q[k].x, q[k].y); }
        ctx.closePath(); ctx.stroke();
      }
    }
  }
  function softShadow(x, y, w, d, alpha) {
    var c = cam(x, y, 0.015);
    var rx = w * CAM.f / c.d, ry = d * CAM.f / c.d * 0.55;
    var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(60,70,95,' + (alpha || 0.22) + ')');
    g.addColorStop(1, 'rgba(60,70,95,0)');
    ctx.save();
    ctx.translate(c.x, c.y); ctx.scale(1, ry / Math.max(rx, ry)); ctx.translate(-c.x, -c.y);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(rx, ry), 0, 7); ctx.fill();
    ctx.restore();
  }
  function lightPool(x, y, color, radius) {
    var c = cam(x, y, 0.02);
    var r = radius * CAM.f / c.d;
    var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    g.addColorStop(0, hexA(color, 0.4));
    g.addColorStop(0.6, hexA(color, 0.15));
    g.addColorStop(1, hexA(color, 0));
    ctx.save();
    ctx.translate(c.x, c.y); ctx.scale(1, 0.5); ctx.translate(-c.x, -c.y);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill();
    ctx.restore();
  }

  // 低矮围墙：360° 环视时给空间包围感又不遮挡俯瞰内部
  var WALL_H = 2.0;
  var WALLS = [];
  function buildWalls() {
    WALLS = [];
    var t = '#d9dce2', f = '#c6c9cf', s = '#bcc0c6';
    function seg(x, y, w, d) { WALLS.push({ x: x, y: y, w: w, d: d, h: WALL_H, top: t, front: f, side: s }); }
    // 西墙（2 段）
    seg(-0.6, -0.9, 0.3, 7.9); seg(-0.6, 7.0, 0.3, 7.7);
    // 东墙（2 段）
    seg(GW + 0.3, -0.9, 0.3, 7.9); seg(GW + 0.3, 7.0, 0.3, 7.7);
    // 北墙（2 段）
    seg(-0.6, GH + 0.3, 7.9, 0.3); seg(7.3, GH + 0.3, 7.7, 0.3);
    // 南墙：留出闸机入口（缺口与门跨对齐，门柱跨度 1.4 → 外缘 x=g.x±1.53，缺口扩到 x≈-0.6..2.8 容纳左右门柱）
    seg(2.8, -0.9, 5.2, 0.3); seg(8.0, -0.9, 6.6, 0.3);
  }
  buildWalls();
  function drawWallSeg(s) {
    box3(s.x, s.y, 0, s.w, s.d, s.h, s.top, s.front, s.side, true);
    box3(s.x, s.y, s.h - 0.14, s.w, s.d, 0.14, '#26d0ce', '#1ea7a5', '#1b8f8d', false); // 顶部青色彩条
    box3(s.x, s.y, 0.05, s.w, s.d, 0.2, '#e8c33a', '#c9a530', '#b08f2a', false);          // 踢脚警示黄带
  }

  function render(now) {
    // 背景：影棚级净色渐变（降低整体白度，保留工业科技感）
    var bg = ctx.createLinearGradient(0, 0, 0, LH);
    bg.addColorStop(0, '#c8ceda'); bg.addColorStop(0.42, '#d9dfe9'); bg.addColorStop(1, '#e6eaf1');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, LW, LH);
    // 顶部天窗高光（大幅减弱，避免整屏泛白）
    var hl = ctx.createRadialGradient(LW * 0.5, LH * 0.12, 0, LW * 0.5, LH * 0.12, LW * 0.62);
    hl.addColorStop(0, 'rgba(255,255,255,.10)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(0, 0, LW, LH);
    // 室内地坪（与货架/墙体拉开明度差）
    (function () {
      var a = cam(-0.5, GH + 0.5, 0.02), b = cam(GW + 0.5, -0.2, 0.02);
      var g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, '#e0e4ec'); g.addColorStop(1, '#d2d7e0');
      quad(cam(-0.5, GH + 0.5, 0.02), cam(GW + 0.5, GH + 0.5, 0.02), cam(GW + 0.5, -0.2, 0.02), cam(-0.5, -0.2, 0.02), g);
    })();
    // 地面网格（提高对比度）
    ctx.strokeStyle = 'rgba(126,136,156,.24)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i <= GW; i += 2) { var a1 = cam(i, 0, 0.02), b1 = cam(i, GH, 0.02); ctx.moveTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); }
    for (var j = 0; j <= GH; j += 2) { var c1 = cam(0, j, 0.02), d1 = cam(GW, j, 0.02); ctx.moveTo(c1.x, c1.y); ctx.lineTo(d1.x, d1.y); }
    ctx.stroke();

    // 中央阳光光池（大幅减弱，避免地面泛白冲淡物料色）
    (function () {
      var c = cam(6, 7, 0.01);
      var r = 7 * CAM.f / c.d;
      var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, 'rgba(255,252,240,.06)');
      g.addColorStop(1, 'rgba(255,252,240,0)');
      ctx.save();
      ctx.translate(c.x, c.y); ctx.scale(1, 0.55); ctx.translate(-c.x, -c.y);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill();
      ctx.restore();
    })();

    // 通道黄色引导虚线
    ctx.strokeStyle = 'rgba(232,180,60,.55)'; ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    [1.5, 4.5, 7.5, 10.5].forEach(function (ay) {
      ctx.beginPath();
      for (var lx = 1.2; lx <= 11.9; lx += 0.5) {
        var p = cam(lx, ay, 0.02);
        lx <= 1.25 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    // 库区字母（地面喷涂）
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'center';
    RACK_ROWS.forEach(function (ry, ri) {
      var p = cam(RACK_X0 - 0.8, ry + 0.5, 0.02);
      ctx.fillStyle = 'rgba(120,130,150,.5)';
      ctx.fillText('ABCD'[ri], p.x, p.y);
    });

    // 货架长影
    ctx.fillStyle = 'rgba(70,80,105,.16)';
    RACK_ROWS.forEach(function (y) {
      var q = [cam(RACK_X0 - 1.7, y + 0.95, 0.015), cam(RACK_X1 + 1 - 1.7, y + 0.95, 0.015),
               cam(RACK_X1 + 1 - 1.7, y - 0.05, 0.015), cam(RACK_X0 - 1.7, y - 0.05, 0.015)];
      ctx.beginPath();
      q.forEach(function (p, k) { k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.closePath(); ctx.fill();
    });

    // 月台边缘 + 警示条
    box3(-0.5, -1.15, 0, GW + 1.4, 1.15, 0.55, '#c9cdd4', '#9aa0aa', '#b4b9c2');
    for (var sx = -0.5; sx < GW + 0.9; sx += 1.0) {
      var dark = Math.floor((sx + 0.5) / 1.0) % 2 === 0;
      quad(cam(sx, -1.14, 0.02), cam(sx + 1.0, -1.14, 0.02), cam(sx + 1.0, -1.14, 0.5), cam(sx, -1.14, 0.5),
        dark ? '#3a3f47' : '#e8c33a');
    }

    // LED 引导灯地面光池（受图层开关控制）
    if (layers.highlight) {
      S.slots.forEach(function (s) {
        if (!s.lit) return;
        lightPool(s.x + 0.5, s.y - 0.55, s.lit, 1.15);
      });
    }

    // 实体深度排序（含围墙，保证 360° 环视时遮挡正确）
    var ents = [];
    WALLS.forEach(function (w) { ents.push({ d: depthOf(w.x + w.w / 2, w.y + w.d / 2, w.h / 2), fn: drawWallSeg, o: w }); });
    S.slots.forEach(function (s) { ents.push({ d: depthOf(s.x + 0.5, s.y, 1.0), fn: drawSlot, o: s }); });
    S.operators.forEach(function (op) { ents.push({ d: depthOf(op.x + 0.5, op.y + 0.5, 0.85), fn: drawOp, o: op }); });
    ents.push({ d: depthOf(GATE.x, GATE.y, 1.0), fn: drawGate, o: GATE });
    ents.push({ d: depthOf(STATION.x, STATION.y, 0.8), fn: drawStation, o: STATION });
    ents.push({ d: depthOf(KIOSK.x, KIOSK.y, 1.0), fn: drawKiosk, o: KIOSK });
    ents.sort(function (a, b) { return b.d - a.d; });
    ents.forEach(function (e) { e.fn(e.o, now); });

    // 人员路径线（BFS 沿通道，绝不穿越货架）：仅聚焦工单的主路径强高亮，其余适当弱化
    if (layers.path) {
      var foOp = null;
      if (focusOrder && focusOrder.op) foOp = S.operators.find(function (p) { return p.id === focusOrder.op; }) || null;
      var hasFocus = !!focusOrder;
      S.operators.forEach(function (op) {
        if (op.mode === 'idle') return;
        var isMain = hasFocus && op === foOp && op.order === focusOrder;
        ctx.strokeStyle = hexA(op.color, hasFocus ? (isMain ? 0.92 : 0.15) : 0.5);
        ctx.lineWidth = isMain ? 3 : 1.6;
        ctx.setLineDash(isMain ? [11, 7] : [6, 7]);
        if (isMain) ctx.lineDashOffset = -((now / 40) % 18);
        ctx.beginPath();
        var from = cam(op.x + 0.5, op.y + 0.5, 0.1);
        ctx.moveTo(from.x, from.y);
        if (op.path && op.path.length) {
          op.path.forEach(function (p) { var c = cam(p.x + 0.5, p.y + 0.5, 0.1); ctx.lineTo(c.x, c.y); });
        }
        ctx.stroke();
        ctx.lineDashOffset = 0;
      });
      ctx.setLineDash([]);
    }
    // 聚焦工单：联动高亮执行人员 + 目标货架（整排）+ 具体格口（3D 线框脉冲）+ 悬浮信息牌
    if (focusOrder) {
      var fpulse = 0.5 + 0.5 * Math.sin(now / 220);
      var fo = focusOrder;
      var fop = fo.op ? S.operators.find(function (p) { return p.id === fo.op; }) : null;
      if (fop && fop.order === fo) {
        var fc = cam(fop.x + 0.5, fop.y + 0.5, 0.06);
        var fr = 0.7 * CAM.f / fc.d;
        ctx.save();
        ctx.translate(fc.x, fc.y); ctx.scale(1, 0.5); ctx.translate(-fc.x, -fc.y);
        ctx.strokeStyle = hexA(fop.color, 0.6 + fpulse * 0.35);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(fc.x, fc.y, fr * (0.95 + fpulse * 0.15), 0, 7); ctx.stroke();
        ctx.restore();
      }
      if (fo.slot) {
        var sl = fo.slot;
        // 目标货架：整排地面色带（弱化脉冲，指明所在货架）
        quad(cam(RACK_X0 - 0.15, sl.y - 0.12, 0.026), cam(RACK_X1 + 1.15, sl.y - 0.12, 0.026),
             cam(RACK_X1 + 1.15, sl.y + 1.12, 0.026), cam(RACK_X0 - 0.15, sl.y + 1.12, 0.026),
             'rgba(232,140,40,' + (0.07 + fpulse * 0.05) + ')');
        // 具体格口：地面到顶的 3D 线框（脉冲描边）
        var fz = DECK_Z[2] + BOX_H + 0.34;
        var g1 = cam(sl.x, sl.y, 0.03), g2 = cam(sl.x + 1, sl.y, 0.03),
            g3 = cam(sl.x + 1, sl.y + 1, 0.03), g4 = cam(sl.x, sl.y + 1, 0.03);
        var h1 = cam(sl.x, sl.y, fz), h2 = cam(sl.x + 1, sl.y, fz),
            h3 = cam(sl.x + 1, sl.y + 1, fz), h4 = cam(sl.x, sl.y + 1, fz);
        ctx.strokeStyle = 'rgba(232,140,40,' + (0.55 + fpulse * 0.4) + ')';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        [g1, g2, g3, g4].forEach(function (p, k) { k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        [h1, h2, h3, h4].forEach(function (p, k) { k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        [[g1, h1], [g2, h2], [g3, h3], [g4, h4]].forEach(function (e) { ctx.moveTo(e[0].x, e[0].y); ctx.lineTo(e[1].x, e[1].y); });
        ctx.stroke();
        // 悬浮信息牌：库位 · 物料编码 · 需求/进度
        var lc = cam(sl.x + 0.5, sl.y + 0.5, fz + 0.4);
        var fsku = SKUS[fo.sku];
        var ftxt = slotLabel(sl) + ' · ' + fsku.sku + ' · 需' + fo.qty + ' 已' + fo.done;
        ctx.font = '700 12px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var ftw = ctx.measureText(ftxt).width;
        ctx.fillStyle = 'rgba(255,255,255,.93)';
        ctx.fillRect(lc.x - ftw / 2 - 8, lc.y - 10, ftw + 16, 20);
        ctx.strokeStyle = '#e88c28'; ctx.lineWidth = 1.4;
        ctx.strokeRect(lc.x - ftw / 2 - 8, lc.y - 10, ftw + 16, 20);
        ctx.fillStyle = '#2b3442';
        ctx.fillText(ftxt, lc.x, lc.y);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // 视觉识别相机闪光：局部光晕（不再全屏刷白）
    S.operators.forEach(function (op) {
      if (op.flash > 0) {
        var c = cam(op.x + 0.5, op.y + 0.5, 1.35);
        var r = 1.7 * CAM.f / c.d;
        var a = Math.min(0.6, op.flash * 2.2);
        var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
        g.addColorStop(0.55, 'rgba(255,255,255,' + (a * 0.35) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill();
      }
    });

    // 屏幕空间覆盖层：先画其余人员标签（简化弱化），最后画聚焦人员标签（完整、置顶）
    var placedLabels = [];
    var foLab = (focusOrder && focusOrder.op) ? S.operators.find(function (p) { return p.id === focusOrder.op; }) : null;
    S.operators.forEach(function (op) { if (op !== foLab) overlayOp(op, placedLabels, false); });
    if (foLab) overlayOp(foLab, placedLabels, true);

    // 暗角
    var vg = ctx.createRadialGradient(LW / 2, LH / 2, LH * 0.5, LW / 2, LH / 2, LH * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,48,64,.18)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, LW, LH);
  }

  // 货架库位段：工业蓝立柱 + 安全橙横梁 + 镀锌层板 + 料箱；仅目标/执行中库位亮 LED + 地面高亮环
  function drawSlot(s) {
    var x = s.x + 0.05, y = s.y + 0.09, w = 0.88, d = 0.80;   // 收窄库位占地，增加通道可见面积（布局不变）
    var postC = '#4a6f9e', postF = '#3a587f', postS = '#2f4a6c';   // 工业蓝立柱：深色落地，边缘清晰
    var topZ = DECK_Z[2] + BOX_H + 0.3;
    box3(x - 0.04, y - 0.04, 0, 0.10, 0.10, topZ, postC, postF, postS);
    box3(x + w - 0.06, y - 0.04, 0, 0.10, 0.10, topZ, postC, postF, postS);
    box3(x - 0.04, y + d - 0.06, 0, 0.10, 0.10, topZ, postC, postF, postS);
    box3(x + w - 0.06, y + d - 0.06, 0, 0.10, 0.10, topZ, postC, postF, postS);
    var lvlCount = (s.sku === null || s.qty <= 0) ? 0 : Math.min(3, Math.ceil(s.qty / 4));
    for (var lv = 0; lv < 3; lv++) {
      var z = DECK_Z[lv];
      box3(x - 0.05, y - 0.1, z - 0.02, w + 0.1, 0.06, 0.08, '#f2a23c', '#d4831f', '#b56f14', true);   // 前横梁（更薄）
      box3(x - 0.05, y - 0.04, z, w + 0.08, d + 0.06, 0.045, '#dde2e9', '#c2c9d3', '#ccd2da', true);  // 镀锌层板（减薄，少遮挡）
      if (lv < lvlCount && s.sku !== null) {
        var col = SKUS[s.sku].color;
        var n = Math.max(1, Math.min(4, s.qty - lv * 4));
        var bw = 0.2, gap = 0.035;
        var total = n * bw + (n - 1) * gap;
        var bx = x + (w - total) / 2;
        if (lv === 0) {
          box3(bx - 0.02, y + 0.15, z + 0.07, total + 0.04, d - 0.32, 0.05, '#c59a62', '#a87f4c', '#b38953');
        }
        var bz = z + 0.07 + (lv === 0 ? 0.05 : 0);
        for (var b = 0; b < n; b++) {
          box3(bx + b * (bw + gap), y + 0.18, bz, bw, d - 0.36, BOX_H * 0.92,
            shade(col, 6), shade(col, -24), shade(col, -46), true);
          var tx = bx + b * (bw + gap) + bw / 2 - 0.02;
          quad(cam(tx, y + 0.18 + (d - 0.36), bz + BOX_H * 0.92), cam(tx + 0.04, y + 0.18 + (d - 0.36), bz + BOX_H * 0.92),
               cam(tx + 0.04, y + 0.18, bz + BOX_H * 0.92), cam(tx, y + 0.18, bz + BOX_H * 0.92), 'rgba(255,255,255,.5)');
        }
        if (s.lit) {
          quad(cam(x, y + d, bz), cam(x + w, y + d, bz), cam(x + w, y, bz), cam(x, y, bz), hexA(s.lit, 0.3));
        }
      }
      // LED 灯条：仅目标/执行中库位画（普通库位不画，大幅降噪）
      if (s.lit) {
        var barY = y - 0.02, barZ = z + 0.05, barH = 0.06;
        var barPts = function (grow) {
          return [cam(x, barY, barZ - grow), cam(x + w, barY, barZ - grow),
                  cam(x + w, barY, barZ + barH + grow), cam(x, barY, barZ + barH + grow)];
        };
        quad.apply(null, barPts(0.05).concat([hexA(s.lit, 0.18)]));
        quad.apply(null, barPts(0.02).concat([hexA(s.lit, 0.4)]));
        quad.apply(null, barPts(0).concat([hexA(s.lit, 0.95)]));
      }
    }
    // 目标/执行中库位地面高亮环（脉冲，强化视觉关联，受图层开关控制）
    if (s.lit && layers.highlight) {
      var pc = cam(s.x + 0.5, s.y + 0.5, 0.04);
      var pr = 0.62 * CAM.f / pc.d;
      var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      ctx.save();
      ctx.translate(pc.x, pc.y); ctx.scale(1, 0.5); ctx.translate(-pc.x, -pc.y);
      ctx.strokeStyle = hexA(s.lit, 0.55 + pulse * 0.35);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(pc.x, pc.y, pr * (0.9 + pulse * 0.12), 0, 7); ctx.stroke();
      ctx.restore();
    }
  }

  // 操作员：放大比例 + 朝向面板 + 通道色安全帽，扛料箱
  function drawOp(op) {
    // 近距视觉避让：与同伴过近时沿连线方向让开，避免模型重叠
    var nvx = 0, nvy = 0;
    for (var oi = 0; oi < S.operators.length; oi++) {
      var o2 = S.operators[oi];
      if (o2 === op) continue;
      var ddx = op.x - o2.x, ddy = op.y - o2.y, dd = Math.hypot(ddx, ddy);
      if (dd < 0.5) {
        if (dd > 0.02) { nvx = ddx / dd * 0.24; nvy = ddy / dd * 0.24; }
        else { nvx = op.id > o2.id ? 0.24 : -0.24; }
      }
    }
    var cx = op.x + 0.5 + nvx, cy = op.y + 0.5 + nvy;
    var sc = 1.4;                                   // 整体放大，便于辨识
    var walking = op.mode.indexOf('go') === 0 && op.path.length;
    var swing = walking ? Math.sin(op.step) * 0.18 : 0;
    softShadow(cx, cy, 0.9 * sc, 0.7 * sc, 0.25);
    var legC = '#2e3440';
    var lw = 0.17 * sc, lh = 0.52 * sc;
    box3(cx - 0.09 * sc + swing, cy - 0.10 * sc, 0, lw, 0.2 * sc, lh, legC, shade(legC, -12), shade(legC, -18));
    box3(cx - 0.09 * sc - swing, cy - 0.10 * sc, 0, lw, 0.2 * sc, lh, legC, shade(legC, -12), shade(legC, -18));
    var tw = 0.38 * sc, td = 0.28 * sc, th = 0.5 * sc;
    box3(cx - tw / 2, cy - td / 2, 0.52 * sc, tw, td, th, '#f2c231', '#d9a820', '#b98e18', true);
    quad(cam(cx - tw / 2, cy - td / 2 - 0.01, 0.66 * sc), cam(cx + tw / 2, cy - td / 2 - 0.01, 0.66 * sc),
        cam(cx + tw / 2, cy - td / 2 - 0.01, 0.84 * sc), cam(cx - tw / 2, cy - td / 2 - 0.01, 0.84 * sc), op.color);
    box3(cx - 0.24 * sc, cy - 0.16 * sc, 0.72 * sc, 0.13 * sc, 0.24 * sc, 0.34 * sc, '#f2c231', '#d9a820', '#b98e18', true);
    box3(cx + 0.11 * sc, cy - 0.16 * sc, 0.72 * sc, 0.13 * sc, 0.24 * sc, 0.34 * sc, '#f2c231', '#d9a820', '#b98e18', true);
    // 头（3D 方块）
    var hw = 0.22 * sc;
    box3(cx - hw / 2, cy - hw / 2, 1.04 * sc, hw, hw, hw, '#e9b88b', '#d49a6e', '#c2895e', true);
    // 通道色安全帽
    box3(cx - 0.13 * sc, cy - 0.13 * sc, 1.22 * sc, 0.26 * sc, 0.26 * sc, 0.14 * sc, op.color, shade(op.color, -18), shade(op.color, -28), true);
    // 朝向面板（脸）——按 faceDir 贴在头朝向侧
    var fd = op.faceDir || { dx: 0, dy: 1 };
    var ad = Math.abs(fd.dx) > Math.abs(fd.dy) ? 'x' : 'y';
    var fw = 0.14 * sc;
    if (ad === 'y') {
      var fy = fd.dy >= 0 ? cy + hw / 2 : cy - hw / 2 - 0.04 * sc;
      box3(cx - fw / 2, fy, 1.08 * sc, fw, 0.05 * sc, fw, '#3a3340', '#2a242e', '#241f27', false);
    } else {
      var fx = fd.dx >= 0 ? cx + hw / 2 : cx - hw / 2 - 0.04 * sc;
      box3(fx, cy - fw / 2, 1.08 * sc, 0.05 * sc, fw, fw, '#3a3340', '#2a242e', '#241f27', false);
    }
    // 怀里料箱
    if (op.carry) {
      var col = SKUS[op.carry.sku].color;
      box3(cx - 0.24 * sc, cy - 0.24 * sc, 0.55 * sc, 0.48 * sc, 0.48 * sc, 0.46 * sc, col, shade(col, -14), shade(col, -30), true);
    }
    // 刷脸中/签退中：头顶上方画人脸识别扫描框 + 扫描线动画（进场绿·签退灰蓝）
    if (op.work === 'face' || op.work === 'signout') {
      var hp = cam(cx, cy, 1.5 * sc);
      if (hp.d < 26) {
        var now = performance.now();
        var isOut = op.work === 'signout';
        var rgb = isOut ? '120,150,200' : '80,220,140';           // 签退灰蓝 / 进场绿
        var label = isOut ? '签退中' : '人脸识别中';
        var bw = 0.36 * sc * CAM.f / hp.d, bh = bw * 1.25;
        var scanY = ((now / 700) % 1) * bh - bh / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(' + rgb + ',.95)'; ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(' + rgb + ',.7)'; ctx.shadowBlur = 10;
        ctx.strokeRect(hp.x - bw / 2, hp.y - bh / 2, bw, bh);
        var cl = bw * 0.18;
        ctx.lineWidth = 3;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          var x0 = hp.x + c[0] * bw / 2, y0 = hp.y + c[1] * bh / 2;
          ctx.beginPath();
          ctx.moveTo(x0, y0 - c[1] * cl); ctx.lineTo(x0, y0); ctx.lineTo(x0 - c[0] * cl, y0);
          ctx.stroke();
        });
        ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hp.x - bw / 2, hp.y + scanY); ctx.lineTo(hp.x + bw / 2, hp.y + scanY); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.fillStyle = 'rgba(' + rgb + ',.95)';
        ctx.font = '600 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(label, hp.x, hp.y - bh / 2 - 4);
      }
    }
  }
  function overlayOp(op, placed, isFocus) {
    var focusMode = !!isFocus;
    if (op.mode === 'idle' && !focusMode) return;   // 待命不画；聚焦人员例外，便于追踪
    var p = cam(op.x + 0.5, op.y + 0.5, 1.98);
    if (p.d > 30) return;                        // 太远不画标签，避免拥挤
    var scale = Math.max(0.72, Math.min(1.25, 17 / p.d));
    ctx.textAlign = 'center';
    ctx.font = '700 ' + Math.round((focusMode ? 13 : 10) * scale) + 'px sans-serif';
    var st = op.mode === 'idle' ? (op.signed ? '待命' : '待签到') : op.mode === 'work' ? ({ pick: '取料', receive: '收货', verify: '校验中', confirm: '确认', place: '上架', face: '刷脸中', signout: '签退中' })[op.work] || '作业中' : op.mode === 'goFace' ? '前往门禁' : op.mode === 'goEnter' ? '进仓中' : op.mode === 'goOut' ? '出场中' : op.mode === 'goWait' ? '返回待命区' : '移动中';
    // 聚焦标签：姓名·状态·工单号（完整）；其余标签简化为 姓名·状态（弱化）
    var txt = focusMode ? (op.name + ' · ' + st + (op.order ? ' · ' + op.order.id : '')) : (op.name + ' · ' + st);
    var w = ctx.measureText(txt).width;
    var bw = w + 14, bh = focusMode ? 18 : 16;
    var py = p.y;
    // 标签防重叠：优先向上错开（避免被压到校验台/货架/工作台），再向下
    var offsets = [0, -19, -38, 19, 38];
    for (var oi = 0; oi < offsets.length; oi++) {
      var cy = p.y + offsets[oi];
      var hit = false;
      for (var k = 0; k < placed.length; k++) {
        var lb = placed[k];
        if (Math.abs(p.x - lb.x) < (bw + lb.w) / 2 + 6 && Math.abs(cy - lb.y) < (bh + 14) / 2) { hit = true; break; }
      }
      if (!hit) { py = cy; break; }
    }
    placed.push({ x: p.x, y: py, w: bw });
    // 背景：聚焦标签不透明强描边（置顶），其余半透明弱化
    ctx.fillStyle = focusMode ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.74)';
    ctx.fillRect(p.x - w / 2 - 7, py - 11, w + 14, bh);
    ctx.strokeStyle = op.color; ctx.lineWidth = focusMode ? 2 : 1.2;
    ctx.strokeRect(p.x - w / 2 - 7, py - 11, w + 14, bh);
    ctx.fillStyle = focusMode ? '#1f2a3a' : '#4a5568';
    ctx.fillText(txt, p.x, py);
    ctx.fillStyle = op.color;
    ctx.beginPath(); ctx.arc(p.x - w / 2 - 1, py - 4, 2.8, 0, 7); ctx.fill();
    if (op.mode === 'work' && (op.work === 'verify' || op.work === 'confirm') && op.order) {
      var maxT = (op.work === 'confirm' ? 0.6 : verifyTime(SKUS[op.order.sku].method));
      ctx.strokeStyle = op.color; ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(p.x, py + 14, 8 * scale, -Math.PI / 2, -Math.PI / 2 + Math.max(0, 1 - op.timer / maxT) * Math.PI * 2);
      ctx.stroke();
    }
  }

  // 人脸门禁（左侧大门）
  function drawGate(g, now) {
    // 两根粗门柱东西分列，横跨南墙缺口（跨度 1.4：门柱外缘 x=g.x±1.53，使 FACE_SPOTS x=0,1,2 全部落在门柱之间不穿柱）
    var postW = 0.26, postD = 0.36, postH = 2.0;
    var lx = g.x - 1.4, rx = g.x + 1.4;            // 左右柱中心 x（跨度加大，避开 x=0,2 落入门柱内）
    softShadow(g.x, g.y + 0.4, 3.2, 1.2, 0.22);
    box3(lx - postW / 2, g.y - postD / 2, 0, postW, postD, postH, '#6a7382', '#535c6a', '#5d6673', true);
    box3(rx - postW / 2, g.y - postD / 2, 0, postW, postD, postH, '#6a7382', '#535c6a', '#5d6673', true);
    // 顶部横梁（东西向跨接两柱）
    box3(lx - postW / 2, g.y - postD / 2, postH - 0.16, (rx - lx) + postW, postD, 0.22, '#5d6673', '#495160', '#535c6a', true);
    // 横梁上的"WMS 入口"标识板
    box3(g.x - 0.7, g.y - postD / 2 - 0.02, postH - 0.5, 1.4, 0.04, 0.34, '#26d0ce', '#1ba8a6', '#20b9b7', false);
    // 两扇摆动玻璃门页：绕门柱内侧旋转，open=0 闭合横跨门洞，open=1 向仓内(+y)摆开 90°
    // 门页宽=(门洞跨度-缝)/2≈1.27、高 1.55、薄板 y=g.y(门洞中线)；轴退离门柱边缘 0.02 防 z-fighting
    // z1 降到 1.70 避开顶部横梁（横梁底 z=postH-0.16=1.84，留 0.14 间隙防穿模）
    // 注意：全开角度必须 ≤90°，超过 90° 门页端点会扫进门柱内部造成穿模
    var open = S.gateOpen;                       // 0..1
    var ang = open * (Math.PI / 2);               // 0..90°（恰好 90°：门页贴门柱旁沿轴竖直，gap=0.02 防平行 z-fighting）
    var Wd = 1.27, z0 = 0.15, z1 = 1.70, yd = g.y, gap = 0.02;   // 门页在门洞中线 y=g.y；gap=轴退离门柱边缘的间隙
    var axL = lx + postW / 2 + gap, axR = rx - postW / 2 - gap;   // 轴退离门柱边缘，门页与门柱留 0.02m 缝防深度冲突
    // 左门页：从轴 axL 沿方向 (cos a, sin a) 摆开（闭合朝 +x 盖左半门洞，全开朝 +y 贴仓内）
    var lEx = axL + Wd * Math.cos(ang), lEy = yd + Wd * Math.sin(ang);
    // 右门页：从轴 axR 沿方向 (-cos a, sin a) 摆开（闭合朝 -x 盖右半门洞，全开朝 +y 贴仓内）
    var rEx = axR - Wd * Math.cos(ang), rEy = yd + Wd * Math.sin(ang);
    // 门页厚度 th：玻璃门页两面（朝南/朝北）+ 顶边，给门页体积感避免无厚度薄片穿模感
    var th = 0.05;
    // 门页薄板两面（玻璃半透明，开合中加橙色边光提示门机运行）
    var glassFill = 'rgba(150,195,235,' + (0.18 + open * 0.06) + ')';
    var glassFillDark = 'rgba(110,150,195,' + (0.22 + open * 0.06) + ')';
    var moving = Math.abs(S.gateTarget - S.gateOpen) > 0.02;
    var edgeColor = moving ? 'rgba(255,170,60,.9)' : 'rgba(90,120,150,.6)';
    // 门页法向（垂直门页平面，朝南的那面）：方向 (sin a, -cos a) 左门页 / (sin a, cos a) 右门页
    var lNX = Math.sin(ang), lNY = -Math.cos(ang);
    var rNX = Math.sin(ang), rNY = Math.cos(ang);
    // 左门页：朝南面（法向 -）+ 朝北面（法向 +）+ 顶边
    quad(cam(axL - lNX * th, yd - lNY * th, z0), cam(lEx - lNX * th, lEy - lNY * th, z0), cam(lEx - lNX * th, lEy - lNY * th, z1), cam(axL - lNX * th, yd - lNY * th, z1), glassFill);
    quad(cam(axL + lNX * th, yd + lNY * th, z0), cam(lEx + lNX * th, lEy + lNY * th, z0), cam(lEx + lNX * th, lEy + lNY * th, z1), cam(axL + lNX * th, yd + lNY * th, z1), glassFillDark);
    quad(cam(axL - lNX * th, yd - lNY * th, z1), cam(lEx - lNX * th, lEy - lNY * th, z1), cam(lEx + lNX * th, lEy + lNY * th, z1), cam(axL + lNX * th, yd + lNY * th, z1), 'rgba(140,180,220,.3)');
    // 右门页
    quad(cam(axR - rNX * th, yd - rNY * th, z0), cam(rEx - rNX * th, rEy - rNY * th, z0), cam(rEx - rNX * th, rEy - rNY * th, z1), cam(axR - rNX * th, yd - rNY * th, z1), glassFill);
    quad(cam(axR + rNX * th, yd + rNY * th, z0), cam(rEx + rNX * th, rEy + rNY * th, z0), cam(rEx + rNX * th, rEy + rNY * th, z1), cam(axR + rNX * th, yd + rNY * th, z1), glassFillDark);
    quad(cam(axR - rNX * th, yd - rNY * th, z1), cam(rEx - rNX * th, rEy - rNY * th, z1), cam(rEx + rNX * th, rEy + rNY * th, z1), cam(axR + rNX * th, yd + rNY * th, z1), 'rgba(140,180,220,.3)');
    // 门页边框（描门页外轮廓，开合中亮橙提示门机运行）
    ctx.strokeStyle = edgeColor; ctx.lineWidth = 1.6;
    ctx.beginPath();
    var pL = [cam(axL - lNX * th, yd - lNY * th, z0), cam(lEx - lNX * th, lEy - lNY * th, z0), cam(lEx - lNX * th, lEy - lNY * th, z1), cam(axL - lNX * th, yd - lNY * th, z1)];
    for (var iL = 0; iL < pL.length; iL++) { iL ? ctx.lineTo(pL[iL].x, pL[iL].y) : ctx.moveTo(pL[iL].x, pL[iL].y); }
    ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    var pR = [cam(axR - rNX * th, yd - rNY * th, z0), cam(rEx - rNX * th, rEy - rNY * th, z0), cam(rEx - rNX * th, rEy - rNY * th, z1), cam(axR - rNX * th, yd - rNY * th, z1)];
    for (var iR = 0; iR < pR.length; iR++) { iR ? ctx.lineTo(pR[iR].x, pR[iR].y) : ctx.moveTo(pR[iR].x, pR[iR].y); }
    ctx.closePath(); ctx.stroke();
    // 门页把手（随门页端点，约 z=1.0 高）：小亮色圆点
    var lhL = cam(lEx - 0.12 * Math.cos(ang), lEy - 0.12 * Math.sin(ang), 1.0);
    var lhR = cam(rEx + 0.12 * Math.cos(ang), rEy - 0.12 * Math.sin(ang), 1.0);
    ctx.fillStyle = '#3a4350';
    ctx.beginPath(); ctx.arc(lhL.x, lhL.y, Math.max(2.5, 0.06 * CAM.f / lhL.d), 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(lhR.x, lhR.y, Math.max(2.5, 0.06 * CAM.f / lhR.d), 0, 7); ctx.fill();
    // 人脸识别屏（嵌在左柱朝南面）
    box3(lx - postW / 2 - 0.02, g.y - 0.22, 1.25, 0.04, 0.46, 0.34, '#1d2b33', '#15222a', '#1a2830', false);
    if (CAM.y < g.y) {
      var sc = cam(lx - postW / 2 - 0.04, g.y, 1.42);
      ctx.save();
      ctx.shadowColor = 'rgba(38,208,206,.9)'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#26d0ce';
      ctx.beginPath(); ctx.arc(sc.x, sc.y, 0.09 * CAM.f / sc.d, 0, 7); ctx.fill();
      ctx.restore();
      // 扫描框十字线
      ctx.strokeStyle = 'rgba(38,208,206,.6)'; ctx.lineWidth = 1;
      var fw = 0.18 * CAM.f / sc.d;
      ctx.strokeRect(sc.x - fw, sc.y - fw * 0.6, fw * 2, fw * 1.2);
    }
    // 门禁通行指示灯（右柱顶，仅正面可见）：有人刷脸→黄闪；空闲→绿
    if (CAM.y < g.y + 0.6) {
      var lc = cam(rx, g.y, postH - 0.3);
      var someoneFace = S.operators.some(function (op) { return op.work === 'face'; });
      var someoneOut = S.operators.some(function (op) { return op.work === 'signout'; });
      var lampC = someoneOut ? '230,80,70' : someoneFace ? '255,200,40' : '80,220,120';
      var pulse = (someoneOut || someoneFace) ? (0.5 + Math.sin(now / 160) * 0.4) : (0.5 + Math.sin(now / 400) * 0.2);
      ctx.save();
      ctx.shadowColor = 'rgba(' + lampC + ',.95)'; ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(' + lampC + ',' + pulse + ')';
      ctx.beginPath(); ctx.arc(lc.x, lc.y, 5, 0, 7); ctx.fill();
      ctx.restore();
    }
    // 闸机外排队区地面标线（南墙外，进场等候；拉远到 y=g.y-1.6..-4.4 覆盖场外待命区全程）
    ctx.strokeStyle = 'rgba(255,200,40,.45)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    [g.y - 1.6, g.y - 2.4, g.y - 3.2, g.y - 4.0].forEach(function (yy) {
      var a = cam(lx - 0.1, yy, 0.02), b = cam(rx + 0.1, yy, 0.02);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    // 收货区标线（门内侧地面）
    quad(cam(lx - 0.1, g.y + 0.5, 0.03), cam(rx + 0.1, g.y + 0.5, 0.03),
        cam(rx + 0.1, g.y + 1.5, 0.03), cam(lx - 0.1, g.y + 1.5, 0.03), 'rgba(38,208,206,.12)');
    // 收货区边线
    ctx.strokeStyle = 'rgba(38,208,206,.5)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    [g.y + 0.5, g.y + 1.5].forEach(function (yy) {
      var a = cam(lx - 0.1, yy, 0.03), b = cam(rx + 0.1, yy, 0.03);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // 校验结算台：电子秤 + 扫码枪 + 相机
  function drawStation(st) {
    softShadow(st.x, st.y, 2.0, 1.6, 0.22);
    box3(st.x - 0.9, st.y - 0.55, 0, 1.8, 1.1, 0.85, '#e8eaef', '#c3c9d3', '#d5dae2');
    box3(st.x - 0.9, st.y - 0.55, 0.1, 0.1, 0.1, 0.75, '#9aa2ae', '#7e8794', '#8b94a1');
    // 电子秤
    box3(st.x - 0.72, st.y - 0.35, 0.85, 0.55, 0.5, 0.09, '#f4f6f9', '#c9cfd9', '#dde2e9');
    box3(st.x - 0.68, st.y + 0.12, 0.94, 0.4, 0.06, 0.2, '#26d0ce', '#1ba8a6', '#20b9b7');
    // 扫码枪
    box3(st.x + 0.0, st.y - 0.3, 0.85, 0.07, 0.07, 0.42, '#3a4350', '#2b323d', '#333b47');
    box3(st.x - 0.08, st.y - 0.38, 1.27, 0.24, 0.16, 0.22, '#2e3440', '#1f242d', '#272d38');
    // 工业相机
    box3(st.x + 0.42, st.y - 0.15, 0.85, 0.08, 0.08, 1.25, '#5d6673', '#495160', '#535c6a');
    box3(st.x + 0.28, st.y - 0.35, 2.0, 0.36, 0.3, 0.28, '#3a4350', '#2b323d', '#333b47');
    // 工业相机镜头发光（仅正面可见）
    if (CAM.y < st.y) {
      var lens = cam(st.x + 0.46, st.y - 0.2, 2.08);
      ctx.save();
      ctx.shadowColor = 'rgba(80,160,255,.8)'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#6ea8ff';
      ctx.beginPath(); ctx.arc(lens.x, lens.y, 0.05 * CAM.f / lens.d, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  // 作业终端（触控一体机）
  function drawKiosk(k) {
    softShadow(k.x, k.y, 1.0, 0.9, 0.22);
    box3(k.x - 0.06, k.y - 0.35, 0, 0.12, 0.12, 1.15, '#5d6673', '#495160', '#535c6a');
    box3(k.x - 0.42, k.y - 0.42, 1.15, 0.84, 0.1, 0.62, '#26d0ce', '#1ba8a6', '#20b9b7');
    var sTop = cam(k.x - 0.36, k.y - 0.435, 1.7), sBot = cam(k.x - 0.36, k.y - 0.435, 1.22);
    quad(sTop, cam(k.x + 0.36, k.y - 0.435, 1.7), cam(k.x + 0.36, k.y - 0.435, 1.22), sBot, '#0e2a30');
    ctx.strokeStyle = 'rgba(38,208,206,.75)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (var i = 0; i <= 4; i++) {
      var px = k.x - 0.3 + i * 0.15;
      var pz = 1.32 + Math.abs(Math.sin(i * 1.7 + k.x)) * 0.3;
      var p = cam(px, k.y - 0.44, pz);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // ---------- HUD ----------
  var el = function (id) { return document.getElementById(id); };
  function fmt(n) { return Math.round(n).toLocaleString('zh-CN'); }
  function stockInfo() {
    var total = 0, cap = S.slots.length * SLOT_CAP;
    S.slots.forEach(function (s) { total += s.qty; });
    S.operators.forEach(function (op) { if (op.carry) total += op.carry.qty; });   // 在途未结算仍计入
    return { total: total, cap: cap, occ: total / cap };
  }
  function refreshHUD() {
    var si = stockInfo();
    var active = S.orders.filter(function (o) { return o.status === 'active'; }).length;
    var failed = S.orders.filter(function (o) { return o.status === 'failed'; }).length;
    el('money').textContent = '💰 ¥' + fmt(money);
    el('k-stock').textContent = fmt(si.total);
    el('k-in').textContent = fmt(S.stats.inQty);
    el('k-out').textContent = fmt(S.stats.outQty);
    el('k-active').textContent = active;
    el('k-fail').textContent = failed;
    setDonut('d1', 'd1v', Math.round(si.occ * 100));
    var rate = (S.stats.done + failed) ? Math.round(S.stats.done / (S.stats.done + failed) * 100) : null;
    setDonut('d2', 'd2v', rate);
  }
  function setDonut(ringId, valId, pct) {
    var ring = el(ringId);
    if (pct === null) { el(valId).textContent = '–'; ring.style.background = 'conic-gradient(#e6ebf3 0deg)'; return; }
    ring.style.background = 'conic-gradient(#26d0ce ' + (pct * 3.6) + 'deg, #e6ebf3 0deg)';
    el(valId).textContent = pct + '%';
  }

  // ---------- 面板 ----------
  var openPanel = null;
  var selected = null;   // 右侧详情选中对象（op / slot / order）
  var focusOrder = null; // 左侧点击聚焦的工单（高亮其人员/目标库位/路线）
  var layers = { path: true, highlight: true };   // 图层开关
  function closeOverlays() {
    document.querySelectorAll('.overlay').forEach(function (p) { p.classList.remove('open'); });
    document.querySelectorAll('.overlay-btn').forEach(function (b) { b.classList.remove('on'); });
    openPanel = null;
  }
  function togglePanel(name) {
    var p = el('panel-' + name);
    if (openPanel === name) { closeOverlays(); return; }
    closeOverlays();
    p.classList.add('open');
    var btn = document.querySelector('.overlay-btn[data-panel="' + name + '"]');
    if (btn) btn.classList.add('on');
    openPanel = name;
    refreshPanels();
  }
  document.querySelectorAll('.overlay-btn').forEach(function (b) {
    b.onclick = function () { togglePanel(b.getAttribute('data-panel')); beep(600, 0.05, 'sine', 0.03); };
  });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = closeOverlays; });
  // 图层开关
  el('layer-path').onclick = function () { layers.path = !layers.path; this.classList.toggle('on', layers.path); };
  el('layer-hl').onclick = function () { layers.highlight = !layers.highlight; this.classList.toggle('on', layers.highlight); };
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') closeOverlays();
    if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); el('pause').onclick(); }
  });
  function refreshPanels() {
    if (openPanel === 'inv') refreshInv();
    else if (openPanel === 'team') refreshTeam();
    else if (openPanel === 'dash') refreshDash();
  }
  // 常驻侧栏：左侧工单 + 右侧详情（始终刷新）
  function refreshSidebars() {
    refreshOrders();
    refreshInfo();
  }
  function refreshInfo() {
    if (selected && selected.kind === 'op' && S.operators.indexOf(selected.o) >= 0) showInfo({ kind: 'op', o: selected.o }, true);
    else if (selected && selected.kind === 'slot' && S.slots.indexOf(selected.o) >= 0) showInfo({ kind: 'slot', o: selected.o }, true);
    else if (selected && selected.kind === 'order' && S.orders.indexOf(selected.o) >= 0) showInfo({ kind: 'order', o: selected.o }, true);
    else refreshRoster();
  }
  function refreshRoster() {
    el('info-title').textContent = '人员任务详情';
    var html = '<div class="t2" style="padding:2px 2px 8px;color:#8a95a6;font-size:10px">点击场景中的工人或库位查看详情</div>';
    S.operators.forEach(function (op) {
      var st = op.mode === 'idle' ? (op.signed ? '待命' : '待签到') : op.mode === 'work' ? (op.work === 'face' ? '刷脸中' : op.work === 'signout' ? '签退中' : '作业中') : op.mode === 'goFace' ? '前往门禁' : op.mode === 'goEnter' ? '进仓中' : op.mode === 'goOut' ? '出场中' : op.mode === 'goWait' ? '返回待命区' : '移动中';
      html += '<div class="fl-row"><div class="ic"><span class="ch-dot" style="background:' + op.color + ';color:' + op.color + '"></span></div>' +
        '<div class="info"><div class="t1">' + op.name + '</div>' +
        '<div class="t2">' + st + (op.order ? ' · ' + op.order.id : '') + '</div></div></div>';
    });
    el('info-body').innerHTML = html;
  }
  function bar(pct, cls) {
    return '<div class="bar"><i class="' + (cls || '') + '" style="width:' + Math.max(0, Math.min(100, pct * 100)) + '%"></i></div>';
  }
  var ST_BADGE = { queued: ['badge-wait', '待执行'], active: ['badge-run', '进行中'], done: ['badge-ok', '已完成'], failed: ['badge-fail', '异常'], cancelled: ['badge-wait', '已取消'] };
  function refreshOrders() {
    var html = '<div class="t2" style="padding:2px 2px 8px;color:#8a95a6;font-size:10px">出库 ORDER · 入库 ASN · 无单领料 MUL</div>';
    var list = S.orders.slice(-14).reverse();
    if (!list.length) html += '<div class="t2" style="padding:8px;color:#8a95a6">暂无工单，等待 WMS 下发…</div>';
    list.forEach(function (o) {
      var sku = SKUS[o.sku];
      var tb = ST_BADGE[o.status];
      var typeTxt = o.type === 'in' ? '入库' : o.type === 'mul' ? '无单领料' : '出库';
      var prog = o.done / o.qty;
      var focusCls = (focusOrder === o) ? ' tr-focus' : '';
      var wmsBadge = o.status === 'done'
        ? (o.wms === 'sent'
          ? '<span class="badge badge-wms-ok">WMS已报·模拟</span>'
          : o.wms === 'failed'
            ? '<span class="badge badge-wms-fail">WMS上报失败</span>'
            : '<span class="badge badge-wms-wait">WMS待报</span>')
        : '';
      var reasonTxt = (o.status === 'queued' && o.reason) ? ' · <i style="color:#d9932b">' + o.reason + '</i>' : '';
      html += '<div class="tr-row' + (o.status === 'failed' ? ' row-fail' : '') + (o.status === 'cancelled' ? ' row-fail' : '') + focusCls + '" data-order="' + o.id + '" style="cursor:pointer">' +
        '<span class="badge ' + tb[0] + '">' + tb[1] + '</span>' + wmsBadge +
        '<div class="info"><div class="t1">' + o.id + ' · ' + typeTxt + (o.op ? ' · ' + o.op + ' 执行' : '') + '</div>' +
        '<div class="t2"><span class="sku-dot" style="background:' + sku.color + '"></span>' + sku.name +
        ' (' + METHOD_TXT[sku.method] + ') · ' + o.done + '/' + o.qty + ' 件' +
        (o.status === 'failed' ? ' · <b style="color:#d84a38">' + o.reason + '</b>' : '') + reasonTxt + '</div>' +
        bar(prog, o.status === 'done' ? 'ok' : o.status === 'failed' ? 'warn' : o.status === 'cancelled' ? 'warn' : '') +
        (o.status === 'active' ? '<button class="mini-btn" data-settle="' + o.id + '">部分结算</button>' : '') +
        (o.status === 'queued' || o.status === 'active' ? '<button class="mini-btn" data-cancel="' + o.id + '">取消</button>' : '') +
        '</div></div>';
    });
    el('orders-body').innerHTML = html;
    document.querySelectorAll('[data-order]').forEach(function (r) {
      r.onclick = function (ev) {
        if (ev.target.classList.contains('mini-btn')) return;   // 结算/取消按钮不触发
        var o = S.orders.find(function (k) { return k.id === r.getAttribute('data-order'); });
        if (o) { focusOrder = o; selected = { kind: 'order', o: o }; showInfo({ kind: 'order', o: o }); refreshOrders(); beep(640, 0.05, 'sine', 0.03); }
      };
    });
    var mb = el('mul-btn');
    if (mb) mb.onclick = spawnMul;
    document.querySelectorAll('[data-settle]').forEach(function (b) {
      b.onclick = function () { partialSettle(b.getAttribute('data-settle')); refreshOrders(); };
    });
    document.querySelectorAll('[data-cancel]').forEach(function (b) {
      b.onclick = function () { cancelOrder(b.getAttribute('data-cancel')); refreshOrders(); };
    });
  }
  function refreshInv() {
    var html = '<div class="inv-grid">';
    S.materials.forEach(function (m) {   // 用统一 Material 实体：显示总量/可用/预留
      var bins = S.slots.filter(function (s) { return s.sku === m.idx && s.qty > 0; }).length;
      var availColor = m.available < 5 ? '#d84a38' : m.available < 15 ? '#d9932b' : '#37b464';
      html += '<div class="inv-card"><div class="n"><span class="sku-dot" style="background:' + m.color + '"></span>' + m.name + '</div>' +
        '<div class="v">' + m.stock + ' <small style="font-size:11px;color:#8a95a6">件</small></div>' +
        '<div class="s">' + m.sku + ' · ' + METHOD_TXT[m.method] + ' · ' + bins + ' 库位</div>' +
        '<div class="s" style="margin-top:2px">可用 <b style="color:' + availColor + '">' + m.available + '</b> · 预留 <b style="color:#d9932b">' + m.reserved + '</b></div></div>';
    });
    var si = stockInfo();
    var totalReserved = S.slots.reduce(function (a, s) { return a + (s.reserved || 0); }, 0);
    html += '</div><div class="t2" style="padding:8px 4px;color:#8a95a6;font-size:11px">库存总量 ' + si.total + ' / ' + si.cap + ' 件 · 预留 ' + totalReserved + ' 件 · 库位编号 = 区域-排-位（每库位 ' + SLOT_CAP + ' 件）</div>';
    el('inv-body').innerHTML = html;
  }
  function refreshTeam() {
    var html = '';
    S.operators.forEach(function (op) {
      var st = op.mode === 'idle' ? (op.signed ? '待命（作业终端旁）' : '待签到') : op.mode === 'work' ? (op.work === 'face' ? '刷脸中' : op.work === 'signout' ? '签退中' : '作业中') : op.mode === 'goFace' ? '前往门禁' : op.mode === 'goEnter' ? '进仓中' : op.mode === 'goOut' ? '出场中' : op.mode === 'goWait' ? '返回待命区' : '移动中';
      html += '<div class="fl-row"><div class="ic"><span class="ch-dot" style="background:' + op.color + ';color:' + op.color + '"></span></div>' +
        '<div class="info"><div class="t1">' + op.name + ' <span class="lv">' + op.id + ' · ' + st + (op.carry ? ' · 扛 ' + SKUS[op.carry.sku].name + ' ×' + op.carry.qty : '') + '</span></div>' +
        '<div class="t2">LED 通道色 <span class="sku-dot" style="background:' + op.color + '"></span> · 完成工单 ' + op.done + ' 单</div></div></div>';
    });
    var upW = UP_WALK * (S.upWalk + 1);
    html += '<div class="up-row"><div class="info"><div class="t1">步伐提速 Lv.' + S.upWalk + ' → ' + (S.upWalk + 1) + '</div>' +
      '<div class="t2">全体操作员移动 +15% · ¥' + upW + '</div></div>' +
      '<button class="buy-btn" id="up-walk" ' + (S.upWalk < 5 && money >= upW ? '' : 'disabled') + '>升级</button></div>';
    var upV = UP_VERIFY * (S.upVerify + 1);
    html += '<div class="up-row"><div class="info"><div class="t1">校验提速 Lv.' + S.upVerify + ' → ' + (S.upVerify + 1) + '</div>' +
      '<div class="t2">计重/扫码/视觉 校验 -8% 耗时 · ¥' + upV + '</div></div>' +
      '<button class="buy-btn" id="up-verify" ' + (S.upVerify < 5 && money >= upV ? '' : 'disabled') + '>升级</button></div>';
    el('team-body').innerHTML = html;
    var uw = el('up-walk');
    if (uw) uw.onclick = function () {
      if (money < upW || S.upWalk >= 5) return;
      money -= upW; S.upWalk++;
      toast('步伐提速 Lv.' + S.upWalk + '！', 'ok'); beep(760, 0.12, 'sine', 0.05);
      refreshTeam(); refreshHUD();
    };
    var uv = el('up-verify');
    if (uv) uv.onclick = function () {
      if (money < upV || S.upVerify >= 5) return;
      money -= upV; S.upVerify++;
      toast('校验提速 Lv.' + S.upVerify + '！', 'ok'); beep(800, 0.12, 'sine', 0.05);
      refreshTeam(); refreshHUD();
    };
  }
  function refreshDash() {
    var st = S.stats;
    var totalReserved = S.slots.reduce(function (a, s) { return a + (s.reserved || 0); }, 0);
    var html = '<div class="rep-grid">' +
      '<div class="rep-card"><label>库存总量</label><b>' + fmt(stockInfo().total) + '</b></div>' +
      '<div class="rep-card"><label>预留量</label><b style="color:#d9932b">' + fmt(totalReserved) + '</b></div>' +
      '<div class="rep-card"><label>今日入库</label><b>' + fmt(st.inQty) + '</b></div>' +
      '<div class="rep-card"><label>今日出库</label><b>' + fmt(st.outQty) + '</b></div>' +
      '<div class="rep-card"><label>完成工单</label><b>' + fmt(st.done) + '</b></div>' +
      '<div class="rep-card"><label>异常工单</label><b style="color:' + (st.failed ? '#d84a38' : '#37b464') + '">' + fmt(st.failed) + '</b></div>' +
      '<div class="rep-card"><label>已取消</label><b>' + fmt(st.cancelled) + '</b></div>' +
      '</div>';
    html += '<div class="chart-label">每 15 秒吞吐量（最近 ' + Math.max(1, st.buckets.length) + ' 桶）</div><div class="chart">';
    var moves = st.buckets.slice(-16);
    var max = Math.max.apply(null, moves.concat([1]));
    moves.forEach(function (m) { html += '<i style="height:' + Math.max(4, m / max * 100) + '%"></i>'; });
    html += '</div>';
    // 库存流水（InventoryTransaction）：最近 8 条出入库调整记录
    html += '<div class="chart-label">库存流水（最近 ' + Math.min(8, S.ledger.length) + ' 条 · 入/出/调整）</div><div class="logbox">';
    S.ledger.slice(0, 8).forEach(function (tx) {
      var kindTxt = tx.kind === 'in' ? '入库' : tx.kind === 'out' ? '出库' : '调整';
      var kindColor = tx.kind === 'in' ? '#37b464' : tx.kind === 'out' ? '#d84a38' : '#d9932b';
      html += '<div class="log-line">[' + Math.floor(tx.t / 60) + ':' + String(Math.floor(tx.t % 60)).padStart(2, '0') + '] <b style="color:' + kindColor + '">' + kindTxt + '</b> ' +
        (tx.sku !== null && tx.sku !== undefined ? SKUS[tx.sku].name : '?') + ' ×' + tx.qty + ' · ' + tx.slot + ' · ' + tx.detail + '</div>';
    });
    if (!S.ledger.length) html += '<div class="t2" style="padding:4px;color:#8a95a6">暂无流水</div>';
    html += '</div>';
    var fails = S.orders.filter(function (o) { return o.status === 'failed'; });
    html += '<div class="chart-label">异常工单（标红告警）</div>';
    if (!fails.length) html += '<div class="t2" style="padding:4px;color:#37b464">暂无异常 ✔</div>';
    fails.forEach(function (o) {
      html += '<div class="tr-row row-fail"><span class="badge badge-fail">异常</span>' +
        '<div class="info"><div class="t1">' + o.id + '</div><div class="t2">' + SKUS[o.sku].name + ' · ' + o.reason + '</div></div></div>';
    });
    // 业务事件（WarehouseEvent）：最近 10 条结构化事件
    html += '<div class="chart-label">业务事件（最近 ' + Math.min(10, S.events.length) + ' 条）</div><div class="logbox">';
    S.events.slice(0, 10).forEach(function (ev) {
      var evColor = ev.result === 'fail' ? '#d84a38' : ev.result === 'warn' ? '#d9932b' : '#37b464';
      html += '<div class="log-line">[' + Math.floor(ev.t / 60) + ':' + String(Math.floor(ev.t % 60)).padStart(2, '0') + '] <b style="color:' + evColor + '">' + ev.kind + '</b> ' +
        (ev.objectId || '') + ' · ' + (ev.detail || '') + (ev.error ? ' · ' + ev.error : '') + '</div>';
    });
    if (!S.events.length) html += '<div class="t2" style="padding:4px;color:#8a95a6">暂无事件</div>';
    html += '</div>';
    html += '<div class="chart-label">实时日志</div><div class="logbox">';
    st.logs.slice(0, 10).forEach(function (l) {
      html += '<div class="log-line log-' + l.type + '">[' + Math.floor(l.t / 60) + ':' + String(Math.floor(l.t % 60)).padStart(2, '0') + '] ' + l.msg + '</div>';
    });
    html += '</div>';
    el('dash-body').innerHTML = html;
  }

  // ---------- 鼠标交互：拖动旋转 + 滚轮缩放 + 点击拾取 ----------
  var drag = { active: false, down: false, x0: 0, y0: 0, moved: 0 };
  canvas.addEventListener('mousedown', function (e) {
    drag.down = true; drag.active = false; drag.x0 = e.clientX; drag.y0 = e.clientY; drag.moved = 0;
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', function (e) {
    if (!drag.down) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    if (drag.moved > 4) {
      drag.active = true;
      ORBIT.yaw -= dx * 0.0032;                       // 灵敏度减半，防晕
      ORBIT.pitch = clamp(ORBIT.pitch + dy * 0.0026, ORBIT_MIN.pitch, ORBIT_MAX.pitch);
      drag.x0 = e.clientX; drag.y0 = e.clientY;
    }
  });
  window.addEventListener('mouseup', function (e) {
    var wasDrag = drag.active;
    drag.down = false; drag.active = false;
    canvas.style.cursor = 'grab';
    if (wasDrag) return;                       // 拖动结束，不触发拾取
    // 视为点击 → 命中检测
    var rect = canvas.getBoundingClientRect();
    var sx = (e.clientX - rect.left) / rect.width * LW;
    var sy = (e.clientY - rect.top) / rect.height * LH;
    if (sx < 0 || sy < 0 || sx > LW || sy > LH) return;
    var best = null, bestD = 1e9;
    function consider(d2, kind, obj) { if (d2 < bestD) { bestD = d2; best = { kind: kind, o: obj }; } }
    S.operators.forEach(function (op) {
      var p = cam(op.x + 0.5, op.y + 0.5, 0.8);
      var d2 = (p.x - sx) * (p.x - sx) + (p.y - sy) * (p.y - sy);
      if (d2 < 34 * 34) consider(d2, 'op', op);
    });
    S.slots.forEach(function (s) {
      var p = cam(s.x + 0.5, s.y + 0.4, 1.0);
      var d2 = (p.x - sx) * (p.x - sx) + (p.y - sy) * (p.y - sy);
      if (d2 < 34 * 34) consider(d2, 'slot', s);
    });
    if (best) showInfo(best);
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var factor = e.deltaY > 0 ? 1.1 : 0.9;
    ORBIT.dist = clamp(ORBIT.dist * factor, ORBIT_MIN.dist, ORBIT_MAX.dist);
    ORBIT.f = clamp(ORBIT.f * (2 - factor), ORBIT_MIN.f, ORBIT_MAX.f);
  }, { passive: false });
  // 触屏支持（单指旋转、双指捏合缩放）
  var pinch = null;
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      drag.down = true; drag.active = false; drag.x0 = e.touches[0].clientX; drag.y0 = e.touches[0].clientY; drag.moved = 0;
    } else if (e.touches.length === 2) {
      drag.down = false;
      var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
      pinch = Math.hypot(dx, dy);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', function (e) {
    if (e.touches.length === 1 && drag.down) {
      var dx = e.touches[0].clientX - drag.x0, dy = e.touches[0].clientY - drag.y0;
      drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      if (drag.moved > 4) { drag.active = true; e.preventDefault(); }
      ORBIT.yaw -= dx * 0.0032;
      ORBIT.pitch = clamp(ORBIT.pitch + dy * 0.0026, ORBIT_MIN.pitch, ORBIT_MAX.pitch);
      drag.x0 = e.touches[0].clientX; drag.y0 = e.touches[0].clientY;
    } else if (e.touches.length === 2 && pinch) {
      e.preventDefault();
      var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
      var d = Math.hypot(dx, dy);
      var factor = pinch / d;
      ORBIT.dist = clamp(ORBIT.dist * factor, ORBIT_MIN.dist, ORBIT_MAX.dist);
      ORBIT.f = clamp(ORBIT.f / factor, ORBIT_MIN.f, ORBIT_MAX.f);
      pinch = d;
    }
  }, { passive: false });
  canvas.addEventListener('touchend', function (e) {
    if (e.touches.length === 0) { drag.down = false; drag.active = false; pinch = null; }
  });
  canvas.style.cursor = 'grab';
  function showInfo(hit, isRefresh) {
    if (!isRefresh) {
      selected = { kind: hit.kind, o: hit.o };   // 记录选中（右侧常驻栏）
      if (hit.kind !== 'order') focusOrder = null;   // 点击人员/库位时取消工单聚焦
    }
    var title = '', body = '';
    if (hit.kind === 'order') {
      var o = hit.o, sku = SKUS[o.sku];
      var tb = ST_BADGE[o.status];
      var typeTxt = o.type === 'in' ? '入库 ASN' : o.type === 'mul' ? '无单领料 MUL' : '出库 ORDER';
      var op = o.op ? S.operators.find(function (p) { return p.id === o.op; }) : null;
      title = '📋 ' + o.id;
      body = kv('类型', typeTxt) +
        kv('状态', '<span class="badge ' + tb[0] + '">' + tb[1] + '</span>') +
        kv('物料', '<span class="sku-dot" style="background:' + sku.color + '"></span>' + sku.name + '（' + sku.sku + '）') +
        kv('校验方式', METHOD_TXT[sku.method]) +
        kv('需求数量', o.qty + ' 件') +
        kv('已完成', o.done + ' / ' + o.qty + ' 件') +
        kv('执行人', op ? op.name + '（' + o.op + '）' : '待分配') +
        kv('目标库位', o.slot ? slotLabel(o.slot) : (o.status === 'failed' ? '—' : '待匹配')) +
        kv('WMS 上报', o.status !== 'done' ? '未上报' : (o.wms === 'sent' ? '已确认（模拟上报）' : '上报中（模拟）')) +
        bar(o.done / o.qty, o.status === 'done' ? 'ok' : o.status === 'failed' ? 'warn' : '') +
        (o.status === 'failed' ? kv('异常原因', '<b style="color:#d84a38">' + o.reason + '</b>') : '') +
        (op && op.mode !== 'idle' ? kv('人员状态', op.mode === 'work' ? '作业中（' + ({ pick: '取料', receive: '收货', verify: '校验中', confirm: '确认', place: '上架', face: '刷脸', signout: '签退' })[op.work] + '）' : (op.mode === 'goFace' ? '前往门禁' : op.mode === 'goEnter' ? '进仓中' : op.mode === 'goOut' ? '出场中' : op.mode === 'goWait' ? '返回待命区' : '移动中')) : '');
    } else if (hit.kind === 'op') {
      var op = hit.o;
      title = '🚶 ' + op.name + '（' + op.id + '）';
      var stTxt = op.mode === 'idle' ? (op.signed ? '待命' : '待签到') : op.mode === 'work' ? '作业中（' + ({ pick: '取料', receive: '收货', verify: '校验', confirm: '确认', place: '上架', face: '刷脸', signout: '签退' })[op.work] + '）' : (op.mode === 'goFace' ? '前往门禁' : op.mode === 'goEnter' ? '进仓中' : op.mode === 'goOut' ? '出场中' : op.mode === 'goWait' ? '返回待命区' : '移动中');
      body = kv('LED 通道色', '<span class="sku-dot" style="background:' + op.color + '"></span> 通道色') +
        kv('签到', op.signed ? '已刷脸签到' : '未签到') +
        kv('状态', stTxt) +
        kv('朝向', op.faceDir ? (Math.abs(op.faceDir.dx) > Math.abs(op.faceDir.dy) ? (op.faceDir.dx > 0 ? '东' : '西') : (op.faceDir.dy > 0 ? '北' : '南')) : '—') +
        kv('当前工单', op.order ? op.order.id + ' · ' + (op.order.type === 'in' ? '入库' : op.order.type === 'mul' ? '无单领料' : '出库') : '无') +
        kv('目标库位', op.slot ? slotLabel(op.slot) : (op.mode === 'goGate' ? '收货闸机' : op.mode === 'goFace' ? '人脸门禁' : op.mode === 'goEnter' ? '待命位' : op.mode === 'goOut' ? '闸机屏前(签退)' : op.mode === 'goWait' ? '场外待命区' : '—')) +
        kv('怀料', op.carry ? SKUS[op.carry.sku].name + ' ×' + op.carry.qty : '无') +
        kv('完成工单', op.done + ' 单') +
        (op.order ? bar(op.order.done / op.order.qty, op.order.status === 'failed' ? 'warn' : '') : '');
    } else {
      var s = hit.o;
      title = '📦 库位 ' + slotLabel(s);
      // 关联到该库位的活跃工单需求
      var demand = S.orders.filter(function (o) { return o.slot === s && (o.status === 'active' || o.status === 'queued'); });
      var demandTxt = demand.length ? demand.map(function (d) { return d.id + ' 需 ' + (d.qty - d.done) + ' 件'; }).join('；') : '无';
      body = s.sku === null ? kv('状态', '空库位') + kv('LED', s.lit ? '亮灯引导中' : '熄灭') + kv('关联需求', demandTxt)
        : kv('物料编码', SKUS[s.sku].sku) +
          kv('物料名称', SKUS[s.sku].name) +
          kv('管理方式', METHOD_TXT[SKUS[s.sku].method]) +
          kv('现有库存', s.qty + ' / ' + SLOT_CAP + ' 件') +
          kv('批次', s.batch) +
          kv('关联需求', demandTxt) +
          kv('库位状态', s.lit ? '引导亮灯中' : '空闲');
    }
    el('info-title').textContent = title;
    el('info-body').innerHTML = body;
  }
  function kv(k, v) { return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>'; }

  // ---------- 顶栏控制 ----------
  el('mul-btn').onclick = spawnMul;
  el('reset-view').onclick = function () { resetView(); beep(540, 0.06, 'sine', 0.03); };
  el('follow').onclick = function () {
    follow = !follow;
    el('follow').classList.toggle('on', follow);
    el('follow').textContent = follow ? '🎥 跟随中' : '🎥 跟随';
    beep(560, 0.05, 'sine', 0.03);
  };
  el('pause').onclick = function () {
    S.paused = !S.paused;
    el('pause').textContent = S.paused ? '▶ 继续' : '⏸ 暂停';
    el('pause').classList.toggle('on', S.paused);
  };
  el('speed').onclick = function () {
    S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1;
    el('speed').textContent = S.speed + '×';
  };
  // 暂停/恢复自动派发（保留手动派发能力）
  el('pause-dispatch').onclick = function () {
    S.dispatchPaused = !S.dispatchPaused;
    el('pause-dispatch').classList.toggle('on', S.dispatchPaused);
    el('pause-dispatch').textContent = S.dispatchPaused ? '▶ 派发暂停' : '⏸ 派发';
    addEvent('dispatch_toggle', null, S.dispatchPaused ? 'warn' : 'ok', '', S.dispatchPaused ? '已暂停自动派发' : '已恢复自动派发');
    addLog((S.dispatchPaused ? '已暂停' : '已恢复') + '自动派发', 'op');
    beep(580, 0.06, 'sine', 0.03);
  };
  // 手动派发一次（暂停派发时可用，强制触发一次 assignOrders）
  el('manual-dispatch').onclick = function () {
    assignOrders();
    addEvent('manual_dispatch', null, 'ok', '', '手动触发派发');
    addLog('手动派发一次', 'op');
    beep(620, 0.06, 'sine', 0.03);
  };

  // ---------- 启动 ----------
  initState();
  refreshHUD();
  setTimeout(function () { el('hint').style.opacity = '0'; }, 12000);

  window.__iso = {
    get S() { return S; }, tick: tick, spawnOrder: spawnOrder, spawnMul: spawnMul, cam: cam, depthOf: depthOf,
    get focusOrder() { return focusOrder; },     // 测试钩子：读取当前聚焦工单
    get LOOK() { return LOOK; },                 // 测试钩子：读取相机锚点
    selectOrder: function (id) {                // 测试钩子：等价于左侧点击工单
      var o = S.orders.find(function (k) { return k.id === id; });
      if (o) { focusOrder = o; selected = { kind: 'order', o: o }; showInfo({ kind: 'order', o: o }); }
      return o || null;
    },
    setFollow: function (v) { follow = !!v; return follow; }   // 测试钩子：切换跟随
  };

  var last = performance.now();
  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    if (!S.paused) {
      for (var k = 0; k < S.speed; k++) tick(dt);
    }
    dampCam(dt);
    render(now);
    if (!loop.acc) loop.acc = 0;
    loop.acc += dt;
    if (loop.acc > 0.4) { loop.acc = 0; refreshHUD(); refreshSidebars(); refreshPanels(); }
    requestAnimationFrame(function () { loop(performance.now()); });
  }
  requestAnimationFrame(function () { loop(performance.now()); });
})();
