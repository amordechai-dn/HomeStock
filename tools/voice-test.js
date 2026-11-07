'use strict';
const assert=require('node:assert/strict');require('../voice.js');const parse=global.HomeVoice.parse;
assert.deepEqual(parse('עגבניה שלוש קילו כל קילו שתי שקל'),{unitPriceAgorot:200,unit:'kg',quantity:3,name:'עגבניה'});
assert.deepEqual(parse('תוסיף שני חלב למקרר במחיר 7 שקלים ליחידה'),{unitPriceAgorot:700,location:'Fridge',quantity:2,name:'חלב'});
assert.deepEqual(parse('עגבניות 3 קילו במחיר 2 שקלים'),{unitPriceAgorot:200,quantity:3,unit:'kg',name:'עגבניות'});
assert.deepEqual(parse('חצי קילו אורז למזווה'),{location:'Pantry',quantity:0.5,unit:'kg',name:'אורז'});
assert.deepEqual(parse('חלב'),{name:'חלב'});
console.log('PASS Hebrew voice: exact reported phrase, quantity after name, units, per-unit prices, fractions, locations and omitted fields');
