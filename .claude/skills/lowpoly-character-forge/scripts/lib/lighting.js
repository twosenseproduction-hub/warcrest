/* lowpoly-character-forge — lighting.js
 * Three-point + hemisphere fill rig that flatters stylized low-poly: warm key,
 * cool rim to pop the silhouette, soft sky/ground hemisphere fill. Toon
 * materials respond to these and cast/receive shadows. window.LPF.lighting. */
(function (root) {
  var THREE = root.THREE;
  var LPF = root.LPF = root.LPF || {};
  LPF.lighting = {
    rig: function (scene, renderer) {
      // Tuned for MeshToonMaterial: keep lit diffuse well under 1.0 so only the
      // emissive blade exceeds the bloom threshold (a hot key blows out to white).
      var key = new THREE.DirectionalLight(0xfff2dd, 1.15); key.position.set(5, 8, 4);
      key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005;
      var c = key.shadow.camera; c.near = 0.5; c.far = 40; c.left = -8; c.right = 8; c.top = 8; c.bottom = -8;
      var fill = new THREE.HemisphereLight(0xbcd3ff, 0x3a2d4a, 0.28);
      var rim = new THREE.DirectionalLight(0x9ad8ff, 0.45); rim.position.set(-4, 3, -5);
      var amb = new THREE.AmbientLight(0xffffff, 0.12);
      scene.add(key, fill, rim, amb);
      if (renderer) {
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
        if (THREE.sRGBEncoding && 'outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
      }
      return { key: key, fill: fill, rim: rim, amb: amb };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
