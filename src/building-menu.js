/* ============================================================================
 * Warcrest — building-menu.js
 * Thronefall-style radial production menu around selected buildings (canvas).
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;
  var open = false;
  var building = null;
  var items = [];

  var BTN_R = 26;
  var HIT_PAD = 22;

  var imgCache = {};

  function UI() { return RTS.UI || {}; }

  function getImg(url) {
    if (!url) return null;
    var c = imgCache[url];
    if (!c) {
      c = new Image();
      c.src = url;
      imgCache[url] = c;
    }
    return c.complete && c.naturalWidth ? c : null;
  }

  function buildItemList(s, b) {
    var out = [];
    var fid = s.playerFaction;
    var spec = RTS.Buildings[b.type];

    if (RTS.isDepositBuilding(b) && b.built) {
      out.push({
        kind: 'automine',
        bid: b.id,
        icon: 'hammer',
        portrait: null,
        cost: 0,
        disabled: false,
        label: b.autoMine ? 'Auto ON' : 'Auto OFF',
        on: !!b.autoMine,
      });
    }

    if (spec.trains && spec.trains.length) {
      spec.trains.forEach(function (role) {
        var us = RTS.Units[role];
        var afford = s.res.player.halcite >= us.cost;
        var supplyOk = s.res.player.supplyUsed + us.supply <= s.res.player.supplyCap;
        out.push({
          kind: 'train',
          bid: b.id,
          role: role,
          icon: null,
          portrait: UI().unitAvatarUrl ? UI().unitAvatarUrl(fid, role) : '',
          cost: us.cost,
          disabled: !b.built || !afford || !supplyOk,
          label: RTS.nameFor(fid, role),
        });
      });
    }

    return out;
  }

  function menuRadius(b, n) {
    var size = Math.max(b.w, b.h);
    var base = 90 + size * 0.35;
    if (n > 5) base += (n - 5) * 8;
    return Math.min(140, Math.max(95, base));
  }

  function layoutItems(s, b, list) {
    var n = list.length;
    if (!n) return [];
    var radius = menuRadius(b, n);
    var startAng = -Math.PI * 0.88;
    var endAng = -Math.PI * 0.12;
    var span = endAng - startAng;
    var step = n === 1 ? 0 : span / (n - 1);
    var cy = b.y - b.h * 0.15;

    return list.map(function (item, i) {
      var ang = n === 1 ? -Math.PI / 2 : startAng + step * i;
      var laid = Object.assign({}, item, {
        x: b.x + Math.cos(ang) * radius,
        y: cy + Math.sin(ang) * radius,
        r: BTN_R,
      });
      return laid;
    });
  }

  function hitSlop(s) {
    return HIT_PAD / s.camera.zoom;
  }

  function drawCircleBtn(ctx, item, s, hovered) {
    var r = item.r;
    var disabled = item.disabled;
    var fill = disabled ? 'rgba(40,40,40,0.72)' : (item.on ? 'rgba(76,175,80,0.88)' : 'rgba(21,101,192,0.9)');
    var stroke = hovered && !disabled ? '#fff' : '#1a1208';

    ctx.beginPath();
    ctx.arc(item.x, item.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = hovered && !disabled ? 3.5 : 2.5;
    ctx.stroke();

    var iconR = r * 0.62;
    var img = null;
    if (item.portrait) img = getImg(item.portrait);
    if (!img && item.icon) img = getImg(UI().iconUrl(item.icon));

    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(item.x, item.y - 2, iconR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, item.x - iconR, item.y - 2 - iconR, iconR * 2, iconR * 2);
      ctx.restore();
    } else if (item.kind === 'automine') {
      ctx.font = 'bold 11px Fredoka, system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(item.on ? 'ON' : 'OFF', item.x, item.y + 4);
    }

    if (item.cost > 0) {
      var gold = getImg(UI().iconUrl('gold'));
      var costY = item.y + r + 10;
      ctx.font = 'bold 11px Fredoka, system-ui';
      ctx.textAlign = 'left';
      var tx = item.x - 8;
      if (gold) {
        ctx.drawImage(gold, tx - 10, costY - 9, 10, 10);
        tx += 2;
      }
      ctx.fillStyle = disabled ? '#ef9a9a' : '#ffc107';
      ctx.strokeStyle = '#1a1208';
      ctx.lineWidth = 2;
      ctx.strokeText(String(item.cost), tx, costY);
      ctx.fillText(String(item.cost), tx, costY);
    }
  }

  function drawQueueBadge(ctx, b, s) {
    if (b.team !== TEAM.PLAYER || !b.built || !b.queue.length) return;
    if (!RTS.isProductionBuilding(b)) return;

    var bx = b.x;
    var by = b.y - b.h / 2 - 14;
    var n = b.queue.length;
    var badgeR = n > 9 ? 13 : 11;

    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = '#1565c0';
    ctx.fill();
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = 'bold ' + (n > 9 ? 11 : 13) + 'px Fredoka, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(String(n), bx, by + 1);

    var job = b.queue[0];
    if (job && job.total && job.remaining != null) {
      var pct = Math.max(0, Math.min(1, 1 - job.remaining / job.total));
      var ringR = badgeR + 5;
      ctx.beginPath();
      ctx.arc(bx, by, ringR, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.strokeStyle = RTS.hexA('#69f0ae', 0.9);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  RTS.BuildingMenu = {
    isOpen: function () { return open; },

    open: function (s, b) {
      if (!b || b.dead || b.team !== TEAM.PLAYER) { this.close(s); return false; }
      var list = buildItemList(s, b);
      if (!list.length) { this.close(s); return false; }
      building = b;
      items = layoutItems(s, b, list);
      items.forEach(function (item) {
        if (item.portrait) getImg(item.portrait);
        if (item.icon) getImg(UI().iconUrl(item.icon));
      });
      getImg(UI().iconUrl('gold'));
      open = true;
      return true;
    },

    close: function (s) {
      open = false;
      building = null;
      items = [];
    },

    refresh: function (s) {
      if (!open || !building) return;
      var b = RTS.getById(s, building.id);
      if (!b || b.dead) { this.close(s); return; }
      building = b;
      items = layoutItems(s, b, buildItemList(s, b));
      if (!items.length) this.close(s);
    },

    layout: function (s) {
      if (!open || !building) return [];
      return items;
    },

    hitTest: function (s, wx, wy) {
      if (!open || !items.length) return null;
      var slop = hitSlop(s);
      var best = null;
      var bd = Infinity;
      items.forEach(function (item) {
        var d = RTS.dist(wx, wy, item.x, item.y);
        if (d <= item.r + slop && d < bd) {
          bd = d;
          best = item;
        }
      });
      return best;
    },

    execute: function (s, item) {
      if (!item) return false;
      if (item.disabled) {
        RTS.Audio.play('deny');
        return false;
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
          return false;
      }
      if (RTS.HUD && RTS.HUD.performAction) RTS.HUD.performAction(s, data);
      this.refresh(s);
      return true;
    },

    draw: function (ctx, s) {
      s.entities.buildings.forEach(function (b) {
        if (b.team === TEAM.PLAYER && b.built) drawQueueBadge(ctx, b, s);
      });

      if (!open || !building || building.dead) return;
      var b = RTS.getById(s, building.id);
      if (!b) return;
      building = b;

      var hover = s.ui.buildingMenuHover;
      items.forEach(function (item) {
        drawCircleBtn(ctx, item, s, hover === item);
      });
    },

    drawAllQueueBadges: function (ctx, s) {
      s.entities.buildings.forEach(function (b) {
        drawQueueBadge(ctx, b, s);
      });
    },
  };
})(window.RTS = window.RTS || {});
