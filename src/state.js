/* ============================================================================
 * EXOFRONT — state.js
 * Single central game-state object + small accessors. No scattered globals.
 * ==========================================================================*/
(function (RTS) {
  'use strict';

  var idCounter = 1;
  RTS.nextId = function () { return 'e' + (idCounter++); };
  RTS.resetIds = function () { idCounter = 1; };

  // The one state object. Everything mutable about a match lives here.
  RTS.createState = function () {
    return {
      // scene flow: boot | menu | factionselect | settings | playing | paused | won | lost
      scene: 'menu',
      // input modes within play: select | place-building | attack-target
      inputMode: 'select',
      pending: { building: null },     // building type queued for placement
      attackMoveArmed: false,
      boxSelectArmed: false,

      playerFaction: 'aurex',
      enemyFaction: 'cinder',
      mapId: 'sapphire_shores',

      camera: { x: 0, y: 0, zoom: RTS.Config.camera.default, vx: 0, vy: 0,
                dragging: false, dragStart: null },

      // resources keyed by team
      res: {
        player: { halcite: RTS.Config.startResources, supplyUsed: 0, supplyCap: RTS.Config.startSupplyCap },
        enemy:  { halcite: RTS.Config.ai.startResources, supplyUsed: 0, supplyCap: RTS.Config.startSupplyCap },
      },

      entities: {
        units: [],
        buildings: [],
        resources: [],
        projectiles: [],
        effects: [],
      },

      selectedIds: [],
      selectionBox: null,            // {x1,y1,x2,y2} world coords while dragging

      timers: {
        gameTime: 0,
        nextWave: RTS.Config.ai.firstWaveAt,
        waveNumber: 0,
        aiThink: 0,
      },

      ui: {
        eventLog: [],
        pointer: null,
        longPressTimer: null,
        longPressAnchor: null,
        lastUiAt: 0,
        baseAlarm: 0,                // >0 = base under attack pulse
        toast: null,
        buildingMenuHover: null,
        buildPanelOpen: false,
        macroGroups: null,         // { role: [unitId, …] } while macro bar is active
        macroRole: null,           // active subgroup role, or null = full mixed pool
        selectionFilter: 'all',    // mirrors macroRole: 'all' | role name
      },

      settings: {
        audio: true,
        sfxVolume: 0.5,
        showHealthAlways: false,
        edgePan: false,
      },

      stats: { unitsBuilt: 0, unitsLost: 0, kills: 0, harvested: 0 },

      screenShake: 0,
      screenFlash: 0,
      flashColor: '#ff5555',
      _running: false,
    };
  };

  // Convenience getters operating on a state -------------------------------
  RTS.getById = function (s, id) {
    var e = s.entities;
    for (var i = 0; i < e.units.length; i++) if (e.units[i].id === id) return e.units[i];
    for (var j = 0; j < e.buildings.length; j++) if (e.buildings[j].id === id) return e.buildings[j];
    for (var k = 0; k < e.resources.length; k++) if (e.resources[k].id === id) return e.resources[k];
    return null;
  };

  RTS.playerCore = function (s) {
    return s.entities.buildings.find(function (b) {
      return b.team === RTS.TEAM.PLAYER && (b.type === 'core' || b.type === 'outpost') && !b.dead;
    });
  };
  RTS.playerHQs = function (s) {
    return s.entities.buildings.filter(function (b) {
      return b.team === RTS.TEAM.PLAYER && (b.type === 'core' || b.type === 'outpost') && !b.dead;
    });
  };
  RTS.enemyCore = function (s) {
    return s.entities.buildings.find(function (b) {
      return b.team === RTS.TEAM.ENEMY && (b.type === 'core' || b.type === 'outpost') && !b.dead;
    });
  };

  RTS.deposits = function (s, team) {
    return s.entities.buildings.filter(function (b) {
      return b.team === team && RTS.isDepositBuilding && RTS.isDepositBuilding(b);
    });
  };

  RTS.buildingIsAttackable = function (b) {
    if (!b || b.dead || b.hp <= 0) return false;
    /* Real structure only — not a fresh scaffold waiting for a builder. */
    return b.built || b.progress > 0;
  };

  RTS.buildingIsTappable = function (b) {
    if (!b || b.dead) return false;
    if (b.built || b.progress > 0) return true;
    /* Player can tap an unstarted site to cancel construction. */
    return b.team === RTS.TEAM.PLAYER && !b.built;
  };

  RTS.canBeAttacked = function (e) {
    if (!e || e.dead) return false;
    if (e.kind === 'unit') return true;
    if (e.kind === 'building') return RTS.buildingIsAttackable(e);
    return false;
  };

  RTS.recalcSupply = function (s, team) {
    var used = 0;
    s.entities.units.forEach(function (u) {
      if (u.team === team && !u.dead) used += (RTS.Units[u.role].supply || 1);
    });
    var cap = RTS.Config.startSupplyCap;
    var lc = RTS.Config.livestock;
    s.entities.buildings.forEach(function (b) {
      if (b.team !== team || b.dead || !b.built) return;
      var bspec = RTS.Buildings[b.type];
      if (!bspec) return;
      if (bspec.supply) cap += bspec.supply;
      if (bspec.isPasture && b.livestock && lc) {
        var live = b.livestock.filter(function (a) { return !a.dead; }).length;
        cap += live * lc.supplyPerAnimal;
      }
    });
    cap = Math.min(cap, RTS.Config.maxSupplyCap);
    s.res[team].supplyUsed = used;
    s.res[team].supplyCap = cap;
  };

  // Event log (short messages) ----------------------------------------------
  RTS.log = function (s, msg, tone) {
    s.ui.eventLog.unshift({ text: msg, tone: tone || 'info', at: s.timers.gameTime });
    if (s.ui.eventLog.length > 6) s.ui.eventLog.pop();
    if (RTS.HUD && RTS.HUD.renderLog) RTS.HUD.renderLog(s);
  };

  RTS.toast = function (s, msg) {
    s.ui.toast = { text: msg, t: 2.4 };
  };

})(window.RTS = window.RTS || {});
