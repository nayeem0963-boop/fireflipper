/**
 * Minimal generic object pool. Obstacles, pickups and particles will be
 * recycled through pools so gameplay never allocates per frame (avoiding
 * GC hitches on mobile).
 *
 * @template T
 */
export class ObjectPool {
  /**
   * @param {() => T} create   factory for new items
   * @param {(item: T) => void} [reset] called when an item is released
   * @param {number} [initialSize]
   */
  constructor(create, reset = () => {}, initialSize = 0) {
    this._create = create;
    this._reset = reset;
    this._free = [];
    this.active = new Set();
    for (let i = 0; i < initialSize; i++) this._free.push(create());
  }

  /** @returns {T} */
  acquire() {
    const item = this._free.pop() ?? this._create();
    this.active.add(item);
    return item;
  }

  /** @param {T} item */
  release(item) {
    if (!this.active.delete(item)) return;
    this._reset(item);
    this._free.push(item);
  }

  releaseAll() {
    for (const item of this.active) {
      this._reset(item);
      this._free.push(item);
    }
    this.active.clear();
  }

  get size() {
    return this.active.size + this._free.length;
  }
}
