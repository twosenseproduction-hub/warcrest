/* ============================================================================
 * EXOFRONT — hud.js
 * Wild Rift-style HUD: minimal floating chrome, context deck on selection,
 * thumb-cluster for combat. Tray = train/build only (no duplicate commands).
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var D = {}; var getState;
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
      ['res-halcite', 'res-supply', 'timer', 'btn-pause', 'command-deck', 'thumb-cluster',
       'selpanel', 'unit-group-strip', 'action-tray', 'event-log', 'toast', 'gesture-hint', 'wave-timer',
       'btn-rail-army', 'btn-rail-pawns', 'btn-rail-stop', 'btn-rail-atk', 'btn-rail-base',
       'btn-build-hammer', 'build-panel', 'build-panel-grid', 'map-tools'].forEach(function (id) {
        D[id] = $(id);
      });

      ['action-tray', 'selpanel', 'unit-group-strip', 'topbar', 'command-deck', 'thumb-cluster', 'map-tools',
       'build-panel', 'btn-build-hammer'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', markUi, true);
        el.addEventListener('touchstart', markUi, true);
      });
      D['hero-portrait'] = ensureHeroPortrait();
      D['btn-pause'] && D['btn-pause'].addEventListener('click', function () { RTS.Game.togglePause(); });

      wireRail('btn-rail-army', function (s) { RTS.selectAllArmy(s); RTS.Audio.play('click'); });
      wireRail('btn-rail-pawns', function (s) {
        if (RTS.selectAllWorkers(s)) {
          RTS.toast(s, 'Pawns selected');
          RTS.Audio.play('click');
        }
      });
      wireRail('btn-rail-stop', function (s) { RTS.orderStop(s, RTS.activeSelectedUnits(s)); RTS.Audio.play('click'); });
      wireRail('btn-rail-atk', function (s) {
        s.attackMoveArmed = !s.attackMoveArmed; RTS.refreshMode(s); RTS.Audio.play('click'); RTS.HUD.sync(s);
      });
      wireRail('btn-rail-base', function (s) {
        var core = RTS.playerCore(s);
        if (core) { RTS.Cam.centerOn(s, core.x, core.y); RTS.Audio.play('click'); }
      });

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

      wireDelegatedTap(D['action-tray'], '[data-act]', function (e, btn) {
        if (btn.classList.contains('disabled')) { RTS.Audio.play('deny'); return; }
        handleAction(getState(), btn.dataset);
      });

      wireDelegatedTap(D['unit-group-strip'], '[data-macro-role]', function (e, chip) {
        var s = getState();
        if (!s) return;
        markUi();
        var role = chip.dataset.macroRole;
        if (role === 'all') {
          if (RTS.selectMacroAll(s)) RTS.Audio.play('click');
        } else if (RTS.selectMacroGroup(s, role)) {
          RTS.Audio.play('click');
        }
      });
    },

    sync: function (s) {
      syncResources(s);
      syncRailBaseIcon(s);

      if (D['btn-rail-atk']) D['btn-rail-atk'].classList.toggle('active', !!s.attackMoveArmed);

      if (D['btn-build-hammer']) {
        D['btn-build-hammer'].classList.toggle('active', !!s.ui.buildPanelOpen);
        D['btn-build-hammer'].setAttribute('aria-expanded', s.ui.buildPanelOpen ? 'true' : 'false');
      }
      renderBuildPanel(s);
      syncPawnSelectButtons(s);
      updateLayout(s);
      updateGestureHint(s);
      renderSelPanel(s);
      renderUnitGroupStrip(s);
      renderTray(s);
      renderHeroPortrait(s);
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
      renderHeroPortrait(s);

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

  function ensureHeroPortrait() {
    var el = document.getElementById('hero-portrait');
    if (el) return el;
    var hud = document.getElementById('hud');
    if (!hud) return null;
    el = document.createElement('div');
    el.id = 'hero-portrait';
    el.className = 'hero-portrait hidden';
    hud.appendChild(el);
    return el;
  }

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function renderHeroPortrait(s) {
    var el = D['hero-portrait'] || ensureHeroPortrait();
    if (!el || !s || s.scene !== 'playing' && s.scene !== 'paused') {
      if (el) el.classList.add('hidden');
      return;
    }
    var heroUnit = RTS.getById(s, s.heroes && s.heroes.player);
    if (!heroUnit || !heroUnit.isHero) {
      el.classList.add('hidden');
      return;
    }
    var spec = RTS.Heroes && RTS.Heroes[heroUnit.heroId] || {};
    var faction = RTS.Factions[heroUnit.faction] || RTS.Factions[s.playerFaction] || {};
    var pct = heroUnit.maxHp ? Math.max(0, Math.min(1, heroUnit.hp / heroUnit.maxHp)) : 0;
    var dead = !!heroUnit.dead || heroUnit.respawnTimer != null;
    var initial = (heroUnit.name || spec.name || '?').charAt(0).toUpperCase();
    var barClass = pct <= 0.25 ? ' is-crit' : pct <= 0.55 ? ' is-warn' : '';
    var body = dead
      ? '<div class="hero-respawn">Respawns in <b>' + Math.ceil(heroUnit.respawnTimer || 0) + 's</b></div>'
      : '<div class="hero-hpbar' + barClass + '"><i style="width:' + (pct * 100) + '%"></i></div>';
    el.className = 'hero-portrait' + (dead ? ' is-dead' : '');
    el.style.setProperty('--hero-color', faction.primary || '#1565c0');
    el.innerHTML =
      '<div class="hero-face" aria-hidden="true">' + esc(initial) +
        '<span class="hero-level">' + esc(heroUnit.level || 1) + '</span></div>' +
      '<div class="hero-info">' +
        '<div class="hero-name">' + esc(heroUnit.name || spec.name || 'Hero') + '</div>' +
        '<div class="hero-class">' + esc(spec.class || 'Hero') + '</div>' +
        body +
      '</div>';
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

  function macroBarActive(s) {
    if (!s.ui.macroGroups || !RTS.macroGroupRoles) return false;
    return RTS.macroGroupRoles(s).length >= 2;
  }

  function deckOpen(s) {
    if (s.inputMode === 'place-building') return true;
    return RTS.selectedUnits(s).length > 0 || RTS.selectedBuildings(s).length > 0;
  }

  function thumbOpen(s) {
    if (s.inputMode === 'place-building') return false;
    return RTS.selectedUnits(s).length > 0 || RTS.selectedBuildings(s).length > 0;
  }

  function updateLayout(s) {
    var deck = D['command-deck'];
    var thumb = D['thumb-cluster'];
    if (deck) {
      var open = deckOpen(s);
      deck.classList.toggle('expanded', open);
      deck.classList.toggle('collapsed', !open);
    }
    if (thumb) thumb.classList.toggle('hidden', !thumbOpen(s));
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
      text = 'Double-tap ground = army · tap group avatars to macro · hammer = build';
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

  function selPortrait(s, kind, isBuilding) {
    var fid = s.playerFaction || 'aurex';
    var inner = isBuilding
      ? UI().buildingPortraitHtml(fid, kind, 28)
      : UI().avatarPortraitHtml(fid, kind, 28);
    return '<div class="sel-portrait">' + inner + '</div>';
  }

  function renderUnitGroupStrip(s) {
    var strip = D['unit-group-strip'];
    if (!strip) return;
    strip.innerHTML = '';
    if (!macroBarActive(s)) {
      strip.classList.add('hidden');
      return;
    }
    strip.classList.remove('hidden');
    var fid = s.playerFaction || 'aurex';
    var roles = RTS.macroGroupRoles(s);
    var total = 0;
    roles.forEach(function (role) { total += s.ui.macroGroups[role].length; });

    function addChip(roleKey, label, count, active, portraitHtml) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'unit-group-chip' + (active ? ' active' : '');
      chip.dataset.macroRole = roleKey;
      chip.innerHTML =
        '<span class="ug-portrait">' + portraitHtml + '</span>' +
        '<span class="ug-count">' + count + '</span>' +
        '<span class="ug-label">' + label + '</span>';
      strip.appendChild(chip);
    }

    addChip('all', 'All', total, !s.ui.macroRole, UI().iconHtml('sword', 22));
    roles.forEach(function (role) {
      var count = s.ui.macroGroups[role].length;
      addChip(role, RTS.nameFor(fid, role), count, s.ui.macroRole === role,
        UI().avatarPortraitHtml(fid, role, 30));
    });
  }

  function renderSelPanel(s) {
    var p = D['selpanel']; if (!p) return;
    p.innerHTML = '';
    p.classList.remove('has-queue', 'has-macro');
    if (!deckOpen(s)) return;

    var units = RTS.activeSelectedUnits(s);
    var allUnits = RTS.selectedUnits(s);
    var blds = RTS.selectedBuildings(s);
    var macro = macroBarActive(s);

    if (macro && allUnits.length) {
      p.classList.add('has-macro');
      var focusRole = s.ui.macroRole || (units.length === 1 ? units[0].role : null);
      var focusUnits = units.length ? units : allUnits;
      var totHp = 0, totMax = 0;
      focusUnits.forEach(function (u) { totHp += u.hp; totMax += u.maxHp; });
      var titleRole = focusRole || 'mixed';
      var title = focusRole
        ? focusUnits.length + ' ' + RTS.nameFor(s.playerFaction, focusRole) + (focusUnits.length > 1 ? 's' : '')
        : allUnits.length + ' units';
      p.innerHTML = selPortrait(s, focusRole || 'lancer', false) + '<div class="sel-body">' +
        '<div class="sel-title">' + title + '</div>' +
        '<div class="sel-line">Tap a group to command it</div>' +
        bar(totHp, totMax) + '</div>';
      return;
    }

    if (blds.length === 1 && !units.length) {
      var b = blds[0];
      var portraitKey = b.type === 'outpost' ? 'outpost' : b.type;
      var queueHtml = renderBuildingQueue(s, b);
      if (queueHtml) p.classList.add('has-queue');
      p.innerHTML = selPortrait(s, portraitKey, true) + '<div class="sel-body">' +
        '<div class="sel-title">' + RTS.nameFor(b.faction, b.type) + '</div>' +
        bar(b.hp, b.maxHp) +
        queueHtml +
        (!b.built ? '<div class="sel-line">' + Math.floor(b.progress * 100) +
          '% · tap Cancel Build below</div>' :
          '<div class="sel-line">Hold ground → rally</div>') +
        '</div>';
      return;
    }

    if (units.length === 1 && !blds.length) {
      var u = units[0];
      p.innerHTML = selPortrait(s, u.role, false) + '<div class="sel-body">' +
        '<div class="sel-title">' + RTS.nameFor(u.faction, u.role) + '</div>' +
        bar(u.hp, u.maxHp) +
        (u.role === 'pawn' && u.buildTask
          ? '<div class="sel-line">building…</div>'
          : u.role === 'pawn' && u.harvest
          ? '<div class="sel-line">' + (
              u.harvest.phase === 'mining' ? 'mining…'
              : u.harvest.phase === 'toBase' && u.harvest.carry > 0
                ? 'returning +' + Math.floor(u.harvest.carry)
                : 'to Ironstone'
            ) + '</div>'
          : u.role === 'pawn'
          ? '<div class="sel-line">Hold site → build</div>'
          : '') +
        '</div>';
      return;
    }

    if (units.length > 1 && !blds.length) {
      var totHp = 0, totMax = 0;
      units.forEach(function (u) { totHp += u.hp; totMax += u.maxHp; });
      p.innerHTML = selPortrait(s, units[0].role, false) + '<div class="sel-body">' +
        '<div class="sel-title">' + units.length + ' units</div>' +
        bar(totHp, totMax) + '</div>';
      return;
    }

    var all = units.concat(blds);
    var totHp2 = 0, totMax2 = 0;
    all.forEach(function (e) { totHp2 += e.hp; totMax2 += e.maxHp; });
    p.innerHTML = selPortrait(s, 'lancer', false) + '<div class="sel-body">' +
      '<div class="sel-title">' + all.length + ' units</div>' +
      bar(totHp2, totMax2) + '</div>';
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

  function renderTray(s) {
    var tray = D['action-tray']; if (!tray) return;
    tray.innerHTML = '';

    if (s.inputMode === 'place-building') {
      tray.appendChild(actionBtn(UI().iconHtml('cancel', 22), { act: 'cancel-place' }, false, 'danger'));
      return;
    }

    var blds = RTS.selectedBuildings(s);
    if (blds.length === 1 && !blds[0].built) {
      tray.appendChild(actionBtn(UI().iconHtml('cancel', 22), { act: 'cancel-build', bid: blds[0].id }, false, 'danger'));
    }
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

  function handleAction(s, data) {
    if (!s || !data || !data.act) return;
    markUi();
    switch (data.act) {
      case 'stop': RTS.orderStop(s, RTS.activeSelectedUnits(s)); RTS.Audio.play('click'); break;
      case 'attackmove': s.attackMoveArmed = !s.attackMoveArmed; RTS.refreshMode(s); RTS.Audio.play('click'); RTS.HUD.sync(s); break;
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
          RTS.HUD.sync(s);
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
    }
    RTS.HUD.sync(s);
  }

  function fmtTime(t) {
    var m = Math.floor(t / 60), sec = Math.floor(t % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

})(window.RTS = window.RTS || {});
