# Reference image for owned match pipeline

Save the figurine T-pose PNG as:
`exports/blender-rig-test/refs/violet_cape_warrior_REF.png`

Then light-scan:
```
python3 .claude/skills/blender-reference-character/scripts/light_scan_reference.py \
  --image exports/blender-rig-test/refs/violet_cape_warrior_REF.png \
  --out exports/blender-rig-test/light-scan/violet_cape_warrior
```

Chat attachments do not persist on disk for the agent — commit the file into the repo.
