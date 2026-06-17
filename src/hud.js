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

  // ---- Layout updater -------------------------------------------------------
  function updateLayout(s) {
    var open = deckOpen(s);
    var deck = D['command-deck'];
    if (deck) deck.classList.toggle('expanded', open);

    var hub = D['bottom-hub'];
    if (hub) hub.classList.toggle('hidden', !open);

    var cc = D['command-card'];
    if (cc) cc.classList.toggle('hidden', !open);

    var clu = D['combat-cluster'];
    if (clu) {
      var hasUnits = open && RTS.activeSelectedUnits && RTS.activeSelectedUnits(s).length > 0;
      clu.classList.toggle('hidden', !hasUnits);
    }

    var bpanel = D['build-panel'];
    if (bpanel) bpanel.classList.toggle('hidden', !s.ui.buildPanelOpen);

    if (D['map-tools']) D['map-tools'].classList.toggle('hidden', open);
    if (D['minimap-chip']) D['minimap-chip'].classList.toggle('deck-open', open);
  }

  function deckOpen(s) {
    if (!s || s.scene !== 'playing') return false;
    if (s.inputMode === 'place-building') return true;
    var prof = selectionProfile(s);
    return prof.type !== 'none';
  }

  function updateGestureHint(s) {
    var el = D['gesture-hint']; if (!el) return;
    var prof = selectionProfile(s);
    if (prof.type === 'building' && prof.building && prof.building.built) {
      el.textContent = 'Hold ground \u2192 rally';
    } else if (prof.type === 'unit') {
      el.textContent = 'Tap ground to move';
    } else {
      el.textContent = '';
    }
  }

  // ---- Squad block (2×2 chip grid) -----------------------------------------
  function renderSquadBlock(s) {
    var block = D['squad-block'];
    var grid = D['squad-chips'];
    if (!block || !grid) return;

    var open = deckOpen(s);
    block.classList.toggle('hidden', !open);
    if (!open) return;

    var fid = s.playerFaction || 'aurex';
    grid.innerHTML = '';
    SQUAD_CHIPS.forEach(function (chip) {
      var count = chip.role === 'all'
        ? RTS.activeSelectedUnits(s).length
        : (s.units || []).filter(function (u) { return u.owner === 'player' && u.role === chip.role; }).length;

      var btn = document.createElement('button');
      btn.className = 'squad-chip' + (count === 0 ? ' disabled' : '');
      btn.dataset.squadRole = chip.role;
      btn.setAttribute('aria-label', chip.label + ' squad');
      var portrait = chip.role === 'all'
        ? UI().iconHtml('sword', 16)
        : UI().avatarPortraitHtml(fid, chip.role, 18);
      btn.innerHTML =
        '<span class="sq-portrait unit-portrait-fill">' + portrait + '</span>' +
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
        '<span class="qico unit-portrait-fill">' + UI().avatarPortraitHtml(fid, job.role) + '</span>' +
        (active ? '<span class="qtime">' + Math.ceil(job.remaining) + 's</span>' : '') +
        '<span class="qprog"><i style="width:' + (pct * 100) + '%"></i></span></span>';
    }).join('');
    return '<div class="sel-queue">' + chips + '</div>';
  }

  function statusLineForUnit(u) {
    if (u.heroId && RTS.getHero) {
      var h = RTS.getHero(u.heroId);
      if (h) return h.class + ' \u00b7 ready';
    }
    if (u.role === 'pawn' && u.buildTask) {
      var qn = u.buildQueue ? u.buildQueue.length : 0;
      return 'building\u2026' + (qn ? ' \u00b7 +' + qn + ' queued' : '');
    }
    if (u.role === 'pawn' && u.harvest) {
      if (u.harvest.phase === 'mining') return 'mining\u2026';
      if (u.harvest.phase === 'toBase' && u.harvest.carry > 0) {
        return 'returning +' + Math.floor(u.harvest.carry);
      }
      return 'to Ironstone';
    }
    if (u.role === 'pawn') return 'Hold site \u2192 build';
    return 'Ready';
  }

  // ---- FIX: collect up to 3 unique roles from a multi-unit selection -------
  function uniqueRolesFromUnits(units, limit) {
    var seen = {};
    var out = [];
    for (var i = 0; i < units.length && out.length < (limit || 3); i++) {
      var r = units[i].heroId ? ('hero:' + units[i].heroId) : units[i].role;
      if (!seen[r]) { seen[r] = true; out.push(units[i]); }
    }
    return out;
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
      if (prof.passiveTags.length) p.classList.add('has-tags');
      var statusText = !b.built
        ? Math.floor(b.progress * 100) + '% built'
        : 'Hold ground \u2192 rally';
      // hub-zone-a: portrait + HP bar stacked
      // hub-zone-b: queue (only rendered when has-queue, hidden via CSS otherwise)
      // hub-zone-c: title / subtype / status / passives
      p.innerHTML =
        '<div class="hub-zone-a">' +
          '<div class="hub-portrait unit-portrait-fill">' + UI().buildingPortraitHtml(b.faction, portraitKey) + '</div>' +
          bar(b.hp, b.maxHp) +
        '</div>' +
        '<div class="hub-zone-b">' + queueHtml + '</div>' +
        '<div class="hub-zone-c">' +
          '<div class="hub-title">' + RTS.nameFor(b.faction, b.type) + '</div>' +
          '<div class="hub-subtype">' + prof.subtype + '</div>' +
          renderPassiveTags(prof.passiveTags) +
          '<div class="hub-status">' + statusText + '</div>' +
        '</div>';
      return;
    }

    if (units.length) {
      var totHp = 0, totMax = 0;
      units.forEach(function (u) { totHp += u.hp; totMax += u.maxHp; });
      var title = units.length === 1 && prof.unit
        ? (prof.unit.heroId && RTS.getHero
          ? RTS.nameFor(prof.unit.faction, prof.unit.heroId)
          : RTS.nameFor(prof.unit.faction, prof.unit.role))
        : units.length + ' ' + (prof.subtype || 'units');
      var status = units.length === 1 ? statusLineForUnit(units[0]) : 'Tap ground to command';
      if (prof.passiveTags.length) p.classList.add('has-tags');

      var portraitInner;
      if (units.length === 1) {
        portraitInner =
          '<div class="hub-portrait unit-portrait-fill">' +
          (units[0].heroId && UI().heroPortraitHtml
            ? UI().heroPortraitHtml(units[0].heroId)
            : UI().avatarPortraitHtml(s.playerFaction, units[0].role)) +
          '</div>';
      } else {
        // Multi-unit: show up to 3 distinct role portraits side by side
        var repUnits = uniqueRolesFromUnits(units, 3);
        portraitInner = '<div class="hub-portraits">';
        repUnits.forEach(function (u) {
          portraitInner +=
            '<div class="hub-portrait unit-portrait-fill">' +
            (u.heroId && UI().heroPortraitHtml
              ? UI().heroPortraitHtml(u.heroId)
              : UI().avatarPortraitHtml(s.playerFaction, u.role)) +
            '</div>';
        });
        portraitInner += '</div>';
      }

      // Units never have a queue — hub-zone-b stays empty (CSS hides it)
      p.innerHTML =
        '<div class="hub-zone-a">' +
          portraitInner +
          bar(totHp, totMax) +
        '</div>' +
        '<div class="hub-zone-b"></div>' +
        '<div class="hub-zone-c">' +
          '<div class="hub-title">' + title + '</div>' +
          '<div class="hub-subtype">' + prof.subtype + '</div>' +
          renderPassiveTags(prof.passiveTags) +
          '<div class="hub-status">' + status + '</div>' +
        '</div>';
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

  // ---- Command card renderer ------------------------------------------------
  function emptySlot(slotId) {
    return { slotId: slotId, act: null, hidden: true, disabled: true, icon: '', cooldown: 0, autocast: false, targeting: false };
  }

  function slot(act, icon, opts) {
    opts = opts || {};
    return {
      slotId: opts.slotId,
      act: act,
      icon: icon,
      label: opts.label || '',
      disabled: !!opts.disabled,
      hidden: false,
      cooldown: opts.cooldown || 0,
      autocast: !!opts.autocast,
      targeting: !!opts.targeting,
      bid: opts.bid,
      uid: opts.uid,
      cost: opts.cost,
      role: opts.role,
    };
  }

  function renderCommandCard(s) {
    var grid = D['cmd-grid']; if (!grid) return;
    if (!deckOpen(s)) { grid.innerHTML = ''; return; }

    var prof = selectionProfile(s);
    var model = buildCommandModel(s, prof);

    var html = '';
    CMD_SLOTS.forEach(function (sid) {
      var sl = model[sid] || emptySlot(sid);
      if (sl.hidden) {
        html += '<button class="cmd-slot slot-hidden" data-slot="' + sid + '" disabled aria-hidden="true"></button>';
        return;
      }
      var cls = 'cmd-slot' + (sl.disabled ? ' disabled' : '') + (sl.targeting ? ' targeting' : '') + (sl.autocast ? ' autocast' : '');
      var cdStyle = sl.cooldown > 0 ? ' style="--cd:' + sl.cooldown + '"' : '';
      var costHtml = sl.cost ? '<span class="slot-cost">' + sl.cost + '</span>' : '';
      var iconHtml = sl.icon ? '<img class="slot-icon" src="' + sl.icon + '" alt="" />' : '';
      html += '<button class="' + cls + '" data-slot="' + sid + '" data-act="' + (sl.act || '') + '"' +
        (sl.bid ? ' data-bid="' + sl.bid + '"' : '') +
        (sl.uid ? ' data-uid="' + sl.uid + '"' : '') +
        (sl.role ? ' data-role="' + sl.role + '"' : '') +
        cdStyle +
        (sl.disabled ? ' disabled' : '') +
        ' aria-label="' + (sl.label || sl.act || '') + '">' +
        iconHtml + costHtml +
        '</button>';
    });
    grid.innerHTML = html;
  }

  function buildCommandModel(s, prof) {
    var model = {};
    CMD_SLOTS.forEach(function (sid) { model[sid] = emptySlot(sid); });
    if (!prof || prof.type === 'none') return model;

    if (prof.type === 'building' && prof.building) {
      return buildBuildingCommands(s, prof.building, model);
    }
    if (prof.type === 'unit') {
      return buildUnitCommands(s, prof, model);
    }
    return model;
  }

  function buildBuildingCommands(s, b, model) {
    var fid = s.playerFaction || 'aurex';
    if (!b.built) return model;

    // Training slots — primary row
    var trainable = RTS.Config.getTrainableUnits ? RTS.Config.getTrainableUnits(fid, b.type) : [];
    trainable.slice(0, 3).forEach(function (role, i) {
      var sid = 'primary' + (i + 1);
      var cost = RTS.Config.unitCost ? RTS.Config.unitCost(role, fid) : 0;
      var atCap = s.res.player.supplyUsed >= s.res.player.supplyCap;
      var trainIcon = (UI().unitAvatarUrl ? UI().unitAvatarUrl(fid, role) : null) || UI().iconUrl(role) || '';
      model[sid] = slot('train', trainIcon, {
        slotId: sid,
        label: 'Train ' + role,
        role: role,
        bid: b.id,
        cost: cost,
        disabled: atCap || s.res.player.halcite < cost,
      });
    });

    // Secondary row — building-specific actions
    if (b.type === 'barracks' || b.type === 'keep') {
      model['secondary1'] = slot('toggle-automine', UI().iconUrl('automine') || '', {
        slotId: 'secondary1',
        label: 'Auto-mine',
        bid: b.id,
        autocast: !!b.autoMine,
      });
    }
    if (RTS.Config.canUpgrade && RTS.Config.canUpgrade(b)) {
      var upCost = RTS.Config.upgradeCost ? RTS.Config.upgradeCost(b) : 0;
      model['secondary2'] = slot('upgrade', UI().iconUrl('upgrade') || '', {
        slotId: 'secondary2',
        label: 'Upgrade',
        bid: b.id,
        cost: upCost,
        disabled: s.res.player.halcite < upCost,
      });
    }
    model['secondary3'] = slot('sell', UI().iconUrl('sell') || '', {
      slotId: 'secondary3',
      label: 'Sell',
      bid: b.id,
    });

    return model;
  }

  function buildUnitCommands(s, prof, model) {
    var units = prof.units || [];
    if (!units.length) return model;

    // Move / Attack-move / Stop
    model['primary1'] = slot('move', UI().iconUrl('move') || '', { slotId: 'primary1', label: 'Move' });
    model['primary2'] = slot('attack-move', UI().iconUrl('attack') || '', {
      slotId: 'primary2', label: 'Attack-move', targeting: !!s.attackMoveArmed,
    });
    model['primary3'] = slot('stop', UI().iconUrl('stop') || '', { slotId: 'primary3', label: 'Stop' });

    // Hero ability in secondary1 if applicable
    if (units.length === 1 && units[0].heroId && RTS.getHero) {
      var h = RTS.getHero(units[0].heroId);
      if (h && h.ability) {
        var cd = h.abilityCooldown || 0;
        model['secondary1'] = slot('hero-ability', UI().iconUrl(h.ability) || '', {
          slotId: 'secondary1',
          label: h.ability,
          uid: units[0].id,
          cooldown: cd > 0 ? (cd / (RTS.Config.heroAbilityCooldown || 10)) : 0,
          disabled: cd > 0,
        });
      }
    }

    // Pawn build shortcut
    var hasPawn = units.some(function (u) { return u.role === 'pawn'; });
    if (hasPawn) {
      model['secondary2'] = slot('open-build', UI().iconUrl('build') || '', {
        slotId: 'secondary2', label: 'Build',
      });
    }

    return model;
  }

  // ---- Selection profile ---------------------------------------------------
  function selectionProfile(s) {
    var blds = RTS.selectedBuildings ? RTS.selectedBuildings(s) : [];
    var units = RTS.activeSelectedUnits ? RTS.activeSelectedUnits(s) : [];

    if (blds.length === 1 && !units.length) {
      var selB = blds[0];
      var tags = RTS.Config.passiveTags ? RTS.Config.passiveTags(selB) : [];
      return {
        type: 'building',
        building: selB,
        units: [],
        unit: null,
        subtype: selB.type,
        passiveTags: tags || [],
      };
    }

    var live = units.filter(function (u) { return u && !u.dead; });
    if (!live.length) return { type: 'none', building: null, units: [], unit: null, subtype: '', passiveTags: [] };

    var tags = live.length === 1 && RTS.Config.passiveTags ? RTS.Config.passiveTags(live[0]) : [];
    var subtype = live.length === 1
      ? (live[0].heroId ? 'Hero' : live[0].role)
      : (allSameRole(live) ? live[0].role : 'mixed');

    return {
      type: 'unit',
      building: null,
      units: live,
      unit: live.length === 1 ? live[0] : null,
      subtype: subtype,
      passiveTags: tags || [],
    };
  }

  function allSameRole(units) {
    if (!units.length) return true;
    var r = units[0].role;
    return units.every(function (u) { return u.role === r; });
  }

  // ---- Build panel ---------------------------------------------------------
  function renderBuildPanel(s) {
    var grid = D['build-panel-grid']; if (!grid) return;
    if (!s.ui.buildPanelOpen) { grid.innerHTML = ''; return; }

    var fid = s.playerFaction || 'aurex';
    var buildables = RTS.Config.getBuildables ? RTS.Config.getBuildables(fid) : [];
    grid.innerHTML = buildables.map(function (btype) {
      var cost = RTS.Config.buildCost ? RTS.Config.buildCost(btype) : 0;
      var canAfford = s.res.player.halcite >= cost;
      var icon = RTS.UI && RTS.UI.buildingUrl ? RTS.UI.buildingUrl(fid, btype) : '';
      return '<button class="cmd-slot' + (canAfford ? '' : ' disabled') + '" data-act="place" data-btype="' + btype + '">' +
        (icon ? '<img class="slot-icon" src="' + icon + '" alt="' + btype + '" />' : '') +
        '<span class="slot-cost">' + cost + '</span>' +
        '</button>';
    }).join('');
  }

  // ---- Pawn select sync ----------------------------------------------------
  function syncPawnSelectButtons(s) {
    var btns = document.querySelectorAll('[data-act="select-pawns"]');
    var hasPawns = (s.units || []).some(function (u) { return u.owner === 'player' && u.role === 'pawn'; });
    btns.forEach(function (b) { b.classList.toggle('disabled', !hasPawns); });
  }

  // ---- Combat mode icon sync -----------------------------------------------
  function syncCombatModeIcon(s) {
    var btn = D['btn-combat-mode']; if (!btn) return;
    var mode = s.combatMode || 'aggressive';
    var img = btn.querySelector('img');
    if (img && RTS.UI && RTS.UI.iconUrl) img.src = RTS.UI.iconUrl(mode);
    btn.setAttribute('aria-label', 'Combat mode: ' + mode);
  }

  function handleCombatMode(s) {
    var modes = ['aggressive', 'defensive', 'hold'];
    var cur = modes.indexOf(s.combatMode || 'aggressive');
    s.combatMode = modes[(cur + 1) % modes.length];
    RTS.Audio.play('click');
    RTS.HUD.sync(s);
  }

  // ---- Action dispatcher ---------------------------------------------------
  function handleAction(s, data) {
    if (!s || !data || !data.act) return;
    var act = data.act;
    RTS.Audio.play('click');

    if (act === 'train' && data.role && data.bid) {
      RTS.trainUnit && RTS.trainUnit(s, data.bid, data.role);
    } else if (act === 'sell' && data.bid) {
      RTS.sellBuilding && RTS.sellBuilding(s, data.bid);
    } else if (act === 'upgrade' && data.bid) {
      RTS.upgradeBuilding && RTS.upgradeBuilding(s, data.bid);
    } else if (act === 'toggle-automine' && data.bid) {
      RTS.toggleAutomine && RTS.toggleAutomine(s, data.bid);
    } else if (act === 'move') {
      s.pendingOrder = 'move';
    } else if (act === 'attack-move') {
      s.attackMoveArmed = !s.attackMoveArmed;
      RTS.refreshMode && RTS.refreshMode(s);
    } else if (act === 'stop') {
      RTS.orderStop && RTS.orderStop(s, RTS.activeSelectedUnits(s));
      s.attackMoveArmed = false;
      RTS.refreshMode && RTS.refreshMode(s);
    } else if (act === 'hero-ability' && data.uid) {
      RTS.triggerHeroAbility && RTS.triggerHeroAbility(s, data.uid);
    } else if (act === 'open-build') {
      s.ui.buildPanelOpen = true;
    } else if (act === 'place' && data.btype) {
      RTS.beginPlacement && RTS.beginPlacement(s, data.btype);
      s.ui.buildPanelOpen = false;
    }
    RTS.HUD.sync(s);
  }

  RTS.HUD.performAction = handleAction;

  function fmtTime(t) {
    var m = Math.floor(t / 60), sec = Math.floor(t % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

})(window.RTS = window.RTS || {});
