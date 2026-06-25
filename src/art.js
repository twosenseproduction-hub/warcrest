/* ============================================================================
 * EXOFRONT — art.js
 * Original cartoon arena art v3: Wild Rift–inspired minion units with
 * layered armor, gradient metal shading, walk cycles, and soft ground shadows.
 *
 * Public API (unchanged — render.js depends on these exact names/signatures):
 *   drawTerrain(s, ctx)
 *   drawResource(ctx, n)
 *   drawBuilding(ctx, b, f, s)
 *   drawUnit(ctx, u, f, s)
 *   drawProjectile(ctx, p)
 *   drawSelectionRing(ctx, e, t, pulse [, s])
 *   drawSelectionRingBack(ctx, e, t, pulse [, s])
 *   drawSelectionRingFront(ctx, e, t, pulse [, s])
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
    drawLivestock: drawLivestock,
    drawPasturePenGround: drawPasturePenGroundWorld,
    drawPasturePenFence: drawPasturePenFenceWorld,
    drawSelectionRing: drawSelectionRing,
    drawSelectionRingBack: drawSelectionRingBack,
    drawSelectionRingFront: drawSelectionRingFront,
    drawHealthBar: drawHealthBar,
    drawShadow: drawShadow,
  };

  /* ==========================================================================
   * Color utils — memoized. Outlines are dark desaturated kin of the fill,
   * never pure black.
   * ========================================================================*/
  var _rgbMemo = {}, _inkMemo = {}, _shadeMemo = {}, _liteMemo = {};

  function rgbOf(c) {
    if (!c) return [128, 128, 128];
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
  var THEMES = {
    grass: {
      groundA: '#8bc34a', groundB: '#6fae39',
      pathInk: '#8a6b3a', pathBody: '#e0bd72', pathLite: '#edd194',
      patchInk: '#8a6b3a', patchBody: '#e0bd72', patchLite: '#edd194',
      edgeInk: '#6fae39', vignette: '16,32,12',
    },
    volcanic: {
      groundA: '#6d4c41', groundB: '#4e342e',
      pathInk: '#bf360c', pathBody: '#ff7043', pathLite: '#ffab91',
      patchInk: '#3e2723', patchBody: '#5d4037', patchLite: '#8d6e63',
      edgeInk: '#4e342e', vignette: '32,16,8',
    },
    frost: {
      groundA: '#b3e5fc', groundB: '#81d4fa',
      pathInk: '#78909c', pathBody: '#eceff1', pathLite: '#ffffff',
      patchInk: '#546e7a', patchBody: '#cfd8dc', patchLite: '#ffffff',
      edgeInk: '#81d4fa', vignette: '12,24,48',
    },
  };

  function mapTheme(s) {
    var key = (s.map && s.map.theme) || 'grass';
    return THEMES[key] || THEMES.grass;
  }

  function drawTerrain(s, ctx) {
    if (RTS._phaserTerrainActive) return;
    if (RTS.Assets && RTS.Assets.ready && RTS.Assets.drawTerrain(s, ctx)) return;
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    var th = mapTheme(s);
    var cam = s.camera, cv = RTS.canvas;
    var vw = cv.clientWidth / cam.zoom, vh = cv.clientHeight / cam.zoom;
    var vx = cam.x - 8, vy = cam.y - 8;
    vw += 16; vh += 16;

    ctx.fillStyle = th.groundB;
    ctx.fillRect(Math.max(0, vx), Math.max(0, vy),
                 Math.min(W, vx + vw) - Math.max(0, vx),
                 Math.min(H, vy + vh) - Math.max(0, vy));

    var tile = 64;
    var tx0 = Math.max(0, Math.floor(vx / tile) * tile);
    var ty0 = Math.max(0, Math.floor(vy / tile) * tile);
    var tx1 = Math.min(W, vx + vw), ty1 = Math.min(H, vy + vh);
    ctx.fillStyle = th.groundA;
    for (var ty = ty0; ty < ty1; ty += tile) {
      for (var tx = tx0; tx < tx1; tx += tile) {
        if (((tx / tile | 0) + (ty / tile | 0)) % 2 === 0) {
          ctx.fillRect(tx, ty, Math.min(tile, W - tx), Math.min(tile, H - ty));
        }
      }
    }

    var path = (s.map && s.map.path) || {
      x0: 320, y0: H - 320, c1x: W * 0.30, c1y: H * 0.56,
      c2x: W * 0.70, c2y: H * 0.44, x1: W - 320, y1: 320,
    };
    drawPath(ctx, path, th);

    var patches = (s.map && s.map.patches) || [
      { x: 320, y: H - 320, r: 270 },
      { x: W - 320, y: 320, r: 270 },
    ];
    patches.forEach(function (p) { drawBasePatch(ctx, p.x, p.y, p.r, th); });

    if (s.map && s.map.decor) {
      var pad = 40;
      s.map.decor.forEach(function (d) {
        if (d.x < vx - pad || d.x > vx + vw + pad || d.y < vy - pad || d.y > vy + vh + pad) return;
        drawDecor(ctx, d, s.map.theme);
      });
    }

    var cxm = W / 2, cym = H / 2;
    var vg = ctx.createRadialGradient(cxm, cym, Math.min(W, H) * 0.42, cxm, cym, Math.hypot(W, H) * 0.58);
    vg.addColorStop(0, 'rgba(' + th.vignette + ',0)');
    vg.addColorStop(1, 'rgba(' + th.vignette + ',0.14)');
    ctx.fillStyle = vg;
    ctx.fillRect(Math.max(0, vx), Math.max(0, vy),
                 Math.min(W, vx + vw) - Math.max(0, vx),
                 Math.min(H, vy + vh) - Math.max(0, vy));

    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.moveTo(6, H - 6); ctx.lineTo(6, 6); ctx.lineTo(W - 6, 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,40,14,0.30)';
    ctx.beginPath(); ctx.moveTo(W - 6, 6); ctx.lineTo(W - 6, H - 6); ctx.lineTo(6, H - 6); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = ink(th.edgeInk);
    ctx.strokeRect(3, 3, W - 6, H - 6);
  }

  function drawPath(ctx, path, th) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(path.x0, path.y0);
    ctx.bezierCurveTo(path.c1x, path.c1y, path.c2x, path.c2y, path.x1, path.y1);
    ctx.strokeStyle = th.pathInk; ctx.lineWidth = 88; ctx.stroke();
    ctx.strokeStyle = th.pathBody; ctx.lineWidth = 74; ctx.stroke();
    ctx.strokeStyle = th.pathLite; ctx.lineWidth = 42; ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawBasePatch(ctx, cx, cy, r, th) {
    pCircle(ctx, cx, cy, r); ctx.fillStyle = th.patchInk; ctx.fill();
    pCircle(ctx, cx, cy, r - 7); ctx.fillStyle = th.patchBody; ctx.fill();
    pCircle(ctx, cx - r * 0.12, cy - r * 0.14, r * 0.62); ctx.fillStyle = th.patchLite; ctx.fill();
  }

  function drawDecor(ctx, d, theme) {
    var h = hashId((d.x | 0) * 73856093 ^ (d.y | 0) * 19349663);
    var kind;
    if (theme === 'volcanic') {
      kind = h % 2 === 0 ? 'rockpile' : 'crack';
    } else if (theme === 'frost') {
      kind = h % 3 === 0 ? 'icicle' : (h % 2 === 0 ? 'snowtuft' : 'crack');
    } else {
      kind = d.kind === 'rock'
        ? (h % 3 === 0 ? 'mushroom' : 'bush')
        : (h % 4 === 0 ? 'flower' : 'grass');
    }
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
    } else if (kind === 'rockpile') {
      celCircle(ctx, -d.r * 0.35, d.r * 0.1, d.r * 0.42, '#5d4037', 3);
      celCircle(ctx, d.r * 0.3, d.r * 0.15, d.r * 0.38, '#6d4c41', 3);
      celCircle(ctx, 0, -d.r * 0.2, d.r * 0.48, '#4e342e', 3);
    } else if (kind === 'icicle') {
      ctx.fillStyle = ink('#90caf9'); ctx.strokeStyle = ink('#546e7a'); ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-d.r * 0.15, d.r * 0.35);
      ctx.lineTo(0, -d.r * 0.55);
      ctx.lineTo(d.r * 0.15, d.r * 0.35);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-d.r * 0.04, -d.r * 0.4, d.r * 0.08, d.r * 0.35);
    } else if (kind === 'snowtuft') {
      ctx.lineCap = 'round';
      var blues = ['#b3e5fc', '#e1f5fe', '#81d4fa'];
      for (var k = -1; k <= 1; k++) {
        ctx.strokeStyle = ink(blues[k + 1]); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(k * d.r * 0.28, d.r * 0.3);
        ctx.quadraticCurveTo(k * d.r * 0.45, -d.r * 0.05, k * d.r * 0.55, -d.r * 0.35); ctx.stroke();
      }
    } else if (kind === 'crack') {
      ctx.strokeStyle = ink('#3e2723'); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-d.r * 0.4, d.r * 0.2); ctx.lineTo(d.r * 0.35, -d.r * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-d.r * 0.1, d.r * 0.35); ctx.lineTo(d.r * 0.15, -d.r * 0.45); ctx.stroke();
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
   * Ironstone pile — stable coin layout, organic mound base, gem crown.
   * Coins arranged in explicit back→front painter order; ground ellipse gives
   * the impression of a real pile sitting on the terrain.
   * ========================================================================*/
  function drawResource(ctx, n) {
    if (RTS.Assets && RTS.Assets.ready && RTS.Assets.drawResource(ctx, n)) return;
    var pct = n.amount / n.max;
    var sc  = 0.55 + 0.45 * pct;   // shrinks as depleted
    var x = n.x, y = n.y, r = n.r;

    // Soft shadow
    drawShadow(ctx, x, y + r * 0.28 * sc, r * sc * 1.05, 0.32);

    // Flat glow halo — ellipse so it reads as a ground pool, not a ring
    ctx.fillStyle = hexA('#ffd54f', 0.18);
    pEllipse(ctx, x, y + r * 0.08, r * 1.18 * sc, r * 0.55 * sc);
    ctx.fill();

    // Dark dirt base ellipse — anchors the pile visually
    ctx.fillStyle = hexA('#c8860a', 0.35);
    pEllipse(ctx, x, y + r * 0.32 * sc, r * 0.88 * sc, r * 0.24 * sc);
    ctx.fill();

    // Coins — explicit stable positions, back row first (painter's order)
    // Layout: [ox_fraction, oy_fraction, size_factor]
    var coinR = r * 0.38 * sc;
    var coinLayout = [
      [ -0.44,  0.18, 1.00 ],   // back-left
      [  0.44,  0.14, 1.00 ],   // back-right
      [ -0.12, -0.06, 1.05 ],   // back-center
      [ -0.52,  0.44, 0.90 ],   // front-left
      [  0.42,  0.44, 0.90 ],   // front-right
    ];
    for (var i = 0; i < coinLayout.length; i++) {
      var cl = coinLayout[i];
      drawCoin(ctx,
        x + cl[0] * r * sc,
        y + cl[1] * r * sc,
        coinR * cl[2]
      );
    }

    // Center gem — drawn last so it always crowns the pile
    drawGem(ctx, x, y - r * 0.22 * sc, r * 0.50 * sc);

    // Amount label
    var label = Math.ceil(n.amount);
    ctx.font = 'bold 12px Fredoka, system-ui';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(label).width + 16;
    var labelY = y + r * sc + 6;
    pRRect(ctx, x - tw / 2, labelY, tw, 18, 9);
    ctx.fillStyle = TEXT_INK; ctx.fill();
    pRRect(ctx, x - tw / 2 + 1.5, labelY + 1.5, tw - 3, 15, 7.5);
    ctx.fillStyle = '#ffc107'; ctx.fill();
    ctx.fillStyle = TEXT_INK;
    ctx.fillText(label, x, labelY + 13);
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
    if (RTS.PunyArt && RTS.PunyArt.enabled && RTS.PunyArt.draw(ctx, b, s)) return;
    if (RTS.Assets && RTS.Assets.ready && RTS.Assets.drawBuilding(ctx, b, f, s)) return;
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
      case 'outpost': drawCastle(ctx, b, f, t, rm * 0.88); break;
      case 'conduit': drawPasture(ctx, b, f, t, rm); break;
      case 'foundry': drawBarracks(ctx, b, f); break;
      case 'forge':
      case 'chiefs_hall': drawForge(ctx, b, f, t, rm); break;
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

  function drawPasturePenGround(ctx, w, h) {
    ctx.beginPath();
    ctx.ellipse(0, h * 0.1, w * 0.44, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,180,80,0.28)';
    ctx.fill();
  }

  function drawPasturePenFence(ctx, w, h) {
    var fenceColor = '#8B6914';
    var fenceRailColor = '#a07820';
    var postY1 = h * 0.05;
    var postY2 = h * 0.38;
    var posts = [-w * 0.44, -w * 0.22, 0, w * 0.22, w * 0.44];
    ctx.strokeStyle = fenceRailColor; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-w * 0.44, postY1 + 6); ctx.lineTo(w * 0.44, postY1 + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.44, postY2 - 6); ctx.lineTo(w * 0.44, postY2 - 6); ctx.stroke();
    posts.forEach(function (px) {
      ctx.fillStyle = fenceColor;
      ctx.strokeStyle = ink(fenceColor); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(px - 4, postY1, 8, postY2 - postY1);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 4, postY1);
      ctx.lineTo(px, postY1 - 7);
      ctx.lineTo(px + 4, postY1);
      ctx.closePath();
      ctx.fillStyle = liteC(fenceColor); ctx.fill();
    });
    ctx.clearRect(-w * 0.11, postY2 - 14, w * 0.22, 20);
  }

  function drawPasturePenGroundWorld(ctx, bx, by, w, h) {
    ctx.save();
    ctx.translate(bx, by);
    drawPasturePenGround(ctx, w, h);
    ctx.restore();
  }

  function drawPasturePenFenceWorld(ctx, bx, by, w, h) {
    ctx.save();
    ctx.translate(bx, by);
    drawPasturePenFence(ctx, w, h);
    ctx.restore();
  }

  function drawPasture(ctx, b, f, t, rm) {
    var w = b.w, h = b.h;
    drawPasturePenGround(ctx, w, h);
    celRRect(ctx, -w * 0.25, -h * 0.38, w * 0.5, h * 0.55, 7, f.primary, 4);
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, -h * 0.38);
    ctx.lineTo(0, -h * 0.65);
    ctx.lineTo(w * 0.28, -h * 0.38);
    ctx.closePath();
    ctx.fillStyle = f.dark; ctx.fill();
    ctx.strokeStyle = ink(f.dark); ctx.lineWidth = 3; ctx.stroke();
    drawPasturePenFence(ctx, w, h);
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
   * Units — Wild Rift–style lane minions: 3/4-view armored humanoids with
   * gradient metal, team trim, animated legs, and attack swings.
   * ========================================================================*/
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    var a = rgbOf(c1), b = rgbOf(c2);
    return rgbStr(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  }

  function metalGrad(ctx, x0, y0, x1, y1, light, mid, dark) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, light);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, dark);
    return g;
  }

  function unitAnim(u, t, rm, moved) {
    var ph = phaseOf(u);
    var fighting = !!(u.inAttackRange || (u.target && !u.moveTo));
    var wf = moved ? 8.5 + u.speed * 0.038 : 2.2;
    var leg = rm ? 0 : (moved ? Math.sin(t * wf + ph) : 0);
    var bob = rm ? 0 : (moved ? Math.abs(Math.sin(t * wf + ph)) * 2.8 : Math.sin(t * 2.1 + ph) * 0.9);
    var arm = rm ? 0 : (fighting ? -0.55 + Math.sin(t * 14 + ph) * 0.35 : (moved ? Math.sin(t * wf + ph + 0.8) * 0.22 : 0));
    return { leg: leg, bob: bob, arm: arm, fighting: fighting };
  }

  function minionPalette(f, team) {
    var enemy = team !== 'player';
    if (f.id === 'cinder') {
      return {
        horde: true,
        trim: f.primary,
        trimHi: '#aed581',
        trimDark: f.dark,
        accent: f.accent,
        steel: '#5d4037',
        steelHi: '#8d6e63',
        steelLo: '#3e2723',
        leather: '#4e342e',
        skin: enemy ? '#689f38' : '#7cb342',
        cape: mix(f.dark, '#33691e', enemy ? 0.45 : 0.62),
        glow: '#dce775',
      };
    }
    return {
      trim: f.primary,
      trimHi: f.secondary,
      trimDark: f.dark,
      accent: f.accent,
      steel: enemy ? '#6a7580' : '#7d8b96',
      steelHi: enemy ? '#9aa5b0' : '#b0bcc8',
      steelLo: enemy ? '#3f4850' : '#4a5560',
      leather: '#5d4037',
      skin: enemy ? '#c4a88a' : '#e0b896',
      cape: mix(f.dark, f.primary, enemy ? 0.35 : 0.55),
      glow: f.accent,
    };
  }

  function drawMinionLeg(ctx, x, y, w, h, ang, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = metalGrad(ctx, -w / 2, -h, w / 2, h, pal.steelHi, pal.steel, pal.steelLo);
    pRRect(ctx, -w / 2, -h * 0.15, w, h, w * 0.35);
    ctx.fill();
    ctx.strokeStyle = ink(pal.steelLo);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = pal.leather;
    pRRect(ctx, -w * 0.55, h * 0.55, w * 1.1, h * 0.28, w * 0.2);
    ctx.fill();
    ctx.strokeStyle = ink(pal.leather);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawMinionBoot(ctx, x, y, w, side, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(side, 1);
    ctx.fillStyle = metalGrad(ctx, 0, -w, w, w, pal.steelHi, pal.steel, pal.steelLo);
    pRRect(ctx, -w * 0.55, -w * 0.15, w * 1.1, w * 0.55, w * 0.22);
    ctx.fill();
    ctx.strokeStyle = ink(pal.steelLo);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawPauldron(ctx, x, y, r, pal, side) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(side, 1);
    ctx.fillStyle = metalGrad(ctx, -r, -r, r, r, pal.steelHi, pal.steel, pal.steelLo);
    pEllipse(ctx, 0, 0, r * 1.05, r * 0.82);
    ctx.fill();
    ctx.strokeStyle = ink(pal.steelLo);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = pal.trim;
    pRRect(ctx, -r * 0.55, -r * 0.15, r * 1.1, r * 0.22, r * 0.1);
    ctx.fill();
    specDot(ctx, -r * 0.25, -r * 0.35, r * 0.18);
    ctx.restore();
  }

  function drawMinionTorso(ctx, r, pal) {
    ctx.fillStyle = metalGrad(ctx, -r, -r * 0.5, r, r, pal.steelHi, pal.steel, pal.steelLo);
    pRRect(ctx, -r * 0.72, -r * 0.15, r * 1.44, r * 1.05, r * 0.28);
    ctx.fill();
    ctx.strokeStyle = ink(pal.steelLo);
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = pal.trim;
    pRRect(ctx, -r * 0.52, r * 0.08, r * 1.04, r * 0.24, r * 0.1);
    ctx.fill();
    ctx.strokeStyle = ink(pal.trimDark);
    ctx.lineWidth = 2;
    ctx.stroke();
    specDot(ctx, -r * 0.38, r * 0.22, r * 0.14);
  }

  function drawMinionCape(ctx, r, pal, sway) {
    var capeCol = (pal && pal.cape) ? pal.cape : '#455a64';
    var trimDark = (pal && pal.trimDark) ? pal.trimDark : '#263238';
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.1);
    ctx.quadraticCurveTo(-r * 1.05, r * 0.35 + sway, -r * 0.85, r * 0.95 + sway * 0.5);
    ctx.quadraticCurveTo(-r * 0.15, r * 0.75, 0, r * 0.55);
    ctx.quadraticCurveTo(r * 0.15, r * 0.75, r * 0.85, r * 0.95 - sway * 0.5);
    ctx.quadraticCurveTo(r * 1.05, r * 0.35 - sway, r * 0.35, -r * 0.1);
    ctx.closePath();
    ctx.fillStyle = metalGrad(ctx, -r, 0, r, r, mix(capeCol, '#ffffff', 0.12), capeCol, trimDark);
    ctx.fill();
    ctx.strokeStyle = ink(trimDark);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawMinionHelm(ctx, r, pal, visor) {
    var hy = -r * 0.72;
    ctx.fillStyle = metalGrad(ctx, -r, hy - r, r, hy + r * 0.3, pal.steelHi, pal.steel, pal.steelLo);
    pCircle(ctx, 0, hy, r * 0.78);
    ctx.fill();
    ctx.strokeStyle = ink(pal.steelLo);
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.fillStyle = pal.trim;
    pRRect(ctx, -r * 0.62, hy - r * 0.95, r * 1.24, r * 0.28, r * 0.12);
    ctx.fill();
    if (visor) {
      ctx.fillStyle = '#1a2530';
      pRRect(ctx, -r * 0.38, hy - r * 0.08, r * 0.76, r * 0.22, r * 0.08);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,220,255,0.35)';
      pRRect(ctx, -r * 0.3, hy - r * 0.04, r * 0.6, r * 0.12, r * 0.05);
      ctx.fill();
    }
    specDot(ctx, -r * 0.28, hy - r * 0.55, r * 0.16);
  }

  function drawMinionSword(ctx, x, y, ang, pal, scale) {
    scale = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    ctx.fillStyle = metalGrad(ctx, -3, -18, 3, 18, '#f5f7fa', '#cfd8dc', '#90a4ae');
    pRRect(ctx, -2.5, -20, 5, 36, 2);
    ctx.fill();
    ctx.strokeStyle = ink('#90a4ae');
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = pal.trimHi;
    pRRect(ctx, -5, 10, 10, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    pRRect(ctx, -2.5, 13, 5, 10, 1.5);
    ctx.fill();
    ctx.restore();
  }

  function drawMinionShield(ctx, x, y, pal, side) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(side, 1);
    ctx.fillStyle = metalGrad(ctx, -8, -12, 8, 12, pal.steelHi, pal.steel, pal.steelLo);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(12, -4, 10, 12);
    ctx.quadraticCurveTo(0, 16, -10, 12);
    ctx.quadraticCurveTo(-12, -4, 0, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink(pal.steelLo);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = pal.trim;
    pCircle(ctx, 0, 2, 5);
    ctx.fill();
    ctx.restore();
  }

  function drawMeleeMinion(ctx, r, pal, anim, t, ph) {
    var leg = anim.leg, arm = anim.arm;
    var sway = RTS.Config.reducedMotion ? 0 : Math.sin(t * 3.5 + ph) * r * 0.08;
    drawMinionCape(ctx, r, pal, sway);
    drawMinionLeg(ctx, -r * 0.28, r * 0.72, r * 0.34, r * 0.62, leg * 0.42, pal);
    drawMinionLeg(ctx, r * 0.28, r * 0.72, r * 0.34, r * 0.62, -leg * 0.42, pal);
    drawMinionBoot(ctx, -r * 0.28, r * 0.98, r * 0.36, 1, pal);
    drawMinionBoot(ctx, r * 0.28, r * 0.98, r * 0.36, -1, pal);
    drawMinionTorso(ctx, r, pal);
    drawPauldron(ctx, -r * 0.82, r * 0.08, r * 0.34, pal, 1);
    drawPauldron(ctx, r * 0.82, r * 0.08, r * 0.34, pal, -1);
    drawMinionShield(ctx, -r * 0.95, r * 0.12, pal, 1);
    ctx.save();
    ctx.translate(r * 0.72, r * 0.05);
    ctx.rotate(-0.35 + arm);
    drawMinionSword(ctx, 0, 0, 0, pal, 1);
    ctx.restore();
    drawMinionHelm(ctx, r, pal, true);
  }

  function drawWorkerMinion(ctx, r, pal, anim, t, ph) {
    var leg = anim.leg;
    drawMinionLeg(ctx, -r * 0.26, r * 0.7, r * 0.32, r * 0.58, leg * 0.38, pal);
    drawMinionLeg(ctx, r * 0.26, r * 0.7, r * 0.32, r * 0.58, -leg * 0.38, pal);
    drawMinionTorso(ctx, r * 0.92, pal);
    if (pal.horde) {
      ctx.fillStyle = pal.skin;
      pCircle(ctx, -r * 0.42, -r * 0.72, r * 0.14);
      ctx.fill();
      pCircle(ctx, r * 0.42, -r * 0.72, r * 0.14);
      ctx.fill();
      ctx.strokeStyle = ink(pal.trimDark);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#6d4c33';
    pRRect(ctx, -r * 0.42, r * 0.05, r * 0.84, r * 0.72, r * 0.12);
    ctx.fill();
    ctx.strokeStyle = ink('#6d4c33');
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = '#ffc107';
    pRRect(ctx, -r * 0.18, r * 0.18, r * 0.36, r * 0.28, r * 0.08);
    ctx.fill();
    ctx.save();
    ctx.translate(-r * 0.55, -r * 0.05);
    ctx.rotate(-0.9 + anim.arm * 0.3);
    ctx.fillStyle = '#8d6e63';
    pRRect(ctx, -r * 0.06, -r * 0.9, r * 0.12, r * 1.2, r * 0.05);
    ctx.fill();
    ctx.fillStyle = metalGrad(ctx, -r * 0.35, -r * 0.95, r * 0.35, -r * 0.55, '#cfd8dc', '#b0bec5', '#78909c');
    ctx.beginPath();
    ctx.moveTo(-r * 0.38, -r * 0.82);
    ctx.quadraticCurveTo(0, -r * 1.15, r * 0.38, -r * 0.82);
    ctx.quadraticCurveTo(0, -r * 0.68, -r * 0.38, -r * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink('#78909c');
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = metalGrad(ctx, -r * 0.5, -r * 1.1, r * 0.5, -r * 0.5, '#ffca28', '#ffb300', '#f57f17');
    pCircle(ctx, 0, -r * 0.88, r * 0.62);
    ctx.fill();
    ctx.strokeStyle = ink('#f57f17');
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = pal.trim;
    pRRect(ctx, -r * 0.55, -r * 0.35, r * 1.1, r * 0.16, r * 0.06);
    ctx.fill();
    specDot(ctx, -r * 0.2, -r * 1.02, r * 0.12);
  }

  function drawScoutMinion(ctx, r, pal, anim, t, ph) {
    var leg = anim.leg, sway = Math.sin(t * 5 + ph) * r * 0.06;
    var scoutPal = {
      trim: pal.trim, trimHi: pal.trimHi, trimDark: pal.trimDark,
      cape: mix(pal.cape, '#1a1a2e', 0.45),
    };
    drawMinionCape(ctx, r * 0.88, scoutPal, sway);
    drawMinionLeg(ctx, -r * 0.22, r * 0.65, r * 0.26, r * 0.52, leg * 0.5, pal);
    drawMinionLeg(ctx, r * 0.22, r * 0.65, r * 0.26, r * 0.52, -leg * 0.5, pal);
    celEllipse(ctx, 0, r * 0.32, r * 0.55, r * 0.48, mix(pal.trimDark, '#263238', 0.4), 2.4);
    ctx.save();
    ctx.translate(r * 0.5, r * 0.1);
    ctx.rotate(0.5 + anim.arm);
    ctx.fillStyle = metalGrad(ctx, -2, -14, 2, 14, pal.trimHi, pal.trim, pal.trimDark);
    pRRect(ctx, -2, -16, 4, 28, 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(r * 0.45, -r * 0.08);
    ctx.rotate(-0.25 - anim.arm * 0.6);
    ctx.fillStyle = metalGrad(ctx, -2, -14, 2, 14, pal.trimHi, pal.trim, pal.trimDark);
    pRRect(ctx, -2, -16, 4, 28, 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = mix(pal.trimDark, '#000000', 0.25);
    pCircle(ctx, 0, -r * 0.55, r * 0.62);
    ctx.fill();
    ctx.strokeStyle = ink(pal.trimDark);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    pCircle(ctx, -r * 0.12, -r * 0.58, r * 0.1);
    ctx.fill();
    pCircle(ctx, r * 0.12, -r * 0.58, r * 0.1);
    ctx.fill();
  }

  function drawHeavyMinion(ctx, r, pal, anim, t, ph) {
    var leg = anim.leg, arm = anim.arm;
    var sr = r * 1.18;
    drawMinionCape(ctx, sr, pal, 0);
    drawMinionLeg(ctx, -sr * 0.32, sr * 0.78, sr * 0.4, sr * 0.68, leg * 0.32, pal);
    drawMinionLeg(ctx, sr * 0.32, sr * 0.78, sr * 0.4, sr * 0.68, -leg * 0.32, pal);
    ctx.fillStyle = metalGrad(ctx, -sr, -sr * 0.2, sr, sr, pal.steelHi, pal.steel, pal.steelLo);
    pRRect(ctx, -sr * 0.95, -sr * 0.05, sr * 1.9, sr * 1.15, sr * 0.32);
    ctx.fill();
    ctx.strokeStyle = ink(pal.steelLo);
    ctx.lineWidth = 3;
    ctx.stroke();
    drawPauldron(ctx, -sr * 1.05, sr * 0.02, sr * 0.42, pal, 1);
    drawPauldron(ctx, sr * 1.05, sr * 0.02, sr * 0.42, pal, -1);
    ctx.save();
    ctx.translate(sr * 0.95, -sr * 0.05);
    ctx.rotate(0.2 + arm);
    ctx.fillStyle = '#6d4c33';
    pRRect(ctx, -sr * 0.07, -sr * 0.55, sr * 0.14, sr * 1.35, sr * 0.05);
    ctx.fill();
    ctx.fillStyle = metalGrad(ctx, -sr * 0.45, -sr * 0.95, sr * 0.45, -sr * 0.35, '#b0bec5', '#90a4ae', '#607d8b');
    pRRect(ctx, -sr * 0.5, -sr * 1.05, sr * 1.0, sr * 0.55, sr * 0.12);
    ctx.fill();
    ctx.strokeStyle = ink('#607d8b');
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.restore();
    drawMinionHelm(ctx, sr * 0.95, pal, true);
    ctx.fillStyle = pal.trim;
    pRRect(ctx, -sr * 0.2, -sr * 1.15, sr * 0.4, sr * 0.14, sr * 0.05);
    ctx.fill();
  }

  function drawSiegeMinion(ctx, r, pal, anim, t, ph) {
    var wheel = anim.leg * 0.2;
    ctx.fillStyle = '#5d4037';
    pRRect(ctx, -r * 1.05, r * 0.15, r * 2.1, r * 0.55, r * 0.1);
    ctx.fill();
    ctx.strokeStyle = ink('#5d4037');
    ctx.lineWidth = 2.4;
    ctx.stroke();
    [-r * 0.55, r * 0.55].forEach(function (wx, i) {
      ctx.save();
      ctx.translate(wx, r * 0.62);
      ctx.rotate(wheel + i * 0.4);
      ctx.fillStyle = metalGrad(ctx, -r * 0.3, -r * 0.3, r * 0.3, r * 0.3, '#8d6e63', '#6d4c41', '#4e342e');
      pCircle(ctx, 0, 0, r * 0.32);
      ctx.fill();
      ctx.strokeStyle = ink('#4e342e');
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.strokeStyle = '#a1887f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, 0);
      ctx.lineTo(r * 0.22, 0);
      ctx.moveTo(0, -r * 0.22);
      ctx.lineTo(0, r * 0.22);
      ctx.stroke();
      ctx.restore();
    });
    ctx.save();
    ctx.translate(-r * 0.05, r * 0.02);
    ctx.rotate(-0.28);
    ctx.fillStyle = metalGrad(ctx, 0, -r * 0.2, r * 2, r * 0.2, '#78909c', '#546e7a', '#37474f');
    pRRect(ctx, 0, -r * 0.22, r * 2.05, r * 0.44, r * 0.14);
    ctx.fill();
    ctx.strokeStyle = ink('#37474f');
    ctx.lineWidth = 2.6;
    ctx.stroke();
    specDot(ctx, r * 0.55, -r * 0.08, r * 0.1);
    ctx.restore();
    drawMinionHelm(ctx, r * 0.75, pal, false);
    pCircle(ctx, -r * 0.55, -r * 0.35, r * 0.32);
    ctx.fillStyle = pal.skin;
    ctx.fill();
    ctx.strokeStyle = ink(pal.skin);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawSupportMinion(ctx, r, pal, anim, t, ph) {
    var glow = RTS.Config.reducedMotion ? 0.5 : (Math.sin(t * 4 + ph) * 0.5 + 0.5);
    var leg = anim.leg;
    drawMinionLeg(ctx, -r * 0.24, r * 0.68, r * 0.28, r * 0.55, leg * 0.35, pal);
    drawMinionLeg(ctx, r * 0.24, r * 0.68, r * 0.28, r * 0.55, -leg * 0.35, pal);
    ctx.fillStyle = metalGrad(ctx, -r * 0.5, 0, r * 0.5, r, '#f5f5f5', '#eceff1', '#b0bec5');
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.9);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.1, 0, -r * 0.05);
    ctx.quadraticCurveTo(r * 0.7, r * 0.1, r * 0.55, r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink('#b0bec5');
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.fillStyle = pal.trim;
    pRRect(ctx, -r * 0.45, r * 0.45, r * 0.9, r * 0.18, r * 0.08);
    ctx.fill();
    drawMinionHelm(ctx, r * 0.92, pal, true);
    ctx.save();
    ctx.translate(r * 0.62, -r * 0.05);
    ctx.fillStyle = '#6d4c33';
    pRRect(ctx, -r * 0.05, -r * 0.85, r * 0.1, r * 1.35, r * 0.04);
    ctx.fill();
    ctx.fillStyle = hexA('#69f0ae', 0.2 + glow * 0.35);
    pCircle(ctx, 0, -r * 0.92, r * 0.38 + glow * r * 0.1);
    ctx.fill();
    ctx.fillStyle = metalGrad(ctx, -r * 0.2, -r * 1.05, r * 0.2, -r * 0.75, '#b9f6ca', '#69f0ae', '#2e7d32');
    pCircle(ctx, 0, -r * 0.92, r * 0.22);
    ctx.fill();
    ctx.strokeStyle = ink('#2e7d32');
    ctx.lineWidth = 2;
    ctx.stroke();
    specDot(ctx, -r * 0.08, -r * 1.02, r * 0.08);
    ctx.restore();
  }

  function renderUnitPose(ctx, role, r, pal, anim, t, ph, factionId) {
    if (factionId === 'cinder') {
      switch (role) {
        case 'pawn': drawWorkerMinion(ctx, r * 0.82, pal, anim, t, ph); break;
        case 'lancer': drawScoutMinion(ctx, r * 0.92, pal, anim, t, ph); break;
        case 'archer': drawScoutMinion(ctx, r * 0.88, pal, anim, t, ph); break;
        case 'monk': drawSupportMinion(ctx, r * 1.08, pal, anim, t, ph); break;
        case 'warrior': drawHeavyMinion(ctx, r * 1.32, pal, anim, t, ph); break;
        default: drawMeleeMinion(ctx, r, pal, anim, t, ph);
      }
      return;
    }
    switch (role) {
      case 'pawn': drawWorkerMinion(ctx, r, pal, anim, t, ph); break;
      case 'lancer': drawScoutMinion(ctx, r, pal, anim, t, ph); break;
      case 'archer': drawMeleeMinion(ctx, r, pal, anim, t, ph); break;
      case 'monk': drawSupportMinion(ctx, r, pal, anim, t, ph); break;
      case 'warrior': drawHeavyMinion(ctx, r, pal, anim, t, ph); break;
      default: drawMeleeMinion(ctx, r, pal, anim, t, ph);
    }
  }

  RTS.Art.renderUnitPose = renderUnitPose;
  RTS.Art.minionPalette = minionPalette;
  RTS.Art.unitAnim = unitAnim;
  RTS.Art.drawShadow = drawShadow;

  function drawUnitOverlays(ctx, u, f, s, r, pal, vb, spriteNative) {
    var topY = vb ? vb.drawY - 6 : u.y - r - 14;
    if (u.role === 'pawn' && u.harvest && u.harvest.carry > 0) {
      ctx.font = 'bold 11px Fredoka, system-ui';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeText('+' + Math.floor(u.harvest.carry), u.x, topY - 2);
      ctx.fillStyle = '#ffc107';
      ctx.fillText('+' + Math.floor(u.harvest.carry), u.x, topY - 2);
    }
    if (!spriteNative && u.muzzleFlash > 0 && u.ranged) {
      var mx = u.x + Math.cos(u.facing) * (r + 8);
      var my = (vb ? vb.bodyCy : u.y) + Math.sin(u.facing) * (r + 8);
      var ma = u.muzzleFlash / RTS.Config.muzzleFlash;
      ctx.fillStyle = hexA(pal.glow, ma * 0.9);
      pCircle(ctx, mx, my, 7 + ma * 4);
      ctx.fill();
      ctx.fillStyle = hexA('#ffffff', ma);
      pCircle(ctx, mx, my, 4);
      ctx.fill();
    }
    if (u.hp < u.maxHp || s.settings.showHealthAlways) {
      var barW = vb ? Math.max(34, vb.drawW * 0.85) : Math.max(34, r * 2.8);
      drawHealthBar(ctx, u.x, topY, barW, u.hp / u.maxHp, pal.trim, false, false);
    }
  }
  RTS.Art.drawUnitOverlays = drawUnitOverlays;

  function drawUnit(ctx, u, f, s) {
    if (RTS.HeroSprites && RTS.HeroSprites.enabled && RTS.HeroSprites.draw(ctx, u, f, s)) return;
    if (RTS.PunyUnits && RTS.PunyUnits.enabled && RTS.PunyUnits.draw(ctx, u, f, s)) return;
    if (RTS.Sprites && RTS.Sprites.ready) {
      RTS.Sprites.drawUnit(ctx, u, f, s);
      return;
    }
    var t = s.timers.gameTime;
    var rm = RTS.Config.reducedMotion;
    if (u.dead) { deathBurst(ctx, u, f); return; }

    var visMul = RTS.SizeRef ? RTS.SizeRef.UNIT_VISUAL_SCALE : 1;
    var r = u.radius * visMul * (1 + u.spawnFlash * 0.28);
    var moved = u._ax !== undefined &&
      (Math.abs(u.x - u._ax) + Math.abs(u.y - u._ay)) > 0.35;
    u._ax = u.x; u._ay = u.y;

    var anim = unitAnim(u, t, rm, moved);
    var pal = minionPalette(f, u.team);
    var flip = Math.cos(u.facing) < -0.12 ? -1 : 1;

    drawShadow(ctx, u.x, u.y + r * 0.62, r * 1.05, 0.38);
    ctx.save();
    ctx.translate(u.x, u.y - anim.bob);
    ctx.scale(flip, 1);
    renderUnitPose(ctx, u.role, r, pal, anim, t, phaseOf(u), u.faction);
    ctx.restore();
    drawUnitOverlays(ctx, u, f, s, r, pal);
  }

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
  RTS.Art.deathBurst = deathBurst;

  function drawProjectile(ctx, p) {
    if (RTS.Assets && RTS.Assets.ready && RTS.Assets.drawProjectile(ctx, p)) return;
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
   * Selection — Cursor_04 corner sprites with z-order split.
   * Top brackets render before buildings (occluded); bottom brackets after.
   * ========================================================================*/
  var SELECTION_CURSOR_SRC =
    'assets/tiny-swords/UI%20Elements/UI%20Elements/Cursors/Cursor_04.png';
  var selectionCursorImg = null;
  var selectionCursorReady = false;
  var CURSOR_QUAD = 64;

  (function loadSelectionCursor() {
    if (typeof Image === 'undefined') return;
    var img = new Image();
    img.onload = function () { selectionCursorReady = true; };
    img.onerror = function () { selectionCursorReady = false; };
    img.src = SELECTION_CURSOR_SRC;
    selectionCursorImg = img;
  })();
  function unitSelectionBox(u, s) {
    var vb = RTS.Sprites && s && RTS.Sprites.unitVisualBounds
      ? RTS.Sprites.unitVisualBounds(u, s) : null;
    if (vb && vb.tight) {
      var t = vb.tight;
      var soleY = vb.soleY != null ? vb.soleY : vb.footY;
      var footPad = 2;
      return {
        tlx: t.x, tly: t.y,
        trx: t.x + t.w, try_: t.y,
        brx: t.x + t.w, bry: soleY + footPad,
        blx: t.x, bly: soleY + footPad,
        front: true,
      };
    }
    var foot = RTS.SizeRef && RTS.SizeRef.selectionFootBox
      ? RTS.SizeRef.selectionFootBox(u.role, vb)
      : { cx: u.x, footY: u.y + 10, rx: 8, ry: 3, yPad: 0 };
    var cx = foot.cx;
    var soleY = foot.footY;
    var rx = foot.rx;
    var ry = foot.ry;
    var top = soleY - ry;
    var bot = soleY + (foot.yPad || 0);
    return {
      tlx: cx - rx, tly: top,
      trx: cx + rx, try_: top,
      brx: cx + rx, bry: bot,
      blx: cx - rx, bly: bot,
      front: true,
      feetOnly: true,
    };
  }

  function selectionBoxFor(e, s) {
    if (e.kind === 'unit') {
      return unitSelectionBox(e, s);
    }

    var bvb = RTS.Assets && RTS.Assets.buildingVisualBounds && s
      ? RTS.Assets.buildingVisualBounds(e, s) : null;
    if (!bvb) return null;

    var br = bvb.boundary || (RTS.SizeRef && RTS.SizeRef.buildingBoundaryRect
      ? RTS.SizeRef.buildingBoundaryRect(e.type, bvb) : null);
    if (!br) return null;

    return {
      tlx: br.left, tly: br.top,
      trx: br.right, try_: br.top,
      brx: br.right, bry: br.bottom,
      blx: br.left, bly: br.bottom,
    };
  }

  function rectToTrapezoid(box, front) {
    return {
      tlx: box.x, tly: box.y,
      trx: box.x + box.w, try_: box.y,
      brx: box.x + box.w, bry: box.y + box.h,
      blx: box.x, bly: box.y + box.h,
      front: !!front,
    };
  }

  function bracketLen(box) {
    var w = box.brx - box.blx;
    var h = box.bry - box.tly;
    if (box.feetOnly) {
      return Math.max(7, Math.min(11, w * 0.24, h * 0.26));
    }
    return Math.max(8, Math.min(22, Math.min(w, h) * 0.42));
  }

  function bracketSpriteSz(box, pulse) {
    var scale = 1 + (pulse - 1) * 0.08;
    if (box.feetOnly) {
      var w = box.brx - box.blx;
      var h = box.bry - box.tly;
      var side = Math.min(w, h);
      return Math.round(Math.max(14, Math.min(22, side * 0.54)) * scale);
    }
    return Math.round(bracketLen(box) * 2.35 * scale);
  }

  function strokeCornerL(ctx, ax, ay, bx, by, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy);
    ctx.stroke();
  }

  function drawBracketPair(ctx, box, which, lw) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    var len = bracketLen(box);

    if (which === 'top') {
      strokeCornerL(ctx,
        box.tlx, box.tly + len,
        box.tlx, box.tly,
        box.tlx + len, box.tly);
      strokeCornerL(ctx,
        box.trx - len, box.try_,
        box.trx, box.try_,
        box.trx, box.try_ + len);
    } else {
      strokeCornerL(ctx,
        box.brx, box.bry - len,
        box.brx, box.bry,
        box.brx - len, box.bry);
      strokeCornerL(ctx,
        box.blx + len, box.bly,
        box.blx, box.bly,
        box.blx, box.bly - len);
    }
  }

  function drawCornerSprite(ctx, img, sx, sy, dx, dy, sz, pulse) {
    ctx.save();
    ctx.globalAlpha = 0.88 + (pulse - 1) * 0.12;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, CURSOR_QUAD, CURSOR_QUAD, dx, dy, sz, sz);
    ctx.restore();
  }

  function drawBrackets(ctx, box, which, pulse) {
    var sz = bracketSpriteSz(box, pulse);

    if (selectionCursorReady && selectionCursorImg) {
      if (which === 'top') {
        drawCornerSprite(ctx, selectionCursorImg, 0, 0, box.tlx, box.tly, sz, pulse);
        drawCornerSprite(ctx, selectionCursorImg, CURSOR_QUAD, 0, box.trx - sz, box.try_, sz, pulse);
      } else {
        drawCornerSprite(ctx, selectionCursorImg, 0, CURSOR_QUAD, box.blx, box.bly - sz, sz, pulse);
        drawCornerSprite(ctx, selectionCursorImg, CURSOR_QUAD, CURSOR_QUAD, box.brx - sz, box.bry - sz, sz, pulse);
      }
      return;
    }

    var lwMain = 3 + (pulse - 1) * 4;
    ctx.strokeStyle = 'rgba(240, 192, 80, 0.55)';
    drawBracketPair(ctx, box, which, lwMain + 3);
    ctx.strokeStyle = '#ffffff';
    drawBracketPair(ctx, box, which, lwMain);
  }

  function drawSelectionRingBack(ctx, e, t, pulse, s) {
    var box = selectionBoxFor(e, s);
    if (!box || box.front) return;
    drawBrackets(ctx, box, 'top', pulse);
  }

  function drawSelectionRingFront(ctx, e, t, pulse, s) {
    var box = selectionBoxFor(e, s);
    if (!box) return;
    if (box.feetOnly) {
      drawBrackets(ctx, box, 'bottom', pulse);
      return;
    }
    if (box.front) {
      drawBrackets(ctx, box, 'top', pulse);
      drawBrackets(ctx, box, 'bottom', pulse);
      return;
    }
    drawBrackets(ctx, box, 'bottom', pulse);
  }

  function drawSelectionRing(ctx, e, t, pulse, s) {
    drawSelectionRingBack(ctx, e, t, pulse, s);
    drawSelectionRingFront(ctx, e, t, pulse, s);
  }

  /* ==========================================================================
   * Health bar — Tiny Swords Live Bars (3-slice sprite) with canvas fallback.
   * ========================================================================*/
  function drawHealthBadge(ctx, x, y, h, large) {
    var br = h / 2 + (large ? 6 : 4.5);
    pCircle(ctx, x - 1, y + h / 2, br);
    ctx.fillStyle = '#ffca28'; ctx.fill();
    ctx.strokeStyle = TEXT_INK; ctx.lineWidth = 2.5; ctx.stroke();
    pStar4(ctx, x - 1, y + h / 2, br * 0.55);
    ctx.fillStyle = '#fff8e1'; ctx.fill();
    ctx.strokeStyle = '#c98f00'; ctx.lineWidth = 1.4; ctx.stroke();
  }

  function drawHealthBar(ctx, cx, y, w, pct, color, large, badge) {
    pct = Math.max(0, Math.min(1, pct));
    var specH = large ? 12 : 8;
    if (RTS.Assets && RTS.Assets.drawSpriteHealthBar &&
        RTS.Assets.drawSpriteHealthBar(ctx, cx, y, w, pct, color, large)) {
      if (badge) drawHealthBadge(ctx, cx - w / 2, y - specH / 2, specH, large);
      return;
    }

    var h = large ? 9 : 5;
    var x = cx - w / 2;
    var fill = pct <= 0.25 ? '#ef5350' : pct <= 0.55 ? '#ffca28' : (color || '#43a047');

    pRRect(ctx, x - 1, y - 1, w + 2, h + 2, h / 2 + 1);
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fill();
    pRRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(20,28,36,0.85)'; ctx.fill();

    if (pct > 0) {
      pRRect(ctx, x, y, Math.max(h, w * pct), h, h / 2);
      var g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, liteC(fill));
      g.addColorStop(1, fill);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      pRRect(ctx, x + 1, y + 1, Math.max(0, w * pct - 2), h * 0.38, 1.5);
      ctx.fill();
    }

    if (badge) drawHealthBadge(ctx, x, y, h, large);
  }

  /* ==========================================================================
   * Shadow — soft radial blob (Wild Rift–style ground contact).
   * ========================================================================*/
  function drawShadow(ctx, x, y, r, alpha) {
    /* shadows disabled */
  }

  function drawAnimal(ctx, a, s) {
    var clip = RTS.Livestock ? RTS.Livestock.clip(a.species, a.animClip) : null;
    var img  = RTS.Livestock ? RTS.Livestock.imgSync(a.species, a.animClip) : null;

    ctx.save();
    ctx.translate(a.x, a.y);

    if (img && clip) {
      var fw = clip.frameW;
      var fh = img.height;
      var sc = a.species === 'pig' ? 0.36 : 0.42;
      var dw = fw * sc;
      var dh = fh * sc;
      ctx.imageSmoothingEnabled = false;
      if (a.facing < 0) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(
        img,
        a.animFrame * fw, 0, fw, fh,
        -dw / 2, -dh * 0.82,
        dw, dh
      );
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = a.species === 'pig' ? '#e8a0a0' : '#f0f0f0';
      ctx.fill();
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    ctx.restore();
  }

  function drawLivestock(ctx, s) {
    s.entities.buildings.forEach(function (b) {
      if (!b.built || b.dead) return;
      var bspec = RTS.Buildings[b.type];
      if (!bspec || !bspec.isPasture || !b.livestock) return;
      b.livestock.forEach(function (a) {
        if (a.dead) return;
        drawAnimal(ctx, a, s);
      });
    });
  }

  /*
   * Fairy Clearing — tile the Pixel Crawler grass tiles across the visible viewport.
   * Uses interior grass tiles (row 1-2, col 1-3) to get clean, flat green ground.
   * A checkerboard-like pattern of 3 tile variants prevents monotone repetition.
   * Rendered at 2× scale (16px → 32px per tile) with pixelated scaling.
   */
  var _fcGrassTiles = [
    { sx: 16, sy: 16 },  // col 1 row 1 — medium green
    { sx: 32, sy: 16 },  // col 2 row 1 — medium green (slightly lighter)
    { sx: 32, sy: 32 },  // col 2 row 2 — slightly deeper green
  ];

  // Draws the PC fairy grass tiles in CSS pixel space (before the world transform).
  // This ensures the tiling covers the full canvas regardless of DPR or camera zoom.
  // W and H are the CSS pixel dimensions of the canvas (passed from render.js).
  function drawFairyGrassFloor(ctx, s, W, H) {
    var img = RTS.Assets && RTS.Assets.img ? RTS.Assets.img('pc-fairy-tiles.png', 'assets/terrain/') : null;
    if (!img) return;
    if (!W || !H) {
      W = RTS.canvas ? RTS.canvas.clientWidth : 1920;
      H = RTS.canvas ? RTS.canvas.clientHeight : 1080;
    }
    var cam = s.camera;
    var tileWorld = 32;   // world units per tile
    var sw = 16, sh = 16; // source pixels in the tileset
    var tileCSS = tileWorld * cam.zoom;  // CSS pixels per displayed tile (scrolls naturally)

    // First tile column/row in world units that is at or just before the left/top screen edge
    var startCol = Math.floor(cam.x / tileWorld);
    var startRow = Math.floor(cam.y / tileWorld);

    // CSS screen offset of that first tile (will be in [-tileCSS, 0])
    var startX = (startCol * tileWorld - cam.x) * cam.zoom;
    var startY = (startRow * tileWorld - cam.y) * cam.zoom;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    var colIdx = 0;
    for (var dx = startX; dx < W + tileCSS; dx += tileCSS, colIdx++) {
      var rowIdx = 0;
      for (var dy = startY; dy < H + tileCSS; dy += tileCSS, rowIdx++) {
        var worldCol = startCol + colIdx;
        var worldRow = startRow + rowIdx;
        var variant = ((worldRow + worldCol) % 3 + 3) % 3;
        var t = _fcGrassTiles[variant];
        ctx.drawImage(img, t.sx, t.sy, sw, sh, dx, dy, tileCSS, tileCSS);
      }
    }
    ctx.restore();
  }

  RTS.Art = RTS.Art || {};
  RTS.Art.drawFairyGrassFloor = drawFairyGrassFloor;

})(window.RTS = window.RTS || {});
