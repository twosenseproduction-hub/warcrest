/* ============================================================================
 * EXOFRONT — render.js
 * Canvas renderer — delegates cartoon art to art.js
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;
  var Art = function () { return RTS.Art; };

  /* ── Fog of War state ───────────────────────────────────────────────────── */
  // fogEnabled: toggled by the DEV button (FOG: ON / FOG: OFF)
  RTS.fogEnabled = true;

  // explored: Set of "tx,ty" strings — tiles the player has ever seen
  RTS._fogExplored = new Set();

  /**
   * Build the set of world-positions currently visible to the player.
   * Returns a Set of "tx,ty" strings.
   * Uses Euclidean (circular) distance — NOT Manhattan.
   */
  RTS._calcVisibleTiles = function (s) {
    var visible = new Set();
    var tileSize = RTS.Config.tileSize || RTS.Config.world && RTS.Config.world.tileSize || 64;
    var worldW   = RTS.Config.world ? RTS.Config.world.w : 4096;
    var worldH   = RTS.Config.world ? RTS.Config.world.h : 4096;
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
              var key = tx + ',' + ty;
              visible.add(key);
              RTS._fogExplored.add(key);
            }
          }
        }
      }
    }

    // Friendly units — vision radius 6 tiles
    s.entities.units.forEach(function (u) {
      if (u.dead || u.team !== TEAM.PLAYER) return;
      revealAround(u.x, u.y, 6);
    });

    // Friendly buildings — vision radius 8 tiles
    s.entities.buildings.forEach(function (b) {
      if (b.team !== TEAM.PLAYER) return;
      revealAround(b.x, b.y, 8);
    });

    return visible;
  };

  /**
   * Draw the fog overlay AFTER terrain/buildings/trees, BEFORE units.
   * - Visible tiles   : no overlay
   * - Explored tiles  : rgba(0,0,0,0.38) — terrain shows through, dimmed
   * - Unexplored tiles : rgba(0,0,0,0.68) — very dark but terrain faintly visible
   * Soft edge: tiles at exactly radius+1 get a heavier veil to avoid hard cuts.
   */
  RTS._drawFogOverlay = function (s, ctx, visibleSet) {
    var tileSize = RTS.Config.tileSize || RTS.Config.world && RTS.Config.world.tileSize || 64;
    var worldW   = RTS.Config.world ? RTS.Config.world.w : 4096;
    var worldH   = RTS.Config.world ? RTS.Config.world.h : 4096;
    var cols     = Math.ceil(worldW / tileSize);
    var rows     = Math.ceil(worldH / tileSize);

    for (var ty = 0; ty < rows; ty++) {
      for (var tx = 0; tx < cols; tx++) {
        var key = tx + ',' + ty;
        var alpha;
        if (visibleSet.has(key)) {
          continue; // fully clear — draw nothing
        } else if (RTS._fogExplored.has(key)) {
          alpha = 0.38; // explored but out of current vision
        } else {
          alpha = 0.68; // never seen
        }
        ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
        ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
      }
    }
  };

  function factionForUnit(u, s) {
    return RTS.Factions[u.faction] || RTS.Factions[s.playerFaction] || RTS.Factions.aurex;
  }

  RTS.Render = {
    dpr: 1,
    resize: function (s) {
      var cv = RTS.canvas;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      cv.width = Math.floor(cv.clientWidth * dpr);
      cv.height = Math.floor(cv.clientHeight * dpr);
      cv.style.width  = cv.clientWidth + 'px';
      cv.style.height = cv.clientHeight + 'px';
      RTS.Cam.clamp(s);
      if (RTS._syncPhaserAfterResize) RTS._syncPhaserAfterResize();
      if (RTS._phaserWorldLayer && RTS._phaserWorldLayer.resize) {
        RTS._phaserWorldLayer.resize();
      }
    },

    /** Camera shake offset for the current frame. */
    _shakeOffset: function (s) {
      return (s.screenShake > 0 && !RTS.Config.reducedMotion)
        ? { x: (Math.random() - 0.5) * s.screenShake, y: (Math.random() - 0.5) * s.screenShake }
        : { x: 0, y: 0 };
    },

    _prepareCtx: function (ctx, dpr) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    },

    /**
     * Draw all world-space content (decor, entities, fog, effects, selection).
     * Used by WorldCanvasLayer (Phaser) and the legacy frame() fallback.
     */
    drawWorld: function (s, ctx, opts) {
      RTS._renderT = s.timers.gameTime;
      var dpr = (opts && opts.dpr) || this.dpr;
      var W = (opts && opts.width) || (RTS.canvas && RTS.canvas.clientWidth) || 0;
      var H = (opts && opts.height) || (RTS.canvas && RTS.canvas.clientHeight) || 0;
      var onMainCanvas = !opts || opts.onMainCanvas !== false;

      this._prepareCtx(ctx, dpr);

      // Fill canvas background — must happen in screen (CSS pixel) space before world transform.
      // For fairy_clearing or when Phaser has no terrain active, fill solid color so
      // the WorldCanvasLayer is opaque and the Phaser scene background can't bleed through.
      if (s.mapId === 'fairy_clearing' || !RTS._phaserTerrainActive) {
        ctx.fillStyle = s.mapId === 'fairy_clearing' ? '#1d401d' : '#4caf50';
        ctx.fillRect(0, 0, W, H);
      }

      // Fairy clearing: draw grass in CSS pixel space BEFORE the world transform so
      // the tiling fills the full canvas regardless of DPR-driven camera zoom.
      if (s.mapId === 'fairy_clearing' && RTS.Art && RTS.Art.drawFairyGrassFloor) {
        RTS.Art.drawFairyGrassFloor(ctx, s, W, H);
      }

      ctx.save();
      var shake = this._shakeOffset(s);
      var c = s.camera;
      ctx.translate(-c.x * c.zoom + shake.x, -c.y * c.zoom + shake.y);
      ctx.scale(c.zoom, c.zoom);

      if (s.mapId !== 'fairy_clearing') {
        Art().drawTerrain(s, ctx);
      }
      if (RTS._phaserTerrainActive && RTS.Assets && RTS.Assets.drawDecor) {
        RTS.Assets.drawDecor(s, ctx);
      }
      s.entities.resources.forEach(function (n) { if (n.amount > 0) Art().drawResource(ctx, n); });
      drawSelectionBack(s, ctx);

      s.entities.buildings.forEach(function (b) { Art().drawBuilding(ctx, b, RTS.Factions[b.faction], s); });
      if (Art().drawLivestock) Art().drawLivestock(ctx, s);

      if (RTS.fogEnabled) {
        var visibleSet = RTS._calcVisibleTiles(s);
        RTS._drawFogOverlay(s, ctx, visibleSet);

        s.entities.units.forEach(function (u) {
          if (u.dead) return;
          if (u.team === TEAM.PLAYER) {
            Art().drawUnit(ctx, u, factionForUnit(u, s), s);
          }
        });

        var tileSize = RTS.Config.tileSize || RTS.Config.world && RTS.Config.world.tileSize || 64;
        s.entities.units.forEach(function (u) {
          if (u.dead || u.team === TEAM.PLAYER) return;
          var key = Math.floor(u.x / tileSize) + ',' + Math.floor(u.y / tileSize);
          if (visibleSet.has(key)) {
            Art().drawUnit(ctx, u, factionForUnit(u, s), s);
          }
        });
      } else {
        s.entities.units.forEach(function (u) { Art().drawUnit(ctx, u, factionForUnit(u, s), s); });
      }

      drawProjectiles(s, ctx);
      drawEffects(s, ctx);
      drawSelectionFront(s, ctx);
      drawGhost(s, ctx);
      drawSelectionBox(s, ctx);
      if (RTS.BuildingMenu) RTS.BuildingMenu.draw(ctx, s);

      ctx.restore();
    },

    /** Screen-space flash and base-alarm chrome (not affected by camera). */
    drawScreenFx: function (s, ctx, opts) {
      var dpr = (opts && opts.dpr) || this.dpr;
      var W = (opts && opts.width) || (RTS.canvas && RTS.canvas.clientWidth) || 0;
      var H = (opts && opts.height) || (RTS.canvas && RTS.canvas.clientHeight) || 0;
      this._prepareCtx(ctx, dpr);

      if (s.screenFlash > 0) {
        ctx.fillStyle = RTS.hexA(s.flashColor, s.screenFlash * 0.28);
        ctx.fillRect(0, 0, W, H);
      }
      if (s.ui.baseAlarm > 0) {
        var a = (Math.sin(s.timers.gameTime * 9) * 0.5 + 0.5) * s.ui.baseAlarm * 0.22;
        ctx.strokeStyle = RTS.hexA('#ff5252', Math.min(0.95, a + 0.25));
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, W - 8, H - 8);
      }
    },

    frame: function (s) {
      // Phaser WorldCanvasLayer owns rendering when active.
      if (RTS._phaserWorldLayer) return;

      RTS._renderT = s.timers.gameTime;
      var cv = RTS.canvas, ctx = RTS.ctx;
      var W = cv.clientWidth, H = cv.clientHeight;

      this.drawWorld(s, ctx, { width: W, height: H, dpr: this.dpr, onMainCanvas: true });
      this.drawScreenFx(s, ctx, { width: W, height: H, dpr: this.dpr });
    },
  };

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

  RTS.renderMinimap = function (s) {
    var cv = RTS.minimap; if (!cv) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== cv.clientWidth * dpr) { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = cv.clientWidth, H = cv.clientHeight;
    var sx = W / RTS.Config.world.w, sy = H / RTS.Config.world.h;
    ctx.fillStyle = '#388e3c'; ctx.fillRect(0, 0, W, H);
    s.entities.resources.forEach(function (n) {
      ctx.fillStyle = '#ffc107';
      ctx.beginPath(); ctx.arc(n.x * sx, n.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
    });
    s.entities.buildings.forEach(function (b) {
      ctx.fillStyle = b.team === TEAM.PLAYER ? '#26c6da' : '#ff7043';
      ctx.fillRect(b.x * sx - 3, b.y * sy - 3, 6, 6);
    });
    s.entities.units.forEach(function (u) {
      if (u.dead) return;
      // On minimap — only show enemy units if fog is off or they are visible
      if (u.team !== TEAM.PLAYER && RTS.fogEnabled) return;
      ctx.fillStyle = u.team === TEAM.PLAYER ? '#80deea' : '#ffab91';
      ctx.fillRect(u.x * sx - 1.5, u.y * sy - 1.5, 3, 3);
    });
    var view = RTS.Cam.viewSizeWorld(s);
    var vx = s.camera.x * sx, vy = s.camera.y * sy, vw = view.w * sx, vh = view.h * sy;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
  };

  RTS.hexA = function (hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

})(window.RTS = window.RTS || {});
