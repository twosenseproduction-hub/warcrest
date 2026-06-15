/* ============================================================================
 * EXOFRONT — render.js
 * Canvas renderer — delegates cartoon art to art.js
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;
  var Art = function () { return RTS.Art; };

  /* ── Fog of War state ───────────────────────────────────────────────────── */
  // fogEnabled: runtime toggle (kept global so debug controls can flip it).
  RTS.fogEnabled = true;

  // Back-compat alias for older debug hooks. Active matches keep fog on state.
  RTS._fogExplored = new Set();

  function fogState(s) {
    if (!s.fog) s.fog = { explored: new Set(), visible: new Set(), stamp: -1 };
    if (!s.fog.explored) s.fog.explored = new Set();
    if (!s.fog.visible) s.fog.visible = new Set();
    RTS._fogExplored = s.fog.explored;
    return s.fog;
  }

  function fogTileSize() {
    return RTS.Config.tileSize ||
      (RTS.Config.world && RTS.Config.world.tileSize) ||
      RTS.TILE || 64;
  }

  function fogWorldSize() {
    return {
      w: RTS.Config.world ? RTS.Config.world.w : 4096,
      h: RTS.Config.world ? RTS.Config.world.h : 4096,
    };
  }

  function fogTileKey(tx, ty) {
    return tx + ',' + ty;
  }

  function fogTileAtWorld(wx, wy) {
    var tileSize = fogTileSize();
    return {
      tx: Math.floor(wx / tileSize),
      ty: Math.floor(wy / tileSize),
    };
  }

  function forEachTileInRect(s, rect, fn) {
    if (!rect) return false;
    var tileSize = fogTileSize();
    var world = fogWorldSize();
    var cols = Math.ceil(world.w / tileSize);
    var rows = Math.ceil(world.h / tileSize);
    var left = rect.left != null ? rect.left : rect.x;
    var top = rect.top != null ? rect.top : rect.y;
    var right = rect.right != null ? rect.right : left + (rect.w || 0);
    var bottom = rect.bottom != null ? rect.bottom : top + (rect.h || 0);
    var tx0 = Math.max(0, Math.floor(left / tileSize));
    var ty0 = Math.max(0, Math.floor(top / tileSize));
    var tx1 = Math.min(cols - 1, Math.floor(right / tileSize));
    var ty1 = Math.min(rows - 1, Math.floor(bottom / tileSize));
    var tx, ty;
    for (ty = ty0; ty <= ty1; ty++) {
      for (tx = tx0; tx <= tx1; tx++) {
        if (fn(fogTileKey(tx, ty), tx, ty)) return true;
      }
    }
    return false;
  }

  function entityFogRect(s, e) {
    if (!e) return null;
    if (e.kind === 'building') {
      var vb = RTS.Assets && RTS.Assets.buildingVisualBounds
        ? RTS.Assets.buildingVisualBounds(e, s) : null;
      if (vb) {
        var br = vb.boundary || vb.tight;
        if (br) {
          return {
            left: br.left != null ? br.left : br.x,
            top: br.top != null ? br.top : br.y,
            right: br.right != null ? br.right : (br.x + br.w),
            bottom: br.bottom != null ? br.bottom : (br.y + br.h),
          };
        }
        return {
          left: vb.x - vb.drawW / 2,
          top: vb.drawY,
          right: vb.x + vb.drawW / 2,
          bottom: vb.drawY + vb.drawH,
        };
      }
      return { left: e.x - e.w / 2, top: e.y - e.h / 2, right: e.x + e.w / 2, bottom: e.y + e.h / 2 };
    }
    var r = Math.max(e.radius || 10, 10);
    return { left: e.x - r, top: e.y - r, right: e.x + r, bottom: e.y + r };
  }

  RTS.resetFog = function (s) {
    if (!s) return;
    s.fog = { explored: new Set(), visible: new Set(), stamp: -1 };
    RTS._fogExplored = s.fog.explored;
  };

  /**
   * Build the set of tiles currently visible to the player.
   * Returns a Set of "tx,ty" strings.
   * Uses Euclidean (circular) distance — NOT Manhattan.
   */
  RTS._calcVisibleTiles = function (s) {
    var fog = fogState(s);
    var visible = new Set();
    var tileSize = fogTileSize();
    var world    = fogWorldSize();
    var worldW   = world.w;
    var worldH   = world.h;
    var cols     = Math.ceil(worldW / tileSize);
    var rows     = Math.ceil(worldH / tileSize);

    function revealAround(wx, wy, radius) {
      var cx = Math.floor(wx / tileSize);
      var cy = Math.floor(wy / tileSize);
      var r  = Math.ceil(radius);
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.sqrt(dx * dx + dy * dy) <= radius) {
            var tx = cx + dx, ty = cy + dy;
            if (tx >= 0 && tx < cols && ty >= 0 && ty < rows) {
              var key = fogTileKey(tx, ty);
              visible.add(key);
              fog.explored.add(key);
            }
          }
        }
      }
    }

    // Friendly units — vision radius 6 tiles
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== TEAM.PLAYER) return;
      var us = RTS.Units && RTS.Units[u.role];
      var radius = u.visionRadius || (us && us.vision) || 6;
      if (u.visionBonus) radius += u.visionBonus;
      revealAround(u.x, u.y, radius);
    });

    // Friendly buildings — vision radius 8 tiles
    s.entities.buildings.forEach(function (b) {
      if (b.dead || b.team !== TEAM.PLAYER) return;
      var bs = RTS.Buildings && RTS.Buildings[b.type];
      revealAround(b.x, b.y, b.visionRadius || (bs && bs.vision) || 8);
    });

    fog.visible = visible;
    fog.stamp = s.timers ? s.timers.gameTime : 0;
    return visible;
  };

  RTS.currentVisibleTiles = function (s) {
    if (!s) return new Set();
    return RTS._calcVisibleTiles(s);
  };

  RTS.fogTileStateAt = function (s, wx, wy, visibleSet) {
    if (!RTS.fogEnabled) return 'visible';
    var fog = fogState(s);
    var t = fogTileAtWorld(wx, wy);
    var key = fogTileKey(t.tx, t.ty);
    var visible = visibleSet || RTS.currentVisibleTiles(s);
    if (visible.has(key)) return 'visible';
    if (fog.explored.has(key)) return 'explored';
    return 'unexplored';
  };

  RTS.entityFogState = function (s, e, visibleSet) {
    if (!RTS.fogEnabled) return 'visible';
    if (!e) return 'unexplored';
    if (e.team === TEAM.PLAYER) return 'visible';

    var fog = fogState(s);
    var visible = visibleSet || RTS.currentVisibleTiles(s);
    var rect = entityFogRect(s, e);
    var sawVisible = false;
    var sawExplored = false;
    forEachTileInRect(s, rect, function (key) {
      if (visible.has(key)) {
        sawVisible = true;
        return true;
      }
      if (fog.explored.has(key)) sawExplored = true;
      return false;
    });
    if (sawVisible) return 'visible';
    if (sawExplored) return 'explored';
    return 'unexplored';
  };

  RTS.entityVisibleToPlayer = function (s, e, visibleSet) {
    return RTS.entityFogState(s, e, visibleSet) === 'visible';
  };

  RTS.entityExploredByPlayer = function (s, e, visibleSet) {
    var st = RTS.entityFogState(s, e, visibleSet);
    return st === 'visible' || st === 'explored';
  };

  /**
   * Draw the fog overlay after terrain/resources and before depth-sorted actors.
   * - Visible tiles   : no overlay
   * - Explored tiles  : rgba(0,0,0,0.38) — terrain shows through, dimmed
   * - Unexplored tiles : rgba(0,0,0,0.68) — very dark but terrain faintly visible
   */
  RTS._drawFogOverlay = function (s, ctx, visibleSet) {
    var fog = fogState(s);
    var tileSize = fogTileSize();
    var world = fogWorldSize();
    var worldW   = world.w;
    var worldH   = world.h;
    var cols     = Math.ceil(worldW / tileSize);
    var rows     = Math.ceil(worldH / tileSize);

    for (var ty = 0; ty < rows; ty++) {
      for (var tx = 0; tx < cols; tx++) {
        var key = fogTileKey(tx, ty);
        var alpha;
        if (visibleSet.has(key)) {
          continue; // fully clear — draw nothing
        } else if (fog.explored.has(key)) {
          alpha = 0.38; // explored but out of current vision
        } else {
          alpha = 0.68; // never seen
        }
        ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
        ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
      }
    }
  };

  RTS.Render = {
    dpr: 1,
    resize: function (s) {
      var cv = RTS.canvas;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      cv.width = Math.floor(cv.clientWidth * dpr);
      cv.height = Math.floor(cv.clientHeight * dpr);
      RTS.Cam.clamp(s);
    },

    frame: function (s) {
      RTS._renderT = s.timers.gameTime;
      var cv = RTS.canvas, ctx = RTS.ctx, dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
      var W = cv.clientWidth, H = cv.clientHeight;

      ctx.fillStyle = '#4caf50';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      var shake = (s.screenShake > 0 && !RTS.Config.reducedMotion)
        ? { x: (Math.random() - 0.5) * s.screenShake, y: (Math.random() - 0.5) * s.screenShake } : { x: 0, y: 0 };
      var c = s.camera;
      ctx.translate(-c.x * c.zoom + shake.x, -c.y * c.zoom + shake.y);
      ctx.scale(c.zoom, c.zoom);

      // ── 1. Terrain/resources draw first; fog will veil what is unseen. ─────
      Art().drawTerrain(s, ctx);
      s.entities.resources.forEach(function (n) {
        if (n.amount <= 0) return;
        if (RTS.fogEnabled && RTS.fogTileStateAt(s, n.x, n.y) === 'unexplored') return;
        Art().drawResource(ctx, n);
      });
      drawSelectionBack(s, ctx);

      var visibleSet = RTS.fogEnabled ? RTS.currentVisibleTiles(s) : null;

      // ── 2. Fog veils terrain/resources before actors are depth painted. ─────
      if (RTS.fogEnabled) {
        RTS._drawFogOverlay(s, ctx, visibleSet);
      }

      // ── 3. Buildings and units share one painter pass by ground contact. ────
      drawDepthSortedEntities(s, ctx, visibleSet);
      if (Art().drawLivestock) Art().drawLivestock(ctx, s);

      drawProjectiles(s, ctx);
      drawEffects(s, ctx);
      drawSelectionFront(s, ctx);
      drawGhost(s, ctx);
      drawSelectionBox(s, ctx);
      if (RTS.BuildingMenu) RTS.BuildingMenu.draw(ctx, s);

      ctx.restore();

      if (s.screenFlash > 0) {
        ctx.fillStyle = RTS.hexA(s.flashColor, s.screenFlash * 0.28);
        ctx.fillRect(0, 0, W, H);
      }
      if (s.ui.baseAlarm > 0) {
        var a = (Math.sin(s.timers.gameTime * 9) * 0.5 + 0.5) * s.ui.baseAlarm * 0.22;
        ctx.strokeStyle = RTS.hexA('#ff5252', Math.min(0.95, a + 0.25));
        ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
      }
    },
  };

  function entityDepth(e, s) {
    if (e.kind === 'building') {
      var bvb = RTS.Assets && RTS.Assets.buildingVisualBounds
        ? RTS.Assets.buildingVisualBounds(e, s) : null;
      return bvb ? bvb.footY : e.y;
    }
    if (e.kind === 'unit') {
      var uvb = RTS.Sprites && RTS.Sprites.unitVisualBounds
        ? RTS.Sprites.unitVisualBounds(e, s) : null;
      if (uvb) return uvb.soleY != null ? uvb.soleY : uvb.footY;
      return e.y + (e.radius || 0) * 0.25;
    }
    return e.y || 0;
  }

  RTS.renderDepthForEntity = entityDepth;

  function unitDrawAlpha(s, u, visibleSet) {
    if (!RTS.fogEnabled || u.team === TEAM.PLAYER) return 1;
    return RTS.entityVisibleToPlayer(s, u, visibleSet) ? 1 : 0;
  }

  function buildingDrawAlpha(s, b, visibleSet) {
    if (!RTS.fogEnabled || b.team === TEAM.PLAYER) return 1;
    var st = RTS.entityFogState(s, b, visibleSet);
    if (st === 'visible') return 1;
    if (st === 'explored') return 0.52;
    return 0;
  }

  function drawDepthSortedEntities(s, ctx, visibleSet) {
    var items = [];
    s.entities.buildings.forEach(function (b) {
      if (b.dead) return;
      var alpha = buildingDrawAlpha(s, b, visibleSet);
      if (alpha <= 0) return;
      items.push({ kind: 'building', e: b, alpha: alpha, z: entityDepth(b, s), tie: 1 });
    });
    s.entities.units.forEach(function (u) {
      if (u.dead && u.corpse <= 0) return;
      var alpha = unitDrawAlpha(s, u, visibleSet);
      if (alpha <= 0) return;
      items.push({ kind: 'unit', e: u, alpha: alpha, z: entityDepth(u, s), tie: 2 });
    });
    items.sort(function (a, b) {
      if (a.z !== b.z) return a.z - b.z;
      if (a.tie !== b.tie) return a.tie - b.tie;
      return String(a.e.id).localeCompare(String(b.e.id));
    });
    items.forEach(function (item) {
      var e = item.e;
      ctx.save();
      if (item.alpha < 1) ctx.globalAlpha *= item.alpha;
      if (item.kind === 'building') Art().drawBuilding(ctx, e, RTS.Factions[e.faction], s);
      else Art().drawUnit(ctx, e, RTS.Factions[e.faction], s);
      ctx.restore();
    });
  }

  function drawProjectiles(s, ctx) {
    s.entities.projectiles.forEach(function (p) { Art().drawProjectile(ctx, p); });
  }

  function drawEffects(s, ctx) {
    if (RTS.Particles) RTS.Particles.draw(s, ctx);
    s.entities.effects.forEach(function (fx) {
      if (fx.kind === 'pfx') return;
      var a = Math.max(0, fx.life / fx.max);
      if (fx.kind === 'spark') {
        ctx.fillStyle = RTS.hexA(fx.color, a);
        ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1.5;
        for (var i = 0; i < 4; i++) {
          var ang = i * 1.57;
          ctx.beginPath(); ctx.moveTo(fx.x, fx.y);
          ctx.lineTo(fx.x + Math.cos(ang) * 6, fx.y + Math.sin(ang) * 6); ctx.stroke();
        }
      } else if (fx.kind === 'ring' || fx.kind === 'cmd') {
        ctx.strokeStyle = RTS.hexA(fx.color, a * 0.85); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = RTS.hexA(fx.color, a * 0.15);
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * 0.6, 0, Math.PI * 2); ctx.fill();
      } else if (fx.kind === 'boom') {
        ctx.fillStyle = RTS.hexA(fx.color, a * 0.55);
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = RTS.hexA('#fff', a * 0.7); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.stroke();
      } else if (fx.kind === 'heal') {
        ctx.font = 'bold 14px Fredoka, system-ui'; ctx.textAlign = 'center';
        ctx.fillStyle = RTS.hexA('#69f0ae', a);
        ctx.fillText('+', fx.x, fx.y + 5);
      } else if (fx.kind === 'float') {
        ctx.font = 'bold 15px Fredoka, system-ui'; ctx.textAlign = 'center';
        ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 3;
        ctx.strokeText(fx.text, fx.x, fx.y);
        ctx.fillStyle = RTS.hexA(fx.color, a);
        ctx.fillText(fx.text, fx.x, fx.y);
      }
    });
  }

  function drawSelectionBack(s, ctx) {
    if (!s.selectedIds.length) return;
    var t = s.timers.gameTime;
    var pulse = RTS.Config.reducedMotion ? 1 : 1 + Math.sin(t * 5) * 0.05;
    s.selectedIds.forEach(function (id) {
      var e = RTS.getById(s, id);
      if (!e || e.dead) return;
      Art().drawSelectionRingBack(ctx, e, t, pulse, s);
    });
  }

  function drawSelectionFront(s, ctx) {
    if (!s.selectedIds.length) return;
    var t = s.timers.gameTime;
    var pulse = RTS.Config.reducedMotion ? 1 : 1 + Math.sin(t * 5) * 0.05;
    s.selectedIds.forEach(function (id) {
      var e = RTS.getById(s, id);
      if (!e || e.dead) return;
      Art().drawSelectionRingFront(ctx, e, t, pulse, s);
    });
  }

  function drawGhost(s, ctx) {
    if (s.inputMode !== 'place-building' || !s.ui.ghost) return;

    var g = s.ui.ghost;
    var draw = RTS.SizeRef && RTS.SizeRef.buildingDrawTarget
      ? RTS.SizeRef.buildingDrawTarget(g.type)
      : RTS.Buildings[g.type];

    var gx = g.x;
    var gy = g.y - draw.h / 2;
    var gw = draw.w;
    var gh = draw.h;
    var vb = null;

    if (RTS.Assets && RTS.Assets.buildingVisualBounds) {
      vb = RTS.Assets.buildingVisualBounds({
        x: g.x, y: g.y, type: g.type,
        w: draw.w, h: draw.h,
        faction: s.playerFaction, dead: false,
      }, s);
      if (vb) {
        gx = vb.x;
        gy = vb.drawY;
        gw = vb.drawW;
        gh = vb.drawH;
      }
    }

    var col = g.valid ? '#66bb6a' : '#ef5350';
    var br = vb && vb.boundary;

    if (br) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = RTS.hexA(col, 0.35);
      ctx.fillRect(br.left, br.top, br.w, br.h);

      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(br.left, br.top, br.w, br.h);
      ctx.setLineDash([]);
    } else {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = RTS.hexA(col, 0.35);
      ctx.fillRect(gx - gw / 2, gy, gw, gh);

      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(gx - gw / 2, gy, gw, gh);
      ctx.setLineDash([]);
    }

    if (g.type === 'outpost') {
      s.entities.resources.forEach(function (n) {
        if (n.amount <= 500) return;
        ctx.strokeStyle = RTS.hexA('#ffd54f', 0.35);
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 120, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  }

  function drawSelectionBox(s, ctx) {
    if (!s.selectionBox) return;
    var b = s.selectionBox;
    var x = Math.min(b.x1, b.x2), y = Math.min(b.y1, b.y2);
    var w = Math.abs(b.x2 - b.x1), h = Math.abs(b.y2 - b.y1);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 5]);
    ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  }

  function drawMinimapFog(s, ctx, sx, sy, visibleSet) {
    var fog = fogState(s);
    var tileSize = fogTileSize();
    var world = fogWorldSize();
    var cols = Math.ceil(world.w / tileSize);
    var rows = Math.ceil(world.h / tileSize);
    var mw = tileSize * sx;
    var mh = tileSize * sy;
    for (var ty = 0; ty < rows; ty++) {
      for (var tx = 0; tx < cols; tx++) {
        var key = fogTileKey(tx, ty);
        if (visibleSet.has(key)) continue;
        ctx.fillStyle = fog.explored.has(key) ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.68)';
        ctx.fillRect(tx * mw, ty * mh, mw + 0.5, mh + 0.5);
      }
    }
  }

  RTS.renderMinimap = function (s) {
    var cv = RTS.minimap; if (!cv) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== cv.clientWidth * dpr) { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = cv.clientWidth, H = cv.clientHeight;
    var sx = W / RTS.Config.world.w, sy = H / RTS.Config.world.h;
    ctx.fillStyle = '#388e3c'; ctx.fillRect(0, 0, W, H);
    var visibleSet = RTS.fogEnabled ? RTS.currentVisibleTiles(s) : null;
    if (RTS.fogEnabled) drawMinimapFog(s, ctx, sx, sy, visibleSet);
    s.entities.resources.forEach(function (n) {
      if (RTS.fogEnabled && RTS.fogTileStateAt(s, n.x, n.y, visibleSet) === 'unexplored') return;
      ctx.fillStyle = '#ffc107';
      ctx.beginPath(); ctx.arc(n.x * sx, n.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
    });
    s.entities.buildings.forEach(function (b) {
      var alpha = 1;
      if (RTS.fogEnabled && b.team !== TEAM.PLAYER) {
        var st = RTS.entityFogState(s, b, visibleSet);
        if (st === 'unexplored') return;
        if (st === 'explored') alpha = 0.45;
      }
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = b.team === TEAM.PLAYER ? '#26c6da' : '#ff7043';
      ctx.fillRect(b.x * sx - 3, b.y * sy - 3, 6, 6);
      ctx.restore();
    });
    s.entities.units.forEach(function (u) {
      if (u.dead) return;
      if (u.team !== TEAM.PLAYER && RTS.fogEnabled && !RTS.entityVisibleToPlayer(s, u, visibleSet)) return;
      ctx.fillStyle = u.team === TEAM.PLAYER ? '#80deea' : '#ffab91';
      ctx.fillRect(u.x * sx - 1.5, u.y * sy - 1.5, 3, 3);
    });
    var view = RTS.Cam.viewSizeWorld(s);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(s.camera.x * sx, s.camera.y * sy, view.w * sx, view.h * sy);
  };

  RTS.hexA = function (hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

})(window.RTS = window.RTS || {});
