/* ============================================================================
 * Warcrest — radial-menu.js
 * Hybrid B: cream cards on a right-thumb arc, anchored to selected buildings.
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

  /* Clockwise from due-east (screen: bulge right, spread vertical). */
  var PRIMARY_ANGLES = [-Math.PI / 6, 0, Math.PI / 6, Math.PI / 3];
  var PRIMARY_RADIUS = 160;
  var SECONDARY_RADIUS = 230;
  var MAX_PRIMARY = 5;

  function UI() { return RTS.UI || {}; }

  function goldCoinSrc() {
    return UI().iconUrl ? UI().iconUrl('gold') : COIN_ICON;
  }

  function unitAvatarSrc(factionId, role) {
    return UI().unitAvatarUrl ? UI().unitAvatarUrl(factionId, role) : '';
  }

  function buildingAvatarSrc(factionId, type) {
    return UI().buildingUrl ? UI().buildingUrl(factionId, type) : '';
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
        avatar: unitAvatarSrc(fid, 'pawn'),
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
          avatar: unitAvatarSrc(fid, role),
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
          avatar: buildingAvatarSrc(fid, type),
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

  function arcFlip(s, scrX) {
    var cv = RTS.canvas;
    if (!cv) return false;
    var margin = 88;
    return scrX + PRIMARY_RADIUS + 72 > cv.clientWidth - margin;
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

      var stateHtml = item.state
        ? '<span class="rcard-state">' + item.state + '</span>'
        : '';

      btn.innerHTML =
        '<img class="rcard-avatar" src="' + avatar + '" alt="">' +
        '<span class="rcard-name">' + item.label + '</span>' +
        stateHtml +
        costHtml;

      if (!item.disabled) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          ev.preventDefault();
          if (!ctx) return;
          execute(ctx.s, item);
          RTS.RadialMenu.close();
          if (navigator.vibrate) navigator.vibrate(10);
        });
      }

      hub.appendChild(btn);
    }

    primary.forEach(function (item, i) {
      var ang = PRIMARY_ANGLES[i] != null
        ? PRIMARY_ANGLES[i]
        : PRIMARY_ANGLES[PRIMARY_ANGLES.length - 1] + (i - PRIMARY_ANGLES.length + 1) * (Math.PI / 8);
      placeCard(item, i, ang, PRIMARY_RADIUS);
    });

    secondary.forEach(function (item, i) {
      var ang = PRIMARY_ANGLES[i % PRIMARY_ANGLES.length];
      placeCard(item, MAX_PRIMARY + i, ang, SECONDARY_RADIUS);
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
      if (d < 52 && d < bestD) { bestD = d; best = c.idx; }
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
    var scr = buildingScreenCenter(s, b);
    ctx.cssX = scr.x;
    ctx.cssY = scr.y;
    ctx.flip = arcFlip(s, scr.x);
    if (root) {
      root.style.left = scr.x + 'px';
      root.style.top = scr.y + 'px';
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

    bm.hitTest = function () { return null; };
    bm.execute = function () { return false; };
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

      var scr = buildingScreenCenter(s, building);
      var flip = arcFlip(s, scr.x);
      var c = s.camera;

      ctx = {
        s: s,
        building: building,
        buildingId: building.id,
        cssX: scr.x,
        cssY: scr.y,
        wx: wx,
        wy: wy,
        hit: building,
        flip: flip,
        camX: c.x,
        camY: c.y,
      };

      root.style.left = scr.x + 'px';
      root.style.top = scr.y + 'px';
      root.classList.toggle('arc-flip', flip);
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
      this.close();
      if (item && !item.disabled) {
        execute(s, item);
        if (navigator.vibrate) navigator.vibrate(10);
        return true;
      }
      return false;
    },

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
