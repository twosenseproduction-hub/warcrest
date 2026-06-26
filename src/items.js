/* ============================================================================
 * Warcrest — items.js
 * Equippable hero items sold at the Merchant. Each item carries passive
 * attributes that fold into the hero's effective stats. Heroes equip up to
 * RTS.Items.MAX_SLOTS. (Shop UI + equip flow wired separately.)
 *
 * Attribute keys (added on top of the hero's base stats):
 *   dmg     flat attack damage
 *   armor   flat armor (0..1 damage reduction scale)
 *   maxHp   flat max-HP
 *   regen   flat HP regenerated per second
 *   speed   flat move speed
 *   range   flat attack range (px)
 *   atkSpeed  attack-speed bonus (fraction; 0.2 = +20% faster)
 * ==========================================================================*/
(function (RTS) {
  'use strict';
  var DIR = 'assets/items/';

  function item(id, name, slot, cost, attrs, desc) {
    return { id: id, name: name, slot: slot, cost: cost, attrs: attrs, desc: desc,
             icon: DIR + id + '.png' };
  }

  RTS.Items = {
    MAX_SLOTS: 4,                     // heroes may equip up to 4 items

    // ── Weapons (damage) ──────────────────────────────────────────────────
    iron_sword:     item('iron_sword',     'Iron Sword',     'weapon', 120, { dmg: 6 },
                         '+6 attack damage.'),
    mithril_edge:   item('mithril_edge',   'Mithril Edge',   'weapon', 320, { dmg: 8, atkSpeed: 0.20 },
                         '+8 damage and +20% attack speed.'),
    verdant_glaive: item('verdant_glaive', 'Verdant Glaive', 'weapon', 300, { dmg: 10, range: 40 },
                         '+10 damage and +40 attack range.'),
    gilded_saber:   item('gilded_saber',   'Gilded Saber',   'weapon', 380, { dmg: 16 },
                         '+16 attack damage.'),

    // ── Armour (survivability) ────────────────────────────────────────────
    leather_vest:   item('leather_vest',   'Leather Vest',   'armor', 110, { armor: 0.10 },
                         '+10% damage reduction.'),
    steel_plate:    item('steel_plate',    'Steel Plate',    'armor', 260, { armor: 0.22 },
                         '+22% damage reduction.'),
    living_mail:    item('living_mail',    'Living Mail',    'armor', 300, { armor: 0.12, regen: 5 },
                         '+12% reduction and regenerates 5 HP/s.'),
    gilded_plate:   item('gilded_plate',   'Gilded Plate',   'armor', 360, { armor: 0.18, maxHp: 70 },
                         '+18% reduction and +70 max HP.'),
  };

  // Stable shop order.
  RTS.ItemShopOrder = [
    'iron_sword', 'mithril_edge', 'verdant_glaive', 'gilded_saber',
    'leather_vest', 'steel_plate', 'living_mail', 'gilded_plate',
  ];

  RTS.getItem = function (id) { return RTS.Items[id] || null; };

  // Sum the attribute bonuses from a hero's equipped item ids.
  RTS.itemBonuses = function (ids) {
    var b = { dmg: 0, armor: 0, maxHp: 0, regen: 0, speed: 0, range: 0, atkSpeed: 0 };
    (ids || []).forEach(function (id) {
      var it = RTS.Items[id];
      if (!it) return;
      Object.keys(it.attrs).forEach(function (k) { b[k] = (b[k] || 0) + it.attrs[k]; });
    });
    return b;
  };
})(window.RTS = window.RTS || {});
