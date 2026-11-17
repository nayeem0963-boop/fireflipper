/**
 * Version of the gameplay rules: physics, track generation, obstacle behaviour, power-ups and scoring.
 *
 * Scores are verified by replaying a run's inputs on the server, and a replay only reproduces the same
 * run on the same rules. BUMP THIS whenever a change could alter what a given seed and input log
 * produce (constants.js, spawner/patterns, createGameSim, flight, collision, scoring). Pure visuals,
 * audio and UI do not need a bump.
 *
 * Effects of a bump: leaderboard boards are keyed by version (so scores from different rules never mix),
 * the server rejects submissions from an out-of-date page (asks the player to reload), and saved ghosts
 * from an older version are discarded.
 */
export const SIM_VERSION = 1;
