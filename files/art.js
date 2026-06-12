/* ============================================================================
 * EXOFRONT — art.js
 * Original cartoon arena art v2: hard-edged cel shading, big-headed chibi
 * units with per-role faces, raised-board terrain, badge health bars and
 * particle deaths. Original characters — premium mobile cartoon style only.
 *
 * Public API (unchanged — render.js depends on these exact names/signatures):
 *   drawTerrain(s, ctx)
 *   drawResource(ctx, n)
 *   drawBuilding(ctx, b, f, s)
 *   drawUnit(ctx, u, f, s)
 *   drawProjectile(ctx, p)
 *   drawSelectionRing(ctx, e, t, pulse)
 *   drawHealthBar(ctx, cx, y, w, pct, color, large [, badge])
 *   drawShadow(ctx, x, y, r, alpha)
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TEXT_INK = '#22282e';

  RTS.Art = {
    drawTerrain: drawTerrain,
    drawResource: drawResource,
    drawBuilding: drawBuilding,
    drawUnit: drawUnit,
    drawProjectile: drawProjectile,
    drawSelectionRing: drawSelectionRing,
    drawHealthBar: drawHealthBar,
    drawShadow: drawShadow,
  };

  /* ==========================================================================
   * Color utils — memoized. Outlines are dark desaturated kin of the fill,
   * never pure black.
   * ========================================================================*/
  var _rgbMemo = {}, _inkMemo = {}, _shadeMemo = {}, _liteMemo = {};

  function rgbOf(c) {
    if (_rgbMemo[c]) return _rgbMemo[c];
    var r = 128, g = 128, b = 128, h, n, m;
    if (c[0] === '#') {
      h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      n = parseInt(h, 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
      m = c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
    }
    return (_rgbMemo[c] = [r, g, b]);
  }
  function rgbStr(r, g, b) { return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }

  // Dark, desaturated outline color derived from the fill.
  function ink(c) {
    if (_inkMemo[c]) return _inkMemo[c];
    var v = rgbOf(c);
    var gray = v[0] * 0.3 + v[1] * 0.55 + v[2] * 0.15;
    var r = (v[0] * 0.62 + gray * 0.38) * 0.34;
    var g = (v[1] * 0.62 + gray * 0.38) * 0.34;
    var b = (v[2] * 0.62 + gray * 0.38) * 0.36;
    return (_inkMemo[c] = rgbStr(r + 8, g + 8, b + 12));
  }
  // Hard cel-shade tone (lower/right third).
  function shadeC(c) {
    if (_shadeMemo[c]) return _shadeMemo[c];
    var v = rgbOf(c);
    return (_shadeMemo[c] = rgbStr(v[0] * 0.72, v[1] * 0.72, v[2] * 0.78));
  }
  // Light tone (top edge bevel etc.).
  function liteC(c) {
    if (_liteMemo[c]) return _liteMemo[c];
    var v = rgbOf(c);
    return (_liteMemo[c] = rgbStr(v[0] + (255 - v[0]) * 0.3, v[1] + (255 - v[1]) * 0.3, v[2] + (255 - v[2]) * 0.3));
  }
  function hexA(hex, a) {
    var v = rgbOf(hex);
    return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')';
  }

  function hashId(id) {
    if (typeof id === 'number') return (id * 2654435761) >>> 0;
    var h = 0, s = String(id);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function phaseOf(e) { return (hashId(e.id || 0) % 997) / 997 * 6.2832; }

  /* ==========================================================================
   * Path + cel-shading helpers. Two-tone hard shade: fill dark, clip, refill
   * base offset up-left → crisp crescent on the lower/right. No gradients.
   * ========================================================================*/
  function pCircle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); }
  function pEllipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); }
  function pRRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function celCircle(ctx, x, y, r, base, lw) {
    pCircle(ctx, x, y, r); ctx.fillStyle = shadeC(base); ctx.fill();
    ctx.save(); pCircle(ctx, x, y, r); ctx.clip();
    pCircle(ctx, x - r * 0.2, y - r * 0.24, r); ctx.fillStyle = base; ctx.fill();
    ctx.restore();
    pCircle(ctx, x, y, r);
    ctx.strokeStyle = ink(base); ctx.lineWidth = lw; ctx.stroke();
  }
  function celEllipse(ctx, x, y, rx, ry, base, lw) {
    pEllipse(ctx, x, y, rx, ry); ctx.fillStyle = shadeC(base); ctx.fill();
    ctx.save(); pEllipse(ctx, x, y, rx, ry); ctx.clip();
    pEllipse(ctx, x - rx * 0.18, y - ry * 0.24, rx, ry); ctx.fillStyle = base; ctx.fill();
    ctx.restore();
    pEllipse(ctx, x, y, rx, ry);
    ctx.strokeStyle = ink(base); ctx.lineWidth = lw; ctx.stroke();
  }
  function celRRect(ctx, x, y, w, h, rad, base, lw) {
    pRRect(ctx, x, y, w, h, rad); ctx.fillStyle = shadeC(base); ctx.fill();
    ctx.save(); pRRect(ctx, x, y, w, h, rad); ctx.clip();
    pRRect(ctx, x - w * 0.08, y - h * 0.12, w, h, rad); ctx.fillStyle = base; ctx.fill();
    ctx.restore();
    pRRect(ctx, x, y, w, h, rad);
    ctx.strokeStyle = ink(base); ctx.lineWidth = lw; ctx.stroke();
  }
  function specDot(ctx, x, y, r) {
    pCircle(ctx, x, y, r);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  }
  function pStar4(ctx, x, y, s) {
    var q = s * 0.32;
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + q, y - q); ctx.lineTo(x + s, y);
    ctx.lineTo(x + q, y + q); ctx.lineTo(x, y + s); ctx.lineTo(x - q, y + q);
    ctx.lineTo(x - s, y); ctx.lineTo(x - q, y - q); ctx.closePath();
  }

  // Outline width scales gently with size.
  function ow(r) { return Math.max(4, Math.min(5.5, 3.4 + r * 0.07)); }

  /* ==========================================================================
   * Terrain — raised game board: high-contrast checker, beveled edge, winding
   * path between bases, cel decor, soft vignette. Tiles culled to the camera.
   * ========================================================================*/
  var GRASS_A = '#8bc34a', GRASS_B = '#6fae39';
  var SAND = '#e0bd72', SAND_LITE = '#edd194', SAND_INK = '#8a6b3a';

  function drawTerrain(s, ctx) {
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    var cam = s.camera, cv = RTS.canvas;
    var vw = cv.clientWidth / cam.zoom, vh = cv.clientHeight / cam.zoom;
    var vx = cam.x - 8, vy = cam.y - 8;
    vw += 16; vh += 16;

    // base grass over the visible rect
    ctx.fillStyle = GRASS_B;
    ctx.fillRect(Math.max(0, vx), Math.max(0, vy),
                 Math.min(W, vx + vw) - Math.max(0, vx),
                 Math.min(H, vy + vh) - Math.max(0, vy));

    // high-contrast checker — only visible tiles, only the light squares
    var tile = 96;
    var tx0 = Math.max(0, Math.floor(vx / tile) * tile);
    var ty0 = Math.max(0, Math.floor(vy / tile) * tile);
    var tx1 = Math.min(W, vx + vw), ty1 = Math.min(H, vy + vh);
    ctx.fillStyle = GRASS_A;
    for (var ty = ty0; ty < ty1; ty += tile) {
      for (var tx = tx0; tx < tx1; tx += tile) {
        if (((tx / tile | 0) + (ty / tile | 0)) % 2 === 0) {
          ctx.fillRect(tx, ty, Math.min(tile, W - tx), Math.min(tile, H - ty));
        }
      }
    }

    // winding path linking the two base plateaus (decorative lane)
    drawPath(ctx, W, H);

    // sandy base plateaus — flat two-tone discs
    drawSandPatch(ctx, 320, H - 320, 270);
    drawSandPatch(ctx, W - 320, 320, 270);

    // decor (culled): grass tufts, flowers, mushrooms, bushes
    if (s.map && s.map.decor) {
      var pad = 40;
      s.map.decor.forEach(function (d) {
        if (d.x < vx - pad || d.x > vx + vw + pad || d.y < vy - pad || d.y > vy + vh + pad) return;
        drawDecor(ctx, d);
      });
    }

    // soft vignette so the play area pops (~10–14% at the corners)
    var cxm = W / 2, cym = H / 2;
    var vg = ctx.createRadialGradient(cxm, cym, Math.min(W, H) * 0.42, cxm, cym, Math.hypot(W, H) * 0.58);
    vg.addColorStop(0, 'rgba(16,32,12,0)');
    vg.addColorStop(1, 'rgba(16,32,12,0.14)');
    ctx.fillStyle = vg;
    ctx.fillRect(Math.max(0, vx), Math.max(0, vy),
                 Math.min(W, vx + vw) - Math.max(0, vx),
                 Math.min(H, vy + vh) - Math.max(0, vy));

    // beveled raised-board edge: light top/left, dark bottom/right, ink frame
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.moveTo(6, H - 6); ctx.lineTo(6, 6); ctx.lineTo(W - 6, 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,40,14,0.30)';
    ctx.beginPath(); ctx.moveTo(W - 6, 6); ctx.lineTo(W - 6, H - 6); ctx.lineTo(6, H - 6); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = ink(GRASS_B);
    ctx.strokeRect(3, 3, W - 6, H - 6);
  }

  function drawPath(ctx, W, H) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(320, H - 320);
    ctx.bezierCurveTo(W * 0.30, H * 0.56, W * 0.70, H * 0.44, W - 320, 320);
    ctx.strokeStyle = SAND_INK; ctx.lineWidth = 88; ctx.stroke();   // banks/outline
    ctx.strokeStyle = SAND;     ctx.lineWidth = 74; ctx.stroke();   // path body
    ctx.strokeStyle = SAND_LITE; ctx.lineWidth = 42; ctx.stroke();  // hard sun-lit center
    ctx.lineCap = 'butt';
  }

  function drawSandPatch(ctx, cx, cy, r) {
    pCircle(ctx, cx, cy, r); ctx.fillStyle = SAND_INK; ctx.fill();
    pCircle(ctx, cx, cy, r - 7); ctx.fillStyle = SAND; ctx.fill();
    pCircle(ctx, cx - r * 0.12, cy - r * 0.14, r * 0.62); ctx.fillStyle = SAND_LITE; ctx.fill();
  }

  function drawDecor(ctx, d) {
    var h = hashId((d.x | 0) * 73856093 ^ (d.y | 0) * 19349663);
    var kind = d.kind === 'rock'
      ? (h % 3 === 0 ? 'mushroom' : 'bush')
      : (h % 4 === 0 ? 'flower' : 'grass');
    ctx.save();
    ctx.translate(d.x, d.y);
    drawShadow(ctx, 0, d.r * 0.25, d.r * 0.8, 0.22);
    if (kind === 'bush') {
      celCircle(ctx, -d.r * 0.45, 0, d.r * 0.5, '#5da03a', 3);
      celCircle(ctx, d.r * 0.45, 0.5, d.r * 0.5, '#6fb944', 3);
      celCircle(ctx, 0, -d.r * 0.3, d.r * 0.58, '#7cc94f', 3);
      specDot(ctx, -d.r * 0.18, -d.r * 0.5, d.r * 0.12);
    } else if (kind === 'mushroom') {
      celRRect(ctx, -d.r * 0.22, -d.r * 0.1, d.r * 0.44, d.r * 0.6, d.r * 0.16, '#f1e3c8', 3);
      celEllipse(ctx, 0, -d.r * 0.3, d.r * 0.7, d.r * 0.42, '#e85f4e', 3);
      ctx.fillStyle = '#fff';
      pCircle(ctx, -d.r * 0.25, -d.r * 0.36, d.r * 0.1); ctx.fill();
      pCircle(ctx, d.r * 0.2, -d.r * 0.24, d.r * 0.08); ctx.fill();
    } else if (kind === 'flower') {
      ctx.strokeStyle = ink('#5da03a'); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, d.r * 0.4); ctx.lineTo(0, -d.r * 0.1); ctx.stroke();
      var petal = (h % 2) ? '#ffd9e6' : '#fff';
      for (var i = 0; i < 5; i++) {
        var a = i / 5 * 6.2832;
        celCircle(ctx, Math.cos(a) * d.r * 0.26, -d.r * 0.3 + Math.sin(a) * d.r * 0.26, d.r * 0.18, petal, 2);
      }
      pCircle(ctx, 0, -d.r * 0.3, d.r * 0.14); ctx.fillStyle = '#ffca28'; ctx.fill();
      ctx.strokeStyle = ink('#ffca28'); ctx.lineWidth = 2; ctx.stroke();
    } else { // grass tuft
      ctx.lineCap = 'round';
      var greens = ['#5da03a', '#7cc94f', '#6fb944'];
      for (var j = -1; j <= 1; j++) {
        ctx.strokeStyle = ink(greens[j + 1]); ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(j * d.r * 0.3, d.r * 0.35);
        ctx.quadraticCurveTo(j * d.r * 0.5, -d.r * 0.1, j * d.r * 0.65, -d.r * 0.45); ctx.stroke();
        ctx.strokeStyle = greens[j + 1]; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(j * d.r * 0.3, d.r * 0.35);
        ctx.quadraticCurveTo(j * d.r * 0.5, -d.r * 0.1, j * d.r * 0.65, -d.r * 0.45); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    ctx.restore();
  }

  /* ==========================================================================
   * Halcite pile — flat cel gold, no gradients.
   * ========================================================================*/
  function drawResource(ctx, n) {
    var pct = n.amount / n.max;
    var sc = 0.55 + 0.45 * pct;
    var x = n.x, y = n.y;

    drawShadow(ctx, x, y + n.r * 0.18, n.r * sc * 0.95, 0.3);

    ctx.fillStyle = hexA('#ffd54f', 0.22);
    pCircle(ctx, x, y, n.r + 8); ctx.fill();

    for (var i = 0; i < 5; i++) {
      var oxx = Math.cos(i * 1.3) * n.r * 0.38 * sc;
      var oyy = Math.sin(i * 1.3) * n.r * 0.22 * sc - i * 2.5;
      drawCoin(ctx, x + oxx, y + oyy, n.r * 0.36 * sc);
    }
    drawGem(ctx, x, y - n.r * 0.16 * sc, n.r * 0.52 * sc);

    var label = Math.ceil(n.amount);
    ctx.font = 'bold 12px Fredoka, system-ui';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(label).width + 16;
    pRRect(ctx, x - tw / 2, y + n.r * sc + 6, tw, 18, 9);
    ctx.fillStyle = TEXT_INK; ctx.fill();
    pRRect(ctx, x - tw / 2 + 1.5, y + n.r * sc + 7.5, tw - 3, 15, 7.5);
    ctx.fillStyle = '#ffc107'; ctx.fill();
    ctx.fillStyle = TEXT_INK;
    ctx.fillText(label, x, y + n.r * sc + 19);
  }

  function drawCoin(ctx, x, y, r) {
    celEllipse(ctx, x, y, r, r * 0.75, '#ffca28', 3);
    specDot(ctx, x - r * 0.25, y - r * 0.2, r * 0.18);
  }

  function drawGem(ctx, x, y, r) {
    // hard two-tone split: light upper facet, deep lower facet
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.85, y); ctx.lineTo(x, y + r * 0.9); ctx.lineTo(x - r * 0.85, y);
    ctx.closePath();
    ctx.fillStyle = '#f59f00'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.85, y); ctx.lineTo(x - r * 0.85, y);
    ctx.closePath();
    ctx.fillStyle = '#ffd43b'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.85, y); ctx.lineTo(x, y + r * 0.9); ctx.lineTo(x - r * 0.85, y);
    ctx.closePath();
    ctx.strokeStyle = ink('#ffca28'); ctx.lineWidth = 4; ctx.stroke();
    specDot(ctx, x - r * 0.2, y - r * 0.45, r * 0.16);
  }

  /* ==========================================================================
   * Buildings — chunky cel structures with idle life (flag wave, smoke,
   * crystal pulse, turret sweep).
   * ========================================================================*/
  function drawBuilding(ctx, b, f, s) {
    if (b.dead) return;
    var x = b.x, y = b.y;
    var built = b.built;
    var alpha = built ? 1 : 0.65 + b.progress * 0.35;
    var t = s.timers.gameTime;
    var rm = RTS.Config.reducedMotion;

    drawShadow(ctx, x, y + b.h * 0.15, Math.max(b.w, b.h) * 0.55, 0.38);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    switch (b.type) {
      case 'core': drawCastle(ctx, b, f, t, rm); break;
      case 'conduit': drawConduit(ctx, b, f, t, rm); break;
      case 'foundry': drawBarracks(ctx, b, f); break;
      case 'forge': drawForge(ctx, b, f, t, rm); break;
      case 'turret': drawCannonTower(ctx, b, f, t, rm); break;
      default: drawBarracks(ctx, b, f);
    }

    ctx.restore();

    if (!built) {
      ctx.strokeStyle = hexA('#5d4037', 0.7); ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.strokeRect(x - b.w / 2 - 4, y - b.h / 2 - 4, b.w + 8, b.h + 8);
      ctx.setLineDash([]);
      drawHealthBar(ctx, x, y - b.h / 2 - 14, b.w, b.progress, '#42a5f5', true, false);
    }

    if (b.hitFlash > 0) {
      ctx.fillStyle = hexA('#ffffff', (b.hitFlash / RTS.Config.hitFlash) * 0.5);
      pRRect(ctx, x - b.w / 2, y - b.h / 2, b.w, b.h, 10); ctx.fill();
    }

    if (built && (b.hp < b.maxHp || s.settings.showHealthAlways)) {
      drawHealthBar(ctx, x, y - b.h / 2 - 14, b.w, b.hp / b.maxHp, f.primary, true, true);
    }

    ctx.font = 'bold 11px Fredoka, system-ui';
    ctx.textAlign = 'center';
    ctx.strokeStyle = TEXT_INK; ctx.lineWidth = 3;
    ctx.strokeText(RTS.nameFor(b.faction, b.type), x, y + b.h / 2 + 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(RTS.nameFor(b.faction, b.type), x, y + b.h / 2 + 18);

    if (b.train) {
      var pct = 1 - b.train.remaining / b.train.total;
      drawHealthBar(ctx, x, y + b.h / 2 + 24, b.w * 0.8, pct, f.secondary, false, false);
    }
  }

  function drawCastle(ctx, b, f, t, rm) {
    var w = b.w, h = b.h;
    celRRect(ctx, -w / 2, -h / 2 + 10, w, h - 10, 10, f.primary, 5);
    // battlements
    var bw = w / 5;
    for (var i = 0; i < 5; i++) {
      celRRect(ctx, -w / 2 + i * bw + 2, -h / 2 - 6, bw - 4, 18, 5, liteC(f.primary), 4);
    }
    // door arch
    celRRect(ctx, -13, h / 2 - 30, 26, 30, 11, shadeC(f.dark), 4);
    // windows
    pCircle(ctx, -w * 0.26, -h * 0.08, 6); ctx.fillStyle = '#fff8d6'; ctx.fill();
    ctx.strokeStyle = ink(f.primary); ctx.lineWidth = 3; ctx.stroke();
    pCircle(ctx, w * 0.26, -h * 0.08, 6); ctx.fillStyle = '#fff8d6'; ctx.fill(); ctx.stroke();
    // waving banner
    var wave = rm ? 0 : Math.sin(t * 3.2) * 4;
    ctx.strokeStyle = ink(f.dark); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -h / 2 - 6); ctx.lineTo(0, -h / 2 - 40); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 - 38);
    ctx.quadraticCurveTo(13 + wave, -h / 2 - 34, 24 + wave, -h / 2 - 29);
    ctx.quadraticCurveTo(13 + wave, -h / 2 - 26, 0, -h / 2 - 20);
    ctx.closePath();
    ctx.fillStyle = f.secondary; ctx.fill();
    ctx.strokeStyle = ink(f.secondary); ctx.lineWidth = 3.5; ctx.stroke();
    specDot(ctx, -w * 0.3, -h * 0.3, 5);
  }

  function drawConduit(ctx, b, f, t, rm) {
    var w = b.w, h = b.h;
    celRRect(ctx, -w / 2 + 8, -h / 2 + 10, w - 16, h - 10, 7, f.primary, 4.5);
    celRRect(ctx, -w / 2, -h / 2 + 2, w, 13, 5, f.dark, 4);
    // floating crystal, pulsing glow
    var pulse = rm ? 0.5 : (Math.sin(t * 3) * 0.5 + 0.5);
    var cy = -h / 2 - 8 - (rm ? 0 : Math.sin(t * 2.2) * 2.5);
    ctx.fillStyle = hexA(f.accent, 0.18 + pulse * 0.2);
    pCircle(ctx, 0, cy, 15 + pulse * 4); ctx.fill();
    drawGemSmall(ctx, 0, cy, 11, f.accent);
  }

  function drawGemSmall(ctx, x, y, r, col) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y);
    ctx.closePath();
    ctx.fillStyle = shadeC(col); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x - r * 0.8, y);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y);
    ctx.closePath();
    ctx.strokeStyle = ink(col); ctx.lineWidth = 3; ctx.stroke();
    specDot(ctx, x - r * 0.2, y - r * 0.4, r * 0.18);
  }

  function drawBarracks(ctx, b, f) {
    var w = b.w, h = b.h;
    celRRect(ctx, -w / 2, -h / 2 + 8, w, h - 8, 9, f.primary, 5);
    // hard two-tone roof
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 5, -h / 2 + 10); ctx.lineTo(0, -h / 2 - 16); ctx.lineTo(w / 2 + 5, -h / 2 + 10);
    ctx.closePath();
    ctx.fillStyle = shadeC(f.dark); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 5, -h / 2 + 10); ctx.lineTo(0, -h / 2 - 16); ctx.lineTo(0, -h / 2 + 10);
    ctx.closePath();
    ctx.fillStyle = f.dark; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 5, -h / 2 + 10); ctx.lineTo(0, -h / 2 - 16); ctx.lineTo(w / 2 + 5, -h / 2 + 10);
    ctx.closePath();
    ctx.strokeStyle = ink(f.dark); ctx.lineWidth = 4.5; ctx.stroke();
    // door + crossed-swords sign
    celRRect(ctx, -11, h / 2 - 24, 22, 24, 8, '#6d4c33', 4);
    pCircle(ctx, 0, -h * 0.12, 11); ctx.fillStyle = '#f4ecd8'; ctx.fill();
    ctx.strokeStyle = ink(f.primary); ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#8a93a0'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, -h * 0.12 - 5); ctx.lineTo(5, -h * 0.12 + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -h * 0.12 - 5); ctx.lineTo(-5, -h * 0.12 + 5); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawForge(ctx, b, f, t, rm) {
    var w = b.w, h = b.h;
    celRRect(ctx, -w / 2, -h / 2 + 6, w, h - 6, 8, shadeC(f.primary), 5);
    // glowing furnace mouth (pulsing)
    var pulse = rm ? 0.6 : (Math.sin(t * 5) * 0.5 + 0.5);
    pRRect(ctx, -14, 2, 28, 18, 9);
    ctx.fillStyle = rgbStr(255, 130 + pulse * 60, 40); ctx.fill();
    ctx.strokeStyle = ink('#ff7043'); ctx.lineWidth = 3.5; ctx.stroke();
    pRRect(ctx, -8, 6, 16, 9, 4.5); ctx.fillStyle = '#ffe082'; ctx.fill();
    // chimney + looping smoke
    celRRect(ctx, w / 2 - 24, -h / 2 - 18, 17, 28, 4, '#7d8a94', 4);
    if (!rm) {
      for (var i = 0; i < 3; i++) {
        var k = ((t * 16 + i * 22) % 66);
        var a = Math.max(0, 1 - k / 66);
        pCircle(ctx, w / 2 - 15 + Math.sin((k + i * 9) * 0.12) * 5, -h / 2 - 22 - k * 0.7, 6 + k * 0.1);
        ctx.fillStyle = 'rgba(238,242,244,' + (a * 0.75) + ')'; ctx.fill();
        ctx.strokeStyle = 'rgba(70,80,88,' + (a * 0.6) + ')'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }

  function drawCannonTower(ctx, b, f, t, rm) {
    var w = b.w;
    celRRect(ctx, -w / 2, -w / 2 + 4, w, w - 4, w * 0.22, '#90a0ab', 4.5);
    // slow sweeping barrel
    var sweep = rm ? -0.6 : -0.6 + Math.sin(t * 0.8 + phaseOf(b)) * 0.3;
    ctx.save(); ctx.rotate(sweep);
    celRRect(ctx, 2, -6, w * 0.62, 12, 5, '#3c4a52', 4);
    celRRect(ctx, w * 0.62 - 5, -8, 9, 16, 4, '#56656e', 3.5);
    ctx.restore();
    celCircle(ctx, 0, -2, w * 0.24, f.primary, 4);
    specDot(ctx, -w * 0.08, -w * 0.1, w * 0.06);
  }

  /* ==========================================================================
   * Units — big-headed upright chibis. Body stays billboard-upright (no
   * top-down spin); they flip to face travel direction, waddle while walking,
   * bob while idle, blink, and pop into outlined particles on death.
   * ========================================================================*/
  function drawUnit(ctx, u, f, s) {
    var t = s.timers.gameTime;
    var rm = RTS.Config.reducedMotion;

    if (u.dead) { deathBurst(ctx, u, f); return; }

    var r = u.radius * (1 + u.spawnFlash * 0.35);
    var ph = phaseOf(u);

    // movement detection via last drawn position (render-only scratch fields)
    var moved = u._ax !== undefined &&
      (Math.abs(u.x - u._ax) + Math.abs(u.y - u._ay)) > 0.35;
    u._ax = u.x; u._ay = u.y;

    var bob = 0, rot = 0, step = 0;
    if (!rm) {
      if (moved) {
        var wf = 7 + u.speed * 0.045;
        bob = Math.abs(Math.sin(t * wf + ph)) * 2.6;
        rot = Math.sin(t * wf + ph) * 0.09;
        step = Math.sin(t * wf + ph) * r * 0.18;
      } else {
        bob = Math.sin(t * 2.1 + ph) * 1.2;
        rot = Math.sin(t * 1.3 + ph) * 0.02;
      }
    }

    drawShadow(ctx, u.x, u.y + r * 0.55, r * 0.95, 0.34);

    var flip = Math.cos(u.facing) < -0.12 ? -1 : 1;

    ctx.save();
    ctx.translate(u.x, u.y - bob);
    ctx.rotate(rot * flip);
    ctx.scale(flip, 1);
    if (u.hitFlash > 0) {
      var q = u.hitFlash / RTS.Config.hitFlash;
      ctx.scale(1 + q * 0.12, 1 - q * 0.1); // squash on hit
    }

    var pal = palette(f, u.team);
    switch (u.role) {
      case 'worker': drawChibiWorker(ctx, r, pal, t, ph, step); break;
      case 'light': drawChibiLancer(ctx, r, pal, t, ph, step); break;
      case 'scout': drawChibiRunner(ctx, r, pal, t, ph, step); break;
      case 'heavy': drawChibiBulwark(ctx, r, pal, t, ph, step); break;
      case 'siege': drawChibiMortar(ctx, r, pal, t, ph, step); break;
      case 'support': drawChibiMender(ctx, r, pal, t, ph, step); break;
      default: drawChibiLancer(ctx, r, pal, t, ph, step);
    }

    ctx.restore();

    // carried Halcite tag
    if (u.role === 'worker' && u.harvest && u.harvest.carry > 0) {
      ctx.font = 'bold 11px Fredoka, system-ui';
      ctx.textAlign = 'center';
      ctx.strokeStyle = TEXT_INK; ctx.lineWidth = 3;
      ctx.strokeText('+' + Math.floor(u.harvest.carry), u.x, u.y - r - 14);
      ctx.fillStyle = '#ffc107';
      ctx.fillText('+' + Math.floor(u.harvest.carry), u.x, u.y - r - 14);
    }

    // muzzle starburst along the actual facing
    if (u.muzzleFlash > 0 && u.ranged) {
      var mx = u.x + Math.cos(u.facing) * (r + 7);
      var my = u.y + Math.sin(u.facing) * (r + 7);
      var ma = u.muzzleFlash / RTS.Config.muzzleFlash;
      pStar4(ctx, mx, my, 8);
      ctx.fillStyle = hexA('#fff176', ma); ctx.fill();
      ctx.strokeStyle = hexA('#b58900', ma); ctx.lineWidth = 2; ctx.stroke();
    }

    if (u.hitFlash > 0) {
      ctx.fillStyle = hexA('#ffffff', (u.hitFlash / RTS.Config.hitFlash) * 0.4);
      pCircle(ctx, u.x, u.y - r * 0.2, r * 1.05); ctx.fill();
    }

    if (u.hp < u.maxHp || s.settings.showHealthAlways) {
      drawHealthBar(ctx, u.x, u.y - r - 12, Math.max(30, r * 2.7), u.hp / u.maxHp, pal.main, false, true);
    }
  }

  // Death: pop into 4–6 outlined stars/circles flying outward, then gone.
  function deathBurst(ctx, u, f) {
    var max = RTS.Config.corpseFade || 1.2;
    var k = 1 - Math.max(0, u.corpse) / max;     // 0 → 1 over the corpse timer
    if (k >= 1) return;
    var a = 1 - k;
    var e = 1 - (1 - k) * (1 - k);               // ease-out fling
    var h = hashId(u.id), ph = phaseOf(u);
    var cols = [f.secondary, '#ffffff', f.primary];
    drawShadow(ctx, u.x, u.y + u.radius * 0.5, u.radius * (1 - k) * 0.9, 0.25 * a);
    ctx.globalAlpha = a;
    for (var i = 0; i < 5; i++) {
      var ang = ph + i * 1.2566 + ((h >> i) & 1) * 0.5;
      var d = e * (u.radius * 2.3 + ((h >> (i * 2)) & 3) * 4);
      var px = u.x + Math.cos(ang) * d;
      var py = u.y + Math.sin(ang) * d - e * 6;
      var sz = (1 - k * 0.7) * (4 + (i % 3) * 2.2);
      var col = cols[i % 3];
      if (i % 2 === 0) pStar4(ctx, px, py, sz * 1.4);
      else pCircle(ctx, px, py, sz);
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = ink(col === '#ffffff' ? f.primary : col); ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function palette(f, team) {
    return {
      main: f.primary,
      light: f.secondary,
      dark: f.dark,
      skin: team === 'player' ? '#ffcc80' : '#cdb6a0',
      trim: f.accent,
    };
  }

  /* ---- Shared chibi anatomy ------------------------------------------------
   * Head ≈ 47% of total height. Squat round body, stubby stepping feet,
   * expressive eyes with per-role brows.
   * --------------------------------------------------------------------------*/
  function drawFeet(ctx, r, step, col) {
    var fy = r * 0.92;
    pEllipse(ctx, -r * 0.32, fy - Math.max(0, step), r * 0.24, r * 0.15);
    ctx.fillStyle = shadeC(col); ctx.fill();
    ctx.strokeStyle = ink(col); ctx.lineWidth = 3; ctx.stroke();
    pEllipse(ctx, r * 0.32, fy - Math.max(0, -step), r * 0.24, r * 0.15);
    ctx.fillStyle = shadeC(col); ctx.fill();
    ctx.strokeStyle = ink(col); ctx.lineWidth = 3; ctx.stroke();
  }

  function drawTorso(ctx, r, col) {
    celEllipse(ctx, 0, r * 0.38, r * 0.78, r * 0.6, col, ow(r));
    specDot(ctx, -r * 0.3, r * 0.16, r * 0.13);
  }

  function drawChibiHead(ctx, r, skin) {
    celCircle(ctx, 0, -r * 0.24, r * 0.72, skin, ow(r));
  }

  // brow: 'neutral' | 'angry' | 'smug' | 'soft'
  function drawFace(ctx, r, skin, brow, t, ph) {
    var hy = -r * 0.24, hr = r * 0.72;
    var exo = hr * 0.36, ey = hy + hr * 0.12;
    var er = hr * 0.27;
    var inkF = ink(skin);
    var blink = ((t + ph) % 3.9) < 0.13;

    if (blink) {
      ctx.strokeStyle = inkF; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-exo, ey, er * 0.8, 0.25, 2.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(exo, ey, er * 0.8, 0.25, 2.9); ctx.stroke();
      ctx.lineCap = 'butt';
    } else {
      [-exo, exo].forEach(function (ex) {
        pEllipse(ctx, ex, ey, er, er * 1.12);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = inkF; ctx.lineWidth = 2.4; ctx.stroke();
        pCircle(ctx, ex + er * 0.12, ey + er * 0.18, er * 0.46);
        ctx.fillStyle = TEXT_INK; ctx.fill();
        specDot(ctx, ex - er * 0.06, ey - er * 0.02, er * 0.16);
      });
    }

    ctx.strokeStyle = inkF; ctx.lineWidth = 3; ctx.lineCap = 'round';
    var by = ey - er * 1.45;
    if (brow === 'angry') {
      ctx.beginPath(); ctx.moveTo(-exo - er * 0.7, by - er * 0.4); ctx.lineTo(-exo + er * 0.5, by + er * 0.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(exo + er * 0.7, by - er * 0.4); ctx.lineTo(exo - er * 0.5, by + er * 0.25); ctx.stroke();
    } else if (brow === 'smug') {
      ctx.beginPath(); ctx.moveTo(-exo - er * 0.6, by + er * 0.2); ctx.lineTo(-exo + er * 0.55, by + er * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.arc(exo, by - er * 0.15, er * 0.7, 3.5, 5.9); ctx.stroke();
    } else if (brow === 'soft') {
      ctx.beginPath(); ctx.arc(-exo, by + er * 0.5, er * 0.7, 3.6, 5.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(exo, by + er * 0.5, er * 0.7, 3.6, 5.8); ctx.stroke();
    } else { // neutral
      ctx.beginPath(); ctx.moveTo(-exo - er * 0.55, by); ctx.lineTo(-exo + er * 0.5, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(exo - er * 0.5, by); ctx.lineTo(exo + er * 0.55, by); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  /* ---- Roles -----------------------------------------------------------------*/
  function drawChibiWorker(ctx, r, pal, t, ph, step) {
    drawFeet(ctx, r, step, pal.dark);
    drawTorso(ctx, r, pal.main);
    // oversized pickaxe over the shoulder
    ctx.save();
    ctx.translate(r * 0.62, r * 0.1); ctx.rotate(-0.7);
    celRRect(ctx, -r * 0.07, -r * 1.1, r * 0.14, r * 1.5, r * 0.07, '#8d6e4f', 3);
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 1.0); ctx.quadraticCurveTo(0, -r * 1.5, r * 0.55, -r * 1.0);
    ctx.quadraticCurveTo(0, -r * 1.18, -r * 0.55, -r * 1.0);
    ctx.closePath();
    ctx.fillStyle = '#9fb1bc'; ctx.fill();
    ctx.strokeStyle = ink('#9fb1bc'); ctx.lineWidth = 3.5; ctx.stroke();
    ctx.restore();
    drawChibiHead(ctx, r, pal.skin);
    // hard hat: dome + brim, bigger than the head
    celCircle(ctx, 0, -r * 0.62, r * 0.6, '#ffca28', 4);
    celEllipse(ctx, 0, -r * 0.44, r * 0.82, r * 0.17, '#f5a623', 3.5);
    drawFace(ctx, r, pal.skin, 'neutral', t, ph);
  }

  function drawChibiLancer(ctx, r, pal, t, ph, step) {
    drawFeet(ctx, r, step, pal.dark);
    drawTorso(ctx, r, pal.main);
    // chest plate band
    celRRect(ctx, -r * 0.5, r * 0.18, r * 1.0, r * 0.34, r * 0.16, pal.light, 3);
    // oversized energy crossbow held forward
    ctx.save();
    ctx.translate(r * 0.78, r * 0.28);
    celRRect(ctx, -r * 0.18, -r * 0.1, r * 0.85, r * 0.2, r * 0.1, '#8d6e4f', 3);
    ctx.strokeStyle = ink(pal.trim); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(r * 0.62, 0, r * 0.42, -1.25, 1.25); ctx.stroke();
    ctx.strokeStyle = pal.trim; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(r * 0.62, 0, r * 0.42, -1.25, 1.25); ctx.stroke();
    pCircle(ctx, r * 0.7, 0, r * 0.1);
    ctx.fillStyle = pal.trim; ctx.fill();
    ctx.restore();
    drawChibiHead(ctx, r, pal.skin);
    // helmet with plume
    celCircle(ctx, 0, -r * 0.58, r * 0.58, pal.dark, 4);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.12); ctx.lineTo(r * 0.2, -r * 0.78); ctx.lineTo(-r * 0.2, -r * 0.78);
    ctx.closePath();
    ctx.fillStyle = pal.trim; ctx.fill();
    ctx.strokeStyle = ink(pal.trim); ctx.lineWidth = 3; ctx.stroke();
    drawFace(ctx, r, pal.skin, 'neutral', t, ph);
  }

  function drawChibiRunner(ctx, r, pal, t, ph, step) {
    drawFeet(ctx, r, step, pal.dark);
    celEllipse(ctx, 0, r * 0.36, r * 0.62, r * 0.56, pal.light, ow(r)); // slimmer
    specDot(ctx, -r * 0.24, r * 0.16, r * 0.1);
    // twin daggers
    ctx.save(); ctx.translate(r * 0.55, r * 0.18); ctx.rotate(0.55);
    celRRect(ctx, -r * 0.05, -r * 0.55, r * 0.1, r * 0.8, r * 0.05, '#cfd8dc', 2.5);
    ctx.restore();
    ctx.save(); ctx.translate(r * 0.55, -r * 0.02); ctx.rotate(-0.4);
    celRRect(ctx, -r * 0.05, -r * 0.55, r * 0.1, r * 0.8, r * 0.05, '#cfd8dc', 2.5);
    ctx.restore();
    drawChibiHead(ctx, r, pal.skin);
    // hood with long flowing tail
    celCircle(ctx, 0, -r * 0.5, r * 0.62, pal.main, 4);
    var sway = Math.sin(t * 6 + ph) * r * 0.12;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.55);
    ctx.quadraticCurveTo(-r * 1.05, -r * 0.5 + sway, -r * 1.35, -r * 0.05 + sway);
    ctx.quadraticCurveTo(-r * 0.9, -r * 0.25, -r * 0.5, -r * 0.15);
    ctx.closePath();
    ctx.fillStyle = pal.main; ctx.fill();
    ctx.strokeStyle = ink(pal.main); ctx.lineWidth = 3.2; ctx.stroke();
    drawFace(ctx, r, pal.skin, 'smug', t, ph);
  }

  function drawChibiBulwark(ctx, r, pal, t, ph, step) {
    drawFeet(ctx, r, step, pal.dark);
    // extra-wide slab body + shoulder pads
    celRRect(ctx, -r * 0.95, -r * 0.12, r * 1.9, r * 1.05, r * 0.4, pal.main, ow(r) + 0.5);
    celCircle(ctx, -r * 0.85, 0, r * 0.32, pal.dark, 3.5);
    celCircle(ctx, r * 0.85, 0, r * 0.32, pal.dark, 3.5);
    // rivets
    ctx.fillStyle = liteC(pal.main);
    pCircle(ctx, -r * 0.45, r * 0.55, r * 0.06); ctx.fill();
    pCircle(ctx, r * 0.45, r * 0.55, r * 0.06); ctx.fill();
    specDot(ctx, -r * 0.4, r * 0.08, r * 0.12);
    // colossal hammer
    ctx.save();
    ctx.translate(r * 1.0, -r * 0.1); ctx.rotate(0.16);
    celRRect(ctx, -r * 0.08, -r * 0.9, r * 0.16, r * 1.7, r * 0.08, '#8d6e4f', 3.5);
    celRRect(ctx, -r * 0.55, -r * 1.45, r * 1.1, r * 0.62, r * 0.14, '#8a98a3', 4.5);
    ctx.strokeStyle = ink('#8a98a3'); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 1.22); ctx.lineTo(r * 0.55, -r * 1.22); ctx.stroke();
    ctx.restore();
    drawChibiHead(ctx, r * 0.92, pal.skin);
    // heavy helm with jaw guard
    celCircle(ctx, 0, -r * 0.52, r * 0.56, pal.dark, 4.2);
    celRRect(ctx, -r * 0.5, -r * 0.2, r * 0.22, r * 0.34, r * 0.08, pal.dark, 3);
    celRRect(ctx, r * 0.28, -r * 0.2, r * 0.22, r * 0.34, r * 0.08, pal.dark, 3);
    drawFace(ctx, r * 0.92, pal.skin, 'angry', t, ph);
  }

  function drawChibiMortar(ctx, r, pal, t, ph, step) {
    // cart with big wheels
    celRRect(ctx, -r * 0.95, -r * 0.12, r * 1.7, r * 0.85, r * 0.18, '#a1887f', ow(r));
    [-r * 0.5, r * 0.38].forEach(function (wx) {
      celCircle(ctx, wx, r * 0.6, r * 0.32, '#5d4a3a', 3.5);
      ctx.strokeStyle = ink('#5d4a3a'); ctx.lineWidth = 2.2;
      var rotW = step * 0.15;
      ctx.beginPath();
      ctx.moveTo(wx - Math.cos(rotW) * r * 0.24, r * 0.6 - Math.sin(rotW) * r * 0.24);
      ctx.lineTo(wx + Math.cos(rotW) * r * 0.24, r * 0.6 + Math.sin(rotW) * r * 0.24);
      ctx.stroke();
      pCircle(ctx, wx, r * 0.6, r * 0.08); ctx.fillStyle = '#cbb59a'; ctx.fill();
    });
    // comically long barrel
    ctx.save();
    ctx.translate(-r * 0.1, r * 0.05); ctx.rotate(-0.32);
    celRRect(ctx, 0, -r * 0.2, r * 2.2, r * 0.4, r * 0.18, '#46555e', ow(r));
    celRRect(ctx, r * 1.95, -r * 0.26, r * 0.28, r * 0.52, r * 0.1, '#5f7079', 3.5);
    specDot(ctx, r * 0.35, -r * 0.07, r * 0.1);
    ctx.restore();
    // little gunner peeking out, goggles up
    celCircle(ctx, -r * 0.45, -r * 0.42, r * 0.42, pal.skin, 3.5);
    celRRect(ctx, -r * 0.82, -r * 0.78, r * 0.74, r * 0.2, r * 0.1, pal.dark, 3);
    pCircle(ctx, -r * 0.6, -r * 0.68, r * 0.11); ctx.fillStyle = pal.trim; ctx.fill();
    ctx.strokeStyle = ink(pal.dark); ctx.lineWidth = 2.2; ctx.stroke();
    pCircle(ctx, -r * 0.32, -r * 0.68, r * 0.11); ctx.fillStyle = pal.trim; ctx.fill(); ctx.stroke();
    // gunner eyes (simple — head is small)
    ctx.fillStyle = TEXT_INK;
    pCircle(ctx, -r * 0.55, -r * 0.38, r * 0.06); ctx.fill();
    pCircle(ctx, -r * 0.33, -r * 0.38, r * 0.06); ctx.fill();
  }

  function drawChibiMender(ctx, r, pal, t, ph, step) {
    drawFeet(ctx, r, step, pal.dark);
    // robe
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, r * 0.95); ctx.quadraticCurveTo(-r * 0.75, 0, 0, -r * 0.1);
    ctx.quadraticCurveTo(r * 0.75, 0, r * 0.6, r * 0.95);
    ctx.closePath();
    ctx.fillStyle = shadeC('#f3eee2'); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, r * 0.8); ctx.quadraticCurveTo(-r * 0.87, -r * 0.15, -r * 0.12, -r * 0.25);
    ctx.quadraticCurveTo(r * 0.63, -r * 0.15, r * 0.48, r * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#f3eee2'; ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, r * 0.95); ctx.quadraticCurveTo(-r * 0.75, 0, 0, -r * 0.1);
    ctx.quadraticCurveTo(r * 0.75, 0, r * 0.6, r * 0.95);
    ctx.closePath();
    ctx.strokeStyle = ink('#d8cfba'); ctx.lineWidth = ow(r); ctx.stroke();
    // trim band
    celRRect(ctx, -r * 0.55, r * 0.62, r * 1.1, r * 0.2, r * 0.1, pal.main, 3);
    // staff with pulsing orb
    var glow = RTS.Config.reducedMotion ? 0.5 : (Math.sin(t * 4 + ph) * 0.5 + 0.5);
    ctx.save();
    ctx.translate(r * 0.7, r * 0.1);
    celRRect(ctx, -r * 0.06, -r * 1.0, r * 0.12, r * 1.6, r * 0.06, '#8d6e4f', 3);
    ctx.fillStyle = hexA('#69f0ae', 0.25 + glow * 0.3);
    pCircle(ctx, 0, -r * 1.05, r * 0.36 + glow * r * 0.08); ctx.fill();
    celCircle(ctx, 0, -r * 1.05, r * 0.22, '#69f0ae', 3);
    ctx.restore();
    drawChibiHead(ctx, r, pal.skin);
    // hood with healer cross
    celCircle(ctx, 0, -r * 0.52, r * 0.6, pal.main, 4);
    ctx.strokeStyle = '#e8fff1'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.86); ctx.lineTo(0, -r * 0.48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.18, -r * 0.67); ctx.lineTo(r * 0.18, -r * 0.67); ctx.stroke();
    ctx.lineCap = 'butt';
    drawFace(ctx, r, pal.skin, 'soft', t, ph);
  }

  /* ==========================================================================
   * Projectiles — chunky outlined orbs with tapered trail.
   * ========================================================================*/
  function drawProjectile(ctx, p) {
    var dx = p.x - p.lastX, dy = p.y - p.lastY, d = Math.hypot(dx, dy) || 1;
    var nx = dx / d, ny = dy / d;
    var rr = p.splash ? 6 : 4.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexA(p.color, 0.25); ctx.lineWidth = rr * 1.6;
    ctx.beginPath(); ctx.moveTo(p.x - nx * 20, p.y - ny * 20); ctx.lineTo(p.x - nx * 6, p.y - ny * 6); ctx.stroke();
    ctx.strokeStyle = hexA(p.color, 0.6); ctx.lineWidth = rr * 0.9;
    ctx.beginPath(); ctx.moveTo(p.x - nx * 12, p.y - ny * 12); ctx.lineTo(p.x - nx * 3, p.y - ny * 3); ctx.stroke();
    ctx.lineCap = 'butt';
    pCircle(ctx, p.x, p.y, rr);
    ctx.fillStyle = p.color; ctx.fill();
    ctx.strokeStyle = ink(p.color); ctx.lineWidth = 2.6; ctx.stroke();
    specDot(ctx, p.x - rr * 0.35, p.y - rr * 0.35, rr * 0.32);
  }

  /* ==========================================================================
   * Selection ring — white pulse + warm under-glow.
   * ========================================================================*/
  function drawSelectionRing(ctx, e, t, pulse) {
    ctx.strokeStyle = 'rgba(255,213,79,0.5)'; ctx.lineWidth = 5;
    if (e.kind === 'unit') {
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.radius * 0.55, (e.radius + 9) * pulse, (e.radius + 9) * 0.42 * pulse, 0, 0, 6.2832);
      ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      pCircle(ctx, e.x, e.y, (e.radius + 8) * pulse); ctx.stroke();
    } else {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5;
      pRRect(ctx, e.x - e.w / 2 - 6, e.y - e.h / 2 - 6, e.w + 12, e.h + 12, 10);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,213,79,0.45)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.h * 0.42, e.w * 0.6, 9, 0, 0, 6.2832);
      ctx.stroke();
    }
  }

  /* ==========================================================================
   * Health bar — chunky pill with optional badge circle on the left end.
   * (badge is an optional trailing arg; all original call shapes still work.)
   * ========================================================================*/
  function drawHealthBar(ctx, cx, y, w, pct, color, large, badge) {
    pct = Math.max(0, Math.min(1, pct));
    var h = large ? 10 : 7;
    var x = cx - w / 2;
    var fill = pct <= 0.25 ? '#ef5350' : pct <= 0.55 ? '#ffca28' : (color || '#66bb6a');

    pRRect(ctx, x - 2, y - 2, w + 4, h + 4, h / 2 + 2);
    ctx.fillStyle = TEXT_INK; ctx.fill();
    pRRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = '#3a4750'; ctx.fill();

    if (pct > 0) {
      pRRect(ctx, x + 1, y + 1, Math.max(h - 2, (w - 2) * pct), h - 2, h / 2 - 1);
      ctx.fillStyle = fill; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      pRRect(ctx, x + 2.5, y + 2, Math.max(0, (w - 5) * pct - 2), (h - 4) * 0.45, 2);
      ctx.fill();
    }

    if (badge) {
      var br = h / 2 + (large ? 6 : 4.5);
      pCircle(ctx, x - 1, y + h / 2, br);
      ctx.fillStyle = '#ffca28'; ctx.fill();
      ctx.strokeStyle = TEXT_INK; ctx.lineWidth = 2.5; ctx.stroke();
      pStar4(ctx, x - 1, y + h / 2, br * 0.55);
      ctx.fillStyle = '#fff8e1'; ctx.fill();
      ctx.strokeStyle = '#c98f00'; ctx.lineWidth = 1.4; ctx.stroke();
    }
  }

  /* ==========================================================================
   * Shadow — tight high-contrast ellipse offset down-right.
   * ========================================================================*/
  function drawShadow(ctx, x, y, r, alpha) {
    ctx.fillStyle = 'rgba(18,32,12,' + (alpha !== undefined ? alpha : 0.32) + ')';
    pEllipse(ctx, x + r * 0.12, y + r * 0.28, r * 0.85, r * 0.3);
    ctx.fill();
  }

})(window.RTS = window.RTS || {});
