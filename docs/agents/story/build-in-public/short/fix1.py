# fix1.py: fix round 1 on short.html, from the blind judge's report (judge1). Run once.
import io
p = io.open('short.html', encoding='utf8').read()
def rep(a, b):
    global p
    assert a in p, a[:90]
    p = p.replace(a, b)

# the drops: Turbo is the rule's proof; E-F replay his drop on "opened"; Reflex drops on "could"; the wave ends before "only one player was left"
rep("const DROP = {}; DROP[SPOT.pulse] = WT(35); DROP[SPOT.turbo] = WT(61); DROP[SPOT.reflex] = WT(102) + .05;\nconst J0 = WT(103) - .1, J1 = WT(110) - .2;",
    "const DROP = {}; DROP[SPOT.turbo] = WT(35); DROP[SPOT.reflex] = WT(103);\nconst TURBO_LIVE = WT(35), TURBO_REPLAY = WT(64);   // the rule's proof is Turbo; E-F replay his drop on 'opened'\nconst J0 = WT(106) - .1, J1 = WT(112) - .6;")
rep("a.rig.root.visible = y > -900;", "a.rig.root.visible = y > -150;   // gone once the head passes the floor: no bodies seen in the shafts")
rep("m4.compose(V(c.x, c.y + y, c.z), q4, y < -900 ? V(0, 0, 0) : one);", "m4.compose(V(c.x, c.y + y, c.z), q4, y < -150 ? V(0, 0, 0) : one);")
# a bolder run
rep("J['leg' + n].rotation.x = lerp(J['leg' + n].rotation.x, -.75 * Math.max(0, s) + .15, k); J['shin' + n].rotation.x = lerp(J['shin' + n].rotation.x, 1.35 * Math.max(0, s), k);",
    "J['leg' + n].rotation.x = lerp(J['leg' + n].rotation.x, -1.15 * Math.max(0, s) + .2, k); J['shin' + n].rotation.x = lerp(J['shin' + n].rotation.x, 1.7 * Math.max(0, s), k);")
rep("J.hips.position.y += Math.abs(Math.sin(ph)) * 2.4 * k;", "J.hips.position.y += Math.abs(Math.sin(ph)) * 5 * k; rig.root.position.y += Math.abs(Math.sin(ph)) * 4 * k;")
# a fly that reads as a fly: matte body, white wings
rep("new THREE.MeshStandardMaterial({ color: lin('#dfe9f2'), transparent: true, opacity: .55, roughness: .2, side: THREE.DoubleSide, depthWrite: false })",
    "new THREE.MeshStandardMaterial({ color: lin('#f4f8fb'), transparent: true, opacity: .85, roughness: .6, side: THREE.DoubleSide, depthWrite: false })")
rep("new THREE.SphereGeometry(2.2, 12, 8).scale(1, .8, 1.5), new THREE.MeshStandardMaterial({ color: lin('#17151a'), roughness: .35, metalness: .2 })",
    "new THREE.SphereGeometry(2.6, 12, 8).scale(1, .8, 1.6), new THREE.MeshStandardMaterial({ color: lin('#1d1a12'), roughness: .9, metalness: 0 })")
# the shot list
rep("const SHOTS = [['A', 0], ['B', WT(5)], ['C', WT(19)], ['D', WT(28)], ['E', WT(41)], ['F', WT(58)], ['G', WT(72)], ['H', WT(86)], ['I', WT(93)], ['J', WT(103)], ['K', WT(109)], ['L', WT(123)], ['M', WT(137)]];",
    "const SHOTS = [['A', 0], ['A2', WT(3)], ['B', WT(5)], ['C', WT(19)], ['D', WT(28)], ['E', WT(41)], ['F', WT(61)], ['G', WT(69)], ['G2', WT(75)], ['H', WT(89)], ['I', WT(96)], ['J', WT(106)], ['K', WT(112)], ['L', WT(126)], ['M', WT(140)]];")
rep("const CLOCK0 = 7.4,", "const CLOCK0 = 6.3,")
rep("  for (let i = 0; i < 50; i++) { A.circle(i).light(i === 49 ? 1 : 1 - opened(i, t) * .85); A.circle(i).open(opened(i, t)); }",
    "  DROP[SPOT.turbo] = (id === 'E' || id === 'F') ? TURBO_REPLAY : TURBO_LIVE;\n  for (let i = 0; i < 50; i++) { A.circle(i).light(i === 49 ? 1 : 1 - opened(i, t) * .85); A.circle(i).open(opened(i, t)); }")
rep("    CA.turbo.rig.root.visible && t < DROP[SPOT.turbo] + 1 && runOnSpot(CA.turbo.rig, t, 1); };",
    "    if (CA.turbo.rig.root.visible && t < DROP[SPOT.turbo] + .6) runOnSpot(CA.turbo.rig, t, 1); };")
# A2: a power on "superpowers"
rep("  } else if (id === 'B') {   // #50 looks up at the trophy",
    "  } else if (id === 'A2') {  // a power on 'superpowers': Turbo running on the spot, his streaks round him\n    everyone(); closeOn('turbo', 1, 300, 250, .2, ['determined', 1]); runOnSpot(CA.turbo.rig, t, 1);\n  } else if (id === 'B') {   // #50 looks up at the trophy")
# D: the rule proven live on Turbo
a = p.index("  } else if (id === 'D') {"); b = p.index("  } else if (id === 'E') {")
p = p[:a] + """  } else if (id === 'D') {   // the rule proven: Turbo cannot stop his feet, and his circle drops him (who he is comes next)
    everyone(); const i = SPOT.turbo, o = sideOf(i), toCam = o.side.clone().addScaledVector(o.out, .55).normalize();
    stand(CA.turbo, i, o.c.clone().addScaledVector(toCam, 100), t, 1); CA.turbo.rig.setExpression(t < DROP[i] ? 'worried' : 'surprised', 1); if (t < DROP[i] + .6) runOnSpot(CA.turbo.rig, t, 1);
    const fk = clamp((t - DROP[i]) / 1.1, 0, 1); p = o.c.clone().addScaledVector(toCam, lerp(380, 300, eout(u / dur))).add(V(0, lerp(150, 260, fk), 0)); l = o.c.clone().add(V(0, lerp(55, -40, fk), 0));
    fov = 34; ap = .01; focus = p.distanceTo(o.c); hero = CA.turbo.rig; sk = .7; A.shadowFocus(o.c, 500);
""" + p[b:]
# G: Reflex blinks on "blinked"; G2 the medium with arms crossed
rep("  } else if (id === 'G') {   // Reflex, smug, arms crossed\n    everyone(); closeOn('reflex', 1, 260, 220, .22, ['smug', 1]); crossArms(CA.reflex.rig);",
    "  } else if (id === 'G') {   // 'before anyone else had even blinked': Reflex close, a smug slow blink\n    everyone(); closeOn('reflex', -1, 200, 180, -.2, ['smug', 1]); crossArms(CA.reflex.rig); CA.reflex.rig.setBlink(clamp(1 - Math.abs(t - WT(74) - .1) / .18, 0, 1));\n  } else if (id === 'G2') {  // Reflex, faster than anyone alive: smug, arms crossed\n    everyone(); closeOn('reflex', 1, 280, 240, .22, ['smug', 1]); crossArms(CA.reflex.rig);")
rep("const R = closeOn('reflex', 1, 120, 104, .0, t < WT(92) ? ['smug', 1] : ['worried', 1]);", "const R = closeOn('reflex', 1, 165, 150, .0, t < WT(93) ? ['smug', 1] : ['worried', 1]);   // chin to crown, the hands below frame")
rep("k = eio(clamp((t - WT(87)) / (WT(92) - WT(87)), 0, 1));", "k = eio(clamp((t - WT(90)) / (WT(93) - WT(90)), 0, 1));")
rep("const R = closeOn('reflex', 1, 330, 360, .15, t < WT(97) ? ['surprised', 1] : ['worried', 1]); crossArms(CA.reflex.rig); swat(CA.reflex.rig, t, WT(95) - .08);",
    "const R = closeOn('reflex', 1, 300, 330, .15, t < WT(100) ? ['surprised', 1] : ['worried', 1]); crossArms(CA.reflex.rig); swat(CA.reflex.rig, t, WT(98) - .08);")
# K: #50 from the front three-quarter, the trophy beside him
a = p.index("  } else if (id === 'K') {"); b = p.index("  } else if (id === 'L') {")
p = p[:a] + """  } else if (id === 'K') {   // #50 alone: a front three-quarter, the trophy beside him, open holes all round
    everyone(); const a = CA.ordinary, c = cw(49), toTro = V(0, 0, 0).sub(c).setY(0).normalize(), side = V(-toTro.z, 0, toTro.x), k = eio(clamp(u / dur, 0, 1));
    stand(a, 49, V(0, 0, 0), t, 0); a.rig.setExpression('neutral', 1); a.rig.lookAt(null, 0);
    const toCam = toTro.clone().multiplyScalar(.45).addScaledVector(side, .9).normalize(); p = c.clone().addScaledVector(toCam, lerp(520, 430, k)).add(V(0, lerp(110, 95, k), 0));
    l = c.clone().add(V(0, 75, 0)).addScaledVector(toTro, 120); fov = 36; ap = .006; focus = p.distanceTo(c); hero = a.rig; sk = .8; A.shadowFocus(c, 900);
""" + p[b:]
rep("a.rig.setExpression(t < WT(129) ? 'neutral' : 'happy', t < WT(129) ? 1 : .55);\n    const bl = clamp(1 - Math.abs(t - WT(127)) / .22, 0, 1);",
    "a.rig.setExpression(t < WT(135) ? 'neutral' : 'happy', t < WT(135) ? 1 : .55);\n    const bl = clamp(1 - Math.abs(t - WT(131)) / .22, 0, 1);")
rep("const F = frameOn(hd.clone().add(V(0, -12, 0)), toCam, lerp(215, 175, eio(clamp(u / dur, 0, 1))), 30, .2, -.03);",
    "const F = frameOn(hd.clone().add(V(0, -12, 0)), toCam.clone().add(V(0, -.12, 0)), lerp(235, 190, eio(clamp(u / dur, 0, 1))), 30, .18, -.03);   // lower and wider than B")
rep("p = V(Math.cos(az) * lerp(700, 2100, k), lerp(420, 1600, k), Math.sin(az) * lerp(700, 2100, k));",
    "p = c.clone().multiplyScalar(1 - k).add(V(Math.cos(az) * lerp(380, 2100, k), lerp(170, 1600, k), Math.sin(az) * lerp(380, 2100, k)));   // starts on #50, then the pull-out")
io.open('short.html', 'w', encoding='utf8').write(p)
print('fix1 applied')
