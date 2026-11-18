/* Character A2: Chandrashekhar Azad on the hero rig (herorig.js). The head, face, hair and moustache are azad.js's own;
   the body is one continuous skinned mesh (bare chest, janeu, dhoti and waistband re-skinned from azad.js).
   Load after family.js, azad.js and herorig.js. window.CHARACTERS.A2 = { meta, C, make(THREE, { lin }) }. */
(function () {
  const A = window.CHARACTERS.A;
  window.CHARACTERS.A2 = { meta: Object.assign({}, A.meta, { id: 'A2', rig: 'hero' }), C: A.C,
    make(THREE, { lin }) { return window.HERORIG(THREE, lin).make(A, { key: 'A2', janeu: true }); } };
})();
