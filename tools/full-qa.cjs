/* Isolated DOM QA; run with jsdom available through NODE_PATH. No production writes. */
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/HomeStock/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;const errors=[];
if(process.env.QA_STORAGE==='indexeddb'){const fake=require('fake-indexeddb');w.indexedDB=new fake.IDBFactory();w.IDBKeyRange=fake.IDBKeyRange;}
w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.addEventListener('error',e=>errors.push(e.error));
for(const file of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js']){
let code=fs.readFileSync(file,'utf8');if(file==='app.js')code=code.replace('window.App = {','window.App = {qaBarcode:openBarcodeProduct,');w.eval(code);}
const wait=()=>new Promise(r=>setTimeout(r,15));
const target=process.env.QA_PROFILE||'aviraz',other=target==='sigal'?'aviraz':'sigal';
assert(['aviraz','sigal'].includes(target));await w.Auth.init();
w.PantryDB.setUser(other);
await w.PantryDB.create({name:'Protected other household stock',quantity:11,unit:'pack',expiryDate:'2028-01-01'});
await w.PantryDB.putShopping({id:'protected-shopping',name:'Protected shopping',quantity:2});
w.PantryDB.setMonthlyLog({'2026-11':{expenses:[{id:'protected-expense',amountAgorot:1234}]}});
await w.PantryDB.putBarcode({barcode:'protected-barcode',he:'פריט שמור'});
await w.PantryDB.putImage({hash:'protected-image',full:'data:image/png;base64,AA==',thumb:'data:image/png;base64,AA=='});
async function snapshot(){return JSON.stringify({items:await w.PantryDB.getAll(),shopping:await w.PantryDB.getAllShopping(),monthly:w.PantryDB.getMonthlyLog(),barcodes:await w.PantryDB.getAllBarcodes(),images:await w.PantryDB.getAllImages()});}
const protectedBefore=await snapshot();
w.Auth.rememberSelection(target);w.App.start();await wait();assert.equal(w.CurrentUser.id(),target);
console.log('QA profile: '+target+'; storage: '+(process.env.QA_STORAGE||'localStorage')+'; protecting untouched '+other+' household');
function btn(name,scope=w.document){const b=[...scope.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===name||b.textContent.trim()===name);assert(b,'missing '+name);return b;}
function field(name,value){const f=w.document.querySelector('input[aria-label="'+name+'"],textarea[aria-label="'+name+'"]');assert(f,'field '+name);f.value=value;f.dispatchEvent(new w.Event('input',{bubbles:true}));return f;}
function pick(label,index){btn(label).click();const opts=w.document.querySelectorAll('[role=option]');assert(opts[index]);opts[index].click();}
const locations=[['מטבח','מזווה','Pantry'],['מטבח','מקרר','Fridge'],['מטבח','מקפיא','Freezer'],['חדר רחצה','שירותים','Toilet'],['חדר רחצה','מקלחת','Shower'],['כללי',null,'House']];
let count=0;
for(let category=0;category<15;category++)for(const [room,place,id] of locations){
btn(count?'הוספת מוצר':'הוספת מוצר ראשון').click();w.document.querySelector('.product-entry-option').click();const extra=w.document.querySelector('.product-review-extras');if(extra)extra.open=true;field('שם המוצר','QA-'+category+'-'+id);field('כמות במלאי','2');field('מחיר ליחידה בשקלים','7.50');field('כמות רצויה בבית','3');field('הערה למוצר','QA note');field('תאריך תפוגה','2027-02-01');pick('קטגוריה',category);
const picker=w.document.querySelector('.location-picker');btn(room,picker).click();if(place)[...picker.querySelectorAll('.location-subspaces button')].find(b=>b.textContent.includes(place)).click();
w.document.querySelector('[aria-label="קנייה חדשה"]').checked=true;w.document.querySelector('.editor-save').click();await wait();const rows=await w.PantryDB.getAll();assert.equal(rows.length,++count);const row=rows.find(r=>r.name==='QA-'+category+'-'+id);assert.equal(row.location,id);assert.equal(row.quantity,2);assert.equal(row.unitPriceAgorot,750);assert.equal(row.expiryDate,'2027-02-01');assert.equal(row.desiredAmount,3);
}
console.log('PASS 90 UI creations: 15 categories × 6 locations, prices, expiry, notes and targets');
const expenseCount=Object.values(w.PantryDB.getMonthlyLog()).reduce((n,m)=>n+(m.expenses||[]).length,0);assert.equal(expenseCount,90);
const editable=(await w.PantryDB.getAll())[0];field('חיפוש בכל הבית',editable.name);await wait();btn('עריכת '+editable.name).click();field('כמות במלאי','4');field('מחיר ליחידה בשקלים','8.25');field('הערה למוצר','edited');w.document.querySelector('[aria-label="קנייה חדשה"]').checked=true;w.document.querySelector('.editor-save').click();await wait();
assert.equal((await w.PantryDB.getAll()).find(r=>r.id===editable.id).quantity,4);
btn('עריכת '+editable.name).click();w.document.querySelector('.editor-delete').click();w.document.querySelector('.delete-confirm-overlay .btn.cancel').click();assert(w.document.querySelector('.editor-overlay'));assert((await w.PantryDB.getAll()).some(r=>r.id===editable.id));
const realRemove=w.PantryDB.remove;w.PantryDB.remove=()=>Promise.reject(new Error('QA simulated storage failure'));
w.document.querySelector('.editor-delete').click();w.document.querySelector('.delete-confirm-overlay .btn.danger').click();await wait();assert(w.document.querySelector('.delete-confirm-overlay .editor-error').textContent);assert((await w.PantryDB.getAll()).some(r=>r.id===editable.id));w.PantryDB.remove=realRemove;
w.document.querySelector('.delete-confirm-overlay .btn.cancel').click();btn('סגירה',w.document.querySelector('.editor-overlay')).click();
console.log('PASS UI edit, canceled deletion and failed deletion keep inventory intact and allow retry');
for(const row of await w.PantryDB.getAll()){
// Search across rooms to open the actual editor for each saved row.
field('חיפוש בכל הבית',row.name);await wait();btn('עריכת '+row.name).click();w.document.querySelector('.editor-delete').click();const confirm=w.document.querySelector('.delete-confirm-overlay');assert(confirm);confirm.querySelector('.btn.danger').click();confirm.querySelector('.btn.danger').click();await wait();assert(!(await w.PantryDB.getAll()).some(r=>r.id===row.id));assert(!w.document.querySelector('.editor-overlay'));
}
assert.equal((await w.PantryDB.getAll()).length,0);assert.equal(Object.values(w.PantryDB.getMonthlyLog()).reduce((n,m)=>n+(m.expenses||[]).length,0),91);
console.log('PASS 90 UI deletions: duplicate taps safe, editor closes, expenses preserved');
btn('הוצאות').click();assert.equal(w.document.querySelectorAll('.monthly-content .stat-row').length,0,'expense page excludes mixed-unit inventory counters');const before=w.location.hash;w.document.querySelector('.expense-remove').click();assert.equal(w.location.hash,before);assert.equal(w.document.querySelectorAll('.expense-row').length,90);w.document.querySelector('.toast button').click();assert.equal(w.document.querySelectorAll('.expense-row').length,91);
console.log('PASS expense delete and undo preserve current route');
const I=w.App._internals;await I.addToShoppingList({name:'QA shopping',quantity:3,unit:'pcs',unitPriceAgorot:200});btn('רשימת קניות').click();w.document.querySelector('.shopping-buy').click();await wait();w.document.querySelector('.purchase-review .btn.save').click();await wait();assert.equal(w.document.querySelectorAll('.shopping-items .shopping-row').length,0);assert(w.document.querySelector('.shopping-bought'));w.document.querySelector('.toast button').click();await wait();assert.equal(w.document.querySelectorAll('.shopping-items .shopping-row').length,1);w.document.querySelector('.shopping-remove').click();await wait();assert.equal(w.location.hash,'#/shopping');assert(!w.document.querySelector('.shopping-items .shopping-row'));
console.log('PASS shopping purchase/archive/undo/delete and route preservation');
w.App.qaBarcode({barcode:'7290000688077',product:{he:'QA barcode',categoryId:'snacks',unit:'pcs'}},()=>{},()=>{w.App.renderMain();});assert(w.document.querySelector('.editor-target'));assert(w.document.querySelector('[aria-label="תאריך תפוגה"]'));assert(!w.document.querySelector('.editor-voice'));w.document.querySelector('.editor-save').click();await wait();assert((await w.PantryDB.getAll()).some(r=>r.barcode==='7290000688077'));
console.log('PASS barcode-prefilled shared editor saves product with full controls');
assert.deepEqual(errors,[]);w.PantryDB.setUser(other);assert.equal(await snapshot(),protectedBefore,'all data in the other household remains byte-for-byte unchanged');console.log('PASS protected household inventory/shopping/expenses/barcodes/photos unchanged');w.close();console.log('ALL ISOLATED QA CHECKS PASSED');
})().catch(e=>{console.error(e);process.exit(1)});
