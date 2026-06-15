(function () {
  'use strict';

  var TILE = 64;
  var DEFAULT_VISION_RADIUS = 6;
  var fogEnabled = true;
  var fogGrid = null;
  var fogCols = 0;
  var fogRows = 0;
  var patched = false;
  var toggleButton = null;

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

    for (var y = 0; y < rows; y++) {
      fogGrid[y] = [];
      for (var x = 0; x < cols; x++) {
        fogGrid[y][x] = 'unexplored';
      }
    }
  }

  function updateVision(state) {
    ensureFogGrid(state);

    for (var y = 0; y < fogRows; y++) {
      for (var x = 0; x < fogCols; x++) {
        if (fogGrid[y][x] === 'visible') fogGrid[y][x] = 'explored';
      }
    }

    var units = state && state.entities ? state.entities.units : [];

    units.forEach(function (unit) {
      if (!unit || unit.dead || unit.team !== window.RTS.TEAM.PLAYER) return;

      var tileX = Math.round(unit.x / TILE);
      var tileY = Math.round(unit.y / TILE);
      var radius = unit.role === 'archer' || unit.role === 'monk' ? DEFAULT_VISION_RADIUS + 1 : DEFAULT_VISION_RADIUS;
      var minX = Math.max(0, tileX - radius);
      var maxX = Math.min(fogCols - 1, tileX + radius);
      var minY = Math.max(0, tileY - radius);
      var maxY = Math.min(fogRows - 1, tileY + radius);

      for (var y = minY; y <= maxY; y++) {
        for (var x = minX; x <= maxX; x++) {
          var dx = x - tileX;
          var dy = y - tileY;

          if (Math.sqrt(dx * dx + dy * dy) <= radius) {
            fogGrid[y][x] = 'visible';
          }
        }
      }
    });
  }

  function drawFog(state) {
    if (!fogEnabled || !state || !window.RTS || !window.RTS.ctx || !window.RTS.canvas) return;

    updateVision(state);

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

        var alpha = stateValue === 'unexplored' ? 1 : 0.6;
        var sx = Math.floor((x * TILE - camera.x) * camera.zoom);
        var sy = Math.floor((y * TILE - camera.y) * camera.zoom);
        var size = Math.ceil(TILE * camera.zoom);

        ctx.fillStyle = 'rgba(0, 0, 0, ' + alpha + ')';
        ctx.fillRect(sx, sy, size, size);
      }
    }

    ctx.restore();
  }

  function patchRenderer() {
    if (patched || !window.RTS || !window.RTS.Render || !window.RTS.Render.frame) return false;

    var originalFrame = window.RTS.Render.frame;

    window.RTS.Render.frame = function (state) {
      originalFrame.call(window.RTS.Render, state);
      updateButtonVisibility(state);
      drawFog(state);
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
