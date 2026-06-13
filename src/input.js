/* ============================================================================
 * EXOFRONT — input.js
 * Camera math + unified touch/mouse input: tap select, command, box select,
 * long-press: rally (production building selected), build site, attack-move;
 * double-tap empty ground = army (deferred 1st tap),
 * double-tap + hold empty ground = command wheel, double-tap building/Pawn = all Pawns,
 * two-finger tap deselect, one-finger pan, two-finger pinch-zoom.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;

  // ---- Camera helpers ------------------------------------------------------
  RTS.Cam = {
    worldToScreen: function (s, wx, wy) {
      var c = s.camera;
      return { x: (wx - c.x) * c.zoom, y: (wy - c.y) * c.zoom };
    },
    screenToWorld: function (s, sx, sy) {
      var c = s.camera;
      return { x: c.x + sx / c.zoom, y: c.y + sy / c.zoom };
    },
    viewSizeWorld: function (s) {
      var cv = RTS.canvas;
      return { w: cv.clientWidth / s.camera.zoom, h: cv.clientHeight / s.camera.zoom };
    },
    clamp: function (s) {
      var c = s.camera, cv = RTS.canvas;
      var vw = cv.clientWidth / c.zoom, vh = cv.clientHeight / c.zoom;
      var W = RTS.Config.world.w, H = RTS.Config.world.h;
      if (vw >= W) c.x = (W - vw) / 2; else c.x = Math.max(0, Math.min(W - vw, c.x));
      if (vh >= H) c.y = (H - vh) / 2; else c.y = Math.max(0, Math.min(H - vh, c.y));
    },
    centerOn: function (s, wx, wy) {
      var cv = RTS.canvas;
      s.camera.x = wx - (cv.clientWidth / s.camera.zoom) / 2;
      s.camera.y = wy - (cv.clientHeight / s.camera.zoom) / 2;
      RTS.Cam.clamp(s);
    },
    zoomAt: function (s, factor, cssX, cssY) {
      var c = s.camera;
      var before = RTS.Cam.screenToWorld(s, cssX, cssY);
      c.zoom = Math.max(RTS.Config.camera.minZoom, Math.min(RTS.Config.camera.maxZoom, c.zoom * factor));
      var after = RTS.Cam.screenToWorld(s, cssX, cssY);
      c.x += before.x - after.x;
      c.y += before.y - after.y;
      RTS.Cam.clamp(s);
    },
  };

  // ---- Hit testing ---------------------------------------------------------
  function hitTest(s, wx, wy) {
    var slop = (RTS.Config.touch ? RTS.Config.touch.slopPx : 28) / s.camera.zoom;
    var cands = [];
    s.entities.units.forEach(function (u) {
      if (u.dead) return;
      var d = RTS.dist(wx, wy, u.x, u.y);
      if (d <= u.radius + slop) {
        cands.push({ e: u, sort: (u.team === TEAM.PLAYER ? 0 : 100) + d });
      }
    });
    s.entities.buildings.forEach(function (b) {
      if (b.dead) return;
      if (!RTS.buildingIsTappable(b)) return;
      var pad = 10 + slop * 0.4;
      if (wx >= b.x - b.w / 2 - pad && wx <= b.x + b.w / 2 + pad &&
          wy >= b.y - b.h / 2 - pad && wy <= b.y + b.h / 2 + pad) {
        cands.push({ e: b, sort: (b.team === TEAM.PLAYER ? 20 : 120) + RTS.dist(wx, wy, b.x, b.y) });
      }
    });
    s.entities.resources.forEach(function (n) {
      if (n.amount <= 0) return;
      if (RTS.dist(wx, wy, n.x, n.y) <= n.r + slop * 0.8) {
        cands.push({ e: n, sort: 200 + RTS.dist(wx, wy, n.x, n.y) });
      }
    });
    cands.sort(function (a, b) { return a.sort - b.sort; });
    return cands.length ? cands[0].e : null;
  }

  function hitTestConstructionSite(s, wx, wy) {
    var slop = (RTS.Config.touch ? RTS.Config.touch.slopPx : 28) / s.camera.zoom;
    var best = null, bd = Infinity;
    s.entities.buildings.forEach(function (b) {
      if (b.dead || b.team !== TEAM.PLAYER || b.built) return;
      var pad = 10 + slop * 0.4;
      if (wx >= b.x - b.w / 2 - pad && wx <= b.x + b.w / 2 + pad &&
          wy >= b.y - b.h / 2 - pad && wy <= b.y + b.h / 2 + pad) {
        var d = RTS.dist(wx, wy, b.x, b.y);
        if (d < bd) { bd = d; best = b; }
      }
    });
    return best;
  }

  // ---- Tap resolution ------------------------------------------------------
  function nearestWorker(s, wx, wy) {
    var best = null, bd = Infinity;
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== TEAM.PLAYER || u.role !== 'pawn') return;
      var d = RTS.dist(wx, wy, u.x, u.y);
      if (d < bd) { bd = d; best = u; }
    });
    return best;
  }

  function haptic(ms) {
    if (navigator.vibrate) navigator.vibrate(ms || 10);
  }

  function resolveHitContext(s, wx, wy) {
    var active = RTS.activeSelectedUnits(s);
    return {
      hit: hitTest(s, wx, wy),
      buildHit: hitTestConstructionSite(s, wx, wy),
      sel: RTS.selectedUnits(s),
      active: active,
      combat: RTS.activeCombatUnits(s),
      workers: RTS.activeWorkers(s),
    };
  }

  function resolveTapIntent(s, wx, wy, additive) {
    var ctx = resolveHitContext(s, wx, wy);
    var hit = ctx.hit;
    var sel = ctx.sel;
    var combat = ctx.combat;
    var workers = ctx.workers;

    if (!sel.length && hit && hit.kind === 'resource') {
      return { type: 'smartMine', nodeId: hit.id, x: wx, y: wy };
    }
    if (hit && hit.kind === 'resource' && workers.length) {
      return { type: 'harvest', nodeId: hit.id, workers: workers };
    }
    if (hit && hit.kind === 'building' && hit.team === TEAM.PLAYER && hit.built && !additive) {
      return { type: 'selectBuilding', buildingId: hit.id };
    }
    if (hit && hit.kind === 'building' && hit.team === TEAM.PLAYER && !hit.built && !additive) {
      return { type: 'selectConstruction', buildingId: hit.id };
    }
    if (hit && hit.kind === 'unit' && hit.team === TEAM.PLAYER) {
      return { type: additive || sel.length ? 'toggleUnit' : 'selectUnit', unitId: hit.id };
    }
    if (hit && hit.team === TEAM.ENEMY && RTS.canBeAttacked(hit)) {
      if (hit.kind === 'unit' && combat.length) {
        return { type: 'attack', targetId: hit.id, x: wx, y: wy, units: combat };
      }
      if (hit.kind === 'building' && combat.length) {
        return { type: 'attack', targetId: hit.id, x: wx, y: wy, units: combat };
      }
    }
    if (combat.length && (!hit || hit.kind === 'resource')) {
      return { type: 'moveCombat', x: wx, y: wy, attackMove: s.attackMoveArmed, units: combat };
    }
    if (workers.length && !combat.length && (!hit || hit.kind === 'resource')) {
      return { type: 'moveWorkers', x: wx, y: wy, units: workers };
    }
    if (!hit) return { type: 'clearOrClose' };
    return { type: 'noop' };
  }

  function executeTapIntent(s, intent, additive) {
    switch (intent.type) {
      case 'smartMine': {
        var nw = nearestWorker(s, intent.x, intent.y);
        if (!nw) return;
        RTS.select(s, nw.id, false);
        RTS.orderHarvest(s, nw, intent.nodeId);
        RTS.Audio.play('move');
        RTS.toast(s, 'Mining ' + RTS.resourceLabel());
        haptic(8);
        RTS.HUD.sync(s);
        break;
      }
      case 'harvest':
        intent.workers.forEach(function (w) { RTS.orderHarvest(s, w, intent.nodeId); });
        RTS.Audio.play('move');
        RTS.toast(s, 'Harvesting ' + RTS.resourceLabel());
        haptic(8);
        break;
      case 'selectBuilding':
        s.selectedIds = [intent.buildingId];
        RTS.clearMacroGroups(s);
        if (RTS.BuildingMenu) RTS.BuildingMenu.open(s, RTS.getById(s, intent.buildingId));
        RTS.refreshMode(s);
        RTS.HUD.sync(s);
        RTS.Audio.play('click');
        haptic(6);
        break;
      case 'selectConstruction':
        s.selectedIds = [intent.buildingId];
        RTS.clearMacroGroups(s);
        if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
        RTS.refreshMode(s);
        RTS.HUD.sync(s);
        RTS.Audio.play('click');
        haptic(6);
        break;
      case 'selectUnit':
        RTS.select(s, intent.unitId, false);
        if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
        RTS.Audio.play('click');
        haptic(6);
        break;
      case 'toggleUnit':
        RTS.toggleSelect(s, intent.unitId);
        if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
        RTS.Audio.play('click');
        haptic(6);
        break;
      case 'attack':
        RTS.orderAttack(s, intent.units, intent.targetId);
        flash(s, intent.x, intent.y, '#ff5a5a');
        RTS.log(s, 'Engaging target', 'info');
        haptic(12);
        break;
      case 'moveCombat':
        RTS.orderMove(s, intent.units, intent.x, intent.y, intent.attackMove);
        flash(s, intent.x, intent.y, intent.attackMove ? '#ff9a3c' : RTS.Factions[s.playerFaction].primary);
        haptic(8);
        break;
      case 'moveWorkers':
        RTS.orderMove(s, intent.units, intent.x, intent.y, false);
        flash(s, intent.x, intent.y, RTS.Factions[s.playerFaction].primary);
        haptic(8);
        break;
      case 'clearOrClose':
        if (RTS.BuildingMenu && RTS.BuildingMenu.isOpen()) {
          RTS.BuildingMenu.close(s);
          RTS.HUD.sync(s);
        } else {
          RTS.clearSelection(s);
        }
        break;
      default:
        break;
    }
  }

  function tapWorld(s, wx, wy, additive) {
    if (s.inputMode !== 'place-building' && s.ui.buildPanelOpen) {
      s.ui.buildPanelOpen = false;
      if (RTS.HUD && RTS.HUD.sync) RTS.HUD.sync(s);
    }

    if (s.inputMode === 'place-building' && s.pending.building) {
      RTS.placeBuilding(s, s.pending.building, wx, wy);
      return;
    }

    if (RTS.BuildingMenu && RTS.BuildingMenu.isOpen()) {
      var menuItem = RTS.BuildingMenu.hitTest(s, wx, wy);
      if (menuItem) {
        RTS.BuildingMenu.execute(s, menuItem);
        RTS.Audio.play('click');
        haptic(8);
        return;
      }
      RTS.BuildingMenu.close(s);
      s.ui.buildingMenuHover = null;
    }

    executeTapIntent(s, resolveTapIntent(s, wx, wy, additive), additive);
  }

  function showLongPressRing(cssX, cssY) {
    var ring = document.getElementById('long-press-ring');
    if (!ring) return;
    ring.classList.remove('hidden');
    ring.style.left = cssX + 'px';
    ring.style.top = cssY + 'px';
  }
  function hideLongPressRing() {
    var ring = document.getElementById('long-press-ring');
    if (ring) ring.classList.add('hidden');
  }

  function flash(s, wx, wy, color) {
    RTS.addEffect(s, { kind: 'cmd', x: wx, y: wy, life: 0.34, max: 0.34, color: color, r: 10 });
  }

  function unfinishedPlayerBuilding(hit) {
    return !!(hit && hit.kind === 'building' && hit.team === TEAM.PLAYER && !hit.built && !hit.dead);
  }

  function productionBuildingsSelected(s) {
    return RTS.selectedBuildings(s).filter(function (b) {
      return b.built && RTS.isProductionBuilding && RTS.isProductionBuilding(b);
    });
  }

  // ---- Long press: rally (building selected), build site, or attack-move ----
  function startLongPress(s, wx, wy, cssX, cssY, hit) {
    clearLongPress(s);
    if (s.inputMode === 'place-building') return;

    var combat = RTS.activeCombatUnits(s);
    var workers = RTS.activeWorkers(s);
    var onBare = isBareGround(hit);
    var mode = null;

    if (unfinishedPlayerBuilding(hit)) {
      mode = 'build';
    } else if (onBare) {
      if (productionBuildingsSelected(s).length && !combat.length) mode = 'rally';
      else if (combat.length) mode = 'attackmove';
    }

    if (!mode) return;

    var ms = (RTS.Config.touch && RTS.Config.touch.longPressMs) || 460;
    showLongPressRing(cssX, cssY);
    s.ui.longPressAnchor = {
      wx: wx, wy: wy, cssX: cssX, cssY: cssY,
      mode: mode, hitId: hit ? hit.id : null,
      start: performance.now(),
    };
    s.ui.longPressTimer = setTimeout(function () {
      var p = s.ui.pointer;
      if (!p || p.moved) return;
      p.longPressFired = true;
      var anchor = s.ui.longPressAnchor;
      if (!anchor) return;

      if (anchor.mode === 'rally') {
        var rallyBlds = productionBuildingsSelected(s);
        if (rallyBlds.length && RTS.setRallyPoint(s, rallyBlds, anchor.wx, anchor.wy)) {
          if (RTS.BuildingMenu) RTS.BuildingMenu.close(s);
          flash(s, anchor.wx, anchor.wy, '#ffc107');
          RTS.toast(s, 'Rally point set');
          RTS.Audio.play('click');
          haptic(14);
        }
      } else if (anchor.mode === 'attackmove') {
        var fighters = RTS.activeCombatUnits(s);
        if (fighters.length) {
          RTS.orderMove(s, fighters, anchor.wx, anchor.wy, true);
          flash(s, anchor.wx, anchor.wy, '#ff9a3c');
          RTS.log(s, 'Attack-move ordered', 'info');
          RTS.toast(s, 'Attack-move');
          haptic(18);
        }
      } else if (anchor.mode === 'build') {
        var site = anchor.hitId ? RTS.getById(s, anchor.hitId) : null;
        if (site && !site.built && !site.dead) {
          var pawns = RTS.activeWorkers(s);
          if (RTS.orderBuild(s, site, pawns)) {
            flash(s, site.x, site.y, '#69f0ae');
            RTS.toast(s, 'Pawn sent to build');
            haptic(14);
          }
        }
      }

      hideLongPressRing();
      clearLongPress(s);
    }, ms);
  }
  function clearLongPress(s) {
    if (s.ui.longPressTimer) clearTimeout(s.ui.longPressTimer);
    s.ui.longPressTimer = null;
    s.ui.longPressAnchor = null;
    hideLongPressRing();
  }

  function clearMenuHold(p) {
    if (!p) return;
    if (p.menuHoldTimer) clearTimeout(p.menuHoldTimer);
    p.menuHoldTimer = null;
  }

  function isBareGround(hit) {
    return !hit;
  }

  function isFriendlyBuilding(hit) {
    return !!(hit && hit.kind === 'building' && hit.team === TEAM.PLAYER && hit.built);
  }

  function isFriendlyPawn(hit) {
    return !!(hit && hit.kind === 'unit' && hit.team === TEAM.PLAYER && hit.role === 'pawn');
  }

  // ---- Init / event wiring -------------------------------------------------
  RTS.Input = {
    init: function (canvas, getState) {
      var DRAG = (RTS.Config.touch && RTS.Config.touch.dragPx) || 12;
      var UIBLOCK = (RTS.Config.touch && RTS.Config.touch.uiBlockMs) || 320;
      var DBL = (RTS.Config.touch && RTS.Config.touch.doubleTapMs) || 320;
      var MENU_HOLD = (RTS.Config.touch && RTS.Config.touch.menuHoldMs) || 280;
      var TWO_TAP = (RTS.Config.touch && RTS.Config.touch.twoFingerTapMs) || 280;
      var lastTap = { t: 0, x: 0, y: 0, empty: false, hitId: null, hitKind: null };
      var pendingTap = null;

      function st() { return getState(); }
      function active() { var s = st(); return !!s && s.scene === 'playing'; }
      function rect() { return canvas.getBoundingClientRect(); }
      function isSurface(e) { return e.target === canvas; }
      function uiBlocked(s) { return performance.now() - (s.ui.lastUiAt || 0) < UIBLOCK; }
      function tapSlop() { return (RTS.Config.touch && RTS.Config.touch.slopPx) || 40; }

      function clearPendingTap() {
        if (pendingTap && pendingTap.timer) clearTimeout(pendingTap.timer);
        pendingTap = null;
      }

      function schedulePendingTap(s, wx, wy, shift) {
        clearPendingTap();
        pendingTap = {
          timer: setTimeout(function () {
            if (!pendingTap) return;
            tapWorld(s, wx, wy, shift);
            pendingTap = null;
            lastTap = { t: 0, x: 0, y: 0, empty: false, hitId: null, hitKind: null };
          }, DBL),
        };
      }

      function isSecondTap(cssX, cssY) {
        if (!lastTap.t) return false;
        return (performance.now() - lastTap.t < DBL) &&
          Math.hypot(cssX - lastTap.x, cssY - lastTap.y) < tapSlop();
      }

      // --- single-pointer (mouse or 1 touch) ---
      function down(cssX, cssY, shift) {
        var s = st(); if (!s || !active() || uiBlocked(s)) return;
        if (RTS.RadialMenu && RTS.RadialMenu.isOpen()) {
          s.ui.pointer = {
            cssX: cssX, cssY: cssY, startX: cssX, startY: cssY,
            moved: false, radialMenu: true,
          };
          RTS.RadialMenu.move(cssX, cssY);
          return;
        }
        var w = RTS.Cam.screenToWorld(s, cssX, cssY);
        var hit = hitTest(s, w.x, w.y);
        var buildHit = hitTestConstructionSite(s, w.x, w.y);
        var onEmpty = !hit || hit.kind === 'resource';
        var boxArmed = s.boxSelectArmed || shift;
        var secondTap = isSecondTap(cssX, cssY) && s.inputMode !== 'place-building';
        clearPendingTap();
        var armyDouble = secondTap && isBareGround(hit) && lastTap.empty;
        var buildingDouble = secondTap && isFriendlyBuilding(hit) && lastTap.hitKind === 'building';
        var pawnDouble = secondTap && isFriendlyPawn(hit) && lastTap.hitKind === 'pawn';
        s.ui.pointer = {
          cssX: cssX, cssY: cssY, startX: cssX, startY: cssY,
          wx: w.x, wy: w.y, moved: false, panning: false, boxing: false,
          longPressFired: false, menuHoldFired: false, secondTap: secondTap,
          armyDouble: armyDouble, buildingDouble: buildingDouble, pawnDouble: pawnDouble,
          onEmpty: onEmpty, useBox: onEmpty && boxArmed, shift: !!shift,
          hitId: hit ? hit.id : null, hit: hit, menuHoldTimer: null,
        };
        if (s.inputMode === 'place-building') { updateGhost(s, w.x, w.y); return; }
        if (armyDouble) {
          clearLongPress(s);
          var pRef = s.ui.pointer;
          pRef.menuHoldTimer = setTimeout(function () {
            if (!pRef || pRef.moved || s.ui.pointer !== pRef) return;
            pRef.menuHoldFired = true;
            if (RTS.RadialMenu && RTS.RadialMenu.open(s, cssX, cssY, w.x, w.y, hit)) {
              haptic(14);
            }
          }, MENU_HOLD);
        } else if (!secondTap && !boxArmed &&
            (isBareGround(hit) || unfinishedPlayerBuilding(buildHit || hit))) {
          startLongPress(s, w.x, w.y, cssX, cssY, buildHit || hit);
        }
      }

      function move(cssX, cssY) {
        var s = st(); if (!s || !active()) return;
        if (RTS.RadialMenu && RTS.RadialMenu.isOpen()) {
          RTS.RadialMenu.move(cssX, cssY);
          return;
        }
        if (RTS.BuildingMenu && RTS.BuildingMenu.isOpen()) {
          var bw = RTS.Cam.screenToWorld(s, cssX, cssY);
          s.ui.buildingMenuHover = RTS.BuildingMenu.hitTest(s, bw.x, bw.y);
          return;
        }
        var w = RTS.Cam.screenToWorld(s, cssX, cssY);
        if (s.inputMode === 'place-building') { updateGhost(s, w.x, w.y); }
        var p = s.ui.pointer;
        if (!p) return;
        var dx = cssX - p.startX, dy = cssY - p.startY;
        if (Math.hypot(dx, dy) <= DRAG) {
          if (s.ui.longPressAnchor) {
            s.ui.longPressAnchor.cssX = cssX;
            s.ui.longPressAnchor.cssY = cssY;
            showLongPressRing(cssX, cssY);
          }
          return;
        }
        p.moved = true;
        clearPendingTap();
        clearLongPress(s);
        clearMenuHold(p);

        if (s.inputMode === 'place-building') { p.cssX = cssX; p.cssY = cssY; return; }

        if (p.useBox && p.onEmpty) {
          p.boxing = true;
          s.selectionBox = { x1: p.wx, y1: p.wy, x2: w.x, y2: w.y };
          return;
        }
        if (p.onEmpty) {
          p.panning = true;
          var prev = RTS.Cam.screenToWorld(s, p.cssX, p.cssY);
          s.camera.x -= (w.x - prev.x);
          s.camera.y -= (w.y - prev.y);
          RTS.Cam.clamp(s);
        }
        p.cssX = cssX; p.cssY = cssY;
      }

      function up(cssX, cssY) {
        var s = st(); if (!s) return;
        if (!active()) { s.ui.pointer = null; return; }
        if (RTS.RadialMenu && RTS.RadialMenu.isOpen()) {
          RTS.RadialMenu.release(cssX, cssY);
          clearLongPress(s);
          var pOpen = s.ui.pointer;
          clearMenuHold(pOpen);
          clearPendingTap();
          s.ui.pointer = null;
          lastTap = { t: 0, x: 0, y: 0, empty: false, hitId: null };
          return;
        }
        clearLongPress(s);
        // Placement: always commit on release (dragging only moves the ghost).
        if (s.inputMode === 'place-building' && s.pending.building) {
          var pw = RTS.Cam.screenToWorld(s, cssX, cssY);
          RTS.placeBuilding(s, s.pending.building, pw.x, pw.y);
          s.ui.pointer = null;
          clearPendingTap();
          lastTap = { t: 0, x: 0, y: 0, empty: false, hitId: null };
          return;
        }
        var p = s.ui.pointer; s.ui.pointer = null;
        if (!p) return;
        clearMenuHold(p);
        if (p.boxing && s.selectionBox) {
          var b = s.selectionBox;
          RTS.selectBox(s, b.x1, b.y1, b.x2, b.y2, p.shift);
          s.selectionBox = null;
          return;
        }
        s.selectionBox = null;
        if (!p.moved && !p.longPressFired && !p.menuHoldFired && !uiBlocked(s)) {
          if (p.armyDouble) {
            RTS.selectAllArmy(s);
            RTS.toast(s, 'Army selected');
            haptic(14);
            lastTap = { t: 0, x: 0, y: 0, empty: false, hitId: null, hitKind: null };
            return;
          }
          if (p.buildingDouble || p.pawnDouble) {
            if (RTS.selectAllWorkers(s)) {
              RTS.toast(s, 'Pawns selected');
              haptic(10);
            }
            lastTap = { t: 0, x: 0, y: 0, empty: false, hitId: null, hitKind: null };
            return;
          }
          var w = RTS.Cam.screenToWorld(s, cssX, cssY);
          var hitUp = hitTest(s, w.x, w.y);
          var now = performance.now();
          if (isBareGround(hitUp) && s.inputMode !== 'place-building') {
            schedulePendingTap(s, w.x, w.y, p.shift);
            lastTap = { t: now, x: cssX, y: cssY, empty: true, hitId: null, hitKind: null };
          } else {
            clearPendingTap();
            lastTap = {
              t: now, x: cssX, y: cssY,
              empty: false,
              hitId: hitUp ? hitUp.id : null,
              hitKind: hitUp && hitUp.kind === 'unit' && hitUp.role === 'pawn' ? 'pawn'
                : hitUp && hitUp.kind === 'building' && hitUp.team === TEAM.PLAYER && hitUp.built
                  ? 'building' : null,
            };
            tapWorld(s, w.x, w.y, p.shift);
          }
        } else if (p.secondTap) {
          lastTap = { t: 0, x: 0, y: 0, empty: false, hitId: null, hitKind: null };
        }
      }

      function updateGhost(s, wx, wy) {
        var snapped = RTS.snapToGrid(wx, wy);
        s.ui.ghost = { type: s.pending.building, x: snapped.x, y: snapped.y,
                       valid: RTS.canPlaceAt(s, s.pending.building, snapped.x, snapped.y) };
      }

      // --- Mouse ---
      canvas.addEventListener('mousedown', function (e) {
        if (!isSurface(e)) return; e.preventDefault();
        var r = rect(); down(e.clientX - r.left, e.clientY - r.top, e.shiftKey);
      });
      window.addEventListener('mousemove', function (e) {
        var s = st(); if (!s) return;
        if (!s.ui.pointer && s.inputMode !== 'place-building') return;
        var r = rect(); move(e.clientX - r.left, e.clientY - r.top);
      });
      window.addEventListener('mouseup', function (e) {
        var r = rect(); up(e.clientX - r.left, e.clientY - r.top);
      });
      canvas.addEventListener('wheel', function (e) {
        var s = st(); if (!s || !active()) return; e.preventDefault();
        var r = rect();
        RTS.Cam.zoomAt(s, e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var s = st(); if (!s || !active()) return;
        // right-click = quick command (move/attack) like RTS
        var r = rect();
        var w = RTS.Cam.screenToWorld(s, e.clientX - r.left, e.clientY - r.top);
        if (s.inputMode === 'place-building') { RTS.cancelPlacement(s); return; }
        tapWorld(s, w.x, w.y, false);
      });

      // --- Touch (pinch + two-finger deselect tap) ---
      var pinch = null;
      var twoFinger = null;

      function fingerPair(e, r) {
        var a = e.touches[0], b = e.touches[1];
        var ax = a.clientX - r.left, ay = a.clientY - r.top;
        var bx = b.clientX - r.left, by = b.clientY - r.top;
        return {
          ax: ax, ay: ay, bx: bx, by: by,
          cx: (ax + bx) / 2, cy: (ay + by) / 2,
          d: Math.hypot(bx - ax, by - ay) || 1,
        };
      }

      canvas.addEventListener('touchstart', function (e) {
        if (!isSurface(e)) return; e.preventDefault();
        var s = st(); if (!s || !active()) return;
        var r = rect();
        if (e.touches.length === 2) {
          clearLongPress(s); s.ui.pointer = null; s.selectionBox = null;
          if (RTS.RadialMenu && RTS.RadialMenu.isOpen()) RTS.RadialMenu.close();
          var fp = fingerPair(e, r);
          twoFinger = {
            t: performance.now(), d0: fp.d, cx: fp.cx, cy: fp.cy, moved: false,
          };
          pinch = null;
          return;
        }
        twoFinger = null;
        pinch = null;
        var t = e.touches[0];
        down(t.clientX - r.left, t.clientY - r.top, false);
      }, { passive: false });

      canvas.addEventListener('touchmove', function (e) {
        if (!active()) return; e.preventDefault();
        var s = st(); var r = rect();
        if (e.touches.length === 2 && twoFinger) {
          var fp = fingerPair(e, r);
          var dDelta = Math.abs(fp.d - twoFinger.d0);
          var cDelta = Math.hypot(fp.cx - twoFinger.cx, fp.cy - twoFinger.cy);
          if (dDelta > 16 || cDelta > 16) twoFinger.moved = true;
          if (twoFinger.moved) {
            if (!pinch) pinch = beginPinch(s, fp, twoFinger);
            doPinch(s, fp, pinch);
          }
          return;
        }
        if (e.touches.length === 1 && !pinch) {
          var t = e.touches[0]; move(t.clientX - r.left, t.clientY - r.top);
        }
      }, { passive: false });

      canvas.addEventListener('touchend', function (e) {
        if (!active()) return;
        var s = st(); var r = rect();
        if (twoFinger && e.touches.length < 2) {
          if (!twoFinger.moved && performance.now() - twoFinger.t < TWO_TAP) {
            RTS.clearSelection(s);
            s.attackMoveArmed = false;
            RTS.refreshMode(s);
            RTS.HUD.sync(s);
            RTS.toast(s, 'Deselected');
            haptic(8);
          }
          twoFinger = null;
          pinch = null;
          s.ui.pointer = null;
          return;
        }
        if (pinch && e.touches.length < 2) { pinch = null; s.ui.pointer = null; return; }
        if (e.touches.length === 0) {
          var t = e.changedTouches[0];
          up(t.clientX - r.left, t.clientY - r.top);
        }
      }, { passive: false });

      canvas.addEventListener('touchcancel', function () {
        var s = st(); if (!s) { pinch = null; twoFinger = null; return; }
        clearPendingTap();
        clearLongPress(s); s.ui.pointer = null; s.selectionBox = null;
        pinch = null; twoFinger = null;
        if (RTS.RadialMenu && RTS.RadialMenu.isOpen()) RTS.RadialMenu.close();
      }, { passive: true });

      function beginPinch(s, fp, tf) {
        return {
          d0: tf.d0,
          zoom0: s.camera.zoom,
          cx: tf.cx, cy: tf.cy,
          camx: s.camera.x, camy: s.camera.y,
        };
      }
      function doPinch(s, fp, pz) {
        var d = fp.d;
        var cx = fp.cx, cy = fp.cy;
        var targetZoom = Math.max(RTS.Config.camera.minZoom,
                          Math.min(RTS.Config.camera.maxZoom, pz.zoom0 * (d / pz.d0)));
        s.camera.x = pz.camx; s.camera.y = pz.camy; s.camera.zoom = pz.zoom0;
        var worldMid = RTS.Cam.screenToWorld(s, pz.cx, pz.cy);
        s.camera.zoom = targetZoom;
        var after = RTS.Cam.screenToWorld(s, cx, cy);
        s.camera.x += worldMid.x - after.x;
        s.camera.y += worldMid.y - after.y;
        s.camera.x -= (cx - pz.cx) / s.camera.zoom;
        s.camera.y -= (cy - pz.cy) / s.camera.zoom;
        RTS.Cam.clamp(s);
      }

      // keyboard niceties (desktop): Esc cancels placement, A = attack-move arm
      window.addEventListener('keydown', function (e) {
        var s = st(); if (!s || !active()) return;
        if (e.key === 'Escape') { if (s.inputMode === 'place-building') RTS.cancelPlacement(s); else RTS.clearSelection(s); }
        if (e.key === 'a' || e.key === 'A') { s.attackMoveArmed = !s.attackMoveArmed; RTS.refreshMode(s); RTS.HUD.sync(s); }
        if (e.key === 's' || e.key === 'S') { RTS.orderStop(s, RTS.activeSelectedUnits(s)); }
      });
    },
  };

})(window.RTS = window.RTS || {});
