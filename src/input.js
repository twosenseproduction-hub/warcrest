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
    // HUD overlays (top bar + bottom command deck) cover the canvas edges.
    // Cache their heights, recomputed only when the window size changes.
    _insets: function () {
      var key = window.innerWidth + 'x' + window.innerHeight;
      if (this._insetKey !== key || !this._insetVal) {
        this._insetKey = key;
        function h(id) { var e = document.getElementById(id); return e && e.offsetHeight ? e.offsetHeight : 0; }
        this._insetVal = { top: h('topbar'), bottom: h('command-deck') };
      }
      return this._insetVal;
    },
    clamp: function (s) {
      var c = s.camera, cv = RTS.canvas;
      var vw = cv.clientWidth / c.zoom, vh = cv.clientHeight / c.zoom;
      var W = RTS.Config.world.w, H = RTS.Config.world.h;
      if (vw >= W) c.x = (W - vw) / 2; else c.x = Math.max(0, Math.min(W - vw, c.x));
      // Let the map scroll past the canvas edges by the HUD overlay heights so the
      // map's top can clear the top bar and its bottom can rise above the deck.
      var ins = RTS.Cam._insets();
      var topPad = ins.top / c.zoom, botPad = ins.bottom / c.zoom;
      var lo = -topPad, hi = (H - vh) + botPad;
      if (hi < lo) c.y = (H - vh) / 2;           // map shorter than the visible band
      else c.y = Math.max(lo, Math.min(hi, c.y));
    },
    centerOn: function (s, wx, wy) {
      var cv = RTS.canvas;
      s.camera.x = wx - (cv.clientWidth / s.camera.zoom) / 2;
      s.camera.y = wy - (cv.clientHeight / s.camera.zoom) / 2;
      s.camera.panTarget = null;
      RTS.Cam.clamp(s);
    },
    panTo: function (s, wx, wy, smooth) {
      var cv = RTS.canvas;
      var tx = wx - (cv.clientWidth / s.camera.zoom) / 2;
      var ty = wy - (cv.clientHeight / s.camera.zoom) / 2;
      if (smooth && !RTS.Config.reducedMotion) {
        s.camera.panTarget = { x: tx, y: ty };
      } else {
        s.camera.x = tx;
        s.camera.y = ty;
        s.camera.panTarget = null;
        RTS.Cam.clamp(s);
      }
    },
    updatePan: function (s, dt) {
      var pt = s.camera.panTarget;
      if (!pt) return;
      var c = s.camera;
      var t = Math.min(1, dt * 9);
      c.x += (pt.x - c.x) * t;
      c.y += (pt.y - c.y) * t;
      RTS.Cam.clamp(s);
      if (Math.abs(pt.x - c.x) < 1.5 && Math.abs(pt.y - c.y) < 1.5) {
        c.x = pt.x;
        c.y = pt.y;
        c.panTarget = null;
      }
    },
    zoomAt: function (s, factor, cssX, cssY) {
      if (RTS.Config.camera && RTS.Config.camera.lock) return;
      var c = s.camera;
      var before = RTS.Cam.screenToWorld(s, cssX, cssY);
      c.zoom = Math.max(RTS.Config.camera.minZoom, Math.min(RTS.Config.camera.maxZoom, c.zoom * factor));
      var after = RTS.Cam.screenToWorld(s, cssX, cssY);
      c.x += before.x - after.x;
      c.y += before.y - after.y;
      RTS.Cam.clamp(s);
    },
  };

  // ---- Per-building ellipse hit map ----------------------------------------
  // Each entry is an array of { ox, oy, rx, ry } ellipses in building-local
  // space (origin = building centre).  Large footprints tile 2-3 ellipses so
  // every part of the sprite can be tapped accurately.
  //
  // Building sizes from config:
  //   core     256 × 192   (Citadel Keep / Warren Maw)
  //   outpost  128 × 128   (Forward Bastion / Raider Camp)
  //   conduit  192 × 192   (Sheep Pen / Pig Sty)
  //   foundry  192 × 128   (Barracks / War Pit)
  //   forge / chiefs_hall  192 × 192   (War Forge / Skull Den · Chief's Hall)
  //   turret    64 × 128   (Arrow Tower / Bone Spire)
  var BUILDING_ELLIPSES = {
    // ── core (256 × 192) ──────────────────────────────────────────────────
    // Three ellipses: left wing · central body · right wing
    core: [
      { ox: -72, oy:  0, rx: 62, ry: 72 },   // left section
      { ox:   0, oy:  0, rx: 72, ry: 80 },   // centre body
      { ox:  72, oy:  0, rx: 62, ry: 72 },   // right section
    ],
    // ── rimwalker_core (Roothold tree 256×256, draws ~192px tall, canopy extends ~177px above foot)
    // Two ellipses covering full tree: lower trunk/door + upper canopy
    rimwalker_core: [
      { ox:  0, oy:  -55, rx: 80, ry: 75 },  // trunk & door (foot to mid-tree)
      { ox:  0, oy: -140, rx: 70, ry: 60 },  // canopy (upper tree)
    ],
    // ── outpost (128 × 128) ───────────────────────────────────────────────
    // Two ellipses: upper tower · lower base
    outpost: [
      { ox:  0, oy: -22, rx: 44, ry: 44 },   // upper tower
      { ox:  0, oy:  22, rx: 52, ry: 40 },   // lower base
    ],
    // ── conduit (192 × 192) ───────────────────────────────────────────────
    // Three ellipses tiling the pen area: top-left · top-right · bottom centre
    conduit: [
      { ox: -38, oy: -32, rx: 56, ry: 56 },
      { ox:  38, oy: -32, rx: 56, ry: 56 },
      { ox:   0, oy:  36, rx: 68, ry: 52 },
    ],
    // ── foundry (192 × 128) ───────────────────────────────────────────────
    // Two ellipses: left half · right half
    foundry: [
      { ox: -42, oy: 0, rx: 58, ry: 52 },
      { ox:  42, oy: 0, rx: 58, ry: 52 },
    ],
    // ── forge (192 × 192) ─────────────────────────────────────────────────
    // Three ellipses mirroring the anvil/chimney layout
    forge: [
      { ox: -44, oy: -28, rx: 56, ry: 58 },
      { ox:  44, oy: -28, rx: 56, ry: 58 },
      { ox:   0, oy:  38, rx: 64, ry: 50 },
    ],
    chiefs_hall: [
      { ox: -44, oy: -28, rx: 56, ry: 58 },
      { ox:  44, oy: -28, rx: 56, ry: 58 },
      { ox:   0, oy:  38, rx: 64, ry: 50 },
    ],
    // ── turret (64 × 128) ─────────────────────────────────────────────────
    // Two ellipses: top battlement · tall shaft
    turret: [
      { ox:  0, oy: -34, rx: 32, ry: 30 },   // battlement cap
      { ox:  0, oy:  20, rx: 26, ry: 52 },   // shaft
    ],
  };

  // Point-in-ellipse test (axis-aligned, local coords).
  function inEllipse(px, py, cx, cy, rx, ry) {
    var dx = (px - cx) / rx;
    var dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  // Returns true if world point (wx, wy) hits any ellipse of building b,
  // with the given extra slop radius added to each semi-axis.
  function buildingEllipseHit(b, wx, wy, slop) {
    var lx = wx - b.x;   // building-local coords
    var ly = wy - b.y;
    var ellipses = BUILDING_ELLIPSES[(b.faction || '') + '_' + b.type] || BUILDING_ELLIPSES[b.type];
    if (!ellipses) {
      // Fallback: single centred ellipse sized to the footprint
      var rx = b.w / 2 + slop, ry = b.h / 2 + slop;
      return inEllipse(lx, ly, 0, 0, rx, ry);
    }
    for (var i = 0; i < ellipses.length; i++) {
      var e = ellipses[i];
      if (inEllipse(lx, ly, e.ox, e.oy, e.rx + slop, e.ry + slop)) return true;
    }
    return false;
  }

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
      var ellipseSlop = slop * 0.35;   // tighter than the old AABB pad
      if (buildingEllipseHit(b, wx, wy, ellipseSlop)) {
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
      if (buildingEllipseHit(b, wx, wy, slop * 0.35)) {
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

  function ensureHeroTestSelection(s) {
    if (!s.map || !s.map.heroTestFocus) return;
    if (RTS.activeCombatUnits(s).length) return;
    var hero = RTS.getById(s, s.map.heroTestFocus);
    if (!hero || hero.dead) return;
    s.selectedIds = [hero.id];
    if (RTS.clearMacroGroups) RTS.clearMacroGroups(s);
    s.ui.selectionFilter = 'all';
    if (RTS.refreshMode) RTS.refreshMode(s);
  }

  function resolveTapIntent(s, wx, wy, additive) {
    ensureHeroTestSelection(s);
    var ctx = resolveHitContext(s, wx, wy);
    var hit = ctx.hit;
    var sel = ctx.sel;
    var combat = ctx.combat;
    var workers = ctx.workers;

    // Armed ability target cursor — next tap casts on the chosen foe/point.
    if (s.pendingAbility) {
      var pa = s.pendingAbility;
      if (pa.cast === 'enemy') {
        if (hit && hit.team === TEAM.ENEMY && RTS.canBeAttacked(hit)) {
          return { type: 'castAbility', uid: pa.uid, abId: pa.abId, targetId: hit.id, x: wx, y: wy };
        }
        return { type: 'noop' };   // mis-tap keeps the cursor armed
      }
      return { type: 'castAbility', uid: pa.uid, abId: pa.abId, x: wx, y: wy };  // point-cast
    }

    // Thronefall preview: tapping an unused build plot opens the build menu
    // anchored to that plot. Small target, so it's an intentional tap.
    if ((RTS.Config.tfLook || RTS.Config.render3d) && s.map && s.map.buildPlots && !additive) {
      for (var pi = 0; pi < s.map.buildPlots.length; pi++) {
        var bp = s.map.buildPlots[pi];
        if (bp.used) continue;
        var pdx = wx - bp.x, pdy = wy - bp.y;
        if (pdx * pdx + pdy * pdy <= 46 * 46) return { type: 'buildPlot', plot: bp };
      }
    }

    if (s.pendingOrder === 'move' &&
        (!hit || hit.kind === 'resource' || isBareGround(hit))) {
      if (!combat.length) {
        s.pendingOrder = null;
        return { type: 'noop' };
      }
      s.pendingOrder = null;
      return { type: 'moveCombat', x: wx, y: wy, attackMove: false, units: combat };
    }
    if (!sel.length && hit && hit.kind === 'resource') {
      return { type: 'smartMine', nodeId: hit.id, x: wx, y: wy };
    }
    if (hit && hit.kind === 'resource' && workers.length) {
      return { type: 'harvest', nodeId: hit.id, workers: workers };
    }
    if (hit && hit.kind === 'building' && hit.team === TEAM.NEUTRAL && hit.built && !additive &&
        (hit.type === 'merchant' || hit.type === 'mercenary')) {
      return { type: 'openShop', shopType: hit.type, buildingId: hit.id };
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
      return { type: 'moveCombat', x: wx, y: wy, attackMove: s.attackMoveArmed, patrol: !!s.patrolArmed, units: combat };
    }
    if (workers.length && !combat.length && (!hit || hit.kind === 'resource')) {
      return { type: 'moveWorkers', x: wx, y: wy, units: workers };
    }
    if (!hit) return { type: 'clearOrClose' };
    return { type: 'noop' };
  }

  function executeTapIntent(s, intent, additive) {
    switch (intent.type) {
      case 'buildPlot':
        s.ui.buildPlot = intent.plot;
        s.ui.buildPanelOpen = true;
        s.ui.shopOpen = null;
        RTS.Audio.play('click');
        RTS.toast(s, 'Choose a structure to raise here');
        RTS.HUD.sync(s);
        break;
      case 'openShop':
        s.ui.shopOpen = intent.shopType;
        s.ui.buildPanelOpen = false;
        RTS.Audio.play('click');
        RTS.toast(s, intent.shopType === 'merchant'
          ? 'Merchant — select a hero, then buy gear'
          : 'Mercenary Camp (coming soon)');
        RTS.HUD.sync(s);
        break;
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
      case 'castAbility': {
        var caster = RTS.getById(s, intent.uid);
        var tgt = intent.targetId ? RTS.getById(s, intent.targetId) : { x: intent.x, y: intent.y };
        var ok = caster && RTS.castAbility && RTS.castAbility(s, caster, intent.abId, tgt);
        s.pendingAbility = null;
        if (ok) { flash(s, intent.x, intent.y, '#c79bff'); haptic(10); }
        else { RTS.Audio.play('deny'); }
        RTS.refreshMode && RTS.refreshMode(s);
        RTS.HUD.sync(s);
        break;
      }
      case 'moveCombat':
        if (intent.patrol) {
          RTS.orderPatrol(s, intent.units, intent.x, intent.y);
          flash(s, intent.x, intent.y, '#5ad1ff');
          s.patrolArmed = false;
          RTS.refreshMode && RTS.refreshMode(s);
          RTS.HUD.sync(s);
        } else {
          RTS.orderMove(s, intent.units, intent.x, intent.y, intent.attackMove);
          flash(s, intent.x, intent.y, intent.attackMove ? '#ff9a3c' : RTS.Factions[s.playerFaction].primary);
          if (intent.units.some(function (u) { return u.role === 'hero'; })) {
            RTS.toast(s, 'Move order');
          }
        }
        haptic(8);
        break;
      case 'moveWorkers':
        RTS.orderMove(s, intent.units, intent.x, intent.y, false);
        flash(s, intent.x, intent.y, RTS.Factions[s.playerFaction].primary);
        haptic(8);
        break;
      case 'clearOrClose':
        if (s.ui.shopOpen) {
          s.ui.shopOpen = null;
          RTS.HUD.sync(s);
        } else if (RTS.BuildingMenu && RTS.BuildingMenu.isOpen()) {
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
    ensureHeroTestSelection(s);

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

    // On bare ground with no contextual action, the long-press still engages so
    // that a follow-up drag can draw a selection box.
    if (!mode) { if (onBare) mode = 'select'; else return; }

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
      // Ring filled: a drag now draws a selection box; releasing without a drag
      // commits the contextual action (attack-move / rally / build).
      p.lpReady = true;
      haptic(12);
    }, ms);
  }

  // Commit the contextual long-press action — called on release when the ring
  // filled but the player did NOT drag a selection box.
  function commitLongPress(s, anchor) {
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
    // mode 'select' → no contextual action (box select handled on drag).
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
    ensureHeroTestSelection: ensureHeroTestSelection,
    tapWorld: function (s, wx, wy, additive) { return tapWorld(s, wx, wy, additive); },
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

      // Left-edge camera-pan zone, landscape only: the leftmost ~18% of the
      // viewport (capped) is a strip where a drag scrolls the camera even with
      // units selected. Tunable via Config.touch.leftPanZone (fraction) / -Max (px).
      function inLeftPanZone(cssX, cssY) {
        var W = window.innerWidth, H = window.innerHeight;
        if (W <= H) return false;                       // landscape only
        var t = (RTS.Config && RTS.Config.touch) || {};
        var frac = t.leftPanZone != null ? t.leftPanZone : 0.18;
        var max = t.leftPanZoneMax != null ? t.leftPanZoneMax : 150;
        return cssX <= Math.min(W * frac, max);
      }

      // --- single-pointer (mouse or 1 touch) ---
      function down(cssX, cssY, shift, isTouch) {
        var s = st();
        if (!s || !active() || (uiBlocked(s) && s.pendingOrder !== 'move')) return;
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
        // Left-edge camera-pan zone (landscape): a drag starting here ALWAYS pans
        // the camera, even with units selected — so you can scroll the field with
        // your left thumb without issuing a move. A tap (no drag) still selects.
        var leftPan = isTouch && !boxArmed && s.inputMode !== 'place-building' && inLeftPanZone(cssX, cssY);
        s.ui.pointer = {
          cssX: cssX, cssY: cssY, startX: cssX, startY: cssY,
          wx: w.x, wy: w.y, moved: false, panning: false, boxing: false,
          longPressFired: false, lpReady: false, menuHoldFired: false, secondTap: secondTap,
          armyDouble: armyDouble, buildingDouble: buildingDouble, pawnDouble: pawnDouble,
          onEmpty: onEmpty, useBox: onEmpty && boxArmed, shift: !!shift, leftPan: leftPan,
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
        } else if (!leftPan && !secondTap && !boxArmed &&
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
        clearMenuHold(p);

        // Left-edge pan zone: drag always scrolls the camera, regardless of what
        // is selected (takes precedence over box-select / move-on-drag).
        if (p.leftPan) {
          p.panning = true;
          var prevL = RTS.Cam.screenToWorld(s, p.cssX, p.cssY);
          s.camera.x -= (w.x - prevL.x);
          s.camera.y -= (w.y - prevL.y);
          RTS.Cam.clamp(s);
          p.cssX = cssX; p.cssY = cssY;
          return;
        }

        // Long-press completed (ring filled) → dragging draws a selection box.
        if (p.lpReady) {
          p.boxing = true;
          hideLongPressRing();
          s.selectionBox = { x1: p.wx, y1: p.wy, x2: w.x, y2: w.y };
          p.cssX = cssX; p.cssY = cssY;
          return;
        }

        clearLongPress(s);

        if (s.inputMode === 'place-building') { p.cssX = cssX; p.cssY = cssY; return; }

        if (p.useBox && p.onEmpty) {
          p.boxing = true;
          s.selectionBox = { x1: p.wx, y1: p.wy, x2: w.x, y2: w.y };
          return;
        }
        // With fighters selected, drag on open ground issues a move on release — don't pan.
        if (p.onEmpty && !RTS.activeCombatUnits(s).length) {
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
        var lpAnchorUp = s.ui.longPressAnchor;
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
        // A camera pan (incl. left-edge zone) must not also fire a move/select.
        if (p.panning) { s.selectionBox = null; return; }
        if (p.boxing && s.selectionBox) {
          var b = s.selectionBox;
          RTS.selectBox(s, b.x1, b.y1, b.x2, b.y2, p.shift);
          s.selectionBox = null;
          return;
        }
        s.selectionBox = null;
        // Long-press held to completion, released without a box drag → contextual action.
        if (p.lpReady) {
          commitLongPress(s, lpAnchorUp);
          return;
        }
        var w = RTS.Cam.screenToWorld(s, cssX, cssY);
        var hitUp = hitTest(s, w.x, w.y);
        ensureHeroTestSelection(s);
        var combatSel = RTS.activeCombatUnits(s);
        var pendingMove = s.pendingOrder === 'move';
        var groundMove = (combatSel.length || pendingMove) && p.onEmpty && isBareGround(hitUp)
          && s.inputMode !== 'place-building';

        // Fighters selected + bare ground: always move on release (even after a small drag).
        // Skip uiBlocked when Move button just armed a pending order (HUD tap sets lastUiAt).
        var uiOk = !uiBlocked(s) || pendingMove;
        if (groundMove && !p.longPressFired && !p.menuHoldFired && uiOk
            && !p.armyDouble && !p.buildingDouble && !p.pawnDouble) {
          clearPendingTap();
          tapWorld(s, w.x, w.y, p.shift);
          if (pendingMove) s.pendingOrder = null;
          lastTap = { t: performance.now(), x: cssX, y: cssY, empty: true, hitId: null, hitKind: null };
          return;
        }

        if (!p.moved && !p.longPressFired && !p.menuHoldFired && (uiOk || pendingMove)) {
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
          var now = performance.now();
          if (isBareGround(hitUp) && s.inputMode !== 'place-building') {
            if (pendingMove) {
              clearPendingTap();
              tapWorld(s, w.x, w.y, p.shift);
              s.pendingOrder = null;
              lastTap = { t: 0, x: 0, y: 0, empty: false, hitId: null, hitKind: null };
            } else {
              schedulePendingTap(s, w.x, w.y, p.shift);
              lastTap = { t: now, x: cssX, y: cssY, empty: true, hitId: null, hitKind: null };
            }
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
      canvas.addEventListener('mouseup', function (e) {
        if (!isSurface(e)) return;
        var r = rect(); up(e.clientX - r.left, e.clientY - r.top);
      });
      window.addEventListener('mouseup', function (e) {
        if (e.target === canvas) return;
        var r = rect(); up(e.clientX - r.left, e.clientY - r.top);
        if (e.button === 2) {
          var s = st();
          if (s && active()) {
            var w = RTS.Cam.screenToWorld(s, e.clientX - r.left, e.clientY - r.top);
            ensureHeroTestSelection(s);
            if (RTS.activeCombatUnits(s).length) tapWorld(s, w.x, w.y, false);
          }
        }
      });
      canvas.addEventListener('wheel', function (e) {
        var s = st(); if (!s || !active()) return; e.preventDefault();
        var r = rect();
        RTS.Cam.zoomAt(s, e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var s = st(); if (!s || !active()) return;
        if (uiBlocked(s) && s.pendingOrder !== 'move') return;
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
        down(t.clientX - r.left, t.clientY - r.top, false, true);
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
        if (RTS.Config.camera && RTS.Config.camera.lock) return;
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
        if (e.key === 'm' || e.key === 'M') {
          s.pendingOrder = 'move';
          ensureHeroTestSelection(s);
          if (RTS.activeCombatUnits(s).length) RTS.toast(s, 'Click ground to move');
        }
        if (e.key === 's' || e.key === 'S') { RTS.orderStop(s, RTS.activeSelectedUnits(s)); }
      });
    },
  };

})(window.RTS = window.RTS || {});
