/* ============================================================================
 * Warcrest — radial-menu.js
 * Double-tap + hold context wheel (V1): move, attack-move, stop, army, workers, mine.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;
  var open = false;
  var root, hub;
  var ctx = null;
  var items = [];
  var activeIdx = -1;

  var ICONS = {
    sword: 'assets/tiny-swords/UI%20Elements/UI%20Elements/Icons/Icon_05.png',
    arrow: 'assets/tiny-swords/UI%20Elements/UI%20Elements/Icons/Icon_08.png',
    cancel: 'assets/tiny-swords/UI%20Elements/UI%20Elements/Icons/Icon_09.png',
    gold: 'assets/tiny-swords/UI%20Elements/UI%20Elements/Icons/Icon_03.png',
    hammer: 'assets/tiny-swords/UI%20Elements/UI%20Elements/Icons/Icon_01.png',
  };

  function nearestWorker(s, wx, wy) {
    var best = null, bd = Infinity;
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== TEAM.PLAYER || u.role !== 'pawn') return;
      var d = RTS.dist(wx, wy, u.x, u.y);
      if (d < bd) { bd = d; best = u; }
    });
    return best;
  }

  function hasWorkers(s) {
    return s.entities.units.some(function (u) {
      return !u.dead && u.team === TEAM.PLAYER && u.role === 'pawn';
    });
  }

  function buildItems(s, hit) {
    var out = [];
    var seen = {};
    function add(id, label, icon) {
      if (seen[id]) return;
      seen[id] = true;
      out.push({ id: id, label: label, icon: icon || 'sword' });
    }

    var sel = RTS.selectedUnits(s);
    var combat = sel.filter(function (u) { return u.role !== 'pawn'; });
    var workers = sel.filter(function (u) { return u.role === 'pawn'; });
    var enemy = hit && (hit.kind === 'unit' || hit.kind === 'building') && hit.team === TEAM.ENEMY;

    if (hit && hit.kind === 'resource' && hit.amount > 0 && hasWorkers(s)) {
      add('mine', 'Mine', 'gold');
    }
    if (enemy && combat.length) {
      add('attack', 'Attack', 'sword');
      add('attackmove', 'Atk move', 'arrow');
    }
    if (combat.length || workers.length) {
      if (!enemy) {
        add('move', 'Move', 'arrow');
        if (combat.length) add('attackmove', 'Atk move', 'sword');
        add('stop', 'Stop', 'cancel');
      }
    }
    add('army', 'Army', 'sword');
    add('workers', 'Pawns', 'hammer');
    return out.slice(0, 5);
  }

  function flash(s, wx, wy, color) {
    RTS.addEffect(s, { kind: 'cmd', x: wx, y: wy, life: 0.34, max: 0.34, color: color, r: 10 });
  }

  function execute(s, item) {
    if (!item || !ctx) return;
    var hit = ctx.hit;
    var wx = ctx.wx;
    var wy = ctx.wy;
    var sel = RTS.selectedUnits(s);
    var combat = sel.filter(function (u) { return u.role !== 'pawn'; });
    var workers = sel.filter(function (u) { return u.role === 'pawn'; });
    var pal = RTS.Factions[s.playerFaction];

    switch (item.id) {
      case 'mine':
        if (hit && hit.kind === 'resource') {
          if (workers.length) {
            workers.forEach(function (w) { RTS.orderHarvest(s, w, hit.id); });
          } else {
            var nw = nearestWorker(s, hit.x, hit.y);
            if (nw) {
              RTS.select(s, nw.id, false);
              RTS.orderHarvest(s, nw, hit.id);
            }
          }
          RTS.Audio.play('move');
          RTS.toast(s, 'Mining Halcite');
        }
        break;
      case 'attack':
        if (hit && combat.length) {
          RTS.orderAttack(s, combat, hit.id);
          flash(s, wx, wy, '#ff5a5a');
        }
        break;
      case 'attackmove':
        if (combat.length) {
          RTS.orderMove(s, combat, wx, wy, true);
          flash(s, wx, wy, '#ff9a3c');
          RTS.toast(s, 'Attack-move');
        }
        break;
      case 'move':
        if (combat.length) {
          RTS.orderMove(s, combat, wx, wy, false);
          flash(s, wx, wy, pal.primary);
        } else if (workers.length) {
          RTS.orderMove(s, workers, wx, wy, false);
          flash(s, wx, wy, pal.primary);
        }
        break;
      case 'stop':
        if (sel.length) RTS.orderStop(s, sel);
        break;
      case 'army':
        RTS.selectAllArmy(s);
        RTS.toast(s, 'Army selected');
        break;
      case 'workers':
        if (RTS.selectAllWorkers(s)) RTS.toast(s, 'Pawns selected');
        break;
    }
    RTS.HUD.sync(s);
  }

  function layoutItems() {
    if (!hub || !items.length) return;
    hub.innerHTML = '';
    var n = items.length;
    var radius = n <= 3 ? 58 : 68;
    items.forEach(function (item, i) {
      var ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'radial-item';
      btn.dataset.idx = String(i);
      btn.style.setProperty('--rx', Math.round(Math.cos(ang) * radius) + 'px');
      btn.style.setProperty('--ry', Math.round(Math.sin(ang) * radius) + 'px');
      btn.innerHTML = '<img src="' + (ICONS[item.icon] || ICONS.sword) + '" alt="" />' +
        '<span>' + item.label + '</span>';
      hub.appendChild(btn);
    });
    highlight(-1);
  }

  function highlight(idx) {
    activeIdx = idx;
    if (!hub) return;
    var nodes = hub.querySelectorAll('.radial-item');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('active', i === idx);
    }
  }

  function pickAt(cssX, cssY) {
    if (!ctx || !items.length) return -1;
    var dx = cssX - ctx.cssX;
    var dy = cssY - ctx.cssY;
    var dist = Math.hypot(dx, dy);
    if (dist < 22) return -1;
    if (dist > 110) return -1;
    var ang = Math.atan2(dy, dx);
    var n = items.length;
    var best = -1;
    var bestDiff = Infinity;
    for (var i = 0; i < n; i++) {
      var itemAng = -Math.PI / 2 + (i / n) * Math.PI * 2;
      var diff = Math.abs(Math.atan2(Math.sin(ang - itemAng), Math.cos(ang - itemAng)));
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return bestDiff <= Math.PI / n + 0.25 ? best : -1;
  }

  RTS.RadialMenu = {
    isOpen: function () { return open; },

    open: function (s, cssX, cssY, wx, wy, hit) {
      if (!root) root = document.getElementById('radial-menu');
      if (!root) return false;
      hub = root.querySelector('.radial-hub');
      items = buildItems(s, hit);
      if (!items.length) return false;
      ctx = { s: s, cssX: cssX, cssY: cssY, wx: wx, wy: wy, hit: hit };
      root.style.left = cssX + 'px';
      root.style.top = cssY + 'px';
      layoutItems();
      root.classList.remove('hidden');
      open = true;
      if (navigator.vibrate) navigator.vibrate(14);
      return true;
    },

    close: function () {
      if (!root) return;
      root.classList.add('hidden');
      open = false;
      ctx = null;
      items = [];
      activeIdx = -1;
      if (hub) hub.innerHTML = '';
    },

    move: function (cssX, cssY) {
      if (!open) return;
      highlight(pickAt(cssX, cssY));
    },

    release: function (cssX, cssY) {
      if (!open || !ctx) { this.close(); return false; }
      var idx = pickAt(cssX, cssY);
      var item = idx >= 0 ? items[idx] : null;
      var s = ctx.s;
      this.close();
      if (item) {
        execute(s, item);
        if (navigator.vibrate) navigator.vibrate(10);
        return true;
      }
      return false;
    },
  };
})(window.RTS = window.RTS || {});
