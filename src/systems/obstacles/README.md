# Obstacles system

Not implemented in the initial setup pass. Planned shape:

- `ObjectPool.js`: generic pool (implemented) used to recycle obstacle instances.
- `spawner.js`: decides when/where to spawn based on `runtime.distance`.
- `collision.js`: pure bounds tests against the bird, no React.
- Rendering lives in `src/components/scene/`, reading pooled data each frame
  (ideally via `InstancedMesh` to keep draw calls low).
