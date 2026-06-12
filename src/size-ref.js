/* ============================================================================
 * Warcrest — size-ref.js
 * Gameplay-radius proportions from League of Legends Size wiki.
 * https://leagueoflegends.fandom.com/wiki/Size
 *
 * LoL values are gameplay radius (hitbox). We map them to world pixels with
 * MINION_PX so a melee minion (48) anchors worker scale on 64px tiles.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var MINION = 48;

  /* Canonical LoL gameplay radii (wiki Size page + turret page). */
  var LOL = {
    minion_melee: 48,
    minion_siege: 65,
    champion_small: 55,
    champion_std: 65,
    champion_large: 80,
    turret: 88.4,
    inhibitor: 105,
    nexus: 131.25,
    rift_herald: 110,
    jungle_large: 65,
    jungle_small: 35,
    decor_bush: 15,
    resource_node: 42,
  };

  var UNIT = {
    pawn: LOL.minion_melee,
    lancer: LOL.champion_std,
    archer: LOL.champion_std,
    monk: LOL.champion_std,
    warrior: LOL.champion_large,
  };

  var BUILDING = {
    turret: LOL.turret,
    conduit: LOL.champion_std,
    foundry: LOL.turret * 0.96,
    forge: LOL.turret,
    outpost: LOL.inhibitor,
    core: LOL.nexus,
  };

  var RESOURCE = {
    node: LOL.resource_node,
    pile: LOL.minion_melee * 0.72,
  };

  var DECOR = {
    bush: LOL.decor_bush,
    tree: LOL.minion_melee,
    rock: LOL.jungle_small,
    treeHeightMul: 2.55,
    bushHeightMul: 1.55,
    rockScaleMul: 1.65,
  };

  /* 1 LoL minion radius → world px (foot / collision). ~44% of a 64px tile. */
  var MINION_PX = 14;
  var GLOBAL_SCALE = 1.25;
  var HEIGHT_MUL = 2.05;
  /* Lancer 320px frames have extra canvas padding — boost draw to match 192px units. */
  var LANCER_VISUAL_MUL = 1.32;
  var LANCER_TRAY_ZOOM = 1.38;

  /* Tall building sprites read larger than flat gameplay radius; keeps LoL ratios. */
  var BUILDING_VISUAL_MUL = 1.45;
  /* Minimum harvest/tap radius on mobile (LoL pile is smaller than click target). */
  var RESOURCE_TAP_MIN_PX = 32;

  function ratio(lolR) {
    return lolR / MINION;
  }

  function pxRadius(lolR) {
    return MINION_PX * ratio(lolR) * GLOBAL_SCALE;
  }

  function pxHeight(lolR, frameScale) {
    return pxRadius(lolR) * HEIGHT_MUL * (frameScale || 1);
  }

  function unitTier(role) {
    return ratio(UNIT[role] || LOL.champion_std);
  }

  function buildingDrawScale(type, baseW) {
    var lolR = BUILDING[type] || LOL.turret;
    var targetW = pxRadius(lolR) * 2 * BUILDING_VISUAL_MUL;
    return targetW / Math.max(baseW, 1);
  }

  function decorWorldR(kind) {
    if (kind === 'tree') return pxRadius(DECOR.tree) * 2.2;
    if (kind === 'bush') return pxRadius(DECOR.bush) * 2.4;
    if (kind === 'rock') return pxRadius(DECOR.rock) * 1.8;
    return pxRadius(DECOR.bush) * 2;
  }

  function trayScale(role) {
    return 0.88 + unitTier(role) * 0.12;
  }

  RTS.SizeRef = {
    MINION: MINION,
    MINION_PX: MINION_PX,
    GLOBAL_SCALE: GLOBAL_SCALE,
    HEIGHT_MUL: HEIGHT_MUL,
    LANCER_VISUAL_MUL: LANCER_VISUAL_MUL,
    LANCER_TRAY_ZOOM: LANCER_TRAY_ZOOM,
    LOL: LOL,
    UNIT: UNIT,
    BUILDING: BUILDING,
    RESOURCE: RESOURCE,
    DECOR: DECOR,
    ratio: ratio,
    pxRadius: pxRadius,
    pxHeight: pxHeight,
    unitLol: function (role) { return UNIT[role] || LOL.champion_std; },
    unitTier: unitTier,
    buildingLol: function (type) { return BUILDING[type] || LOL.turret; },
    buildingDrawScale: buildingDrawScale,
    resourceR: function () {
      return Math.max(pxRadius(RESOURCE.node), RESOURCE_TAP_MIN_PX * GLOBAL_SCALE);
    },
    resourcePileR: function () { return pxRadius(RESOURCE.pile); },
    decorWorldR: decorWorldR,
    trayScale: trayScale,
  };
})(window.RTS = window.RTS || {});
