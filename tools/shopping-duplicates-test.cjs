'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
async function check(indexed){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};
 if(indexed)w.indexedDB=new (require('fake-indexeddb').IDBFactory)();
 for(const f of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js'])w.eval(fs.readFileSync(f,'utf8'));
 const db=w.PantryDB,A=w.App._internals;
 await db.setUser('qa-aviraz');
 const inventory=await db.create({name:'קוטג׳',quantity:3,unit:'pack'}),before=JSON.stringify(await db.getAll());
 const first=await db.putShopping({id:'a',name:'קוטג',quantity:1,unit:'pack',note:'ראשון'});
 await db.putShopping({id:'b',name:'Cottage cheese',nameHe:'קוטג׳',quantity:2,unit:'pack',imageHash:'photo',note:'שני'});
 await db.putShopping({id:'grams',name:'קוטג',quantity:100,unit:'g'});
 await db.putShopping({id:'different',name:'קוטג 5%',quantity:1,unit:'pack'});
 await db.putShopping({id:'archive',name:'קוטג',quantity:1,unit:'pack',purchased:true});
 assert.equal(A.shopKey({name:'קוטג'}),A.shopKey({name:'Cottage cheese'}));
 let rows=await A.reconcileShopping(await db.getAllShopping());
 assert.equal(rows.length,4);let merged=rows.find(r=>r.id==='a');assert.equal(merged.quantity,3);assert.equal(merged.imageHash,'photo');assert(merged.note.includes('ראשון')&&merged.note.includes('שני'));
 await db.putShopping({id:'b',name:'קוטג׳',quantity:2,unit:'pack'}); // stale device reintroduces old row
 rows=await A.reconcileShopping(await db.getAllShopping());assert.equal(rows.find(r=>r.id==='a').quantity,3,'cleanup is retry safe');
 const originals=JSON.stringify(await db.getAllShopping());await A.reconcileShopping(await db.getAllShopping());assert.equal(JSON.stringify(await db.getAllShopping()),originals,'idempotent');
 A.setShoppingItems(rows);
 await Promise.all([A.addToShoppingList({name:'קוטג',quantity:1,unit:'pack'}),A.addToShoppingList({name:'קוטג׳',quantity:1,unit:'pack'})]);
 rows=await db.getAllShopping();assert.equal(rows.find(r=>r.id==='a').quantity,5);assert.equal(rows.filter(r=>!r.purchased&&r.unit==='pack'&&A.shopKey(r)===A.shopKey(first)).length,1);
 await Promise.all([A.addToShoppingList({name:'חדש',quantity:1,unit:'pack'}),A.addToShoppingList({name:'חדש',quantity:2,unit:'pack'})]);
 rows=await db.getAllShopping();assert.equal(rows.filter(r=>r.name==='חדש').length,1);assert.equal(rows.find(r=>r.name==='חדש').quantity,3);
 assert.equal(JSON.stringify(await db.getAll()),before,'inventory untouched');assert.equal((await db.getItem(inventory.id)).quantity,3);
 await db.setUser('qa-sigal');assert.equal((await db.getAllShopping()).length,0);await A.addToShoppingList({name:'קוטג',quantity:1,unit:'pack'});assert.equal((await db.getAllShopping()).length,1);
 await db.setUser('qa-aviraz');assert.equal((await db.getAllShopping()).find(r=>r.id==='a').quantity,5,'households remain isolated');
 w.close();console.log('PASS shopping duplicate cleanup, aliases, metadata/quantity preservation, replay safety, rapid adds and household isolation: '+(indexed?'IndexedDB':'localStorage'));
}
(async()=>{await check(false);await check(true);})().catch(e=>{console.error(e);process.exit(1)});
