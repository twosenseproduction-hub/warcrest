/* ============================================================================
 * Warcrest — radial-menu.js
 * Icon-only radial arc, anchored to selected buildings.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;
  var open = false;
  var root, hub;
  var ctx = null;
  var items = [];
  var activeIdx = -1;
  var keyHandler = null;

  var COIN_ICON = 'assets/tiny-swords/UI%20Elements/UI%20Elements/Icons/Icon_03.png';
  var HAMMER_ICON = 'assets/tiny-swords/Terrain/Resources/Tools/Tool_01.png';

  /* Fan on the building shoulder — tight to sprite edge, spaced by item count. */
  var PRIMARY_RADIUS = 72;
  var SECONDARY_RADIUS = 112;
  var MAX_PRIMARY = 5;
  var MENU_EDGE_GAP = 2;
  var SHOULDER_INSET = 24; /* pull hub toward building so rings sit on the silhouette */
  var SHOULDER_Y = 0.36; /* anchor height: fraction from tight top toward foot */
  var BUTTON_CENTER_GAP = 76; /* min px between 58px ring centers */
  var MAX_ARC = Math.PI * 0.72;
  var BUTTON_HALF = 29;

  function arcAngles(count, radius) {
    if (count <= 0) return [];
    if (count === 1) return [0];
    var minAng = 2 * Math.asin(Math.min(1, BUTTON_CENTER_GAP / (2 * radius)));
    var arc = Math.min(MAX_ARC, minAng * (count - 1));
    arc = Math.max(arc, minAng);
    var start = -arc / 2;
    var step = arc / (count - 1);
    var out = [];
    for (var i = 0; i < count; i++) out.push(start + step * i);
    return out;
  }

  function UI() { return RTS.UI || {}; }

  function goldCoinSrc() {
    return UI().iconUrl ? UI().iconUrl('gold') : COIN_ICON;
  }

  function unitAvatarSrc(factionId, role) {
    return UI().unitAvatarUrl ? UI().unitAvatarUrl(factionId, role) : '';
  }

  function hammerSrc() {
    return HAMMER_ICON;
  }

  function resolveBuilding(s, hit) {
    if (!hit || hit.kind !== 'building' || hit.team !== TEAM.PLAYER || hit.dead) return null;
    return RTS.getById(s, hit.id) || hit;
  }


  function buildItems(s, building) {
    if (!building) return [];
    var out = [];
    var fid = s.playerFaction;
    var spec = RTS.Buildings[building.type];
    if (!spec) return [];

    if (RTS.isDepositBuilding && RTS.isDepositBuilding(building)) {
      out.push({
        id: 'automine-' + building.id,
        kind: 'automine',
        bid: building.id,
        label: 'AUTO-MINE',
        state: building.autoMine ? 'ON' : 'OFF',
        avatar: HAMMER_ICON,
        cost: 0,
        disabled: !building.built,
      });
    }

    if (spec.trains && spec.trains.length && building.built) {
      spec.trains.forEach(function (role) {
        var us = RTS.Units[role];
        if (!us) return;
        var afford = s.res.player.halcite >= us.cost;
        var supplyOk = s.res.player.supplyUsed + us.supply <= s.res.player.supplyCap;
        out.push({
          id: 'train-' + role + '-' + building.id,
          kind: 'train',
          bid: building.id,
          role: role,
          label: RTS.nameFor(fid, role).toUpperCase(),
          avatar: UI().roleTrayIcon ? UI().roleTrayIcon(fid, role, 34) : unitAvatarSrc(fid, role),
          cost: us.cost,
          disabled: !afford || !supplyOk,
        });
      });
    }

    if (RTS.activeWorkers(s).length && building.built &&
        (building.type === 'core' || building.type === 'outpost')) {
      RTS.BuildMenu.forEach(function (type) {
        var bspec = RTS.Buildings[type];
        if (!bspec) return;
        var afford = s.res.player.halcite >= bspec.cost;
        out.push({
          id: 'build-' + type,
          kind: 'build',
          type: type,
          label: RTS.nameFor(fid, type).toUpperCase(),
          avatar: HAMMER_ICON,
          cost: bspec.cost,
          disabled: !afford,
        });
      });
    }

    return out;
  }

  function buildingScreenCenter(s, b) {
    return RTS.Cam.worldToScreen(s, b.x, b.y);
  }

  function menuAnchor(s, b) {
    var zoom = s.camera.zoom || 1;
    var vb = RTS.Assets && RTS.Assets.buildingVisualBounds
      ? RTS.Assets.buildingVisualBounds(b, s) : null;
    var center = buildingScreenCenter(s, b);
    var halfW;
    var anchorY;
    var flip;

    if (vb && vb.tight) {
      var t = vb.tight;
      var left = RTS.Cam.worldToScreen(s, t.x, b.y);
      var right = RTS.Cam.worldToScreen(s, t.x + t.w, b.y);
      var top = RTS.Cam.worldToScreen(s, b.x, t.y);
      var bot = RTS.Cam.worldToScreen(s, b.x, t.y + t.h);
      halfW = Math.abs(right.x - left.x) / 2;
      anchorY = top.y + (bot.y - top.y) * SHOULDER_Y;
      flip = arcFlip(s, center.x, halfW);
      var edgeX = flip ? left.x : right.x;
      var inset = SHOULDER_INSET * zoom;
      return {
        x: edgeX + (flip ? inset - MENU_EDGE_GAP : -inset + MENU_EDGE_GAP),
        y: anchorY,
        flip: flip,
      };
    }

    halfW = Math.max(b.w, b.h) * 0.32 * zoom;
    anchorY = center.y - (vb ? vb.drawH * 0.06 * zoom : 0);
    flip = arcFlip(s, center.x, halfW);
    var insetFallback = SHOULDER_INSET * zoom;
    return {
      x: center.x + (flip
        ? -(halfW + MENU_EDGE_GAP) + insetFallback
        : halfW + MENU_EDGE_GAP - insetFallback),
      y: anchorY,
      flip: flip,
    };
  }

  function arcFlip(s, centerX, halfW) {
    var cv = RTS.canvas;
    if (!cv) return false;
    var margin = 56;
    var extent = PRIMARY_RADIUS + BUTTON_HALF + 8;
    var anchorX = centerX + halfW - SHOULDER_INSET + MENU_EDGE_GAP;
    return anchorX + extent > cv.clientWidth - margin;
  }

  function wireCardTap(btn, fn) {
    var lastAt = 0;
    function run(ev) {
      if (ev.type === 'pointerup' && ev.pointerType === 'mouse' && ev.button !== 0) return;
      var now = performance.now();
      if (now - lastAt < 280) return;
      lastAt = now;
      ev.stopPropagation();
      ev.preventDefault();
      fn(ev);
    }
    btn.addEventListener('pointerup', run);
    btn.addEventListener('click', run);
  }

  function layoutItems(s) {
    if (!hub || !items.length || !ctx || !ctx.building) return;
    hub.innerHTML = '';

    var flip = ctx.flip;
    var primary = items.slice(0, MAX_PRIMARY);
    var secondary = items.slice(MAX_PRIMARY);

    function placeCard(item, globalIdx, ang, radius) {
      var useAng = flip ? Math.PI - ang : ang;
      var rx = Math.round(Math.cos(useAng) * radius);
      var ry = Math.round(Math.sin(useAng) * radius);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rcard' + (item.disabled ? ' disabled' : '');
      btn.dataset.idx = String(globalIdx);
      btn.style.setProperty('--rx', rx + 'px');
      btn.style.setProperty('--ry', ry + 'px');
      btn.disabled = !!item.disabled;

      var avatar = item.avatar || '';
      var costHtml = item.cost > 0
        ? '<span class="rcard-cost"><img class="rcard-coin" src="' + goldCoinSrc() +
          '" alt="">' + item.cost + '</span>'
        : '';
      var avatarHtml = typeof item.avatar === 'string' && item.avatar.indexOf('<') >= 0
        ? item.avatar
        : (avatar ? '<img class="rcard-avatar" src="' + avatar + '" alt="">' : '');

      btn.innerHTML =
        '<span class="rcard-ring" aria-hidden="true"></span>' +
        '<span class="rcard-body">' +
        avatarHtml +
        costHtml +
        '</span>';

      if (!item.disabled) {
        wireCardTap(btn, function () {
          if (!ctx || !open) return;
          var idx = parseInt(btn.dataset.idx, 10);
          var live = items[idx];
          if (!live || live.disabled) return;
          execute(ctx.s, live);
          refresh(ctx.s);
          if (navigator.vibrate) navigator.vibrate(10);
        });
      }

      hub.appendChild(btn);
    }

    var primaryAngles = arcAngles(primary.length, PRIMARY_RADIUS);
    var secondaryAngles = arcAngles(secondary.length, SECONDARY_RADIUS);

    primary.forEach(function (item, i) {
      placeCard(item, i, primaryAngles[i], PRIMARY_RADIUS);
    });

    secondary.forEach(function (item, i) {
      placeCard(item, MAX_PRIMARY + i, secondaryAngles[i], SECONDARY_RADIUS);
    });

    highlight(activeIdx);
  }

  function highlight(idx) {
    activeIdx = idx;
    if (!hub) return;
    var nodes = hub.querySelectorAll('.rcard');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('active', i === idx);
    }
  }

  function cardCenters() {
    if (!hub || !RTS.canvas) return [];
    var canvasRect = RTS.canvas.getBoundingClientRect();
    var nodes = hub.querySelectorAll('.rcard');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var rect = nodes[i].getBoundingClientRect();
      out.push({
        x: rect.left + rect.width / 2 - canvasRect.left,
        y: rect.top + rect.height / 2 - canvasRect.top,
        idx: i,
      });
    }
    return out;
  }

  function pickAt(cssX, cssY) {
    if (!open || !items.length) return -1;
    var best = -1;
    var bestD = Infinity;
    cardCenters().forEach(function (c) {
      var d = Math.hypot(cssX - c.x, cssY - c.y);
      if (d < 34 && d < bestD) { bestD = d; best = c.idx; }
    });
    return best;
  }

  function execute(s, item) {
    if (!item || item.disabled) {
      RTS.Audio.play('deny');
      return;
    }
    var data;
    switch (item.kind) {
      case 'train':
        data = { act: 'train', role: item.role, bid: item.bid };
        break;
      case 'build':
        data = { act: 'build', type: item.type };
        break;
      case 'automine':
        data = { act: 'toggle-automine', bid: item.bid };
        break;
      default:
        return;
    }
    if (RTS.HUD && RTS.HUD.performAction) RTS.HUD.performAction(s, data);
    else if (item.kind === 'train') {
      var b = RTS.getById(s, item.bid);
      if (b) RTS.train(s, b, item.role);
    }
    RTS.HUD.sync(s);
    if (open) refresh(s);
  }

  function shouldClose(s) {
    if (!ctx) return true;
    var b = RTS.getById(s, ctx.buildingId);
    if (!b || b.dead) return true;
    if (s.selectedIds.indexOf(ctx.buildingId) < 0) return true;
    var c = s.camera;
    if (Math.abs(c.x - ctx.camX) > 1.5 || Math.abs(c.y - ctx.camY) > 1.5) return true;
    return false;
  }

  function refresh(s) {
    if (!open || !ctx) return;
    if (shouldClose(s)) { RTS.RadialMenu.close(); return; }
    var b = RTS.getById(s, ctx.buildingId);
    if (!b) { RTS.RadialMenu.close(); return; }
    ctx.building = b;
    items = buildItems(s, b);
    if (!items.length) { RTS.RadialMenu.close(); return; }
    var anchor = menuAnchor(s, b);
    ctx.cssX = anchor.x;
    ctx.cssY = anchor.y;
    ctx.flip = anchor.flip;
    if (root) {
      root.style.left = anchor.x + 'px';
      root.style.top = anchor.y + 'px';
      root.classList.toggle('arc-flip', anchor.flip);
    }
    layoutItems(s);
  }

  function bindEscape() {
    if (keyHandler) return;
    keyHandler = function (e) {
      if (e.key === 'Escape' && open) RTS.RadialMenu.close();
    };
    document.addEventListener('keydown', keyHandler);
  }

  function unbindEscape() {
    if (!keyHandler) return;
    document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }

  function installBuildingBridge() {
    if (!RTS.BuildingMenu || RTS.BuildingMenu._radialBridged) return;
    RTS.BuildingMenu._radialBridged = true;
    var bm = RTS.BuildingMenu;
    var origClose = bm.close.bind(bm);
    var origDraw = bm.draw.bind(bm);

    bm.open = function (s, b) {
      origClose(s);
      var scr = RTS.Cam.worldToScreen(s, b.x, b.y);
      return RTS.RadialMenu.open(s, scr.x, scr.y, b.x, b.y, b);
    };

    bm.close = function (s) {
      RTS.RadialMenu.close();
      origClose(s);
    };

    bm.isOpen = function () {
      return RTS.RadialMenu.isOpen();
    };

    bm.draw = function (ctx2d, s) {
      if (RTS.BuildingMenu.drawAllQueueBadges) {
        RTS.BuildingMenu.drawAllQueueBadges(ctx2d, s);
      } else {
        origDraw(ctx2d, s);
      }
    };

    bm.refresh = function (s) {
      if (RTS.RadialMenu.isOpen()) refresh(s);
    };

    bm.hitTest = function (s, wx, wy) {
      if (!RTS.RadialMenu.isOpen()) return null;
      var scr = RTS.Cam.worldToScreen(s, wx, wy);
      var idx = pickAt(scr.x, scr.y);
      if (idx < 0) return null;
      return items[idx] || null;
    };

    bm.execute = function (s, menuItem) {
      if (!menuItem || menuItem.disabled) return false;
      execute(s, menuItem);
      refresh(s);
      return true;
    };
  }

  RTS.RadialMenu = {
    isOpen: function () { return open; },

    open: function (s, cssX, cssY, wx, wy, hit) {
      if (!root) root = document.getElementById('radial-menu');
      if (!root) return false;
      hub = root.querySelector('.radial-hub');
      if (!hub) return false;

      var building = resolveBuilding(s, hit);
      if (!building) return false;

      items = buildItems(s, building);
      if (!items.length) return false;

      var anchor = menuAnchor(s, building);
      var c = s.camera;

      ctx = {
        s: s,
        building: building,
        buildingId: building.id,
        cssX: anchor.x,
        cssY: anchor.y,
        wx: wx,
        wy: wy,
        hit: building,
        flip: anchor.flip,
        camX: c.x,
        camY: c.y,
      };

      root.style.left = anchor.x + 'px';
      root.style.top = anchor.y + 'px';
      root.classList.toggle('arc-flip', anchor.flip);
      layoutItems(s);
      root.classList.remove('hidden');
      open = true;
      bindEscape();
      if (navigator.vibrate) navigator.vibrate(14);
      return true;
    },

    close: function () {
      if (!root) return;
      root.classList.add('hidden');
      root.classList.remove('arc-flip');
      open = false;
      ctx = null;
      items = [];
      activeIdx = -1;
      unbindEscape();
      if (hub) hub.innerHTML = '';
    },

    move: function (cssX, cssY) {
      if (!open || !ctx) return;
      if (shouldClose(ctx.s)) { this.close(); return; }
      highlight(pickAt(cssX, cssY));
    },

    release: function (cssX, cssY) {
      if (!open || !ctx) { this.close(); return false; }
      var idx = pickAt(cssX, cssY);
      var item = idx >= 0 ? items[idx] : null;
      var s = ctx.s;
      if (item && !item.disabled) {
        execute(s, item);
        highlight(-1);
        if (navigator.vibrate) navigator.vibrate(10);
        return true;
      }
      this.close();
      return false;
    },

    pickAt: pickAt,

    refresh: refresh,
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installBuildingBridge);
    } else {
      installBuildingBridge();
    }
  }
})(window.RTS = window.RTS || {});
