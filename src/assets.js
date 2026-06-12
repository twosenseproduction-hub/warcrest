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

  var GOLD_STONES = [
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 1.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 2.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 3.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 4.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 5.png',
    'Terrain/Resources/Gold/Gold Stones/Gold Stone 6.png',
  ];

  /* Layered clump — back to front (y). idx = stone variant, s = scale mul. */
  var GOLD_CLUMP = [
    { idx: 2, x: -0.48, y: -0.06, s: 1.12 },
    { idx: 4, x: 0.44, y: -0.10, s: 1.06 },
    { idx: 0, x: -0.02, y: -0.24, s: 1.38, hero: true },
    { idx: 5, x: -0.62, y: 0.14, s: 0.92 },
    { idx: 1, x: 0.58, y: 0.10, s: 0.96 },
    { idx: 3, x: -0.22, y: 0.20, s: 0.82 },
    { idx: 5, x: 0.18, y: 0.18, s: 0.76 },
    { idx: 2, x: 0.34, y: 0.22, s: 0.68 },
  ];

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
    return {
      x: b.x,
      footY: footY,
      drawW: drawW,
      drawH: drawH,
      drawY: footY - drawH * footRatio,
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
    var list, idx, frameW, frameCount, targetH, footRatio;

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
      frameW = 0;
      targetH = RTS.SizeRef.decorDrawHeight('rock');
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
      var animFps = d.kind === 'bush' ? 3 : 2.5;
      var fi = decorAnimFrame(t, h, frameCount, animFps, rm);
      var frame = sheetFrame(img, fi, frameW);
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
    var sc = 0.62 + 0.38 * pct;
    var x = n.x;
    var footY = n.y + 8;
    var h = hashId(n.id);
    var t = RTS._renderT || 0;
    var rm = RTS.Config.reducedMotion;
    var baseR = n.r * sc * 1.05;
    var rot = ((h % 360) - 180) * 0.004;

    var pile = imgSync('Terrain/Resources/Gold/Gold Resource/Gold_Resource.png');
    if (!pile) return false;

    RTS.Art.drawShadow(ctx, x, footY + baseR * 0.08, baseR * 1.35, 0.34);

    /* Disturbed earth patch under the vein */
    ctx.save();
    ctx.translate(x, footY);
    ctx.fillStyle = 'rgba(62, 48, 32, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, baseR * 0.06, baseR * 1.15, baseR * 0.52, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 92, 58, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, baseR * 0.04, baseR * 0.82, baseR * 0.38, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var pieces = GOLD_CLUMP.map(function (slot, i) {
      var idx = slot.idx % GOLD_STONES.length;
      var sx = slot.x * baseR;
      var sy = slot.y * baseR;
      if (rot) {
        var cs = Math.cos(rot), sn = Math.sin(rot);
        var rx = sx * cs - sy * sn;
        var ry = sx * sn + sy * cs;
        sx = rx; sy = ry;
      }
      return {
        idx: idx,
        x: x + sx,
        y: footY + sy,
        scale: slot.s * (0.94 + ((h >> (i * 3)) % 7) * 0.018),
        hero: !!slot.hero,
        z: sy,
      };
    });
    pieces.sort(function (a, b) { return a.z - b.z; });

    var unit = baseR * 0.62;
    var i, piece, stonePath, stone, hiPath, img, ss, sw, sh, drawY;
    for (i = 0; i < pieces.length; i++) {
      piece = pieces[i];
      stonePath = GOLD_STONES[piece.idx];
      stone = imgSync(stonePath);
      if (!stone) continue;
      ss = unit * piece.scale / Math.max(stone.width, stone.height);
      sw = stone.width * ss;
      sh = stone.height * ss;
      drawY = piece.y - sh * 0.72;

      ctx.drawImage(stone, piece.x - sw / 2, drawY, sw, sh);
      if (!rm) {
        var stonePhase = piece.idx * 0.85 + (h & 255) * 0.004;
        var stonePulse = 0.5 + 0.5 * Math.sin(t * 4.2 + stonePhase);
        hiPath = stonePath.replace('.png', '_Highlight.png');
        img = imgSync(hiPath);
        if (img && stonePulse > 0.15) {
          ctx.globalAlpha = (piece.hero ? 0.28 : 0.12) + stonePulse * (piece.hero ? 0.55 : 0.3);
          ctx.drawImage(img, piece.x - sw / 2, drawY, sw, sh);
          ctx.globalAlpha = 1;
        }
      }
    }

    /* Center nugget + sparkle strip on the hero pile */
    var nugScale = unit * 0.42 / Math.max(pile.width, pile.height);
    var nugW = pile.width * nugScale;
    var nugH = pile.height * nugScale;
    var nugY = footY - baseR * 0.38 - nugH * 0.5;
    ctx.drawImage(pile, x - nugW / 2, nugY, nugW, nugH);

    if (!rm) {
      var spark = imgSync('Terrain/Resources/Gold/Gold Resource/Gold_Resource_Highlight.png');
      if (spark) {
        var frames = 6;
        var fw = spark.width / frames;
        var fi = Math.floor(t * 6 + (h & 255) * 0.08) % frames;
        ctx.globalAlpha = 0.72 + Math.sin(t * 5 + h * 0.02) * 0.22;
        ctx.drawImage(spark, fi * fw, 0, fw, spark.height,
          x - nugW * 0.65, nugY - nugH * 0.22, nugW * 1.3, nugH * 1.3);
        ctx.globalAlpha = 1;
      }
    }

    var label = Math.ceil(n.amount);
    var ly = footY - baseR * 0.72;
    ctx.font = 'bold 11px Fredoka, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(18, 14, 10, 0.85)';
    ctx.strokeText(label, x, ly);
    ctx.fillStyle = pct < 0.35 ? '#ffb74d' : '#ffe082';
    ctx.fillText(label, x, ly);

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
      ctx.strokeStyle = 'rgba(93,64,55,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.strokeRect(x - drawW / 2 - 4, drawY - 4, drawW + 8, drawH + 8);
      ctx.setLineDash([]);
      RTS.Art.drawHealthBar(ctx, x, drawY - 14, drawW, b.progress, '#42a5f5', true, false);
    }

    if (b.hitFlash > 0) {
      var flashK = b.hitFlash / RTS.Config.hitFlash;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,' + (flashK * 0.75) + ')';
      ctx.fillRect(x - drawW / 2, drawY, drawW, drawH);
      ctx.fillStyle = 'rgba(255,150,90,' + (flashK * 0.4) + ')';
      ctx.fillRect(x - drawW / 2, drawY, drawW, drawH);
      ctx.restore();
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
    buildingVisualBounds: buildingVisualBounds,
    buildingCollisionRect: buildingCollisionRect,
  };

})(window.RTS = window.RTS || {});
