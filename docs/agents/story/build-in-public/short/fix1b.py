import io
p = io.open('short.html', encoding='utf8').read()
def rep(a, b):
    global p
    assert a in p, a[:90]; p = p.replace(a, b)
rep("l = c.clone().add(V(0, lerp(90, -40, clamp((t - DROP[SPOT.reflex]) / .6, 0, 1)), 0)); }", "l = c.clone().add(V(0, lerp(90, 45, clamp((t - DROP[SPOT.reflex]) / .6, 0, 1)), 0)); }   // he sinks out of frame; the lens stays on the floor")
rep("const toCam = toTro.clone().multiplyScalar(.45).addScaledVector(side, .9).normalize();", "const toCam = toTro.clone().multiplyScalar(.85).addScaledVector(side, .55).normalize();   // in front of him: his face, the holes behind")
rep("opacity: .85, roughness: .6, side: THREE.DoubleSide", "opacity: .95, roughness: .5, emissive: lin('#c9d6e0'), emissiveIntensity: .35, side: THREE.DoubleSide")
rep("const fly = new THREE.Group(); S.add(fly);", "const fly = new THREE.Group(); fly.scale.setScalar(1.6); S.add(fly);   // a black fly on a black head: big pale wings carry it")
io.open('short.html', 'w', encoding='utf8').write(p)
s = io.open('score.mjs', encoding='utf8').read()
def rs(a, b):
    global s
    assert a in s, a[:90]; s = s.replace(a, b)
rs("const DROP = { 9: W(35), 1: W(61), 0: W(102) + .05 }, J0 = W(103) - .1, J1 = W(110) - .2;", "const DROP = { 1: W(35), 0: W(103) }, J0 = W(106) - .1, J1 = W(112) - .6, TURBO_REPLAY = W(64);")
rs("for (let t = 7.4; t < DUR - .3; t += 1) { const seen = (t >= W(19) && t < W(28)) || (t >= W(103) && t < W(109)); add(FX, tick(Math.round(t - 7.4) % 5 === 0), t, seen ? .32 : .12, -.25, FXWET, .2); }",
   "for (let t = 6.3; t < DUR - .3; t += 1) { const seen = (t >= W(19) && t < W(28)) || (t >= W(106) && t < W(112)); add(FX, tick(Math.round(t - 6.3) % 5 === 0), t, seen ? .32 : .12, -.25, FXWET, .2); }")
a = s.index("// Pulse: his heart"); b = s.index("// Reflex: the fly")
s = s[:a] + """// Turbo, live: running feet he cannot stop, until the floor goes (the rule's proof); then the replay (E-F), the same feet and the same drop
for (let t = W(28) - .4, k = 0; t < DROP[1] + .35; t += .19, k++) step(t, .8, k % 2 ? .25 : .1);
drop(DROP[1], 1.1, .2);
add(FX, W1(), W(41) - .08, db(-12), 0, FXWET, .4);   // the replay whoosh on "That was Turbo"
for (let t = W(41), k = 0; t < TURBO_REPLAY + .35; t += .19, k++) step(t, .7, k % 2 ? .25 : .1);
drop(TURBO_REPLAY, .9, .2);
""" + s[b:]
rs("const a = W(87) - .2, b = W(92), x = len(b - a + .1);", "const a = W(90) - .2, b = W(93), x = len(b - a + .1);")
rs("add(FX, W1(), W(95) - .1, db(-8), -.1, FXWET, .3); add(FX, gain(mix(noise(.06, { bp: 1600, q: 1, d: .02 }), gain(sine(220, .05, { a: .001, d: .02 }), .5)), .55), W(95) + .02, 1, -.1, FXWET, .3);",
   "add(FX, W1(), W(98) - .1, db(-8), -.1, FXWET, .3); add(FX, gain(mix(noise(.06, { bp: 1600, q: 1, d: .02 }), gain(sine(220, .05, { a: .001, d: .02 }), .5)), .55), W(98) + .02, 1, -.1, FXWET, .3);")
rs("Object.keys(DROP).map(Number).filter(i => i > 1 && i !== 9).forEach(", "Object.keys(DROP).map(Number).filter(i => i > 1).forEach(")
rs("add(FX, gain(noise(.03, { bp: 2400, q: 3, d: .01 }), .12), W(127), 1, 0, FXWET, .3);", "add(FX, gain(noise(.03, { bp: 2400, q: 3, d: .01 }), .12), W(131), 1, 0, FXWET, .3);")
rs("W(129) + .05, 1, 0, FXWET, .6);", "W(135) + .05, 1, 0, FXWET, .6);")
rs("k = t < W(19) ? .6 : .85 + .3 * (t / J0);", "k = t < W(19) ? .6 : .85 + .3 * (t / J0);")
rs("if (beat % 2 === 1 && t > W(41)) add(MUS, shaker(), t + .01, .4 * k, .4); }", "if (beat % 2 === 1 && t > W(28)) add(MUS, shaker(), t + .01, .4 * k, .4); }")
rs("const p = pad([41, 48, 53, 56], W(109) - J0 + .4,", "const p = pad([41, 48, 53, 56], W(112) - J0 + .4,")
rs("{ const a = W(109) - .2, b = DUR;", "{ const a = W(112) - .2, b = DUR;")
rs("W(123) + k * 1.2, 1, (k % 2) - .5, MUSWET, .6)); }", "W(126) + k * 1.2, 1, (k % 2) - .5, MUSWET, .6)); }")
io.open('score.mjs', 'w', encoding='utf8').write(s)
print('fix1b applied')
