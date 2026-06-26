/* ============================================================================
 * Warcrest — hud.js
 * Mobile-first condensed bottom hub: squad chips · center info · 3×2 command card
 * + thumb combat cluster. Icon-first — no keyboard slot labels in player UI.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var D = {}; var getState;

  // WC3-style command card: 4 columns x 3 rows. Bottom row (r3) holds the
  // movement/combat commands; upper rows hold abilities / build / management.
  var CMD_SLOTS = [
    'r1c1', 'r1c2', 'r1c3', 'r1c4',
    'r2c1', 'r2c2', 'r2c3', 'r2c4',
    'r3c1', 'r3c2', 'r3c3', 'r3c4',
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

  // Top-centre emblem follows the player's faction.
  function syncFactionCrest(s) {
    var img = D['tb-crest'];
    if (!img || !s) return;
    var fid = s.playerFaction || 'aurex';
    var url = 'assets/ui/crests/' + fid + '.png?v=20260626b';
    if (img.getAttribute('src') !== url) img.setAttribute('src', url);
  }

  RTS.HUD = {
    init: function (getStateFn) {
      getState = getStateFn;
      ['res-halcite', 'res-supply', 'timer', 'btn-pause', 'command-deck', 'bottom-hub',
       'selpanel', 'squad-chips', 'squad-block', 'cmd-grid', 'command-card',
       'event-log', 'toast', 'gesture-hint', 'wave-timer',
       'btn-rail-army', 'btn-rail-pawns', 'btn-rail-base',
       'btn-combat-stop', 'btn-combat-mode', 'btn-combat-atk',
       'btn-hero-i1', 'btn-hero-i2', 'btn-hero-i3',
       'btn-build-hammer', 'build-panel', 'build-panel-grid', 'map-tools', 'tb-crest',
       'shop-panel', 'shop-grid', 'shop-head',
       'hub-minimap', 'hub-right', 'hub-hero', 'hub-action-grid', 'minimap'].forEach(function (id) {
        D[id] = $(id);
      });

      ['cmd-grid', 'selpanel', 'squad-chips', 'squad-block', 'hub-action-grid', 'topbar', 'command-deck',
       'bottom-hub', 'map-tools', 'build-panel', 'btn-build-hammer', 'hub-minimap', 'type-select'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', markUi, true);
        el.addEventListener('touchstart', markUi, true);
      });

      wireDelegatedTap($('type-select'), '[data-cat]', function (e, btn) {
        if (btn.classList.contains('disabled')) { RTS.Audio.play('deny'); return; }
        var st = getState();
        if (st) RTS.selectByCategory(st, btn.dataset.cat);
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

      ['btn-hero-i1', 'btn-hero-i2', 'btn-hero-i3'].forEach(function (bid, idx) {
        wireRail(bid, function (s) {
          var units = RTS.activeSelectedUnits ? RTS.activeSelectedUnits(s) : [];
          if (units.length === 1 && units[0].heroId) {
            var ok = RTS.triggerHeroAbility && RTS.triggerHeroAbility(s, units[0].id, idx);
            RTS.Audio.play(ok ? 'click' : 'deny');
            RTS.HUD.sync(s);
          }
        });
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
        if (s.ui.buildPanelOpen) { s.ui.shopOpen = null; if (RTS.BuildingMenu) RTS.BuildingMenu.close(s); }
        RTS.Audio.play('click');
        RTS.HUD.sync(s);
      });

      wireDelegatedTap(D['build-panel-grid'], '[data-act]', function (e, btn) {
        if (btn.classList.contains('disabled')) { RTS.Audio.play('deny'); return; }
        handleAction(getState(), btn.dataset);
      });

      wireDelegatedTap(D['shop-grid'], '[data-act]', function (e, btn) {
        if (btn.classList.contains('disabled')) { RTS.Audio.play('deny'); return; }
        handleAction(getState(), btn.dataset);
      });

      wireDelegatedTap(D['cmd-grid'], '[data-act]', function (e, btn) {
        if (btn.classList.contains('disabled') || btn.classList.contains('slot-hidden')) {
          RTS.Audio.play('deny'); return;
        }
        handleAction(getState(), btn.dataset);
      });

      wireDelegatedTap(D['selpanel'], '[data-act]', function (e, btn) {
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

      wireDelegatedTap(D['selpanel'], '[data-squad-role]', function (e, chip) {
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
      syncFactionCrest(s);

      if (D['btn-combat-atk']) D['btn-combat-atk'].classList.toggle('active', !!s.attackMoveArmed);
      syncAbilitySlots(s);

      if (D['btn-build-hammer']) {
        D['btn-build-hammer'].classList.toggle('active', !!s.ui.buildPanelOpen);
        D['btn-build-hammer'].setAttribute('aria-expanded', s.ui.buildPanelOpen ? 'true' : 'false');
      }

      var quickRail = deckOpen(s);
      if (D['btn-rail-army']) D['btn-rail-army'].classList.toggle('hidden', quickRail);
      if (D['btn-rail-pawns']) D['btn-rail-pawns'].classList.toggle('hidden', quickRail);

      renderBuildPanel(s);
      renderShopPanel(s);
      syncPawnSelectButtons(s);
      updateLayout(s);
      updateGestureHint(s);
      renderSquadBlock(s);
      renderCenterPanel(s);
      renderCommandCard(s);
      renderTypeSelect(s);
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
        D['wave-timer'].textContent = Math.ceil(rem) + 's';
        D['wave-timer'].parentElement && D['wave-timer'].parentElement.classList.toggle('warn', rem < 10);
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
    var chip = D['hub-minimap'];
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
    // Hub strip is always visible — no expand/collapse.
    // Action grid always shown; buttons dim/disable when nothing selected.
    var open = deckOpen(s);
    var hasUnits = open && RTS.activeSelectedUnits && RTS.activeSelectedUnits(s).length > 0;

    // Dim combat buttons when no units selected
    var ag = D['hub-action-grid'];
    if (ag) ag.classList.toggle('no-selection', !hasUnits);

    var bpanel = D['build-panel'];
    if (bpanel) bpanel.classList.toggle('hidden', !s.ui.buildPanelOpen);

    if (D['map-tools']) D['map-tools'].classList.toggle('hidden', open);
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
    var CIRC = 56.5; // 2π×9
    var MAX_SHOWN = 5;
    var chips = b.queue.slice(0, MAX_SHOWN).map(function (job, i) {
      var pct = job.total ? Math.max(0, Math.min(1, 1 - job.remaining / job.total)) : 0;
      var active = i === 0;
      var offset = active ? (CIRC * (1 - pct)).toFixed(1) : CIRC.toFixed(1);
      var ico = UI().avatarPortraitHtml(fid, job.role);
      return '<span class="qchip-ring' + (active ? ' active' : '') + '">' +
        '<svg class="qring-svg" viewBox="0 0 22 22" aria-hidden="true">' +
          '<circle class="qring-bg" cx="11" cy="11" r="9"/>' +
          (active ? '<circle class="qring-fill" cx="11" cy="11" r="9" stroke-dashoffset="' + offset + '"/>' : '') +
        '</svg>' +
        '<span class="qchip-ico unit-portrait-fill">' + ico + '</span>' +
        '</span>';
    }).join('');
    var overflow = b.queue.length > MAX_SHOWN
      ? '<span class="qchip-overflow">+' + (b.queue.length - MAX_SHOWN) + '</span>'
      : '';
    return '<div class="sel-queue sel-queue--circular">' + chips + overflow + '</div>';
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
      return 'to ' + RTS.resourceLabel(u.faction);
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

  function renderSquadChipsHtml(s) {
    var fid = s.playerFaction || 'aurex';
    return SQUAD_CHIPS.map(function (chip) {
      var count = chip.role === 'all'
        ? RTS.activeSelectedUnits(s).length
        : (s.units || []).filter(function (u) { return u.owner === 'player' && u.role === chip.role; }).length;
      var portrait = chip.role === 'all'
        ? UI().iconHtml('sword', 16)
        : UI().avatarPortraitHtml(fid, chip.role, 18);
      return '<button class="squad-chip' + (count === 0 ? ' disabled' : '') + '"' +
        ' data-squad-role="' + chip.role + '"' +
        ' aria-label="' + chip.label + ' squad">' +
        '<span class="sq-portrait unit-portrait-fill">' + portrait + '</span>' +
        '<span class="sq-tag">' + chip.label + '</span>' +
        (chip.role !== 'all' && count ? '<span class="sq-count">' + count + '</span>' : '') +
        '</button>';
    }).join('');
  }

  function renderCenterPanel(s) {
    var p = D['selpanel']; if (!p) return;
    p.innerHTML = '';
    p.classList.remove('has-queue', 'has-tags', 'has-squad');
    if (!deckOpen(s)) return;

    var prof = selectionProfile(s);
    var units = prof.units || RTS.activeSelectedUnits(s);
    var b = prof.building;

    if (prof.type === 'building' && b) {
      var fid = s.playerFaction || 'aurex';
      var portraitKey = b.type === 'outpost' ? 'outpost' : b.type;

      if (!b.built) {
        p.innerHTML =
          '<div class="hub-zone-a">' +
            '<div class="hub-portrait unit-portrait-fill">' + UI().buildingPortraitHtml(b.faction, portraitKey) + '</div>' +
            bar(b.progress, 1) +
          '</div>' +
          '<div class="hub-zone-b"></div>' +
          '<div class="hub-zone-c">' +
            '<div class="hub-title">' + RTS.nameFor(b.faction, b.type) + '</div>' +
            '<div class="hub-subtype">Building\u2026</div>' +
            '<div class="hub-status">' + Math.floor(b.progress * 100) + '% built</div>' +
          '</div>';
        return;
      }

      // Built building \u2014 the MIDDLE zone shows info + the production queue
      // only. The buildable units live in the command card (left zone).
      var queueHtml = renderBuildingQueue(s, b);
      if (queueHtml) p.classList.add('has-queue');
      if (prof.passiveTags.length) p.classList.add('has-tags');
      var qLen = b.queue ? b.queue.length : 0;
      var canTrain = RTS.Config.getTrainableUnits &&
        RTS.Config.getTrainableUnits(fid, b.type).length > 0;
      var statusLine = qLen
        ? ('Training ' + qLen + (qLen > 1 ? ' units' : ' unit') + '\u2026')
        : (canTrain ? 'Ready to train' : 'Hold ground \u2192 rally');
      // Centered stack: portrait + title on top, queue underneath (no side bleed).
      p.classList.add('is-building');
      p.innerHTML =
        '<div class="hub-bld">' +
          '<div class="hub-portrait unit-portrait-fill">' + UI().buildingPortraitHtml(b.faction, portraitKey) + '</div>' +
          '<div class="hub-title">' + RTS.nameFor(b.faction, b.type) + '</div>' +
          '<div class="hub-status">' + statusLine + '</div>' +
          bar(b.hp, b.maxHp) +
          (queueHtml ? '<div class="hub-bld-queue">' + queueHtml + '</div>' : '') +
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

      if (units.length > 1) {
        p.classList.add('has-squad');
        p.innerHTML =
          '<div class="hub-squad-row">' + renderSquadChipsHtml(s) + '</div>' +
          '<div class="hub-info-row">' +
            '<div class="hub-zone-c">' +
              '<div class="hub-title">' + title + '</div>' +
              '<div class="hub-status">' + status + '</div>' +
            '</div>' +
          '</div>' +
          bar(totHp, totMax);
        return;
      }

      if (prof.passiveTags.length) p.classList.add('has-tags');
      p.innerHTML =
        '<div class="hub-zone-a">' +
          '<div class="hub-portrait unit-portrait-fill">' +
          (units[0].heroId && UI().heroPortraitHtml
            ? UI().heroPortraitHtml(units[0].heroId)
            : UI().avatarPortraitHtml(s.playerFaction, units[0].role)) +
          '</div>' +
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
      passive: !!opts.passive,
      bid: opts.bid,
      uid: opts.uid,
      cost: opts.cost,
      role: opts.role,
      abId: opts.abId,
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
      var cls = 'cmd-slot' + (sl.disabled ? ' disabled' : '') + (sl.targeting ? ' targeting' : '') + (sl.autocast ? ' autocast' : '') + (sl.passive ? ' passive' : '');
      var cdStyle = sl.cooldown > 0 ? ' style="--cd:' + sl.cooldown + '"' : '';
      var costHtml = sl.cost ? '<span class="slot-cost">' + sl.cost + '</span>' : '';
      var iconHtml = sl.icon ? '<img class="slot-icon" src="' + sl.icon + '" alt="" />' : '';
      html += '<button class="' + cls + '" data-slot="' + sid + '" data-act="' + (sl.act || '') + '"' +
        (sl.bid ? ' data-bid="' + sl.bid + '"' : '') +
        (sl.uid ? ' data-uid="' + sl.uid + '"' : '') +
        (sl.abId ? ' data-abid="' + sl.abId + '"' : '') +
        (sl.role ? ' data-role="' + sl.role + '"' : '') +
        cdStyle +
        (sl.disabled ? ' disabled' : '') +
        ' aria-label="' + (sl.label || sl.act || '') + '">' +
        iconHtml + costHtml +
        '</button>';
    });
    grid.innerHTML = html;
  }

  // Type-select bar (Worker | Melee | Ranged | Caster): live counts + active state.
  function renderTypeSelect(s) {
    var bar = $('type-select'); if (!bar) return;
    var selected = RTS.activeSelectedUnits ? RTS.activeSelectedUnits(s) : [];
    var chips = bar.querySelectorAll('[data-cat]');
    var fid = s.playerFaction || 'aurex';
    Array.prototype.forEach.call(chips, function (chip) {
      var cat = chip.dataset.cat;
      var roles = (RTS.CATEGORY_ROLES && RTS.CATEGORY_ROLES[cat]) || [];
      // Populate the representative unit portrait once per faction.
      if (chip._iconFid !== fid) {
        var ico = chip.querySelector('.ts-ico');
        if (ico && UI().avatarPortraitHtml) {
          ico.innerHTML = UI().avatarPortraitHtml(fid, chip.dataset.role, 18);
          chip._iconFid = fid;
        }
      }
      var count = RTS.unitsOfCategory ? RTS.unitsOfCategory(s, cat).length : 0;
      chip.classList.toggle('disabled', count === 0);
      var badge = chip.querySelector('.ts-count');
      if (badge) badge.textContent = count ? count : '';
      var active = count > 0 && selected.length > 0 && selected.every(function (u) {
        return roles.indexOf(u.role) >= 0 || (cat === 'caster' && u.heroId);
      });
      chip.classList.toggle('active', active);
    });
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
    if (!b.built) return model;
    var fid = s.playerFaction || 'aurex';

    // ── Buildable units (top rows) — what this building produces. ──
    var trainable = RTS.Config.getTrainableUnits ? RTS.Config.getTrainableUnits(fid, b.type) : [];
    var trainSlots = ['r1c1', 'r1c2', 'r1c3', 'r1c4', 'r2c1', 'r2c2', 'r2c3', 'r2c4'];
    trainable.slice(0, trainSlots.length).forEach(function (role, i) {
      var cost = RTS.Config.unitCost ? RTS.Config.unitCost(role, fid) : 0;
      var atCap = s.res.player.supplyUsed >= s.res.player.supplyCap;
      var icon = (UI().unitAvatarUrl ? UI().unitAvatarUrl(fid, role) : null) || UI().iconUrl(role) || '';
      model[trainSlots[i]] = slot('train', icon, {
        slotId: trainSlots[i], label: RTS.nameFor(fid, role), role: role, bid: b.id,
        cost: cost, disabled: atCap || s.res.player.halcite < cost,
      });
    });

    // ── Management (bottom row) ──
    // "Cancel" subtracts the most recent unit from the production queue
    // (it does NOT sell the building).
    var hasQueue = b.queue && b.queue.length > 0;
    model['r3c1'] = slot('cancel-train', UI().iconUrl('cancel') || '', {
      slotId: 'r3c1', label: 'Cancel last from queue', bid: b.id, disabled: !hasQueue,
    });
    // Base Arrow Tower can specialise into a long-range Arrow Tower or a Bombard.
    if (b.type === 'turret' && !b.towerType && !b.upgrading && RTS.TowerUpgrades) {
      var arrow = RTS.TowerUpgrades.arrow, bombard = RTS.TowerUpgrades.bombard;
      model['r3c2'] = slot('upgrade-tower', UI().iconUrl('upgrade') || '', {
        slotId: 'r3c2', label: arrow.label, bid: b.id, variant: 'arrow', cost: arrow.cost,
        disabled: s.res.player.halcite < arrow.cost,
      });
      model['r3c3'] = slot('upgrade-tower', UI().iconUrl('upgrade') || '', {
        slotId: 'r3c3', label: bombard.label, bid: b.id, variant: 'bombard', cost: bombard.cost,
        disabled: s.res.player.halcite < bombard.cost,
      });
    } else if (RTS.Config.canUpgrade && RTS.Config.canUpgrade(b)) {
      var upCost = RTS.Config.upgradeCost ? RTS.Config.upgradeCost(b) : 0;
      var upLabel = 'Upgrade';
      if (b.type === 'core') {
        var cspec = RTS.Buildings.core;
        upLabel = 'Build ' + ((cspec.tierName && cspec.tierName[(b.level || 1)]) || 'Keep');
      }
      model['r3c2'] = slot('upgrade', UI().iconUrl('upgrade') || '', {
        slotId: 'r3c2', label: upLabel, bid: b.id, cost: upCost,
        disabled: s.res.player.halcite < upCost,
      });
    }
    if (b.type === 'barracks' || b.type === 'keep') {
      model['r3c3'] = slot('toggle-automine', UI().iconUrl('automine') || '', {
        slotId: 'r3c3', label: 'Auto-mine', bid: b.id, autocast: !!b.autoMine,
      });
    }

    return model;
  }

  function buildUnitCommands(s, prof, model) {
    var units = prof.units || [];
    if (!units.length) return model;

    // ── Abilities / passive (top row) ──
    // Hero kit: passive (always-on) + up to 3 actives, locked by level.
    if (units.length === 1 && units[0].heroId && RTS.getHero) {
      var h = RTS.getHero(units[0].heroId);
      if (h) {
        var lvl = units[0].level || 1;
        if (h.passive) {
          model['r1c1'] = slot('hero-passive', UI().iconUrl('ability') || '', {
            slotId: 'r1c1', label: h.passive.name + ' — passive',
            passive: true, disabled: true,
          });
        }
        var aSlots = ['r1c2', 'r1c3', 'r1c4'];
        (h.abilities || []).slice(0, 3).forEach(function (ab, i) {
          var locked = (ab.unlockLevel || 1) > lvl;
          model[aSlots[i]] = slot('hero-ability', UI().iconUrl('ability') || '', {
            slotId: aSlots[i], label: ab.name, uid: units[0].id,
            disabled: locked, cost: locked ? ('L' + (ab.unlockLevel || 1)) : 0,
          });
        });
      }
    }
    // Regular-unit abilities (autocast toggles) — top row, after any hero kit.
    if (units.length === 1 && !units[0].heroId && RTS.abilityList) {
      var au = units[0];
      var abs = RTS.abilityList(au);
      var abSlots = ['r1c1', 'r1c2', 'r1c3'];
      abs.slice(0, 3).forEach(function (ab, i) {
        var ready = (au.mana || 0) >= ab.manaCost;
        var cdLeft = au._abilityCd && au._abilityCd[ab.id]
          ? Math.max(0, au._abilityCd[ab.id] - (s.timers.gameTime || 0)) : 0;
        var manual = ab.cast === 'enemy' || ab.cast === 'point';
        var armed = manual && s.pendingAbility && s.pendingAbility.uid === au.id && s.pendingAbility.abId === ab.id;
        model[abSlots[i]] = slot('unit-ability', ab.icon || '', {
          slotId: abSlots[i],
          label: ab.name + (manual ? '' : (ab.autocastDefault ? ' (autocast)' : '')),
          uid: au.id, abId: ab.id,
          autocast: manual ? false : RTS.autocastOn(au, ab.id),
          targeting: !!armed,
          cooldown: cdLeft > 0 ? cdLeft / ab.cooldown : 0,
          disabled: !ready && cdLeft <= 0,
        });
      });
    }
    // Pawn build shortcut
    if (units.some(function (u) { return u.role === 'pawn'; })) {
      model['r1c1'] = slot('open-build', UI().iconUrl('build') || '', {
        slotId: 'r1c1', label: 'Build',
      });
    }

    // ── Movement / combat commands (bottom row, WC3 convention) ──
    model['r3c1'] = slot('move', UI().iconUrl('move') || '', { slotId: 'r3c1', label: 'Move' });
    model['r3c2'] = slot('patrol', UI().iconUrl('patrol') || UI().iconUrl('move') || '', {
      slotId: 'r3c2', label: 'Patrol', targeting: !!s.patrolArmed,
    });
    model['r3c3'] = slot('attack-move', UI().iconUrl('attack') || '', {
      slotId: 'r3c3', label: 'Attack-move', targeting: !!s.attackMoveArmed,
    });
    model['r3c4'] = slot('stop', UI().iconUrl('stop') || '', { slotId: 'r3c4', label: 'Stop' });

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

  function selectedHero(s) {
    var units = RTS.activeSelectedUnits ? RTS.activeSelectedUnits(s) : [];
    for (var i = 0; i < units.length; i++) if (units[i].heroId) return units[i];
    return null;
  }

  function renderShopPanel(s) {
    var panel = D['shop-panel'], grid = D['shop-grid'];
    if (!panel || !grid) return;
    var open = !!s.ui.shopOpen;
    panel.classList.toggle('hidden', !open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (!open) { grid.innerHTML = ''; return; }

    if (s.ui.shopOpen === 'mercenary') {
      grid.innerHTML = '<div style="padding:10px;opacity:.8">Mercenaries — coming soon.</div>';
      if (D['shop-head']) D['shop-head'].textContent = 'Mercenary Camp';
      return;
    }
    var hero = selectedHero(s);
    var slotsUsed = hero ? (hero.items || []).length : 0;
    if (D['shop-head']) {
      D['shop-head'].textContent = hero
        ? ('Merchant — ' + RTS.nameFor(hero.faction, hero.heroId) + '  (' + slotsUsed + '/' + RTS.Items.MAX_SLOTS + ' slots)')
        : 'Merchant — select a hero to equip';
    }
    var gold = s.res.player.halcite;
    grid.innerHTML = (RTS.ItemShopOrder || []).map(function (id) {
      var it = RTS.Items[id]; if (!it) return '';
      var afford = hero && gold >= it.cost && slotsUsed < RTS.Items.MAX_SLOTS;
      return '<button class="cmd-slot' + (afford ? '' : ' disabled') + '" data-act="buy-item" data-item="' + id + '" ' +
        'title="' + it.name + ' — ' + it.desc + '">' +
        '<img class="slot-icon" src="' + it.icon + '" alt="' + it.name + '" />' +
        '<span class="slot-cost">' + it.cost + '</span></button>';
    }).join('');
  }

  // ---- Pawn select sync ----------------------------------------------------
  function syncPawnSelectButtons(s) {
    var btns = document.querySelectorAll('[data-act="select-pawns"]');
    var hasPawns = (s.units || []).some(function (u) { return u.owner === 'player' && u.role === 'pawn'; });
    btns.forEach(function (b) { b.classList.toggle('disabled', !hasPawns); });
  }

  // ---- Ability slot (I-row) sync -------------------------------------------
  function syncAbilitySlots(s) {
    var slotIds = ['btn-hero-i1', 'btn-hero-i2', 'btn-hero-i3'];
    var units = RTS.activeSelectedUnits ? RTS.activeSelectedUnits(s) : [];
    var sel = units.length === 1 && units[0].heroId ? units[0] : null;
    var hero = sel && RTS.getHero ? RTS.getHero(sel.heroId) : null;
    var abilities = (hero && hero.abilities) ? hero.abilities : [];
    var now = (s.timers && s.timers.gameTime) || 0;
    slotIds.forEach(function (bid, i) {
      var btn = D[bid];
      if (!btn) return;
      var ab = abilities[i];
      if (sel && ab) {
        var iconUrl = 'assets/heroes/' + hero.faction + '/' + hero.id + '/abilities/' + ab.id + '.png';
        var img = btn.querySelector('img') || document.createElement('img');
        img.className = 'ic-ts'; img.alt = ab.name; img.src = iconUrl;
        if (!btn.contains(img)) btn.appendChild(img);
        var cdLeft = (sel._abilityCd && sel._abilityCd[ab.id])
          ? Math.max(0, sel._abilityCd[ab.id] - now) : 0;
        var busy = !!sel._channel;
        var locked = ab.unlockLevel && (sel.level || 1) < ab.unlockLevel;
        btn.disabled = locked || cdLeft > 0 || busy;
        btn.classList.toggle('act-slot-ability', cdLeft > 0);
        btn.classList.toggle('act-slot-locked', !!locked);
        btn.classList.remove('act-slot-empty');
        btn.setAttribute('aria-label', locked
          ? (ab.name + ' (locks until level ' + ab.unlockLevel + ')')
          : (ab.name + (cdLeft > 0 ? (' (' + Math.ceil(cdLeft) + 's)') : '')));
      } else {
        btn.innerHTML = '';
        btn.disabled = true;
        btn.className = 'act-slot act-slot-empty ts-round-btn';
        btn.setAttribute('aria-label', '');
      }
    });
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
    } else if (act === 'cancel-train' && data.bid) {
      var cb = (s.entities.buildings || []).find(function (x) { return x.id === data.bid; });
      if (cb && cb.queue && cb.queue.length && RTS.cancelTrainQueueItem) {
        RTS.cancelTrainQueueItem(s, data.bid, cb.queue.length - 1);
      } else {
        RTS.Audio.play('deny');
      }
    } else if (act === 'upgrade' && data.bid) {
      RTS.upgradeBuilding && RTS.upgradeBuilding(s, data.bid);
    } else if (act === 'upgrade-tower' && data.bid) {
      RTS.upgradeTower && RTS.upgradeTower(s, data.bid, data.variant);
    } else if (act === 'toggle-automine' && data.bid) {
      RTS.toggleAutomine && RTS.toggleAutomine(s, data.bid);
    } else if (act === 'move') {
      s.pendingOrder = 'move';
      s.ui.lastUiAt = 0;
      if (RTS.Input && RTS.Input.ensureHeroTestSelection) {
        RTS.Input.ensureHeroTestSelection(s);
      }
      if (RTS.activeCombatUnits && RTS.activeCombatUnits(s).length) {
        RTS.toast && RTS.toast(s, 'Tap ground to move');
      } else if (s.map && s.map.heroTestFocus) {
        RTS.toast && RTS.toast(s, 'Tap ground to move');
      }
    } else if (act === 'attack-move') {
      s.attackMoveArmed = !s.attackMoveArmed;
      if (s.attackMoveArmed) s.patrolArmed = false;
      RTS.refreshMode && RTS.refreshMode(s);
    } else if (act === 'patrol') {
      s.patrolArmed = !s.patrolArmed;
      if (s.patrolArmed) {
        s.attackMoveArmed = false;
        RTS.toast && RTS.toast(s, 'Tap ground to patrol');
      }
      RTS.refreshMode && RTS.refreshMode(s);
    } else if (act === 'stop') {
      RTS.orderStop && RTS.orderStop(s, RTS.activeSelectedUnits(s));
      s.attackMoveArmed = false;
      s.patrolArmed = false;
      RTS.refreshMode && RTS.refreshMode(s);
    } else if (act === 'hero-ability' && data.uid) {
      RTS.triggerHeroAbility && RTS.triggerHeroAbility(s, data.uid);
    } else if (act === 'unit-ability' && data.uid && data.abid) {
      var ab = RTS.Abilities && RTS.Abilities[data.abid];
      if (ab && (ab.cast === 'enemy' || ab.cast === 'point')) {
        // arm a target cursor; the next world tap casts it (see input.js)
        if (s.pendingAbility && s.pendingAbility.abId === data.abid) {
          s.pendingAbility = null;                     // tap again to cancel
        } else {
          s.pendingAbility = { uid: +data.uid, abId: data.abid, cast: ab.cast };
          s.attackMoveArmed = false; s.patrolArmed = false;
          RTS.toast && RTS.toast(s, 'Pick a target for ' + ab.name);
        }
        RTS.refreshMode && RTS.refreshMode(s);
      } else {
        RTS.toggleAutocast && RTS.toggleAutocast(s, +data.uid, data.abid);
      }

    } else if (act === 'open-build') {
      s.ui.buildPanelOpen = true;
    } else if (act === 'place' && data.btype) {
      RTS.beginPlacement && RTS.beginPlacement(s, data.btype);
      s.ui.buildPanelOpen = false;
    } else if (act === 'buy-item' && data.item) {
      var hero = selectedHero(s);
      if (!hero) { RTS.toast(s, 'Select a hero first'); RTS.Audio.play('deny'); }
      else {
        var res = RTS.buyItemForHero(s, hero, data.item);
        if (res.ok) { RTS.toast(s, 'Equipped ' + res.item.name); RTS.Audio.play('click'); }
        else { RTS.toast(s, res.msg); RTS.Audio.play('deny'); }
      }
    } else if (act === 'close-shop') {
      s.ui.shopOpen = null;
    }
    RTS.HUD.sync(s);
  }

  RTS.HUD.performAction = handleAction;

  function fmtTime(t) {
    var m = Math.floor(t / 60), sec = Math.floor(t % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

})(window.RTS = window.RTS || {});
