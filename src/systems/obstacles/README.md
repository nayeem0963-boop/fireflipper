# Obstacles system

- `patterns.js`: section builders (gate, single column, floating rocks, rock formation,
  narrow passage, swinging gate, geyser). Each returns its safe corridor and the range the
  bird may exit at.
- `spawner.js`: places sections ahead of the bird, scales difficulty with distance (with
  late-game escalation past ~1,640 m), inserts breathers (orb arcs, no hazards) between runs
  of hazards, and constrains every corridor to be reachable from the previous one.
- `dynamics.js`: motion of moving obstacles as pure functions of run time (swinging gate
  edges, geyser cycle), so every replay sees the same hazards.
- `ObjectPool.js`: recycles obstacle and orb records, so generation never allocates
  per frame.

Rendering lives in `src/components/scene/ObstacleField.jsx` (InstancedMesh per shape);
collision lives in `src/systems/physics/collision.js`. Fairness is verified headlessly
by `npm run test:sim`.
