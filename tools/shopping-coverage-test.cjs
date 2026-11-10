'use strict';const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};
for(const f of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js'])w.eval(fs.readFileSync(f,'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,50));w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await wait();const db=w.PantryDB;
let item=await db.create({name:'קרקרים',quantity:1,desiredAmount:2,unit:'pack',location:'Pantry'});const shop=await db.putShopping({name:'קרקרים',quantity:1,unit:'pack'});
const shopping=()=>[...w.document.querySelectorAll('.nav-link')].find(b=>b.getAttribute('aria-label')==='רשימת קניות').click();
w.App.start();await wait();shopping();assert(!w.document.querySelector('.shopping-coverage'));assert.equal((await db.getAllShopping()).length,1);
item.quantity=2;item=await db.put(item);w.location.hash='#/inventory';w.App.start();await wait();assert(w.document.querySelector('.toast'),'updated inventory notifies outside shopping');shopping();assert(w.document.querySelector('.shopping-coverage'));assert.equal((await db.getAllShopping()).length,1,'meeting target never deletes shopping automatically');
function decision(text){[...w.document.querySelectorAll('.shopping-coverage button')].find(b=>b.textContent===text).click();}
decision('להשאיר');await wait();assert(!w.document.querySelector('.shopping-coverage'));assert((await db.getAllShopping())[0].stockReviewKeep);w.App.start();await wait();shopping();assert(!w.document.querySelector('.shopping-coverage'),'keep survives reload');
await wait();item.quantity=3;item=await db.put(item);w.App.start();await wait();shopping();assert(w.document.querySelector('.shopping-coverage'),'changed stock prompts again');
const before=JSON.stringify(await db.getAll());decision('הסרה מהקניות');await wait();assert.equal((await db.getAllShopping()).length,0);assert.equal(JSON.stringify(await db.getAll()),before,'removal does not alter inventory');w.document.querySelector('.toast-undo').click();await wait();assert.equal((await db.getAllShopping()).length,1);assert.equal(Object.values(db.getMonthlyLog()).flatMap(m=>m.expenses||[]).length,0);
// A stale prompt must not delete the row after stock has fallen below target.
item.quantity=1;await db.put(item);decision('הסרה מהקניות');await wait();assert.equal((await db.getAllShopping()).length,1);assert(!w.document.querySelector('.shopping-coverage'));
w.close();console.log('PASS coverage prompt, no automatic removal, keep/reload/recheck, removal/undo, stale-state guard, unchanged inventory and expenses');
})().catch(e=>{console.error(e);process.exit(1)});
