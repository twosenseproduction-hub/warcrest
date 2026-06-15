(function () {
  'use strict';

  var TILE = 64;
  var UNIT_VISION_RADIUS = 5;
  var KEEP_VISION_RADIUS = 8;
  var BUILDING_VISION_RADIUS = 3;
  var fogEnabled = true;
  var fogGrid = null;
  var fogEdgeGrid = null;
  var fogCols = 0;
  var fogRows = 0;
  var patched = false;
  var toggleButton = null;
  var originalDrawUnit = null;

  function ensureButton() {
    if (toggleButton) return toggleButton;

    toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.id = 'btn-fog-toggle';
    toggleButton.textContent = 'FOG: ON';
    toggleButton.setAttribute('aria-pressed', 'true');
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = 'max(12px, env(safe-area-inset-top))';
    toggleButton.style.left = '50%';
    toggleButton.style.transform = 'translateX(-50%)';
    toggleButton.style.zIndex = '40';
    toggleButton.style.minHeight = '36px';
    toggleButton.style.padding = '7px 14px';
    toggleButton.style.border = '1px solid #FFD700';
    toggleButton.style.borderRadius = '999px';
    toggleButton.style.background = 'rgba(10, 14, 22, 0.82)';
    toggleButton.style.color = '#FFD700';
    toggleButton.style.font = '700 12px "Courier New", monospace';
    toggleButton.style.letterSpacing = '0.08em';
    toggleButton.style.boxShadow = '0 0 12px rgba(0, 0, 0, 0.55)';
    toggleButton.style.textShadow = '0 1px 2px #000';
    toggleButton.style.touchAction = 'manipulation';
    toggleButton.style.pointerEvents = 'auto';

    toggleButton.addEventListener('click', function () {
      fogEnabled = !fogEnabled;
      toggleButton.textContent = fogEnabled ? 'FOG: ON' : 'FOG: OFF';
      toggleButton.setAttribute('aria-pressed', String(fogEnabled));
    });

    document.body.appendChild(toggleButton);
    return toggleButton;
  }

  function updateButtonVisibility(state) {
    var button = ensureButton();
    var scene = state && state.scene;
    var inGame = scene === 'playing' || scene === 'paused' || scene === 'won' || scene === 'lost';

    button.style.display = inGame ? 'block' : 'none';
  }

  function ensureFogGrid(state) {
    var world = window.RTS && window.RTS.Config && window.RTS.Config.world;
    var cols = Math.ceil(((state && state.map && state.map.w) || (world && world.w) || 3072) / TILE);
    var rows = Math.ceil(((state && state.map && state.map.h) || (world && world.h) || 1920) / TILE);

    if (fogGrid && fogCols === cols && fogRows === rows) return;

    fogCols = cols;
    fogRows = rows;
    fogGrid = [];
    fogEdgeGrid = [];

    for (var y = 0; y < rows; y++) {
      fogGrid[y] = [];
      fogEdgeGrid[y] = [];
      for (var x = 0; x < cols; x++) {
        fogGrid[y][x] = 'unexplored';
        fogEdgeGrid[y][x] = false;
      }
    }
  }

  function updateVision(state) {
    ensureFogGrid(state);

    for (var y = 0; y < fogRows; y++) {
      for (var x = 0; x < fogCols; x++) {
        if (fogGrid[y][x] === 'visible') fogGrid[y][x] = 'explored';
        fogEdgeGrid[y][x] = false;
      }
    }

    var units = state && state.entities ? state.entities.units : [];
    var buildings = state && state.entities ? state.entities.buildings : [];

    units.forEach(function (unit) {
      if (!unit || unit.dead || unit.team !== window.RTS.TEAM.PLAYER) return;

      revealWorldCircle(unit.x, unit.y, UNIT_VISION_RADIUS);
    });

    buildings.forEach(function (building) {
      if (!building || building.dead || building.team !== window.RTS.TEAM.PLAYER) return;

      revealWorldCircle(building.x, building.y, building.type === 'core' ? KEEP_VISION_RADIUS : BUILDING_VISION_RADIUS);
    });
  }

  function revealWorldCircle(worldX, worldY, radius) {
    var tileX = Math.round(worldX / TILE);
    var tileY = Math.round(worldY / TILE);
    var edgeRadius = radius + 1;
    var minX = Math.max(0, tileX - edgeRadius);
    var maxX = Math.min(fogCols - 1, tileX + edgeRadius);
    var minY = Math.max(0, tileY - edgeRadius);
    var maxY = Math.min(fogRows - 1, tileY + edgeRadius);

    for (var y = minY; y <= maxY; y++) {
      for (var x = minX; x <= maxX; x++) {
        var dx = x - tileX;
        var dy = y - tileY;
        var distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius) {
          fogGrid[y][x] = 'visible';
        } else if (distance <= edgeRadius) {
          fogEdgeGrid[y][x] = true;
          if (fogGrid[y][x] === 'unexplored') fogGrid[y][x] = 'explored';
        }
      }
    }
  }

  function isTileVisible(tileX, tileY) {
    if (!fogEnabled) return true;
    if (!fogGrid) return true;
    if (tileY < 0 || tileY >= fogRows || tileX < 0 || tileX >= fogCols) return false;
    return fogGrid[tileY][tileX] === 'visible';
  }

  function isWorldVisible(worldX, worldY) {
    return isTileVisible(Math.round(worldX / TILE), Math.round(worldY / TILE));
  }

  function drawFog(state) {
    if (!fogEnabled || !state || !window.RTS || !window.RTS.ctx || !window.RTS.canvas) return;

    var ctx = window.RTS.ctx;
    var canvas = window.RTS.canvas;
    var camera = state.camera || { x: 0, y: 0, zoom: 1 };
    var dpr = window.RTS.Render && window.RTS.Render.dpr ? window.RTS.Render.dpr : 1;
    var viewLeft = camera.x;
    var viewTop = camera.y;
    var viewRight = camera.x + canvas.clientWidth / camera.zoom;
    var viewBottom = camera.y + canvas.clientHeight / camera.zoom;
    var startX = Math.max(0, Math.floor(viewLeft / TILE) - 1);
    var endX = Math.min(fogCols - 1, Math.ceil(viewRight / TILE) + 1);
    var startY = Math.max(0, Math.floor(viewTop / TILE) - 1);
    var endY = Math.min(fogRows - 1, Math.ceil(viewBottom / TILE) + 1);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (var y = startY; y <= endY; y++) {
      for (var x = startX; x <= endX; x++) {
        var stateValue = fogGrid[y][x];
        if (stateValue === 'visible') continue;

        var alpha = stateValue === 'unexplored' ? 1 : (fogEdgeGrid[y][x] ? 0.7 : 0.5);
        var sx = Math.floor((x * TILE - camera.x) * camera.zoom);
        var sy = Math.floor((y * TILE - camera.y) * camera.zoom);
        var size = Math.ceil(TILE * camera.zoom);

        ctx.fillStyle = 'rgba(0, 0, 0, ' + alpha + ')';
        ctx.fillRect(sx, sy, size, size);
      }
    }

    ctx.restore();
  }

  function redrawFriendlyEntities(state) {
    if (!fogEnabled || !state || !window.RTS || !window.RTS.ctx || !window.RTS.canvas) return;
    if (!window.RTS.Art || !originalDrawUnit) return;

    var ctx = window.RTS.ctx;
    var dpr = window.RTS.Render && window.RTS.Render.dpr ? window.RTS.Render.dpr : 1;
    var camera = state.camera || { x: 0, y: 0, zoom: 1 };
    var entities = state.entities || {};
    var buildings = entities.buildings || [];
    var units = entities.units || [];

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(-camera.x * camera.zoom, -camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);

    buildings.forEach(function (building) {
      if (!building || building.dead || building.team !== window.RTS.TEAM.PLAYER) return;
      window.RTS.Art.drawBuilding(ctx, building, window.RTS.Factions[building.faction], state);
    });

    units.forEach(function (unit) {
      if (!unit || unit.dead || unit.team !== window.RTS.TEAM.PLAYER) return;
      originalDrawUnit.call(window.RTS.Art, ctx, unit, window.RTS.Factions[unit.faction], state);
    });

    ctx.restore();
  }

  function patchArtVisibility() {
    if (!window.RTS || !window.RTS.Art || !window.RTS.Art.drawUnit || originalDrawUnit) return false;

    originalDrawUnit = window.RTS.Art.drawUnit;
    window.RTS.Art.drawUnit = function (ctx, unit, faction, state) {
      if (
        fogEnabled &&
        fogGrid &&
        unit &&
        unit.team !== window.RTS.TEAM.PLAYER &&
        !isWorldVisible(unit.x, unit.y)
      ) {
        return;
      }

      originalDrawUnit.call(window.RTS.Art, ctx, unit, faction, state);
    };

    return true;
  }

  function patchRenderer() {
    if (patched || !window.RTS || !window.RTS.Render || !window.RTS.Render.frame) return false;
    if (!patchArtVisibility()) return false;

    var originalFrame = window.RTS.Render.frame;

    window.RTS.Render.frame = function (state) {
      if (fogEnabled) updateVision(state);
      originalFrame.call(window.RTS.Render, state);
      updateButtonVisibility(state);
      drawFog(state);
      redrawFriendlyEntities(state);
    };

    patched = true;
    ensureButton();
    return true;
  }

  function waitForRenderer() {
    if (patchRenderer()) return;
    window.setTimeout(waitForRenderer, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForRenderer);
  } else {
    waitForRenderer();
  }
})();
