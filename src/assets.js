/* ============================================================================
 * EXOFRONT — assets.js
 * Tiny Swords kingdom pack — Blue vs Red humans, shared buildings & arrows.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var KINGDOM_BASE = 'assets/tiny-swords/';
  var TILE = 64;
  var cache = {};
  var ready = false;

  function url(base, rel) {
    return base + rel.split('/').map(encodeURIComponent).join('/');
  }

  function loadImg(rel, base) {
    base = base || KINGDOM_BASE;
    var key = base + rel;
    if (cache[key]) {
      if (cache[key]._img) return Promise.resolve(cache[key]._img);
      return cache[key];
    }
    var promise = new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { promise._img = img; resolve(img); };
      img.onerror = function () { reject(new Error('asset: ' + key)); };
      img.src = url(base, rel);
    });
    cache[key] = promise;
    return promise;
  }

  function imgSync(rel, base) {
    base = base || KINGDOM_BASE;
    var p = cache[base + rel];
    return (p && p._img) ? p._img : null;
  }

  function factionColor(fid) {
    return fid === 'cinder' ? 'Red' : 'Blue';
  }

  function hashId(id) {
    if (typeof id === 'number') return (id * 2654435761) >>> 0;
    var h = 0, s = String(id);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  var BUILDING_FILES = {
    core: 'Castle.png',
    outpost: 'House1.png',
    conduit: 'House2.png',
    foundry: 'Barracks.png',
    forge: 'Archery.png',
    turret: 'Tower.png',
  };

  var BUILDING_FOOT = {
    core: 0.96,
    outpost: 0.95,
    conduit: 0.94,
    foundry: 0.95,
    forge: 0.95,
    turret: 0.90,
  };

  /* Measured from sprite alpha channels — inset fractions (0..1) per edge. */
  var BUILDING_TIGHT_INSETS = {
    Castle:   { l: 0.012, r: 0.012, t: 0.16, b: 0.027 },
    House1:   { l: 0.062, r: 0.062, t: 0.083, b: 0.099 },
    House2:   { l: 0.000, r: 0.000, t: 0.120, b: 0.073 },
    House3:   { l: 0.023, r: 0.023, t: 0.193, b: 0.104 },
    Tower:    { l: 0.031, r: 0.031, t: 0.180, b: 0.102 },
    Archery:  { l: 0.016, r: 0.031, t: 0.238, b: 0.062 },
    Barracks: { l: 0.021, r: 0.021, t: 0.227, b: 0.043 },
  };

  var BUILDING_TYPE_TO_INSET_KEY = {
    core:    'Castle',
    outpost: 'House1',
    conduit: 'House2',
    foundry: 'Barracks',
    forge:   'Archery',
    turret:  'Tower',
  };

  var GOLD_STONES = [
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 1.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 2.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 3.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 4.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 5.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 6.png',
  ];

  /* Gold deposit — hero + supports, tiered by depletion (not a scattered loot pile). */
  var GOLD_STONE_DRAW = 0.74; /* sprite scale vs node footprint (was 0.58) */
  var GOLD_DEPOSIT = {
    slots: [
      { idx: 0, x: 0, y: -0.22, s: 1.44, role: 'hero' },
      { idx: 2, x: -0.50, y: -0.02, s: 1.06, role: 'support' },
      { idx: 4, x: 0.44, y: -0.04, s: 1.02, role: 'support' },
      { idx: 3, x: 0.12, y: 0.17, s: 0.76, role: 'optional' },
    ],
  };

  function goldPieceCount(pct) {
    if (pct > 0.66) return 4;
    if (pct > 0.33) return 3;
    return 2;
  }

  var DECOR_SPRITES = {
    bush: [
      'Terrain/Decorations/Bushes/Bushe1.png',
      'Terrain/Decorations/Bushes/Bushe2.png',
      'Terrain/Decorations/Bushes/Bushe3.png',
      'Terrain/Decorations/Bushes/Bushe4.png',
    ],
    tree: [
      'Terrain/Resources/Wood/Trees/Tree1.png',
      'Terrain/Resources/Wood/Trees/Tree2.png',
      'Terrain/Resources/Wood/Trees/Tree3.png',
      'Terrain/Resources/Wood/Trees/Tree4.png',
    ],
    rock: [
      'Terrain/Decorations/Rocks in the Water/Water Rocks_01.png',
      'Terrain/Decorations/Rocks in the Water/Water Rocks_02.png',
      'Terrain/Decorations/Rocks in the Water/Water Rocks_03.png',
    ],
  };

  var ARROW = 'Units/Blue Units/Archer/Arrow.png';

  function buildingDrawScale(type, imgW, imgH) {
    return RTS.SizeRef.buildingDrawScale(type, imgW, imgH);
  }

  function buildingFootY(b, s) {
    var grid = s && s.map && s.map.terrainGrid;
    return grid && RTS.Terrain ? RTS.Terrain.groundY(grid, b.x, b.y) : b.y;
  }

  function buildingVisualBounds(b, s) {
    var asset = buildingAsset(b);
    var img = imgSync(asset.rel, asset.base);
    if (!img) return null;
    var footY = buildingFootY(b, s);
    var sc = buildingDrawScale(b.type, img.width, img.height);
    var drawW = img.width * sc;
    var drawH = img.height * sc;
    var footRatio = BUILDING_FOOT[b.type] || 0.95;
    var drawY = footY - drawH * footRatio;

    var key = BUILDING_TYPE_TO_INSET_KEY[b.type] || 'House1';
    var ins = BUILDING_TIGHT_INSETS[key] || { l: 0, r: 0, t: 0, b: 0 };
    var tx = b.x - drawW / 2 + drawW * ins.l;
    var ty = drawY + drawH * ins.t;
    var tw = drawW * (1 - ins.l - ins.r);
    var th = drawH * (1 - ins.t - ins.b);

    return {
      x: b.x,
      footY: footY,
      drawW: drawW,
      drawH: drawH,
      drawY: drawY,
      tight: { x: tx, y: ty, w: tw, h: th },
      boundary: RTS.SizeRef && RTS.SizeRef.buildingBoundaryRect
        ? RTS.SizeRef.buildingBoundaryRect(b.type, {
          x: b.x, footY: footY, drawW: drawW, drawH: drawH, drawY: drawY,
          tight: { x: tx, y: ty, w: tw, h: th },
        })
        : null,
    };
  }

  /* Footprint for unit collision — solid base, not full sprite height. */
  function buildingCollisionRect(b, s) {
    var vb = buildingVisualBounds(b, s);
    if (vb) {
      var hw = vb.drawW * 0.36;
      return {
        l: vb.x - hw,
        r: vb.x + hw,
        t: vb.drawY + vb.drawH * 0.42,
        b: vb.footY + 4,
      };
    }
    var hw = b.w * 0.36;
    var hh = b.h * 0.28;
    return { l: b.x - hw, r: b.x + hw, t: b.y - hh, b: b.y + hh * 0.55 };
  }

  function buildingAsset(b) {
    var file = BUILDING_FILES[b.type] || BUILDING_FILES.foundry;
    return {
      base: KINGDOM_BASE,
      rel: 'Buildings/' + factionColor(b.faction) + ' Buildings/' + file,
      frames: 1,
    };
  }

  function loadAll() {
    var paths = [
      { base: KINGDOM_BASE, rel: 'Terrain/Tileset/Shadow.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Tileset/Water Background color.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Tileset/Water Foam.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Tileset/Tilemap_color1.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Tileset/Tilemap_color2.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Tileset/Tilemap_color3.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Tileset/Tilemap_color4.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Tileset/Tilemap_color5.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Resources/Gold/Gold Resource/Gold_Resource.png' },
      { base: KINGDOM_BASE, rel: 'Terrain/Resources/Gold/Gold Resource/Gold_Resource_Highlight.png' },
      { base: KINGDOM_BASE, rel: ARROW },
      { base: KINGDOM_BASE, rel: 'UI Elements/UI Elements/Cursors/Cursor_04.png' },
      { base: KINGDOM_BASE, rel: 'UI Elements/UI Elements/Bars/SmallBar_Base.png' },
      { base: KINGDOM_BASE, rel: 'UI Elements/UI Elements/Bars/SmallBar_Fill.png' },
      { base: KINGDOM_BASE, rel: 'UI Elements/UI Elements/Bars/BigBar_Base.png' },
      { base: KINGDOM_BASE, rel: 'UI Elements/UI Elements/Bars/BigBar_Fill.png' },
    ];
    Object.keys(BUILDING_FILES).forEach(function (t) {
      paths.push({ base: KINGDOM_BASE, rel: 'Buildings/Blue Buildings/' + BUILDING_FILES[t] });
      paths.push({ base: KINGDOM_BASE, rel: 'Buildings/Red Buildings/' + BUILDING_FILES[t] });
    });
    GOLD_STONES.forEach(function (p) {
      paths.push({ base: KINGDOM_BASE, rel: p });
      paths.push({ base: KINGDOM_BASE, rel: p.replace('.png', '_Highlight.png') });
    });
    DECOR_SPRITES.bush.forEach(function (p) { paths.push({ base: KINGDOM_BASE, rel: p }); });
    DECOR_SPRITES.tree.forEach(function (p) { paths.push({ base: KINGDOM_BASE, rel: p }); });
    DECOR_SPRITES.rock.forEach(function (p) { paths.push({ base: KINGDOM_BASE, rel: p }); });
    return Promise.all(paths.map(function (p) { return loadImg(p.rel, p.base); }));
  }

  function drawTerrain(s, ctx) {
    var W = RTS.Config.world.w, H = RTS.Config.world.h;
    var cam = s.camera, cv = RTS.canvas;
    var vw = cv.clientWidth / cam.zoom, vh = cv.clientHeight / cam.zoom;
    var vx = cam.x - 8, vy = cam.y - 8;
    vw += 16; vh += 16;

    var grid = s.map && s.map.terrainGrid;
    if (!grid || !RTS.Terrain) return false;
    if (!RTS.Terrain.render(ctx, s, grid, vx, vy, vw, vh)) return false;

    var theme = (s.map && s.map.theme) || 'grass';
    if (s.map && s.map.decor) {
      var pad = 80;
      s.map.decor.forEach(function (d) {
        if (d.x < vx - pad || d.x > vx + vw + pad || d.y < vy - pad || d.y > vy + vh + pad) return;
        drawDecorSprite(ctx, d, theme, s);
      });
    }

    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(20,40,14,0.35)';
    ctx.strokeRect(3, 3, W - 6, H - 6);
    return true;
  }

  function sheetFrame(img, frame, frameW, frameH) {
    frameH = frameH || img.height;
    var sx = frame * frameW;
    if (sx + frameW > img.width) return null;
    return { sx: sx, sy: 0, sw: frameW, sh: frameH };
  }

  function decorAnimFrame(t, h, frameCount, fps, reducedMotion) {
    if (reducedMotion) return ((h >> 8) % frameCount + frameCount) % frameCount;
    var phase = (h & 255) * 0.041;
    return (Math.floor(t * fps + phase) % frameCount + frameCount) % frameCount;
  }

  function drawDecorSprite(ctx, d, theme, s) {
    var h = hashId((d.x | 0) * 73856093 ^ (d.y | 0) * 19349663);
    var t = RTS._renderT || 0;
    var rm = RTS.Config.reducedMotion;
    var list, idx, frameW, frameCount, frameH, targetH, footRatio;

    if (d.kind === 'tree') {
      list = DECOR_SPRITES.tree;
      idx = h % list.length;
      frameW = 192;
      frameCount = 8;
      targetH = RTS.SizeRef.decorDrawHeight('tree', idx);
      footRatio = 0.9;
    } else if (d.kind === 'rock' || ((theme === 'volcanic' || theme === 'amber') && d.kind !== 'bush')) {
      list = DECOR_SPRITES.rock;
      idx = h % list.length;
      frameW = 128;
      frameCount = 8;
      frameH = 64;
      targetH = RTS.SizeRef.decorDrawHeight('rock');
      footRatio = 0.85;
    } else if (d.kind === 'bush') {
      list = DECOR_SPRITES.bush;
      idx = h % list.length;
      frameW = 128;
      frameCount = 8;
      targetH = RTS.SizeRef.decorDrawHeight('bush');
      footRatio = 0.78;
    } else if (h % 5 === 0) {
      list = DECOR_SPRITES.tree;
      idx = h % list.length;
      frameW = 192;
      frameCount = 8;
      targetH = RTS.SizeRef.decorDrawHeight('tree', idx);
      footRatio = 0.9;
    } else {
      list = DECOR_SPRITES.bush;
      idx = h % list.length;
      frameW = 128;
      frameCount = 8;
      targetH = RTS.SizeRef.decorDrawHeight('bush');
      footRatio = 0.78;
    }

    var img = imgSync(list[idx]);
    if (!img) return;
    var grid = s && s.map && s.map.terrainGrid;
    var footY = grid && RTS.Terrain ? RTS.Terrain.groundY(grid, d.x, d.y) : d.y;

    if (frameW) {
      var animFps = d.kind === 'bush' ? 3 : (d.kind === 'rock' ? 2 : 2.5);
      var fi = decorAnimFrame(t, h, frameCount, animFps, rm);
      var frame = sheetFrame(img, fi, frameW, frameH);
      if (!frame) return;
      var sc = targetH / frame.sh;
      var w = frame.sw * sc;
      var ht = frame.sh * sc;
      RTS.Art.drawShadow(ctx, d.x, footY + ht * 0.08, d.r * 0.9, 0.25);
      ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh,
        d.x - w / 2, footY - ht * footRatio, w, ht);
      return;
    }

    var sc = targetH / Math.max(img.height, 1);
    var w = img.width * sc;
    var ht = img.height * sc;
    RTS.Art.drawShadow(ctx, d.x, footY + ht * 0.08, d.r * 0.9, 0.25);
    ctx.drawImage(img, d.x - w / 2, footY - ht * 0.85, w, ht);
  }

  function drawResource(ctx, n) {
    var pct = n.amount / n.max;
    var x = n.x;
    var footY = n.y + 8;
    var h = hashId(n.id);
    var t = RTS._renderT || 0;
    var rm = RTS.Config.reducedMotion;
    /* Stable footprint — depletion shrinks fullness, not the whole landmark. */
    var baseR = n.r * 1.10;
    var rot = ((h % 360) - 180) * 0.004;
    var pieceCount = goldPieceCount(pct);
    var fullness = 0.78 + 0.22 * pct;

    if (!imgSync(GOLD_STONES[0])) return false;

    RTS.Art.drawShadow(ctx, x, footY + baseR * 0.08, baseR * 1.28, 0.30);

    /* Disturbed earth — broader base, more visible as ore depletes */
    var earthA = 0.24 + (1 - pct) * 0.16;
    var earthInnerA = 0.16 + (1 - pct) * 0.14;
    ctx.save();
    ctx.translate(x, footY);
    ctx.fillStyle = 'rgba(44, 34, 22, ' + earthA + ')';
    ctx.beginPath();
    ctx.ellipse(0, baseR * 0.08, baseR * 1.24, baseR * 0.58, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(92, 70, 44, ' + earthInnerA + ')';
    ctx.beginPath();
    ctx.ellipse(0, baseR * 0.05, baseR * 0.90, baseR * 0.42, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var slots = GOLD_DEPOSIT.slots.slice(0, pieceCount);
    var pieces = slots.map(function (slot, i) {
      var idx = slot.idx % GOLD_STONES.length;
      var rawX = slot.x * baseR, rawY = slot.y * baseR;
      var sx = rawX, sy = rawY;
      if (rot) {
        var cs = Math.cos(rot), sn = Math.sin(rot);
        sx = rawX * cs - rawY * sn;
        sy = rawX * sn + rawY * cs;
      }
      var scaleMul = slot.s;
      if (slot.role === 'hero') scaleMul *= fullness;
      else if (slot.role === 'support') scaleMul *= 0.86 + 0.14 * pct;
      else scaleMul *= 0.82 + 0.18 * pct;
      return {
        idx: idx,
        x: x + sx,
        y: footY + sy,
        scale: scaleMul * (0.97 + ((h >> (i * 3)) % 5) * 0.012),
        role: slot.role,
        z: sy,
      };
    });
    pieces.sort(function (a, b) { return a.z - b.z; });

    var unit = baseR * GOLD_STONE_DRAW;
    var i, piece, stonePath, stone, hiPath, img, ss, sw, sh, drawY;
    for (i = 0; i < pieces.length; i++) {
      piece = pieces[i];
      stonePath = GOLD_STONES[piece.idx];
      stone = imgSync(stonePath);
      if (!stone) continue;
      ss = unit * piece.scale / Math.max(stone.width, stone.height);
      sw = stone.width * ss;
      sh = stone.height * ss;
      drawY = piece.y - sh * 0.74;

      ctx.drawImage(stone, piece.x - sw / 2, drawY, sw, sh);

      /* Single accent shimmer — hero stone only */
      if (!rm && piece.role === 'hero') {
        var stonePhase = piece.idx * 0.85 + (h & 255) * 0.004;
        var stonePulse = 0.5 + 0.5 * Math.sin(t * 3.0 + stonePhase);
        hiPath = stonePath.replace('.png', '_Highlight.png');
        img = imgSync(hiPath);
        if (img && stonePulse > 0.4) {
          ctx.globalAlpha = 0.16 + stonePulse * 0.28;
          ctx.drawImage(img, piece.x - sw / 2, drawY, sw, sh);
          ctx.globalAlpha = 1;
        }
      }
    }

    /* Quiet amount label — UI annotation, not part of the silhouette */
    var label = Math.ceil(n.amount);
    var lx = x + baseR * 0.38;
    var ly = footY - baseR * 0.92;
    ctx.font = '600 9px Fredoka, system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(18, 14, 10, 0.55)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = pct < 0.35 ? 'rgba(255, 183, 77, 0.82)' : 'rgba(255, 224, 160, 0.75)';
    ctx.fillText(label, lx, ly);

    return true;
  }

  function drawBuilding(ctx, b, f, s) {
    if (b.dead) return false;
    var asset = buildingAsset(b);
    var img = imgSync(asset.rel, asset.base);
    if (!img) return false;

    var vb = buildingVisualBounds(b, s);
    if (!vb) return false;
    var x = vb.x;
    var footY = vb.footY;
    var drawW = vb.drawW;
    var drawH = vb.drawH;
    var drawY = vb.drawY;
    var built = b.built;
    var alpha = built ? 1 : 0.65 + b.progress * 0.35;

    RTS.Art.drawShadow(ctx, x, footY + 4, Math.max(b.w, b.h) * 0.5, 0.36);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, 0, 0, img.width, img.height, x - drawW / 2, drawY, drawW, drawH);
    ctx.restore();

    if (!built) {
      var br = vb.boundary;
      if (br) {
        ctx.strokeStyle = 'rgba(93,64,55,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
        ctx.strokeRect(br.left - 2, br.top - 2, br.w + 4, br.h + 4);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = 'rgba(93,64,55,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
        ctx.strokeRect(x - drawW / 2 - 4, drawY - 4, drawW + 8, drawH + 8);
        ctx.setLineDash([]);
      }
      RTS.Art.drawHealthBar(ctx, x, drawY - 14, drawW, b.progress, '#42a5f5', true, false);
    }

    if (built && (b.hp < b.maxHp || s.settings.showHealthAlways)) {
      RTS.Art.drawHealthBar(ctx, x, drawY - 14, drawW, b.hp / b.maxHp, f.primary, true, true);
    }

    ctx.font = 'bold 11px Fredoka, system-ui';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#22282e'; ctx.lineWidth = 3;
    ctx.strokeText(RTS.nameFor(b.faction, b.type), x, footY + 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(RTS.nameFor(b.faction, b.type), x, footY + 18);

    if (b.train) {
      var pct = 1 - b.train.remaining / b.train.total;
      RTS.Art.drawHealthBar(ctx, x, footY + 24, drawW * 0.8, pct, f.secondary, false, false);
    }
    return true;
  }

  /* ---- Health bars — Tiny Swords “Live Bars” 3-slice (stretchable horizontally) ---- */
  var HP_BAR = {
    small: {
      base: 'UI Elements/UI Elements/Bars/SmallBar_Base.png',
      fill: 'UI Elements/UI Elements/Bars/SmallBar_Fill.png',
      capL: 49, capLW: 15, capR: 256, capRW: 15,
      midX: 128, midW: 64, texH: 64,
      fillY: 30, fillH: 3,
      displayH: 8,
    },
    big: {
      base: 'UI Elements/UI Elements/Bars/BigBar_Base.png',
      fill: 'UI Elements/UI Elements/Bars/BigBar_Fill.png',
      capL: 40, capLW: 24, capR: 256, capRW: 24,
      midX: 128, midW: 64, texH: 64,
      fillY: 20, fillH: 24,
      displayH: 12,
    },
  };

  function hpBarFillColor(pct, color) {
    if (color === '#42a5f5') return color;
    if (pct <= 0.25) return '#d94040';
    if (pct <= 0.55) return '#e0a820';
    return color || '#48b848';
  }

  function drawBarFrame(ctx, baseImg, spec, x, top, totalW, barH) {
    var scale = barH / spec.texH;
    var capW = spec.capLW * scale;
    var capRW = spec.capRW * scale;
    var midW = Math.max(1, totalW - capW - capRW);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(baseImg, spec.capL, 0, spec.capLW, spec.texH, x, top, capW, barH);
    ctx.drawImage(baseImg, spec.midX, 0, spec.midW, spec.texH, x + capW, top, midW, barH);
    ctx.drawImage(baseImg, spec.capR, 0, spec.capRW, spec.texH, x + capW + midW, top, capRW, barH);
    return { capW: capW, capRW: capRW, midW: midW, insetX: scale };
  }

  function drawBarFill(ctx, fillImg, spec, x, top, totalW, barH, pct, color) {
    if (pct <= 0.001) return;
    var scale = barH / spec.texH;
    var capW = spec.capLW * scale;
    var capRW = spec.capRW * scale;
    var insetX = scale;
    var innerW = totalW - insetX * 2;
    var fillW = Math.max(1, innerW * pct);
    var fillY = top + (spec.fillY / spec.texH) * barH;
    var fillH = Math.max(1, (spec.fillH / spec.texH) * barH);
    var fillX = x + insetX;
    var fillColor = hpBarFillColor(pct, color);

    ctx.save();
    ctx.beginPath();
    ctx.rect(fillX, fillY, fillW, fillH);
    ctx.clip();
    ctx.fillStyle = fillColor;
    ctx.fillRect(fillX, fillY, innerW, fillH);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(fillImg, 0, spec.fillY, fillImg.width, spec.fillH, fillX, fillY, innerW, fillH);
    ctx.restore();
  }

  function drawSpriteHealthBar(ctx, cx, y, w, pct, color, large) {
    var spec = large ? HP_BAR.big : HP_BAR.small;
    var baseImg = imgSync(spec.base);
    var fillImg = imgSync(spec.fill);
    if (!baseImg || !fillImg) return false;

    pct = Math.max(0, Math.min(1, pct));
    var barH = spec.displayH;
    var totalW = Math.max(barH * 3.2, w);
    var x = cx - totalW / 2;
    var top = y - barH / 2;

    drawBarFrame(ctx, baseImg, spec, x, top, totalW, barH);
    drawBarFill(ctx, fillImg, spec, x, top, totalW, barH, pct, color);
    return true;
  }

  function drawProjectile(ctx, p) {
    var img = imgSync(ARROW);
    if (!img) return false;
    var dx = p.x - p.lastX, dy = p.y - p.lastY;
    var ang = Math.atan2(dy, dx);
    var sz = p.splash ? 22 : 16;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
    return true;
  }

  function drawUnitShadow(ctx, x, y, r, alpha) {
    return false;
  }

  RTS.Assets = {
    ready: false,
    KINGDOM_BASE: KINGDOM_BASE,
    BASE: KINGDOM_BASE,
    url: function (rel) { return url(KINGDOM_BASE, rel); },
    loadImg: function (rel) { return loadImg(rel, KINGDOM_BASE); },
    img: function (rel) { return imgSync(rel, KINGDOM_BASE); },
    packBase: function () { return KINGDOM_BASE; },
    factionColor: factionColor,

    load: function (cb) {
      var self = this;
      loadAll().then(function () {
        ready = true;
        self.ready = true;
        if (cb) cb();
      }).catch(function (err) {
        console.error('EXOFRONT Tiny Swords load failed', err);
        self.ready = false;
        if (cb) cb(err);
      });
    },

    drawTerrain: drawTerrain,
    drawResource: drawResource,
    drawBuilding: drawBuilding,
    drawProjectile: drawProjectile,
    drawUnitShadow: drawUnitShadow,
    drawSpriteHealthBar: drawSpriteHealthBar,
    buildingVisualBounds: buildingVisualBounds,
    buildingCollisionRect: buildingCollisionRect,
  };

})(window.RTS = window.RTS || {});
