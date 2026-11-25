import { lazy } from 'react';
import { validateSchema } from '../params.js';
import ribbonKnot from './ribbonKnot.js';
import crystalStudy from './crystalStudy.js';
import lightOrbit from './lightOrbit.js';
import vortexCore from './vortexCore.js';
import fractalLattice from './fractalLattice.js';
import quantumPrism from './quantumPrism.js';
import starlightCanopy from './starlightCanopy.js';
import cyberHelix from './cyberHelix.js';
import lotus from './lotus.js';
import monolithGrid from './monolithGrid.js';
import plasmaSphere from './plasmaSphere.js';
import neuralLandscape from './neuralLandscape.js';
import particleDancer from './particleDancer.js';
import solarSystem from './solarSystem.js';

/**
 * The Art Lab's exhibition: every art piece, in the order the HUD lists them.
 *
 * A piece is two files in this folder: a definition (`name.js`, pure data: id, title, blurb, `params` schema, optional
 * camera/lighting hints) and a component (`Name.jsx`, the scene content). To add one, write both and add one line below:
 *
 *   piece(myPiece, () => import('./MyPiece.jsx')),
 *
 * The component is loaded on demand (its own chunk), and the definition is plain JS so tests can check it without a browser.
 */
const piece = (definition, load) => Object.freeze({ ...definition, Component: lazy(load) });

export const PIECES = Object.freeze([
  piece(ribbonKnot, () => import('./RibbonKnot.jsx')),
  piece(crystalStudy, () => import('./CrystalStudy.jsx')),
  piece(lightOrbit, () => import('./LightOrbit.jsx')),
  piece(vortexCore, () => import('./VortexCore.jsx')),
  piece(fractalLattice, () => import('./FractalLattice.jsx')),
  piece(quantumPrism, () => import('./QuantumPrism.jsx')),
  piece(starlightCanopy, () => import('./StarlightCanopy.jsx')),
  piece(cyberHelix, () => import('./CyberHelix.jsx')),
  piece(lotus, () => import('./Lotus.jsx')),
  piece(monolithGrid, () => import('./MonolithGrid.jsx')),
  piece(plasmaSphere, () => import('./PlasmaSphere.jsx')),
  piece(neuralLandscape, () => import('./NeuralLandscape.jsx')),
  piece(particleDancer, () => import('./ParticleDancer.jsx')),
  piece(solarSystem, () => import('./SolarSystem.jsx')),
]);

export function getPiece(id) {
  return PIECES.find((p) => p.id === id) ?? PIECES[0];
}

// Development guard: a malformed parameter schema is reported when the page loads, not when someone drags a slider.
if (import.meta.env?.DEV) {
  for (const p of PIECES) {
    const problems = validateSchema(p.params);
    if (problems.length) console.warn(`[Art Lab] piece "${p.id}" has a bad params schema:\n  ${problems.join('\n  ')}`);
  }
}
