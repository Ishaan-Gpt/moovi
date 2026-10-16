/**
 * Moovi's camera layer: every move as a keyword an AI director can call, one deterministic implementation per move for
 * the DOM (CSS 3D), flat 2D runtimes and three.js, and the matching gen-AI video prompt. See README "Camera layer".
 *
 *   const { calls } = parseCamera('dolly zoom in, ramp up');
 *   cameraTrack(calls, t)          // CamState at t seconds
 *   cssCamera(state, 1920)         // DOM: perspective + world transform
 *   applyToThree(threeCam, state)  // three.js
 *   toCamKey(state, frame)         // style-1 / MotionEasy key
 *   promptFor(calls[0])            // the same move for Kling, Runway, Veo, ...
 */
export * from './core';
export * from './moves';
export * from './call';
export * from './parse';
