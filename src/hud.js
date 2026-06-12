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

  RTS.HUD = {
    init: function (getStateFn) {
      getState = getStateFn;
      ['res-halcite', 'res-supply', 'timer', 'btn-pause', 'command-deck', 'thumb-cluster',
       'selpanel', 'action-tray', 'event-log', 'toast', 'gesture-hint', 'wave-timer',
       'btn-rail-army', 'btn-rail-stop', 'btn-rail-atk', 'btn-rail-base'].forEach(function (id) {
        D[id] = $(id);
      });

      ['action-tray', 'selpanel', 'topbar', 'command-deck', 'thumb-cluster', 'minimap-chip'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', markUi, true);
        el.addEventListener('touchstart', markUi, true);
      });
      D['btn-pause'] && D['btn-pause'].addEventListener('click', function () { RTS.Game.togglePause(); });

      wireRail('btn-rail-army', function (s) { RTS.selectAllArmy(s); RTS.Audio.play('click'); });
      wireRail('btn-rail-stop', function (s) { RTS.orderStop(s, RTS.selectedUnits(s)); RTS.Audio.play('click'); });
      wireRail('btn-rail-atk', function (s) {
        s.attackMoveArmed = !s.attackMoveArmed; RTS.refreshMode(s); RTS.Audio.play('click'); RTS.HUD.sync(s);
      });
      wireRail('btn-rail-base', function (s) {
        var core = RTS.playerCore(s);
        if (core) { RTS.Cam.centerOn(s, core.x, core.y); RTS.Audio.play('click'); }
      });

      D['action-tray'] && D['action-tray'].addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]'); if (!btn) return;
        if (btn.classList.contains('disabled')) { RTS.Audio.play('deny'); return; }
        handleAction(getState(), btn.dataset);
      });
    },

    sync: function (s) {
      if (!D['res-halcite']) return;
      D['res-halcite'].textContent = Math.floor(s.res.player.halcite);
      var sp = s.res.player;
      D['res-supply'].textContent = sp.supplyUsed + '/' + sp.supplyCap;
      D['res-supply'].className = sp.supplyUsed >= sp.supplyCap ? 'val warn' : 'val';

      if (D['btn-rail-atk']) D['btn-rail-atk'].classList.toggle('active', !!s.attackMoveArmed);

      updateLayout(s);
      updateGestureHint(s);
      renderSelPanel(s);
      renderTray(s);
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

      if (!s.ui.queueHudTick) s.ui.queueHudTick = 0;
      s.ui.queueHudTick -= dt;
      if (s.ui.queueHudTick <= 0) {
        var prodSel = RTS.selectedBuildings(s).some(function (b) {
          return b.built && b.queue.length && RTS.isProductionBuilding(b);
        });
        if (prodSel) {
          s.ui.queueHudTick = 0.35;
          updateQueueProgress(s);
        } else {
          s.ui.queueHudTick = 0.8;
        }
      }
    },
  };

  function markUi() { var s = getState(); if (s) s.ui.lastUiAt = performance.now(); }

  function wireRail(id, fn) {
    var el = D[id]; if (!el) return;
    el.addEventListener('pointerdown', markUi, true);
    el.addEventListener('click', function () { var s = getState(); if (s) fn(s); });
  }

  function deckOpen(s) {
    if (s.inputMode === 'place-building') return true;
    return RTS.selectedUnits(s).length > 0 || RTS.selectedBuildings(s).length > 0;
  }

  function thumbOpen(s) {
    if (s.inputMode === 'place-building') return false;
    return RTS.selectedUnits(s).length > 0;
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
    if (s.inputMode === 'place-building') return 'Tap ground to place · pinch to zoom';
    if (s.attackMoveArmed) return 'Tap where to attack-move';
    return '';
  }

  function updateGestureHint(s) {
    var el = D['gesture-hint'];
    if (!el) return;
    var text = gestureHintText(s);
    var show = !!text || (s.timers.gameTime < 12 && s.scene === 'playing' && !deckOpen(s));
    if (show && !text) text = 'Double-tap = army · hold 2nd tap = command wheel · two-finger tap = deselect';
    el.textContent = text;
    el.classList.toggle('hidden', !show);
    el.classList.toggle('attack', !!s.attackMoveArmed);
    el.classList.toggle('place', s.inputMode === 'place-building');
  }

  function selPortrait(s, kind, isBuilding) {
    var fid = s.playerFaction || 'aurex';
    var inner = isBuilding
      ? UI().buildingPortraitHtml(fid, kind, 28)
      : UI().avatarPortraitHtml(fid, kind, 28);
    return '<div class="sel-portrait">' + inner + '</div>';
  }

  function renderQueueBlock(s, b) {
    var spec = RTS.Buildings[b.type];
    if (!b.built || !spec.trains || !spec.trains.length) return '';
    if (!b.queue.length) return '<div class="sel-line">Queue empty</div>';
    var html = '<div class="sel-queue">';
    b.queue.forEach(function (job, idx) {
      var us = RTS.Units[job.role];
      var cls = 'qchip' + (idx === 0 ? ' active' : '');
      html += '<span class="' + cls + '">';
      html += '<span class="qico">' + UI().roleTrayIcon(s.playerFaction, job.role, 20) + '</span>';
      if (idx === 0 && job.total) {
        var pct = Math.max(0, Math.min(1, 1 - job.remaining / job.total));
        html += '<span class="qprog"><i style="width:' + (pct * 100) + '%"></i></span>';
        html += '<span class="qtime">' + Math.ceil(job.remaining) + 's</span>';
      }
      html += '</span>';
    });
    html += '</div>';
    return html;
  }

  function renderDepositHints(b) {
    if (!b.built) return '';
    var lines = '';
    if (RTS.isProductionBuilding(b)) lines += '<div class="sel-line">Tap ground → rally</div>';
    if (RTS.isDepositBuilding(b) && b.autoMine) lines += '<div class="sel-line auto-on">Auto-mine on</div>';
    return lines;
  }

  // Refresh queue timer/progress without rebuilding the panel — full renderSelPanel
  // would recreate the building portrait img every tick and make it flicker away.
  function updateQueueProgress(s) {
    var units = RTS.selectedUnits(s);
    var blds = RTS.selectedBuildings(s);
    if (blds.length !== 1 || units.length) { renderSelPanel(s); return; }

    var b = blds[0];
    if (!b.built || !b.queue.length || !RTS.isProductionBuilding(b)) { renderSelPanel(s); return; }

    var p = D['selpanel'];
    if (!p || !p.querySelector('.sel-queue')) { renderSelPanel(s); return; }

    var job = b.queue[0];
    if (!job || !job.total) return;

    var pct = Math.max(0, Math.min(1, 1 - job.remaining / job.total));
    var prog = p.querySelector('.qchip.active .qprog i');
    var time = p.querySelector('.qchip.active .qtime');
    if (!prog || !time) { renderSelPanel(s); return; }

    prog.style.width = (pct * 100) + '%';
    time.textContent = Math.ceil(job.remaining) + 's';
  }

  function renderSelPanel(s) {
    var p = D['selpanel']; if (!p) return;
    p.innerHTML = '';
    p.classList.remove('has-queue');
    if (!deckOpen(s)) return;

    var units = RTS.selectedUnits(s);
    var blds = RTS.selectedBuildings(s);

    if (blds.length === 1 && !units.length) {
      var b = blds[0];
      var portraitKey = b.type === 'outpost' ? 'outpost' : b.type;
      var hasQueue = b.built && RTS.Buildings[b.type].trains && b.queue.length;
      if (hasQueue) p.classList.add('has-queue');
      p.innerHTML = selPortrait(s, portraitKey, true) + '<div class="sel-body">' +
        '<div class="sel-title">' + RTS.nameFor(b.faction, b.type) + '</div>' +
        bar(b.hp, b.maxHp) +
        (!b.built ? '<div class="sel-line">' + Math.floor(b.progress * 100) + '% built</div>' :
          renderQueueBlock(s, b) + renderDepositHints(b)) +
        '</div>';
      return;
    }

    if (units.length === 1 && !blds.length) {
      var u = units[0];
      p.innerHTML = selPortrait(s, u.role, false) + '<div class="sel-body">' +
        '<div class="sel-title">' + RTS.nameFor(u.faction, u.role) + '</div>' +
        bar(u.hp, u.maxHp) +
        (u.role === 'worker' && u.harvest
          ? '<div class="sel-line">' + (
              u.harvest.phase === 'mining' ? 'mining…'
              : u.harvest.phase === 'toBase' && u.harvest.carry > 0
                ? 'returning +' + Math.floor(u.harvest.carry)
                : 'to gold'
            ) + '</div>'
          : '') +
        '</div>';
      return;
    }

    var all = units.concat(blds);
    var totHp = 0, totMax = 0;
    all.forEach(function (e) { totHp += e.hp; totMax += e.maxHp; });
    p.innerHTML = selPortrait(s, 'light', false) + '<div class="sel-body">' +
      '<div class="sel-title">' + all.length + ' units</div>' +
      bar(totHp, totMax) + '</div>';
  }

  function bar(v, max) {
    var pct = Math.max(0, Math.min(1, v / max));
    return '<div class="sel-bar"><div class="bar"><i style="width:' + (pct * 100) +
           '%"></i></div><b>' + Math.ceil(pct * 100) + '%</b></div>';
  }

  function renderTray(s) {
    var tray = D['action-tray']; if (!tray) return;
    tray.innerHTML = '';

    if (s.inputMode === 'place-building') {
      tray.appendChild(actionBtn(UI().iconHtml('cancel', 22), { act: 'cancel-place' }, false, 'danger'));
      return;
    }

    var units = RTS.selectedUnits(s);
    var blds = RTS.selectedBuildings(s);
    var hasWorker = units.some(function (u) { return u.role === 'worker'; });
    var hasCore = blds.some(function (b) { return b.type === 'core'; });
    var deposit = blds.length === 1 && !units.length && RTS.isDepositBuilding(blds[0]) ? blds[0] : null;

    if (deposit && deposit.built) {
      tray.appendChild(actionBtn(UI().iconHtml('hammer', 22),
        { act: 'toggle-automine', bid: deposit.id }, false,
        deposit.autoMine ? 'on' : '', deposit.autoMine ? 'ON' : 'OFF'));
    }

    blds.forEach(function (b) {
      var trains = RTS.Buildings[b.type].trains;
      if (!trains || !trains.length) return;
      trains.forEach(function (role) {
        var spec = RTS.Units[role];
        var afford = s.res.player.halcite >= spec.cost;
        var supplyOk = s.res.player.supplyUsed + spec.supply <= s.res.player.supplyCap;
        tray.appendChild(actionBtn(UI().roleTrayIcon(s.playerFaction, role, 30),
          { act: 'train', role: role, bid: b.id }, !b.built || !afford || !supplyOk, '',
          spec.cost));
      });
    });

    if (hasWorker || hasCore) {
      RTS.BuildMenu.forEach(function (t) {
        var spec = RTS.Buildings[t];
        tray.appendChild(actionBtn(UI().buildTrayIcon(s.playerFaction, t, 30),
          { act: 'build', type: t }, s.res.player.halcite < spec.cost, '', spec.cost));
      });
    }
  }

  function actionBtn(icon, data, disabled, extra, cost) {
    var b = document.createElement('button');
    b.className = 'act' + (disabled ? ' disabled' : '') + (extra ? ' ' + extra : '');
    for (var k in data) b.dataset[k] = data[k];
    b.innerHTML = '<span class="ico">' + icon + '</span>' +
      (cost ? '<span class="cost"><img class="ic-ts xs" src="' + UI().iconUrl('gold') +
        '" alt="" />' + cost + '</span>' : '');
    return b;
  }

  function handleAction(s, data) {
    markUi();
    switch (data.act) {
      case 'stop': RTS.orderStop(s, RTS.selectedUnits(s)); RTS.Audio.play('click'); break;
      case 'attackmove': s.attackMoveArmed = !s.attackMoveArmed; RTS.refreshMode(s); RTS.Audio.play('click'); RTS.HUD.sync(s); break;
      case 'toggle-automine':
        var hq = RTS.getById(s, data.bid);
        if (hq && hq.built) {
          hq.autoMine = !hq.autoMine;
          RTS.toast(s, hq.autoMine ? 'Auto-mine enabled' : 'Auto-mine disabled');
          if (hq.autoMine) {
            var node = RTS.nearestNodeForBuilding(s, hq);
            if (node) {
              s.entities.units.forEach(function (u) {
                if (u.dead || u.team !== RTS.TEAM.PLAYER || u.role !== 'worker') return;
                if (u.harvest || u.buildTask || u.moveTo || u.target) return;
                if (RTS.dist(u.x, u.y, hq.x, hq.y) > 380) return;
                RTS.orderHarvest(s, u, node.id);
              });
            }
          }
          RTS.Audio.play('click');
          RTS.HUD.sync(s);
        }
        break;
      case 'train':
        var b = RTS.getById(s, data.bid); if (b) RTS.train(s, b, data.role); break;
      case 'build': RTS.beginPlacement(s, data.type); break;
      case 'cancel-place': RTS.cancelPlacement(s); RTS.Audio.play('click'); break;
    }
  }

  function fmtTime(t) {
    var m = Math.floor(t / 60), sec = Math.floor(t % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

})(window.RTS = window.RTS || {});
