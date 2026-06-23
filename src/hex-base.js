/* ============================================================================
 * Warcrest — hex-base.js
 * Fixed hex-slot system for core and outpost buildings.
 * Slots are computed from RTS.BaseLayout config and stored per-core.
 * Workers snap to the nearest open slot; the ring is drawn as feedback.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  function dist(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  RTS.HexBase = {};

  // _slots[coreId] = array of slot objects
  RTS.HexBase._slots = {};

  // ---- initBaseSlots -------------------------------------------------------
  // Populate slot records for a core/outpost entity.
  // Call once when the building is placed or loaded.
  RTS.HexBase.initBaseSlots = function (coreEntity) {
    var layoutType = coreEntity.baseLayout || 'main';
    var layout = (RTS.BaseLayout && RTS.BaseLayout[layoutType]) ||
                 (RTS.BaseLayout && RTS.BaseLayout.main) || null;
    if (!layout) return;

    var slots = [];
    var i, angle, pos;

    // Building slots
    for (i = 0; i < layout.angles.length; i++) {
      angle = layout.angles[i];
      pos   = RTS.Config.getSlotWorld(coreEntity.x, coreEntity.y, layoutType, i);
      slots.push({
        index:        i,
        angle:        angle,
        x:            pos.x,
        y:            pos.y,
        occupied:     false,
        buildingId:   null,
        isTurretSlot: false,
      });
    }

    // Turret slots follow building slots
    var turretOffset = layout.angles.length;
    for (i = 0; i < layout.turretAngles.length; i++) {
      angle = layout.turretAngles[i];
      pos   = RTS.Config.getSlotWorld(
        coreEntity.x, coreEntity.y, layoutType, turretOffset + i
      );
      slots.push({
        index:        turretOffset + i,
        angle:        angle,
        x:            pos.x,
        y:            pos.y,
        occupied:     false,
        buildingId:   null,
        isTurretSlot: true,
      });
    }

    RTS.HexBase._slots[coreEntity.id] = slots;
  };

  // ---- getOpenSlots --------------------------------------------------------
  RTS.HexBase.getOpenSlots = function (coreId) {
    var slots = RTS.HexBase._slots[coreId];
    if (!slots) return [];
    var open = [];
    for (var i = 0; i < slots.length; i++) {
      if (!slots[i].occupied) open.push(slots[i]);
    }
    return open;
  };

  // ---- occupySlot ----------------------------------------------------------
  RTS.HexBase.occupySlot = function (coreId, slotIndex, buildingId) {
    var slots = RTS.HexBase._slots[coreId];
    if (!slots) return;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].index === slotIndex) {
        slots[i].occupied   = true;
        slots[i].buildingId = buildingId;
        return;
      }
    }
  };

  // ---- freeSlot ------------------------------------------------------------
  RTS.HexBase.freeSlot = function (coreId, slotIndex) {
    var slots = RTS.HexBase._slots[coreId];
    if (!slots) return;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].index === slotIndex) {
        slots[i].occupied   = false;
        slots[i].buildingId = null;
        return;
      }
    }
  };

  // ---- snapToBuildSlot -----------------------------------------------------
  // Finds the nearest open slot within 90px threshold.
  // Turret type only snaps to turret slots; non-turret cannot go in turret slots.
  // Returns { x, y, slotIndex, isTurretSlot } or null.
  RTS.HexBase.snapToBuildSlot = function (worldX, worldY, coreId, buildingType) {
    var THRESHOLD = 90;
    var isTurret  = (buildingType === 'turret');
    var slots     = RTS.HexBase._slots[coreId];
    if (!slots) return null;

    var best     = null;
    var bestDist = Infinity;
    var i, slot, d;

    for (i = 0; i < slots.length; i++) {
      slot = slots[i];
      if (slot.occupied) continue;
      if (isTurret && !slot.isTurretSlot) continue;
      if (!isTurret && slot.isTurretSlot) continue;
      d = dist(worldX, worldY, slot.x, slot.y);
      if (d < bestDist && d <= THRESHOLD) {
        bestDist = d;
        best     = slot;
      }
    }

    if (!best) return null;
    return {
      x:            best.x,
      y:            best.y,
      slotIndex:    best.index,
      isTurretSlot: best.isTurretSlot,
    };
  };

  // ---- renderSlotIndicators ------------------------------------------------
  // Draw open-slot outlines as hexagons in world space.
  // Called after terrain, before units — camera transform already applied.
  RTS.HexBase.renderSlotIndicators = function (ctx, camera) {
    var coreIds = Object.keys(RTS.HexBase._slots);
    if (!coreIds.length) return;

    var RADIUS = 10;
    var SIDES  = 6;
    var ci, si, coreId, slots, slot, factionSecondary, v, ang, vx, vy;
    var s = (RTS.Game && RTS.Game._state) ? RTS.Game._state : null;

    for (ci = 0; ci < coreIds.length; ci++) {
      coreId = coreIds[ci];
      slots  = RTS.HexBase._slots[coreId];

      // Resolve faction secondary colour for this core
      factionSecondary = '#aaaaaa';
      if (s) {
        var core = RTS.getById ? RTS.getById(s, coreId) : null;
        if (core && core.faction && RTS.Factions && RTS.Factions[core.faction]) {
          factionSecondary = RTS.Factions[core.faction].secondary || factionSecondary;
        }
      }

      for (si = 0; si < slots.length; si++) {
        slot = slots[si];
        if (slot.occupied) continue;

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = factionSecondary;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        for (v = 0; v < SIDES; v++) {
          ang = (v / SIDES) * Math.PI * 2 - Math.PI / 6;
          vx  = slot.x + Math.cos(ang) * RADIUS;
          vy  = slot.y + Math.sin(ang) * RADIUS;
          if (v === 0) ctx.moveTo(vx, vy);
          else         ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
  };

})(window.RTS = window.RTS || {});
