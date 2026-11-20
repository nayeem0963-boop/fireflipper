import { SRGBColorSpace, TextureLoader } from 'three';

/**
 * Loads a sprite atlas only when it is about to be needed (the hazards and the power-ups are first drawn several hundred metres into a run, so a player who
 * leaves early never downloads them). Looks only: nothing here touches the simulation.
 *
 *  - `request()` starts the download once (a second call, or a call while loading, does nothing: no duplicate request). A failed load is retried twice after a pause;
 *    after that the atlas simply stays absent and the renderer draws nothing from it (it never throws, and nothing is drawn with a missing texture).
 *  - `texture` is null until the image has loaded; the renderer assigns it to its material only then, so a sprite is never drawn blank or half-loaded.
 *  - `dispose()` cancels a pending load or retry and frees the texture.
 */
/** How many metres before an atlas's first possible appearance its download starts (10 to 25 s of flight at the game's speeds). */
export const ATLAS_LEAD = 150;
const RETRY_MS = [1500, 4000];

export function createLazyAtlas(url, onLoad) {
  let state = 'idle'; // idle -> loading -> loaded | failed
  let attempt = 0;
  let timer = 0;
  let alive = true;
  const atlas = {
    texture: null,
    get state() {
      return state;
    },
    request() {
      if (state !== 'idle' || !alive) return;
      state = 'loading';
      const start = () => {
        timer = 0;
        new TextureLoader().load(
          url,
          (tex) => {
            if (!alive) return tex.dispose();
            tex.colorSpace = SRGBColorSpace;
            atlas.texture = tex;
            state = 'loaded';
            onLoad(tex);
          },
          undefined,
          () => {
            if (!alive) return;
            if (attempt < RETRY_MS.length) timer = setTimeout(start, RETRY_MS[attempt++]);
            else state = 'failed';
          },
        );
      };
      start();
    },
    dispose() {
      alive = false;
      if (timer) clearTimeout(timer);
      atlas.texture?.dispose();
      atlas.texture = null;
    },
  };
  return atlas;
}
