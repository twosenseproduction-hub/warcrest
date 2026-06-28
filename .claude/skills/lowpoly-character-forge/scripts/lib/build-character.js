/* lowpoly-character-forge — build-character.js
 * Composes parts + materials into a posed chibi character. buildElf(params)
 * targets the reference (violet skin, navy/gold cloth, green leaf motif,
 * glowing blade, pointed ears, raised-weapon action stance). Every value is a
 * named param so the critique loop can converge by adjusting one knob at a time.
 * window.LPF.buildCharacter / window.LPF.buildElf. */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};
  var P = LPF.parts;

  var DEFAULTS = {
    palette: { skin: 0x8a5cd0, cloth: 0x26314f, accent: 0xf2c14e, leaf: 0x4fae6b, blade: 0x40ffa0, hair: 0xf2c14e },
    headScale: 1.15, earLen: 0.7, torsoH: 1.3, limbLen: 0.9, outline: 0.03,
    bladeLen: 1.5, stance: 0.5,
  };

  LPF.buildElf = function (params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    var pal = Object.assign({}, DEFAULTS.palette, (params && params.palette) || {});
    var skin = LPF.toon(pal.skin, { ramp: LPF.RAMP.skin });
    var cloth = LPF.toon(pal.cloth, { ramp: LPF.RAMP.cloth });
    var accent = LPF.toon(pal.accent, { ramp: LPF.RAMP.metal });
    var leaf = LPF.toon(pal.leaf, { ramp: LPF.RAMP.cloth });
    var blade = LPF.toon(pal.blade, { ramp: LPF.RAMP.metal, emissive: pal.blade, emissiveIntensity: 2.2, rim: false });

    var root3 = new THREE.Group();

    // legs
    [-1, 1].forEach(function (s) {
      var leg = new THREE.Mesh(LPF.smooth(P.limbGeo(0.17, p.limbLen)), cloth);
      leg.position.set(0.18 * s, p.limbLen * 0.5, 0); root3.add(leg);
    });
    // torso (tapered)
    var torso = new THREE.Mesh(LPF.smooth(P.torsoGeo(0.42, 0.6, p.torsoH)), cloth);
    torso.position.y = p.limbLen + p.torsoH * 0.5; root3.add(torso);
    // gold sash accent
    var sash = new THREE.Mesh(LPF.smooth(P.torsoGeo(0.5, 0.5, 0.16)), accent);
    sash.position.y = p.limbLen + p.torsoH * 0.45; root3.add(sash);

    var shoulderY = p.limbLen + p.torsoH;
    // head
    var head = new THREE.Mesh(LPF.smooth(P.headGeo(0.5 * p.headScale, 0.18)), skin);
    head.position.y = shoulderY + 0.5 * p.headScale; root3.add(head);
    // hair topknot
    var knot = new THREE.Mesh(LPF.smooth(P.headGeo(0.22, 0.1)), LPF.toon(pal.hair, { ramp: LPF.RAMP.cloth }));
    knot.position.y = head.position.y + 0.45 * p.headScale; root3.add(knot);
    // pointed ears (mirrored extruded shapes)
    [-1, 1].forEach(function (s) {
      var ear = new THREE.Mesh(LPF.smooth(P.extrude(P.pointedShape(p.earLen, 0.16), 0.08)), skin);
      ear.position.set(0.42 * p.headScale * s, head.position.y + 0.05, -0.05);
      ear.rotation.z = -s * 0.9; ear.rotation.y = s * 0.3; root3.add(ear);
    });

    // arms (right raised into an action stance)
    var armL = new THREE.Mesh(LPF.smooth(P.limbGeo(0.13, p.limbLen * 0.9)), skin);
    armL.position.set(-0.5, shoulderY - 0.3, 0); armL.rotation.z = 0.3; root3.add(armL);
    var armR = P.joint(0.5, shoulderY - 0.1, 0);
    var armRm = new THREE.Mesh(LPF.smooth(P.limbGeo(0.13, p.limbLen * 0.9)), skin);
    armRm.position.y = -p.limbLen * 0.45; armR.add(armRm);
    armR.rotation.z = -1.1 * p.stance - 0.4; root3.add(armR);

    // glowing curved blade in the raised hand
    var sword = new THREE.Mesh(LPF.smooth(P.bladeGeo(p.bladeLen, 0.22)), blade);
    sword.position.y = -p.limbLen * 0.95; sword.rotation.z = -0.3; armR.add(sword);
    // hilt
    var hilt = new THREE.Mesh(LPF.smooth(P.limbGeo(0.05, 0.3)), accent);
    hilt.position.y = -p.limbLen * 0.95 + 0.1; armR.add(hilt);

    // leaf motif on the chest
    var chestLeaf = new THREE.Mesh(LPF.smooth(P.extrude(P.pointedShape(0.4, 0.18), 0.06)), leaf);
    chestLeaf.position.set(0, p.limbLen + p.torsoH * 0.7, 0.42); root3.add(chestLeaf);

    root3.userData.emissiveMeshes = [sword];   // for selective bloom in the harness
    if (p.outline) LPF.outlineGroup(root3, p.outline, 0x161020);

    // center on origin, feet at y=0
    var box = new THREE.Box3().setFromObject(root3); var c = new THREE.Vector3(); box.getCenter(c);
    root3.position.x -= c.x; root3.position.z -= c.z; root3.position.y -= box.min.y;
    root3.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return root3;
  };

  // registry so the harness can build by name (?build=elf)
  LPF.buildCharacter = function (name, params) {
    if (name === 'elf' || !name) return LPF.buildElf(params);
    return LPF.buildElf(params);
  };
})(typeof window !== 'undefined' ? window : globalThis);
