/* ============================================================================
 * Warcrest — puny-art.js
 * Draws per-faction building sprites generated from the CC0 Puny World tileset
 * (assets/buildings/<faction>_<type>.png). Hooked from art.js drawBuilding so
 * built structures render the Puny re-skins (Human stone/blue, Elf wood/green,
 * Orc bone/red). Toggle with RTS.PunyArt.enabled.
 * See docs/ART_PIPELINE.md.
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var DIR = 'assets/buildings/';
  var cache = {};

  function imgFor(b) {
    var key = (b.faction || 'aurex') + '_' + b.type;
    var c = cache[key];
    if (c === undefined) { c = new Image(); c.src = DIR + key + '.png'; cache[key] = c; }
    return (c && c.complete && c.naturalWidth) ? c : null;
  }

  RTS.PunyArt = {
    // Opt-in while the Puny art direction is still being evaluated. Flip to true
    // (or set RTS.PunyArt.enabled = true in the console) to preview faction
    // buildings rendered from the Puny World re-skins.
    enabled: false,
    // Returns true if it drew the building (caller then skips its own art).
    draw: function (ctx, b, s) {
      if (!this.enabled || b.dead || !b.built) return false;   // construction uses default art
      var im = imgFor(b);
      if (!im) return false;

      var drawW = b.w * 0.98;
      var drawH = drawW * im.naturalHeight / im.naturalWidth;
      var footY = b.y + b.h * 0.42;                            // sprite base sits on the footprint
      var dx = Math.round(b.x - drawW / 2);
      var dy = Math.round(footY - drawH);

      if (RTS.Art && RTS.Art.drawShadow) {
        RTS.Art.drawShadow(ctx, b.x, footY, Math.max(b.w, b.h) * 0.45, 0.32);
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, dx, dy, Math.round(drawW), Math.round(drawH));
      ctx.restore();
      return true;
    },
  };
})(window.RTS = window.RTS || {});
