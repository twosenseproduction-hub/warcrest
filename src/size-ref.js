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
  };

  /* Draw size targets — width-led, height follows sprite aspect in assets.js */
  var BUILDING_DRAW = {
    core: { w: 256, h: 192 },
    outpost: { w: 128, h: 128 },
    conduit: { w: 128, h: 128 },
    foundry: { w: 160, h: 128 },
    forge: { w: 176, h: 144 },
    turret: { w: 56, h: 96 },
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
  };

  var HEIGHT_MUL = 2.05;
  /* Pawn 192px frames → ~64px on screen at foot radius UNIT.pawn */
  var UNIT_VISUAL_SCALE = REF.charH / (UNIT.pawn * HEIGHT_MUL);
  var LANCER_VISUAL_MUL = 1.12;
  var LANCER_TRAY_ZOOM = 1.22;

  /*
   * Per-role sprite + selection calibration (measured from Tiny Swords idle frames).
   * footRatio — fraction from sprite top to the bottom of visible art (feet/shadow).
   * Prior values (~0.86–0.94) assumed feet near the sheet bottom; actual art ends near
   * 0.62–0.71, which pushed brackets ~10px below the visible pawn.
   */
  var UNIT_VISUAL = {
    pawn:    { footRatio: 0.698, selectRxMul: 0.36, selectRyMul: 0.10 },
    lancer:  { footRatio: 0.616, selectRxMul: 0.34, selectRyMul: 0.11 },
    archer:  { footRatio: 0.703, selectRxMul: 0.35, selectRyMul: 0.10 },
    monk:    { footRatio: 0.693, selectRxMul: 0.36, selectRyMul: 0.10 },
    warrior: { footRatio: 0.708, selectRxMul: 0.38, selectRyMul: 0.11 },
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
    var spec = unitVisualSpec(role);
    if (!vb) {
      return { cx: 0, soleY: 0, rx: 8, ry: 3 };
    }
    return {
      cx: vb.x,
      soleY: vb.soleY != null ? vb.soleY : vb.footY,
      rx: Math.max(6, vb.drawW * spec.selectRxMul),
      ry: Math.max(2, vb.drawH * spec.selectRyMul),
    };
  }

  function selectionFootBox(role, vb) {
    var ell = unitSelectionEllipse(role, vb);
    return {
      cx: ell.cx,
      footY: ell.soleY,
      rx: ell.rx,
      ry: ell.ry,
      yPad: 0,
    };
  }

  function selectionEllipse(role) {
    return unitVisualSpec(role);
  }

  function selectionRadius(role) {
    var spec = unitVisualSpec(role);
    return Math.max(6, Math.round(64 * spec.selectRxMul));
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
