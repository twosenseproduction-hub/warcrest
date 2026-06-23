import { WorldCanvasLayer } from '../phaser/WorldCanvasLayer.js?v=20260620h';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this._tilemap = null;
    this._tilemapLayers = null;
    this._activeTerrainKey = null;
    this._worldLayer = null;
  }

  create() {
    RTS.canvas = this.sys.game.canvas;
    RTS.ctx    = this.sys.game.context;
    RTS._phaserRenderActive = true;

    RTS.Game.boot();

    RTS._rebuildPhaserTerrain = (mapId, force) => this._rebuildTerrain(mapId, force);
    RTS._syncPhaserAfterResize = () => this._syncPhaserScale();

    this.cameras.main.setOrigin(0, 0);

    // Entity overlay: canvas texture composited above tilemap (postrender on CANVAS +
    // Scale.NONE is unreliable — refresh is driven from the rAF sim loop in game.js).
    this._worldLayer = new WorldCanvasLayer(this);
  }

  _phaserKeyForMap(mapId) {
    if (mapId === 'turtle_cove') return 'turtle_cove';
    if (mapId === 'sapphire_shores') return 'sapphire';
    if (mapId === 'runic_clearing') return 'runic_clearing';
    if (mapId === 'fairy_clearing') return 'fairy_clearing';
    return null;
  }

  _syncPhaserScale() {
    const cv = this.sys.game.canvas;
    if (!this._tilemapLayers || cv.clientWidth < 8 || cv.clientHeight < 8) return;
    if (this.scale.width !== cv.width || this.scale.height !== cv.height) {
      this.scale.resize(cv.width, cv.height);
      this.cameras.main.setSize(cv.width, cv.height);
      cv.style.width  = cv.clientWidth + 'px';
      cv.style.height = cv.clientHeight + 'px';
    }
  }

  _rebuildTerrain(mapId, force) {
    const key = this._phaserKeyForMap(mapId);
    if (!force && key === this._activeTerrainKey) return;
    this._activeTerrainKey = key;

    if (this._tilemapLayers) {
      Object.keys(this._tilemapLayers).forEach((k) => {
        if (this._tilemapLayers[k]) this._tilemapLayers[k].destroy();
      });
      this._tilemapLayers = null;
    }
    if (this._tilemap) {
      this._tilemap.destroy();
      this._tilemap = null;
    }
    RTS._phaserTerrainActive = false;
    RTS.CurrentMapgen = null;

    if (!key || !this.cache.tilemap.exists(key)) {
      RTS._phaserTerrainActive = false;
      RTS.CurrentMapgen = null;
      return;
    }

    try {
      const tmjEntry = this.cache.tilemap.get(key);
      if (tmjEntry && tmjEntry.data && RTS.parseMapTMJ) {
        const mg = RTS.parseMapTMJ(tmjEntry.data);
        if (mg) {
          RTS.CurrentMapgen = mg;
          if (key === 'sapphire') RTS.SapphireMapgen = mg;
          if (key === 'turtle_cove') RTS.TurtleCoveMapgen = mg;
          console.log('[warcrest] map data loaded from ' + key + '.tmj');
        }
      }
    } catch (e) {
      console.warn('[warcrest] TMJ parse failed for ' + key, e);
    }

    // fairy_clearing uses the 2D canvas overlay for all terrain — skip Phaser tilemap rendering.
    if (key === 'fairy_clearing') {
      RTS._phaserTerrainActive = false;
      // Manually resize Phaser to device pixels (normally done by _syncPhaserScale which
      // needs _tilemapLayers; we skip that but still need the DPR-correct game size so
      // the WorldCanvasLayer image fills the full screen at DPR > 1).
      const cv = this.sys.game.canvas;
      if (cv && cv.clientWidth >= 8) {
        this.scale.resize(cv.width, cv.height);
        this.cameras.main.setSize(cv.width, cv.height);
        cv.style.width  = cv.clientWidth + 'px';
        cv.style.height = cv.clientHeight + 'px';
      }
      this.cameras.main.setBounds(0, 0, RTS.Config.world.w, RTS.Config.world.h);
      return;
    }

    const map = this.make.tilemap({ key });
    this._tilemap = map;
    const tileset = map.addTilesetImage('terrain-grass', 'terrain-grass', 64, 64);
    if (!tileset) return;

    this._tilemapLayers = {
      ground:   map.createLayer('ground',   tileset, 0, 0),
      elevated: map.createLayer('elevated', tileset, 0, 0),
      cliffs:   map.createLayer('cliffs',   tileset, 0, 0),
    };
    this._tilemapLayers.ground.setDepth(0);
    this._tilemapLayers.elevated.setDepth(1);
    this._tilemapLayers.cliffs.setDepth(2);
    RTS._phaserTerrainActive = true;

    const worldW = map.widthInPixels;
    const worldH = map.heightInPixels;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this._syncPhaserScale();
  }

  _syncPhaserCamera(s) {
    const cam = this.cameras.main;
    const dpr = (RTS.Render && RTS.Render.dpr) || 1;
    cam.scrollX = s.camera.x;
    cam.scrollY = s.camera.y;
    // Canvas entities draw with dpr then zoom; Phaser renders on the device-pixel
    // canvas — zoom must include dpr so terrain matches sprite positions.
    cam.zoom = s.camera.zoom * dpr;
  }

  update(_time, _delta) {
    const s = RTS.Game && RTS.Game.state;

    if (s && s.camera && this._tilemapLayers) {
      this._syncPhaserScale();
      this._syncPhaserCamera(s);
    }
  }

  shutdown() {
    if (this._worldLayer) {
      this._worldLayer.destroy();
      this._worldLayer = null;
    }
    RTS._phaserRenderActive = false;
    RTS._phaserTerrainActive = false;
    RTS._rebuildPhaserTerrain = null;
    RTS._syncPhaserAfterResize = null;
    RTS._phaserWorldLayer = null;
  }
}
