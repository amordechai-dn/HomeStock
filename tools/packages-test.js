'use strict';const assert=require('node:assert/strict');require('../packages.js');const P=global.HomePackages;
const legacy={id:'milk',quantity:2,expiryDate:'2026-11-10',unit:'pack'};const a=P.normalize(legacy);assert.equal(a.batches.length,1);assert.equal(a.quantity,2);assert.equal(legacy.batches,undefined);
const b=P.add(a,1,'2026-11-20');assert.equal(b.batches.length,2);assert.equal(b.quantity,3);assert.equal(b.expiryDate,'2026-11-10');
const c=P.normalize({...b,quantity:1});assert.equal(c.batches.length,1);assert.equal(c.batches[0].expiryDate,'2026-11-20');
assert.equal(P.normalize({...c,quantity:0}).expiryDate,null);assert.deepEqual(P.normalize(c),c);console.log('PASS package migration, separate expiry batches, earliest-first consumption, empty stock and idempotence');
