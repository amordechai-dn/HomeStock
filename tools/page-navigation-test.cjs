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
for(const [name,route] of [['הוצאות','expenses'],['הגדרות','settings'],['רשימת קניות','shopping'],['המלאי שלי','inventory']]){
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
button('המלאי שלי').click();
assert.deepEqual([...w.document.querySelectorAll('.storage-shelf')].map(n=>n.getAttribute('aria-label')),['מזווה','מקרר','מקפיא'],'shelves keep location order regardless of stock sorting');
button('הוספת מוצר').click();w.document.querySelector('.product-entry-option').click();
assert.deepEqual([...w.document.querySelectorAll('.location-subspaces button')].map(n=>n.textContent.trim().replace(/^\S+\s+/,'')),['מזווה','מקרר','מקפיא'],'editor location order');
console.log('PASS DOM: page background clicks, all noncamera navigation, simplified settings and version placement');w.close();
})().catch(e=>{console.error(e);process.exit(1)});
