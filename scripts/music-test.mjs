/**
 * Background music tests. Run with: npm run test:music
 * The music is procedural Web Audio (no audio files). This runs the real module against a tiny fake AudioContext, so it checks what it
 * schedules and how it starts, fades and stops, and that the hook plays it only while a run is live and sound is on.
 */
import fs from 'node:fs';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  } else console.log(`  ok   ${name}`);
};
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A fake Web Audio context that counts what is made and scheduled.
const made = { osc: 0, started: 0, gains: 0, ramps: [] };
class Param {
  constructor(v = 1) { this.value = v; }
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime(v, t) { made.ramps.push([v, t]); return this; }
  cancelScheduledValues() { return this; }
}
const node = () => ({ connect: (n) => n ?? node(), start() { made.started++; }, stop() {} });
class FakeCtx {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = node(); }
  resume() { return Promise.resolve(); }
  createGain() { made.gains++; return { ...node(), gain: new Param(1) }; }
  createOscillator() { made.osc++; return { ...node(), frequency: new Param(440), type: 'sine' }; }
  createBiquadFilter() { return { ...node(), frequency: new Param(1000), Q: new Param(1), type: 'lowpass' }; }
  createBuffer(_c, len) { return { getChannelData: () => new Float32Array(len) }; }
}

const { getAudio, unlockAudio } = await import('../src/systems/audio/sfx.js');
const { setMusicActive } = await import('../src/systems/audio/music.js');

// Before any user gesture there is no audio graph, and the music must do nothing (and not throw).
check('no audio graph before a user gesture', getAudio() === null);
let threw = false;
try {
  setMusicActive(true);
  setMusicActive(false);
} catch {
  threw = true;
}
check('setMusicActive is a safe no-op until audio is unlocked', !threw && made.osc === 0);

globalThis.window = { AudioContext: FakeCtx };
unlockAudio();
const audio = getAudio();
check('after unlocking, the shared audio graph is available', !!audio && audio.ctx instanceof FakeCtx && !!audio.master);

setMusicActive(true);
check('starting schedules notes ahead of time (arpeggio, bass and pad)', made.osc >= 3 && made.started >= 3, `${made.osc} oscillators`);
const first = made.osc;
setMusicActive(true);
check('starting twice does not double the schedule', made.osc === first);
const fadeIn = made.ramps.at(-1);
check('it fades in to an audible level', fadeIn[0] >= 0.1 && fadeIn[1] > audio.ctx.currentTime);

audio.ctx.currentTime = 2;
await wait(250); // a scheduler tick runs and queues the notes for the new time
check('the look-ahead scheduler keeps queueing notes as time moves on', made.osc > first, `${made.osc} vs ${first}`);

setMusicActive(false);
check('stopping fades out to silence', made.ramps.at(-1)[0] <= 0.0002);
await wait(1100);
const settled = made.osc;
await wait(300);
check('after the fade the scheduler timer stops (no more notes, nothing keeps the page busy)', made.osc === settled);
setMusicActive(true);
check('it can start again afterwards', made.osc > settled);
setMusicActive(false);
await wait(1100);

// Source rules.
const music = read('src/systems/audio/music.js');
check('the music is procedural: no audio files, no network', !/fetch\(|new Audio\(|\.mp3|\.ogg|\.wav|XMLHttpRequest/.test(music));
const hook = read('src/hooks/useGameAudio.js');
check('the hook plays music only while a run is live and sound is on', /s\.soundEnabled && s\.status === STATUS\.RUNNING/.test(hook));
check('it stays quiet in plain Auto play (as the milestone chime does), but plays in the Journey Preview', /\(!s\.demo \|\| s\.preview\)/.test(hook.split('syncMusic')[1] ?? ''));
check('it follows pause (not running) and stops when the game screen goes away', /subscribe\(syncMusic\)/.test(hook) && /unsubscribe\(\)/.test(hook) && /setMusicActive\(false\)/.test(hook));
check('the music does not read or touch the simulation', !/systems\/(game|runner|physics|obstacles)/.test(music));

console.log(failures ? `\n${failures} failed` : '\nmusic tests passed');
process.exit(failures ? 1 : 0);
