# Installed AI checkpoint

The local production run uses `ai-service/models/road_damage_yolo.pt`, a
YOLO11s road-damage checkpoint from
[Katekar3/road-damage-yolo](https://github.com/Katekar3/road-damage-yolo).
The upstream project identifies its repository and weights as AGPL-3.0 and
reports the following held-out results:

* India test split pothole AP50: 0.453 for the India-only model and 0.413 for
  the default India + Kent model.
* At confidence 0.35 on the India test split, the India + Kent model reports
  about 0.37 recall and 0.59 precision for potholes.

The checkpoint's class order is `longitudinal_crack`, `transverse_crack`,
`alligator_crack`, `pothole`. The AI class catalogue and UI filters use those
names. It is trained on public RDD2022 India data plus the Kent pothole set;
the upstream author documents dataset sources, attribution, and limitations
in the linked repository.

Downloaded release: `v1.0`, `best.pt` (19,179,290 bytes). SHA-256:

```text
6a9352f0610bd1ef521942b834cf4824f3391925ab0e3d2cb0bd1a2c2b8d634d
```

The upstream evaluation is a baseline, not evidence of fitness for an
operational road-safety decision system. It reports roughly six in ten
pothole detections missed at the chosen threshold, and the repository says it
has not been field-tested on Indian roads. Review findings manually and
validate on representative local images before operational use. Severity
scores in this application remain heuristic estimates.
