/* cast2.js: the rest of the family on the hero rig (herorig.js), each from its own old file (head, face, wardrobe colours).
   S2 = Bhagat Singh (kurta and pyjama), N2 = the gentleman / constable (coat and trousers, shoes). Load after the old
   character files and herorig.js. Only the characters whose old file is loaded are registered. */
(function () {
  const reg = (id, baseId, spec) => { const A = window.CHARACTERS[baseId]; if (!A) return;
    window.CHARACTERS[id] = { meta: Object.assign({}, A.meta, { id, rig: 'hero' }), C: A.C, make(THREE, { lin }) { return window.HERORIG(THREE, lin).make(A, Object.assign({ key: id }, spec)); } }; };
  reg('S2', 'S', {}); reg('N2', 'N', {}); reg('G2', 'G', {}); reg('V2', 'V', {});
})();
