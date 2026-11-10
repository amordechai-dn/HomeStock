const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
// Run from the repository root with jsdom installed (or supplied via NODE_PATH).
const root=process.cwd();
(async()=>{
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/HomeStock/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});
for(const file of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js'])w.eval(fs.readFileSync(root+'/'+file,'utf8'));
w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await new Promise(r=>setTimeout(r,100));
function button(text){const b=[...w.document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')===text||b.textContent.trim()===text));assert(b,'button '+text);return b;}
const stableNav=w.document.querySelector('.kitchen-nav');
for(const [name,route] of [['מלאי','stock'],['הוצאות','expenses'],['הגדרות','settings'],['רשימת קניות','shopping'],['בית','inventory']]){
button(name).click();assert.equal(w.document.querySelector('.kitchen-nav'),stableNav,'navigation DOM stays mounted');assert.equal(w.location.hash,'#/'+route);const page=w.document.querySelector('#main-content');assert(page);page.click();assert.equal(w.location.hash,'#/'+route,'background stays on '+route);
}
button('הגדרות').click();const before=w.location.hash;
assert.equal(w.document.querySelector('.settings-page details'),null,'settings have no collapsed information');
assert.equal(w.document.querySelector('[aria-label="עריכת פרופיל"]'),null,'profile editing removed');
assert(button('מחיקת המלאי').closest('.settings-page'),'inventory deletion is directly visible');
assert(w.document.querySelector('.nav-settings .nav-app-version'),'version stays beside settings');
assert.equal(w.location.hash,before);
for(const [location,quantity] of [['Freezer',0],['Fridge',1],['Pantry',9]])await w.PantryDB.create({name:'בדיקת '+location,quantity,location,unit:'pcs',categoryId:'other'});
await w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await new Promise(r=>setTimeout(r,100));
button('מלאי').click();
assert.equal(w.document.querySelectorAll('.stock-table tbody tr[data-item-id]').length,3,'table includes every storage location');
assert.equal(w.document.querySelectorAll('.stock-table thead th').length,11);
assert.equal(w.document.querySelector('.stock-table tbody tr').children.length,11);
w.document.querySelector('.stock-product').click();
assert(w.document.querySelector('.product-editor'),'table opens shared editor');
w.document.querySelector('.product-editor .sheet-close').click();
assert.equal(w.location.hash,'#/stock','closing edit keeps table');
w.document.querySelector('.stock-delete').click();
assert(w.document.querySelector('.delete-confirm-overlay'));
w.document.querySelector('.delete-confirm-overlay .cancel').click();
assert.equal((await w.PantryDB.getAll()).length,3,'cancel delete leaves records intact');
assert.equal(w.location.hash,'#/stock');
button('בית').click();
assert(w.document.querySelector('.home-overview'));assert.equal(w.document.querySelector('.inventory-workbench'),null,'home is status rather than a product list');
button('הוספת מוצר').click();w.document.querySelector('.product-entry-option').click();
assert.deepEqual([...w.document.querySelectorAll('.location-subspaces button')].map(n=>n.textContent.trim().replace(/^\S+\s+/,'')),['מזווה','מקרר','מקפיא'],'editor location order');
console.log('PASS DOM: page background clicks, all noncamera navigation, simplified settings and version placement');w.close();
})().catch(e=>{console.error(e);process.exit(1)});
