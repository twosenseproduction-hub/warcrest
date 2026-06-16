/* ============================================================================
 * Warcrest — hud.js
 * Mobile-first condensed bottom hub: squad chips · center info · 3×2 command card
 * + thumb combat cluster. Icon-first — no keyboard slot labels in player UI.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var D = {}; var getState;

  var CMD_SLOTS = [
    'primary1', 'primary2', 'primary3',
    'secondary1', 'secondary2', 'secondary3',
  ];

  var SQUAD_CHIPS = [
    { key: 'all', label: 'ALL', role: 'all' },
    { key: 'archer', label: 'ARC', role: 'archer' },
    { key: 'lancer', label: 'LAN', role: 'lancer' },
    { key: 'pawn', label: 'PWN', role: 'pawn' },
  ];

  function UI() {
    return RTS.UI || {
      iconUrl: function () { return ''; },
      iconHtml: function () { return '●'; },
      roleTrayIcon: function () { return '●'; },
      buildTrayIcon: function () { return '◻'; },
      avatarPortraitHtml: function () { return '●'; },
      stripPortraitHtml: function () { return '●'; },
      buildingPortraitHtml: function () { return '◻'; },
    };
  }

  function $(id) { return document.getElementById(id); }

  function syncResources(s) {
    if (!D['res-halcite']) return;
    D['res-halcite'].textContent = Math.floor(s.res.player.halcite);
    var sp = s.res.player;
    D['res-supply'].textContent = sp.supplyUsed + '/' + sp.supplyCap;
    D['res-supply'].className = sp.supplyUsed >= sp.supplyCap ? 'val warn' : 'val';
  }

  function syncRailBaseIcon(s) {
    var btn = D['btn-rail-base'];
    if (!btn || !s) return;
    var img = btn.querySelector('img');
    if (!img || !RTS.UI || !RTS.UI.buildingUrl) return;
    var fid = s.playerFaction || 'aurex';
    var url = RTS.UI.buildingUrl(fid, 'core');
    if (img.getAttribute('src') !== url) img.setAttribute('src', url);
  }

  RTS.HUD = {
    init: function (getStateFn) {
      getState = getStateFn;
      ['res-halcite', 'res-supply', 'timer', 'btn-pause', 'command-deck', 'bottom-hub',
       'selpanel', 'squad-chips', 'squad-block', 'cmd-grid', 'command-card', 'combat-cluster',
       'event-log', 'toast', 'gesture-hint', 'wave-timer',
       'btn-rail-army', 'btn-rail-pawns', 'btn-rail-base',
       'btn-combat-stop', 'btn-combat-mode', 'btn-combat-atk',
       'btn-build-hammer', 'build-panel', 'build-panel-grid', 'map-tools', 'minimap-chip', 'minimap'].forEach(function (id) {
        D[id] = $(id);
      });

      ['cmd-grid', 'selpanel', 'squad-chips', 'squad-block', 'combat-cluster', 'topbar', 'command-deck',
       'bottom-hub', 'map-tools', 'build-panel', 'btn-build-hammer', 'minimap-chip'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', markUi, true);
        el.addEventListener('touchstart', markUi, true);
      });
      D['btn-pause'] && D['btn-pause'].addEventListener('click', function () { RTS.Game.togglePause(); });

      wireRail('btn-rail-army', function (s) { RTS.selectAllArmy(s); RTS.Audio.play('click'); });
      wireRail('btn-rail-pawns', function (s) {
        if (RTS.selectAllWorkers(s)) {
          RTS.toast(s, 'Pawns selected');
          RTS.Audio.play('click');
        }
      });
      wireRail('btn-rail-base', function (s) {
        var core = RTS.playerCore(s);
        if (core) { RTS.Cam.panTo(s, core.x, core.y, true); RTS.Audio.play('click'); }
      });

      wireRail('btn-combat-stop', function (s) {
        RTS.orderStop(s, RTS.activeSelectedUnits(s));
        s.attackMoveArmed = false;
        RTS.refreshMode(s);
        RTS.Audio.play('click');
        RTS.HUD.sync(s);
      });
      wireRail('btn-combat-atk', function (s) {
        s.attackMoveArmed = !s.attackMoveArmed;
        RTS.refreshMode(s);
        RTS.Audio.play('click');
        RTS.HUD.sync(s);
      });
      wireRail('btn-combat-mode', function (s) { handleCombatMode(s); });

      wireTap(D['btn-build-hammer'], function () {
        var s = getState();
        if (!s || s.scene !== 'playing') return;
        s.ui.buildPanelOpen = !s.ui.buildPanelOpen;
        if (s.ui.buildPanelOpen && RTS.BuildingMenu) RTS.BuildingMenu.close(s);
        RTS.Audio.play('click');
        RTS.HUD.sync(s);
      });

      wireDelegatedTap(D['build-panel-grid'], '[data-act]', function (e, btn) {
        if (btn.classList.contains('disabled')) { RTS.Audio.play('deny'); return; }
        handleAction(getState(), btn.dataset);
      });

      wireDelegatedTap(D['cmd-grid'], '[data-act]', function (e, btn) {
        if (btn.classList.contains('disabled') || btn.classList.contains('slot-hidden')) {
          RTS.Audio.play('deny'); return;
        }
        handleAction(getState(), btn.dataset);
      });

      // ---- cmd-slot press-state: add/remove `pressing` class on touch down/up ----
      wireCmdSlotPressState(D['cmd-grid']);

      wireDelegatedTap(D['squad-chips'], '[data-squad-role]', function (e, chip) {
        var s = getState();
        if (!s || chip.classList.contains('disabled')) return;
        markUi();
        var role = chip.dataset.squadRole;
        if (role === 'all') {
          if (RTS.selectMacroAll(s)) RTS.Audio.play('click');
        } else if (RTS.selectMacroGroup(s, role)) {
          RTS.Audio.play('click');
        }
      });

      wireMinimapTap();
    },

    sync: function (s) {
      syncResources(s);
      syncRailBaseIcon(s);

      if (D['btn-combat-atk']) D['btn-combat-atk'].classList.toggle('active', !!s.attackMoveArmed);

      if (D['btn-build-hammer']) {
        D['btn-build-hammer'].classList.toggle('active', !!s.ui.buildPanelOpen);
        D['btn-build-hammer'].setAttribute('aria-expanded', s.ui.buildPanelOpen ? 'true' : 'false');
      }

      var quickRail = deckOpen(s);
      if (D['btn-rail-army']) D['btn-rail-army'].classList.toggle('hidden', quickRail);
      if (D['btn-rail-pawns']) D['btn-rail-pawns'].classList.toggle('hidden', quickRail);

      renderBuildPanel(s);
      syncPawnSelectButtons(s);
      updateLayout(s);
      updateGestureHint(s);
      renderSquadBlock(s);
      renderCenterPanel(s);
      renderCommandCard(s);
      syncCombatModeIcon(s);
    },

    renderLog: function (s) {
      var box = D['event-log']; if (!box) return;
      box.innerHTML = '';
      s.ui.eventLog.forEach(function (ev, i) {
        var li = document.createElement('div');
        li.className = 'evt ' + ev.tone + (i === 0 ? ' fresh' : '');
        li.textContent = ev.text;
        box.appendChild(li);
      });
    },

    tick: function (s, dt) {
      syncResources(s);
      if (RTS.Cam && RTS.Cam.updatePan) RTS.Cam.updatePan(s, dt);
      if (D['timer']) D['timer'].textContent = fmtTime(s.timers.gameTime);
      if (D['wave-timer']) {
        var rem = Math.max(0, s.timers.nextWave - s.timers.gameTime);
        D['wave-timer'].innerHTML = '<img class="ic-ts sm" src="' + UI().iconUrl('sword') +
          '" alt="" /> ' + Math.ceil(rem) + 's';
        D['wave-timer'].className = rem < 10 ? 'wave-badge warn' : 'wave-badge';
      }
      var t = D['toast'];
      if (s.ui.toast) { t.textContent = s.ui.toast.text; t.classList.add('show'); }
      else t.classList.remove('show');

      if (RTS.BuildingMenu && RTS.BuildingMenu.isOpen()) {
        if (!s.ui.bmenuRefresh) s.ui.bmenuRefresh = 0;
        s.ui.bmenuRefresh -= dt;
        if (s.ui.bmenuRefresh <= 0) {
          s.ui.bmenuRefresh = 0.35;
          RTS.BuildingMenu.refresh(s);
        }
      }
    },
  };

  function markUi() { var s = getState(); if (s) s.ui.lastUiAt = performance.now(); }

  // Adds `pressing` class to a .cmd-slot on pointerdown and removes it on
  // pointerup / pointercancel / pointerleave so CSS can swap to the pressed asset.
  function wireCmdSlotPressState(grid) {
    if (!grid) return;
    var pressed = null;

    function clearPressed() {
      if (pressed) { pressed.classList.remove('pressing'); pressed = null; }
    }

    grid.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('.cmd-slot');
      if (!btn || btn.classList.contains('disabled') || btn.classList.contains('slot-hidden')) return;
      clearPressed();
      pressed = btn;
      btn.classList.add('pressing');
    }, true);

    grid.addEventListener('pointerup',     clearPressed, true);
    grid.addEventListener('pointercancel', clearPressed, true);
    grid.addEventListener('pointerleave',  clearPressed, true);
  }

  function wireTap(el, fn) {
    if (!el) return;
    var lastAt = 0;
    function run(e) {
      if (e.type === 'pointerup' && e.pointerType === 'mouse' && e.button !== 0) return;
      var now = performance.now();
      if (now - lastAt < 280) return;
      lastAt = now;
      fn(e);
    }
    el.addEventListener('pointerup', run);
    el.addEventListener('click', run);
  }

  function wireDelegatedTap(el, selector, fn) {
    if (!el) return;
    wireTap(el, function (e) {
      var btn = e.target.closest(selector);
      if (!btn || !el.contains(btn)) return;
      fn(e, btn);
    });
  }

  function wireRail(id, fn) {
    var el = D[id]; if (!el) return;
    el.addEventListener('pointerdown', markUi, true);
    wireTap(el, function () { var s = getState(); if (s) fn(s); });
  }

  function wireMinimapTap() {
    var chip = D['minimap-chip'];
    var cv = D['minimap'];
    if (!chip || !cv) return;
    wireTap(chip, function (e) {
      var s = getState();
      if (!s || s.scene !== 'playing') return;
      var rect = cv.getBoundingClientRect();
      var pt = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e;
      var lx = pt.clientX - rect.left;
      var ly = pt.clientY - rect.top;
      if (lx < 0 || ly < 0 || lx > rect.width || ly > rect.height) return;
      var wx = (lx / rect.width) * RTS.Config.world.w;
      var wy = (ly / rect.height) * RTS.Config.world.h;
      RTS.Cam.panTo(s, wx, wy, true);
      RTS.Audio.play('click');
      markUi();
    });
  }

  function macroBarActive(s) {
    if (!s.ui.macroGroups || !RTS.macroGroupRoles) return false;
    return RTS.macroGroupRoles(s).length >= 2;
  }

  function deckOpen(s) {
    if (s.inputMode === 'place-building') return true;
    return RTS.selectedUnits(s).length > 0 || RTS.selectedBuildings(s).length > 0;
  }

  function combatClusterOpen(s) {
    if (s.inputMode === 'place-building') return false;
    var units = RTS.activeSelectedUnits(s);
    return units.some(function (u) { return u.role !== 'pawn'; });
  }

  function updateLayout(s) {
    var deck = D['command-deck'];
    var hub = D['bottom-hub'];
    var combat = D['combat-cluster'];
    var open = deckOpen(s);
    if (deck) {
      deck.classList.toggle('expanded', open);
      deck.classList.toggle('collapsed', !open);
    }
    if (hub) hub.classList.toggle('hidden', !open);
    if (combat) combat.classList.toggle('hidden', !combatClusterOpen(s));
  }

  function gestureHintText(s) {
    if (s.inputMode === 'place-building') return 'Tap ground to place · a worker will hammer it up';
    if (s.attackMoveArmed) return 'Tap where to attack-move';
    return '';
  }

  function updateGestureHint(s) {
    var el = D['gesture-hint'];
    if (!el) return;
    var text = gestureHintText(s);
    var show = !!text || (s.timers.gameTime < 12 && s.scene === 'playing' && !deckOpen(s));
    if (show && !text) {
      text = 'Double-tap ground = army · squad chips = macro · hammer = build';
    }
    el.textContent = text;
    el.classList.toggle('hidden', !show);
    el.classList.toggle('attack', !!s.attackMoveArmed);
    el.classList.toggle('place', s.inputMode === 'place-building');
  }

  function syncPawnSelectButtons(s) {
    var fid = s.playerFaction || 'aurex';
    var html = UI().avatarPortraitHtml(fid, 'pawn', 28);
    ['btn-rail-pawns'].forEach(function (id) {
      var el = D[id];
      if (!el) return;
      var slot = el.querySelector('.pawn-select-portrait');
      if (slot) slot.innerHTML = html;
    });
  }

  // ---- Selection profile for HUD model ------------------------------------
  function selectionProfile(s) {
    if (s.inputMode === 'place-building') {
      return { type: 'place', passiveTags: [], subtype: 'Build site' };
    }
    var units = RTS.activeSelectedUnits(s);
    var allUnits = RTS.selectedUnits(s);
    var blds = RTS.selectedBuildings(s);

    if (blds.length === 1 && !units.length) {
      return {
        type: 'building',
        building: blds[0],
        passiveTags: [],
        subtype: RTS.nameFor(blds[0].faction, blds[0].type),
      };
    }
    if (!units.length && !blds.length) {
      return { type: 'none', passiveTags: [], subtype: '' };
    }
    if (units.length === 1 && !blds.length) {
      var u = units[0];
      return {
        type: u.role === 'pawn' ? 'worker' : 'fighter',
        units: units,
        passiveTags: u.uiPassiveTags || [],
        subtype: RTS.nameFor(u.faction, u.role),
        unit: u,
      };
    }
    if (macroBarActive(s) && allUnits.length) {
      return {
        type: 'mixed',
        units: units.length ? units : allUnits,
        allUnits: allUnits,
        passiveTags: [],
        subtype: s.ui.macroRole ? RTS.nameFor(s.playerFaction, s.ui.macroRole) : 'Mixed army',
      };
    }
    if (units.length > 1) {
      var roles = {};
      units.forEach(function (u) { roles[u.role] = (roles[u.role] || 0) + 1; });
      var roleKeys = Object.keys(roles);
      var profType = roleKeys.length > 1 ? 'mixed' : (roleKeys[0] === 'pawn' ? 'worker' : 'fighter');
      return {
        type: profType,
        units: units,
        allUnits: units,
        passiveTags: [],
        subtype: profType === 'mixed' ? 'Mixed army' : RTS.nameFor(s.playerFaction, roleKeys[0]),
      };
    }
    return { type: 'mixed', units: units, allUnits: units, passiveTags: [], subtype: 'Selection' };
  }

  function squadChipCount(s, role) {
    if (!s.ui.macroGroups) return 0;
    if (role === 'all') {
      var total = 0;
      RTS.macroGroupRoles(s).forEach(function (r) { total += s.ui.macroGroups[r].length; });
      return total;
    }
    return s.ui.macroGroups[role] ? s.ui.macroGroups[role].length : 0;
  }

  function renderSquadBlock(s) {
    var block = D['squad-block'];
    var grid = D['squad-chips'];
    if (!grid) return;
    grid.innerHTML = '';
    var show = macroBarActive(s);
    if (block) block.classList.toggle('hidden', !show);
    if (!show) return;

    var fid = s.playerFaction || 'aurex';
    SQUAD_CHIPS.forEach(function (chip) {
      var count = squadChipCount(s, chip.role);
      var hasRole = chip.role === 'all' ? count > 0 : count > 0;
      var active = chip.role === 'all' ? !s.ui.macroRole : s.ui.macroRole === chip.role;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'squad-chip' + (active ? ' active' : '') + (!hasRole ? ' disabled' : '');
      btn.dataset.squadRole = chip.role;
      btn.setAttribute('aria-label', chip.label + ' squad');
      var portrait = chip.role === 'all'
        ? UI().iconHtml('sword', 16)
        : UI().avatarPortraitHtml(fid, chip.role, 18);
      btn.innerHTML =
        '<span class="sq-portrait">' + portrait + '</span>' +
        '<span class="sq-tag">' + chip.label + '</span>' +
        (chip.role !== 'all' && count ? '<span class="sq-count">' + count + '</span>' : '');
      grid.appendChild(btn);
    });
  }

  function renderBuildingQueue(s, b) {
    if (!b.built || !b.queue || !b.queue.length) return '';
    var fid = s.playerFaction || 'aurex';
    var chips = b.queue.map(function (job, i) {
      var pct = job.total ? Math.max(0, Math.min(1, 1 - job.remaining / job.total)) : 0;
      var active = i === 0;
      return '<span class="qchip' + (active ? ' active' : '') + '">' +
        UI().avatarPortraitHtml(fid, job.role, 18) +
        (active ? '<span class="qtime">' + Math.ceil(job.remaining) + 's</span>' : '') +
        '<span class="qprog"><i style="width:' + (pct * 100) + '%"></i></span></span>';
    }).join('');
    return '<div class="sel-queue">' + chips + '</div>';
  }

  function statusLineForUnit(u) {
    if (u.role === 'pawn' && u.buildTask) return 'building…';
    if (u.role === 'pawn' && u.harvest) {
      if (u.harvest.phase === 'mining') return 'mining…';
      if (u.harvest.phase === 'toBase' && u.harvest.carry > 0) {
        return 'returning +' + Math.floor(u.harvest.carry);
      }
      return 'to Ironstone';
    }
    if (u.role === 'pawn') return 'Hold site → build';
    return 'Ready';
  }

  function renderCenterPanel(s) {
    var p = D['selpanel']; if (!p) return;
    p.innerHTML = '';
    p.classList.remove('has-queue', 'has-tags');
    if (!deckOpen(s)) return;

    var prof = selectionProfile(s);
    var units = prof.units || RTS.activeSelectedUnits(s);
    var b = prof.building;

    if (prof.type === 'building' && b) {
      var portraitKey = b.type === 'outpost' ? 'outpost' : b.type;
      var queueHtml = renderBuildingQueue(s, b);
      if (queueHtml) p.classList.add('has-queue');
      p.innerHTML =
        '<div class="hub-portrait">' + UI().buildingPortraitHtml(b.faction, portraitKey, 30) + '</div>' +
        '<div class="hub-body">' +
        '<div class="hub-title">' + RTS.nameFor(b.faction, b.type) + '</div>' +
        '<div class="hub-subtype">' + prof.subtype + '</div>' +
        bar(b.hp, b.maxHp) +
        renderPassiveTags(prof.passiveTags) +
        (!b.built
          ? '<div class="hub-status">' + Math.floor(b.progress * 100) + '% built</div>'
          : '<div class="hub-status">Hold ground → rally</div>') +
        queueHtml +
        '</div>';
      if (prof.passiveTags.length) p.classList.add('has-tags');
      return;
    }

    if (units.length) {
      var totHp = 0, totMax = 0;
      units.forEach(function (u) { totHp += u.hp; totMax += u.maxHp; });
      var title = units.length === 1 && prof.unit
        ? RTS.nameFor(prof.unit.faction, prof.unit.role)
        : units.length + ' ' + (prof.subtype || 'units');
      var status = units.length === 1 ? statusLineForUnit(units[0]) : 'Tap ground to command';
      var portraitRole = units.length === 1 ? units[0].role : (s.ui.macroRole || 'lancer');
      p.innerHTML =
        '<div class="hub-portrait">' + UI().avatarPortraitHtml(s.playerFaction, portraitRole, 30) + '</div>' +
        '<div class="hub-body">' +
        '<div class="hub-title">' + title + '</div>' +
        '<div class="hub-subtype">' + prof.subtype + '</div>' +
        bar(totHp, totMax) +
        renderPassiveTags(prof.passiveTags) +
        '<div class="hub-status">' + status + '</div>' +
        '</div>';
      if (prof.passiveTags.length) p.classList.add('has-tags');
    }
  }

  function renderPassiveTags(tags) {
    if (!tags || !tags.length) return '';
    return '<div class="hub-passives">' +
      tags.map(function (t) { return '<span class="passive-tag">' + t + '</span>'; }).join('') +
      '</div>';
  }

  function bar(v, max) {
    var pct = Math.max(0, Math.min(1, v / max));
    var state = pct <= 0.25 ? ' is-crit' : pct <= 0.55 ? ' is-warn' : '';
    return '<div class="sel-bar"><div class="hp-bar' + state + '">' +
      '<span class="hp-bar__cap hp-bar__cap--l"></span>' +
      '<span class="hp-bar__stretch"><span class="hp-bar__fill" style="width:' + (pct * 100) + '%"></span></span>' +
      '<span class="hp-bar__cap hp-bar__cap--r"></span>' +
      '</div><b>' + Math.ceil(pct * 100) + '%</b></div>';
  }

  // ---- Command card model --------------------------------------------------
  function emptySlot(slotId) {
    return { slotId: slotId, act: null, hidden: true, disabled: true, icon: '', cooldown: 0, autocast: false, targeting: false };
  }

  function slot(act, icon, opts) {
    opts = opts || {};
    return {
      slotId: opts.slotId,
      act: act,
      icon: icon,
      hidden: !!opts.hidden,
      disabled: !!opts.disabled,
      cooldown: opts.cooldown || 0,
      autocast: !!opts.autocast,
      targeting: !!opts.targeting,
      data: opts.data || {},
      active: !!opts.active,
      danger: !!opts.danger,
      green: !!opts.green,
    };
  }

  function buildCommandSlots(s, prof) {
    var slots = CMD_SLOTS.map(emptySlot);
    function put(idx, def) {
      def.slotId = CMD_SLOTS[idx];
      slots[idx] = def;
    }

    if (prof.type === 'place') {
      put(5, slot('cancel-place', UI().iconHtml('cancel', 20), { danger: true }));
      return slots;
    }

    if (prof.type === 'building' && prof.building) {
      var b = prof.building;
      var fid = s.playerFaction || 'aurex';
      var trains = (RTS.Buildings[b.type] && RTS.Buildings[b.type].trains) || [];
      trains.slice(0, 3).forEach(function (role, i) {
        if (role === '_livestock') {
          var lc = RTS.Config.livestock;
          var afford = s.res.player.halcite >= lc.trainCost;
          put(i, slot('train', UI().iconHtml(fid === 'cinder' ? 'pig' : 'sheep', 20), {
            disabled: !b.built || !afford,
            data: { bid: b.id, role: '_livestock' },
          }));
        } else {
          var us = RTS.Units[role];
          var afford2 = s.res.player.halcite >= us.cost;
          var supplyOk = s.res.player.supplyUsed + us.supply <= s.res.player.supplyCap;
          put(i, slot('train', UI().roleTrayIcon(fid, role, 22), {
            disabled: !b.built || !afford2 || !supplyOk,
            data: { bid: b.id, role: role },
          }));
        }
      });
      if (!b.built) {
        put(5, slot('cancel-build', UI().iconHtml('cancel', 20), { danger: true, data: { bid: b.id } }));
      } else {
        put(3, slot('toggle-automine', UI().iconHtml('hammer', 20), {
          active: !!b.autoMine,
          green: !!b.autoMine,
          data: { bid: b.id },
          hidden: !RTS.isDepositBuilding || !RTS.isDepositBuilding(b),
        }));
        put(4, slot('rally', UI().iconHtml('arrow', 20), { disabled: false }));
        put(5, slot('more', UI().iconHtml('info', 20), { disabled: false, data: { bid: b.id } }));
      }
      return slots;
    }

    if (prof.type === 'worker') {
      put(0, slot('move', UI().iconHtml('arrow', 20), { targeting: true }));
      put(1, slot('stop', UI().iconHtml('cancel', 20)));
      put(2, slot('harvest', UI().iconHtml('gold', 20)));
      put(3, slot('build-cmd', UI().iconHtml('hammer', 20)));
      put(4, slot('repair', UI().iconHtml('gear', 20), { disabled: true, hidden: true }));
      put(5, slot('return', UI().iconHtml('shield', 20)));
      return slots;
    }

    if (prof.type === 'fighter') {
      put(0, slot('move', UI().iconHtml('arrow', 20), { targeting: true }));
      put(1, slot('stop', UI().iconHtml('cancel', 20)));
      put(2, slot('attackmove', UI().iconHtml('sword', 20), { active: !!s.attackMoveArmed }));
      put(3, slot('hold', UI().iconHtml('shield', 20)));
      put(4, slot('stance', UI().iconHtml('gear', 20), { disabled: true, hidden: true }));
      put(5, slot('context', UI().iconHtml('info', 20), { disabled: true, hidden: true }));
      return slots;
    }

    if (prof.type === 'mixed') {
      put(0, slot('move', UI().iconHtml('arrow', 20), { targeting: true }));
      put(1, slot('stop', UI().iconHtml('cancel', 20)));
      put(2, slot('attackmove', UI().iconHtml('sword', 20), { active: !!s.attackMoveArmed }));
      put(3, slot('hold', UI().iconHtml('shield', 20)));
      put(4, slot('formation', UI().iconHtml('shield', 20), { disabled: true, hidden: true }));
      put(5, slot('patrol', UI().iconHtml('bow', 20), { disabled: true, hidden: true }));
      return slots;
    }

    return slots;
  }

  function renderCommandCard(s) {
    var grid = D['cmd-grid'];
    if (!grid) return;
    grid.innerHTML = '';
    if (!deckOpen(s)) return;

    var prof = selectionProfile(s);
    var slots = buildCommandSlots(s, prof);
    s.ui.commandCard = { profile: prof.type, slots: slots };

    slots.forEach(function (def) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cmd-slot' +
        (def.disabled ? ' disabled' : '') +
        (def.hidden ? ' slot-hidden' : '') +
        (def.green ? ' cmd-green' : (def.active ? ' on' : '')) +
        (def.danger ? ' danger' : '') +
        (def.targeting ? ' targeting' : '');
      btn.dataset.slotId = def.slotId;
      if (def.act) btn.dataset.act = def.act;
      if (def.data) {
        Object.keys(def.data).forEach(function (k) { btn.dataset[k] = def.data[k]; });
      }
      btn.innerHTML = '<span class="cmd-ico">' + (def.icon || '') + '</span>';
      if (def.cooldown > 0) {
        btn.innerHTML += '<span class="cmd-cooldown" style="--cd:' + def.cooldown + '"></span>';
      }
      if (def.autocast) {
        btn.innerHTML += '<span class="cmd-autocast" aria-hidden="true"></span>';
      }
      grid.appendChild(btn);
    });
  }

  function syncCombatModeIcon(s) {
    var btn = D['btn-combat-mode'];
    if (!btn) return;
    var img = btn.querySelector('img');
    if (!img) return;
    var prof = selectionProfile(s);
    var icon = 'shield';
    if (prof.type === 'building') icon = 'arrow';
    else if (prof.type === 'worker') icon = 'hammer';
    else icon = 'gear';
    var url = UI().iconUrl(icon);
    if (img.getAttribute('src') !== url) img.setAttribute('src', url);
    btn.classList.toggle('on', prof.type === 'building' && prof.building && prof.building.autoMine);
  }

  function handleCombatMode(s) {
    var prof = selectionProfile(s);
    if (prof.type === 'building' && prof.building) {
      handleAction(s, { act: 'toggle-automine', bid: prof.building.id });
      return;
    }
    if (prof.type === 'worker') {
      s.ui.buildPanelOpen = !s.ui.buildPanelOpen;
      if (s.ui.buildPanelOpen && RTS.BuildingMenu) RTS.BuildingMenu.close(s);
      RTS.Audio.play('click');
      RTS.HUD.sync(s);
      return;
    }
    s.attackMoveArmed = false;
    RTS.refreshMode(s);
    RTS.toast(s, 'Tap ground to hold position');
    RTS.Audio.play('click');
    RTS.HUD.sync(s);
  }

  function renderBuildPanel(s) {
    var panel = D['build-panel'];
    var grid = D['build-panel-grid'];
    if (!panel || !grid) return;
    var open = !!s.ui.buildPanelOpen && s.scene === 'playing';
    panel.classList.toggle('hidden', !open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (!open) { grid.innerHTML = ''; return; }
    grid.innerHTML = '';
    RTS.BuildMenu.forEach(function (t) {
      var spec = RTS.Buildings[t];
      var disabled = s.res.player.halcite < spec.cost;
      var btn = actionBtn(
        UI().buildTrayIcon(s.playerFaction, t, 28),
        { act: 'build', type: t },
        disabled,
        '',
        spec.cost
      );
      var lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = RTS.nameFor(s.playerFaction, t);
      btn.appendChild(lbl);
      grid.appendChild(btn);
    });
  }

  function actionBtn(icon, data, disabled, extra, cost) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'act' + (disabled ? ' disabled' : '') + (extra ? ' ' + extra : '');
    for (var k in data) b.dataset[k] = data[k];
    b.innerHTML = '<span class="ico">' + icon + '</span>' +
      (cost ? '<span class="cost"><img class="ic-ts xs" src="' + UI().iconUrl('gold') +
        '" alt="" />' + cost + '</span>' : '');
    return b;
  }

  RTS.HUD.performAction = function (s, data) { handleAction(s, data); };

  function nearestResourceNode(s, units) {
    var best = null, bd = Infinity;
    var ox = 0, oy = 0, n = 0;
    units.forEach(function (u) { ox += u.x; oy += u.y; n++; });
    if (!n) return null;
    ox /= n; oy /= n;
    s.entities.resources.forEach(function (node) {
      if (node.amount <= 0) return;
      var d = RTS.dist(ox, oy, node.x, node.y);
      if (d < bd) { bd = d; best = node; }
    });
    return best;
  }

  function handleAction(s, data) {
    if (!s || !data || !data.act) return;
    markUi();
    var units = RTS.activeSelectedUnits(s);
    var workers = RTS.activeWorkers(s);
    switch (data.act) {
      case 'stop':
        RTS.orderStop(s, units);
        s.attackMoveArmed = false;
        RTS.refreshMode(s);
        RTS.Audio.play('click');
        break;
      case 'move':
        s.attackMoveArmed = false;
        RTS.refreshMode(s);
        RTS.toast(s, 'Tap ground to move');
        RTS.Audio.play('click');
        break;
      case 'attackmove':
        s.attackMoveArmed = !s.attackMoveArmed;
        RTS.refreshMode(s);
        RTS.Audio.play('click');
        break;
      case 'hold':
        RTS.orderStop(s, units);
        s.attackMoveArmed = false;
        RTS.refreshMode(s);
        RTS.toast(s, 'Holding position');
        RTS.Audio.play('click');
        break;
      case 'harvest':
        if (!workers.length) { RTS.Audio.play('deny'); break; }
        var node = nearestResourceNode(s, workers);
        if (!node) { RTS.toast(s, 'No Ironstone in reach'); RTS.Audio.play('deny'); break; }
        workers.forEach(function (w) { RTS.orderHarvest(s, w, node.id); });
        RTS.Audio.play('click');
        break;
      case 'build-cmd':
        s.ui.buildPanelOpen = true;
        if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
        RTS.Audio.play('click');
        break;
      case 'return':
        workers.forEach(function (w) {
          if (w.harvest && w.harvest.carry > 0) {
            w.harvest.phase = 'toBase';
            if (RTS.Harvest && RTS.Harvest.assignReturnDeposit) RTS.Harvest.assignReturnDeposit(s, w);
          }
        });
        RTS.Audio.play('click');
        break;
      case 'rally':
        RTS.toast(s, 'Long-press ground to set rally');
        RTS.Audio.play('click');
        break;
      case 'more':
        if (data.bid) {
          var bMore = RTS.getById(s, data.bid);
          if (bMore && RTS.BuildingMenu) RTS.BuildingMenu.open(s, bMore);
        }
        RTS.Audio.play('click');
        break;
      case 'toggle-automine':
        var hq = RTS.getById(s, data.bid);
        if (hq && hq.built) {
          hq.autoMine = !hq.autoMine;
          RTS.toast(s, hq.autoMine ? 'Auto-mine enabled' : 'Auto-mine disabled');
          if (hq.autoMine) {
            s.entities.units.forEach(function (u) {
              if (u.dead || u.team !== RTS.TEAM.PLAYER || u.role !== 'pawn') return;
              if (u.harvest || u.buildTask || u.moveTo || u.target) return;
              if (RTS.dist(u.x, u.y, hq.x, hq.y) > 380) return;
              var node = RTS.nodeForDeposit(s, hq);
              if (!node) return;
              RTS.orderHarvest(s, u, node.id, { depositOwnerId: hq.id });
            });
          }
          RTS.Audio.play('click');
        }
        break;
      case 'train':
        var b = RTS.getById(s, data.bid); if (b) RTS.train(s, b, data.role); break;
      case 'build':
        RTS.beginPlacement(s, data.type);
        break;
      case 'cancel-place':
        RTS.cancelPlacement(s);
        RTS.Audio.play('click');
        break;
      case 'cancel-build':
        if (RTS.cancelConstruction(s, data.bid)) RTS.Audio.play('click');
        else RTS.Audio.play('deny');
        break;
      case 'cancel-train':
        if (RTS.cancelTrainQueueItem(s, data.bid, parseInt(data.qidx, 10))) RTS.Audio.play('click');
        else RTS.Audio.play('deny');
        break;
      default:
        RTS.Audio.play('deny');
        break;
    }
    RTS.HUD.sync(s);
  }

  function fmtTime(t) {
    var m = Math.floor(t / 60), sec = Math.floor(t % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

})(window.RTS = window.RTS || {});
