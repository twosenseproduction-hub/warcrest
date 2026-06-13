/* ============================================================================
 * EXOFRONT — render.js
 * Canvas renderer — delegates cartoon art to art.js
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var TEAM = RTS.TEAM;
  var Art = function () { return RTS.Art; };

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

      Art().drawTerrain(s, ctx);
      s.entities.resources.forEach(function (n) { if (n.amount > 0) Art().drawResource(ctx, n); });
      drawSelectionBack(s, ctx);
      s.entities.buildings.forEach(function (b) { Art().drawBuilding(ctx, b, RTS.Factions[b.faction], s); });
      s.entities.units.forEach(function (u) { Art().drawUnit(ctx, u, RTS.Factions[u.faction], s); });
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

    if (RTS.Assets && RTS.Assets.buildingVisualBounds) {
      var vb = RTS.Assets.buildingVisualBounds({
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

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = RTS.hexA(col, 0.35);
    ctx.fillRect(gx - gw / 2, gy, gw, gh);

    ctx.globalAlpha = 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(gx - gw / 2, gy, gw, gh);
    ctx.setLineDash([]);

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
