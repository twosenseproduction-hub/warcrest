/* ============================================================================
 * Warcrest — size-ref.js
 * Tiny Swords reference scale — one world unit = 64px tile (cliff face height).
 *
 * Reference proportions (top-down 3/4):
 *   1 character height  = 1 tile (64px)
 *   1 small house       ≈ 2 tiles tall, ~2 tiles wide
 *   1 tower             ≈ 1.5 tiles tall · castle ≈ 3 tiles (wider)
 *   1 deciduous tree    ≈ 2 tiles tall · pine ≈ 3 tiles
 *   1 bush / rock       ≈ 0.4–0.5 tile
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var TILE = 64;

  var REF = {
    charH: TILE,
    charFootR: 11,
    houseH: TILE * 2,
    houseW: TILE * 2,
    barracksH: TILE * 2,
    barracksW: TILE * 2.5,
    archeryH: TILE * 2.25,
    archeryW: TILE * 2.75,
    towerH: TILE * 1.5,
    towerW: TILE * 0.875,
    castleH: TILE * 3,
    castleW: TILE * 4,
    treeH: TILE * 2.5,
    pineH: TILE * 3,
    bushH: 32,
    rockH: 26,
  };

  /* Gameplay foot radii (collision / selection), derived from char foot. */
  var UNIT = {
    pawn: REF.charFootR,
    lancer: REF.charFootR * 1.08,
    archer: REF.charFootR * 1.05,
    monk: REF.charFootR * 1.05,
    warrior: REF.charFootR * 1.18,
    hero: REF.charFootR * 1.32,
  };

  /* Draw size targets — width-led, height follows sprite aspect in assets.js */
  /* Scale tier 5: all values ×5/3 from original (×4/3 then ×1.25) for ~2.5–3× unit size. */
  var BUILDING_DRAW = {
    core: { w: 426, h: 320 },
    outpost: { w: 216, h: 216 },
    conduit: { w: 296, h: 240 },
    foundry: { w: 266, h: 216 },
    forge: { w: 296, h: 240 },
    chiefs_hall: { w: 296, h: 240 },
    turret: { w: 120, h: 160 },
  };

  /*
   * Visual boundary tuning — applied on top of alpha-measured tight sprite rect
   * from assets.js (not gameplay footprint from RTS.Buildings).
   *
   * wMul/hMul scale the tight mass; pad* trim in px; yOffset shifts box down (+).
   * Reference corrected sizes @ 1x (world px): see buildingBoundary() comments.
   */
  var BUILDING_VISUAL_BOUNDARY = {
    core:    { wMul: 1.00, hMul: 1.00, padL: 1, padR: 1, padT: 0, padB: 3, xOffset: 0, yOffset: 0 },
    conduit: { wMul: 1.00, hMul: 1.00, padL: 0, padR: 0, padT: 0, padB: 2, xOffset: 0, yOffset: 0 },
    foundry: { wMul: 1.00, hMul: 1.00, padL: 1, padR: 1, padT: 0, padB: 2, xOffset: 0, yOffset: 0 },
    forge:   { wMul: 1.00, hMul: 1.00, padL: 0, padR: 0, padT: 0, padB: 2, xOffset: 0, yOffset: 0 },
    chiefs_hall: { wMul: 1.00, hMul: 1.00, padL: 0, padR: 0, padT: 0, padB: 2, xOffset: 0, yOffset: 0 },
    turret:  { wMul: 1.00, hMul: 1.00, padL: 1, padR: 1, padT: 0, padB: 2, xOffset: 0, yOffset: 0 },
    outpost: { wMul: 1.00, hMul: 1.00, padL: 0, padR: 0, padT: 0, padB: 2, xOffset: 0, yOffset: 0 },
  };

  /* Legacy LoL keys kept for tier helpers only. */
  var LOL = {
    minion_melee: 48,
    champion_std: 65,
    champion_large: 80,
    turret: 88.4,
    inhibitor: 105,
    nexus: 131.25,
    resource_node: 42,
    decor_bush: 15,
    jungle_small: 35,
  };

  var UNIT_LOL = {
    pawn: LOL.minion_melee,
    lancer: LOL.champion_std,
    archer: LOL.champion_std,
    monk: LOL.champion_std,
    warrior: LOL.champion_large,
    hero: LOL.champion_large * 1.08,
  };

  var HEIGHT_MUL = 2.05;
  /*
   * Global unit draw multiplier — tune here when units feel too small vs buildings.
   * Base scale maps pawn foot radius + HEIGHT_MUL to REF.charH (1 tile). Sprites have
   * ~30% transparent headroom (footRatio ~0.70), so visible bodies read ~35–45% of
   * Barracks (128px) until this multiplier is applied.
   */
  var GLOBAL_UNIT_SCALE = 1.6;
  var UNIT_VISUAL_SCALE =
    (REF.charH / (UNIT.pawn * HEIGHT_MUL)) * GLOBAL_UNIT_SCALE;
  var LANCER_VISUAL_MUL = 1.12;
  var LANCER_TRAY_ZOOM = 1.22;

  /*
   * Per-role sprite + selection calibration (measured from Tiny Swords idle frames).
   * footRatio — fraction from sprite top to the bottom of visible art (feet/shadow).
   * Prior values (~0.86–0.94) assumed feet near the sheet bottom; actual art ends near
   * 0.62–0.71, which pushed brackets ~10px below the visible pawn.
   */
  /*
   * selectWMul — selection width vs tight body width (>1 = wider than torso).
   * selectTopFrac — top bracket height as fraction down the tight body rect.
   * selectFootPad — px below sole for bottom bracket baseline.
   */
  var UNIT_VISUAL = {
    pawn:    { footRatio: 0.698, selectWMul: 1.14, selectTopFrac: 0.36, selectFootPad: 3 },
    lancer:  { footRatio: 0.616, selectWMul: 1.10, selectTopFrac: 0.30, selectFootPad: 3 },
    archer:  { footRatio: 0.703, selectWMul: 1.12, selectTopFrac: 0.34, selectFootPad: 3 },
    monk:    { footRatio: 0.693, selectWMul: 1.12, selectTopFrac: 0.36, selectFootPad: 3 },
    warrior: { footRatio: 0.708, selectWMul: 1.16, selectTopFrac: 0.32, selectFootPad: 3 },
    hero:    { footRatio: 0.70, selectWMul: 1.18, selectTopFrac: 0.28, selectFootPad: 3 },
  };

  function unitVisualSpec(role) {
    return UNIT_VISUAL[role] || UNIT_VISUAL.pawn;
  }

  function unitFootRatio(role, frameH) {
    return unitVisualSpec(role).footRatio;
  }

  function unitFootOffset(role) {
    return unitVisualSpec(role).footRatio;
  }

  function unitSelectionEllipse(role, vb) {
    var box = selectionFootBox(role, vb);
    return {
      cx: box.cx,
      soleY: box.footY,
      rx: box.rx,
      ry: box.ry,
    };
  }

  function selectionFootBox(role, vb) {
    var spec = unitVisualSpec(role);
    if (!vb) {
      return { cx: 0, footY: 0, rx: 14, ry: 10, yPad: 3 };
    }
    var soleY = vb.soleY != null ? vb.soleY : vb.footY;
    var footPad = spec.selectFootPad != null ? spec.selectFootPad : 3;
    var tight = vb.tight;
    if (tight) {
      var wMul = spec.selectWMul != null ? spec.selectWMul : 1.12;
      var topFrac = spec.selectTopFrac != null ? spec.selectTopFrac : 0.36;
      var rx = Math.max(10, tight.w * wMul * 0.5);
      var topY = tight.y + tight.h * topFrac;
      var ry = Math.max(8, soleY - topY);
      return { cx: vb.x, footY: soleY, rx: rx, ry: ry, yPad: footPad };
    }
    return {
      cx: vb.x,
      footY: soleY,
      rx: Math.max(10, vb.drawW * 0.38),
      ry: Math.max(8, vb.drawH * 0.18),
      yPad: footPad,
    };
  }

  function selectionEllipse(role) {
    return unitVisualSpec(role);
  }

  function selectionRadius(role) {
    var spec = unitVisualSpec(role);
    var wMul = spec.selectWMul != null ? spec.selectWMul : 1.12;
    return Math.max(10, Math.round(26 * wMul));
  }

  var RESOURCE_TAP_MIN_PX = 28;

  function pxRadius(roleOrLol) {
    if (typeof roleOrLol === 'string' && UNIT[roleOrLol] != null) return UNIT[roleOrLol];
    return REF.charFootR;
  }

  function pxHeight(role, frameScale) {
    var r = typeof role === 'string' ? pxRadius(role) : role;
    return r * HEIGHT_MUL * (frameScale || 1) * UNIT_VISUAL_SCALE;
  }

  function unitTier(role) {
    return pxRadius(role) / REF.charFootR;
  }

  function buildingDrawScale(type, imgW, imgH) {
    var t = BUILDING_DRAW[type] || BUILDING_DRAW.foundry;
    var scW = t.w / Math.max(imgW, 1);
    if (!imgH || !t.h) return scW;
    var scH = t.h / Math.max(imgH, 1);
    return Math.min(scW, scH);
  }

  function buildingDrawTarget(type) {
    return BUILDING_DRAW[type] || BUILDING_DRAW.foundry;
  }

  function buildingBoundary(type) {
    return BUILDING_VISUAL_BOUNDARY[type] || BUILDING_VISUAL_BOUNDARY.foundry;
  }

  /** World-space visual boundary rect hugging visible building mass (not gameplay footprint). */
  function buildingBoundaryRect(type, vb) {
    if (!vb) return null;
    var spec = buildingBoundary(type);
    var tight = vb.tight;
    var cx = vb.x + (spec.xOffset || 0);
    var footY = vb.footY;

    if (tight) {
      var wMul = spec.wMul != null ? spec.wMul : 1;
      var hMul = spec.hMul != null ? spec.hMul : 1;
      var padL = spec.padL || 0;
      var padR = spec.padR || 0;
      var padT = spec.padT || 0;
      var padB = spec.padB || 0;
      var yOff = spec.yOffset || 0;
      var w = Math.max(8, tight.w * wMul - padL - padR);
      var h = Math.max(8, tight.h * hMul - padT - padB);
      var top = tight.y + padT + yOff;
      var left = cx - w / 2;
      return {
        cx: cx,
        cy: top + h / 2,
        w: w,
        h: h,
        left: left,
        right: left + w,
        top: top,
        bottom: top + h,
        footY: footY,
      };
    }

    /* Fallback when tight insets unavailable — still tighter than full sprite rect. */
    var dw = vb.drawW || 64;
    var dh = vb.drawH || 64;
    var drawY = vb.drawY != null ? vb.drawY : footY - dh * 0.9;
    var topRatio = spec.topRatio != null ? spec.topRatio : 0.28;
    var botPad = spec.botRatio != null ? spec.botRatio : 0.03;
    var w = Math.max(8, dw * (spec.wMul != null ? spec.wMul : 0.88));
    var top = drawY + dh * topRatio + (spec.yOffset || 0);
    var bottom = drawY + dh * (1 - botPad);
    var h = Math.max(8, bottom - top);
    var left = cx - w / 2;
    return {
      cx: cx,
      cy: top + h / 2,
      w: w,
      h: h,
      left: left,
      right: left + w,
      top: top,
      bottom: bottom,
      footY: footY,
    };
  }

  function decorDrawHeight(kind, spriteIdx) {
    if (kind === 'tree') {
      return (spriteIdx === 0) ? REF.pineH : REF.treeH;
    }
    if (kind === 'bush') return REF.bushH;
    if (kind === 'rock') return REF.rockH;
    return REF.bushH;
  }

  function decorWorldR(kind, spriteIdx) {
    var h = decorDrawHeight(kind, spriteIdx);
    if (kind === 'tree') return h * 0.22;
    if (kind === 'bush') return h * 0.42;
    if (kind === 'rock') return h * 0.48;
    return h * 0.35;
  }

  function trayScale(role) {
    return 0.9 + unitTier(role) * 0.08;
  }

  function ratio(lolR) {
    return lolR / LOL.minion_melee;
  }

  RTS.SizeRef = {
    TILE: TILE,
    REF: REF,
    MINION: LOL.minion_melee,
    MINION_PX: UNIT.pawn,
    GLOBAL_SCALE: 1,
    GLOBAL_UNIT_SCALE: GLOBAL_UNIT_SCALE,
    HEIGHT_MUL: HEIGHT_MUL,
    UNIT_VISUAL_SCALE: UNIT_VISUAL_SCALE,
    LANCER_VISUAL_MUL: LANCER_VISUAL_MUL,
    LANCER_TRAY_ZOOM: LANCER_TRAY_ZOOM,
    BUILDING_DRAW: BUILDING_DRAW,
    LOL: LOL,
    UNIT: UNIT_LOL,
    BUILDING: {},
    RESOURCE: { node: LOL.resource_node, pile: LOL.minion_melee * 0.72 },
    DECOR: {
      bush: LOL.decor_bush,
      tree: LOL.minion_melee,
      rock: LOL.jungle_small,
      treeHeightMul: 1,
      bushHeightMul: 1,
      rockScaleMul: 1,
    },
    ratio: ratio,
    pxRadius: pxRadius,
    pxHeight: pxHeight,
    unitLol: function (role) { return UNIT_LOL[role] || LOL.champion_std; },
    unitTier: unitTier,
    buildingLol: function () { return LOL.turret; },
    buildingDrawScale: buildingDrawScale,
    buildingDrawTarget: buildingDrawTarget,
    BUILDING_VISUAL_BOUNDARY: BUILDING_VISUAL_BOUNDARY,
    buildingBoundary: buildingBoundary,
    buildingBoundaryRect: buildingBoundaryRect,
    selectionEllipse: selectionEllipse,
    selectionFootBox: selectionFootBox,
    selectionRadius: selectionRadius,
    UNIT_VISUAL: UNIT_VISUAL,
    unitVisualSpec: unitVisualSpec,
    unitFootRatio: unitFootRatio,
    unitFootOffset: unitFootOffset,
    unitSelectionEllipse: unitSelectionEllipse,
    resourceR: function () {
      return Math.max(TILE * 0.55, RESOURCE_TAP_MIN_PX);
    },
    resourcePileR: function () { return REF.charFootR * 0.65; },
    decorDrawHeight: decorDrawHeight,
    decorWorldR: decorWorldR,
    trayScale: trayScale,
  };
})(window.RTS = window.RTS || {});
