# Meshy AI models

## Purple Elf — matching the reference

### What drifts (and how to fix it)

| Gap | Cause | Fix |
|-----|-------|-----|
| Chrome / plastic shine | PBR metalness + normals + studio preview lights | `enable_pbr: false`, strip normals, roughness=1 (`matte_glb.py` / post) |
| Paint / filigree mismatch | Meshy invents texture when enhanced | `image_enhancement: false` + `texture_image_url` = reference |
| Soft / rounded forms | Smart Topology / high-poly remesh | Remesh ~8–12k tris, or `model_type: lowpoly` |
| Silhouette / side drift | Single front image only | Add side + back refs (Multi-Image to 3D) |
| Exact game look | Image-to-3D always approximates | Rebuild in lowpoly-character-forge, or retopo in Blender |

### Current ship (`purple_elf_meshy.glb`)

**Fidelity regen** (Meshy-6): no image enhancement, texture from reference, no PBR, remesh 12k, then normals stripped for a painted read.

| File | Description |
|------|-------------|
| `purple_elf_ref.jpg` | Source T-pose reference |
| `purple_elf_meshy.glb` | Best current match (matte / flat) |
| `purple_elf_meshy_fidelity_raw.glb` | Pre-normal-strip fidelity export |
| `purple_elf_meshy_v1_smarttopo.glb` | First smart-topology attempt |
| `purple_elf_meshy_pbr.glb` | Early shiny PBR backup |
| `purple_elf_meshy_view_*.png` | Meshy preview views |

**Regen (closest Meshy settings):**
```bash
MESHY_API_KEY=… python3 tools/.meshy-work/generate_purple_elf_fidelity.py
```

**Next step for even closer:** supply side + back images → Multi-Image to 3D, or rebuild procedurally.

## Elven Archer (text-to-3D experiment)

`elven_archer_meshy.glb` — earlier prompt-only attempt; less faithful than image-to-3D.
