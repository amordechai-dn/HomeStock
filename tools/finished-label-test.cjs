'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{for(const phone of [true,false]){
const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;w.scrollTo=()=>{};w.matchMedia=()=>({matches:phone,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};
for(const f of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js'])w.eval(fs.readFileSync(f,'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,40));w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await wait();const item=await w.PantryDB.create({name:'מוצר לבדיקה',quantity:2,unit:'pack'});w.App.start();await wait();[...w.document.querySelectorAll('.nav-link')].find(b=>b.getAttribute('aria-label')==='מלאי').click();
assert.equal(w.document.querySelector('.item-finished').textContent,'נגמר');w.document.querySelector('.item-finished').click();await wait();const btn=w.document.querySelector('.item-finished');assert.equal(btn.textContent,'אזל מהמלאי');assert(btn.disabled);assert.equal((w.document.querySelector('[data-item-id]').textContent.match(/אזל מהמלאי/g)||[]).length,1);assert.equal((await w.PantryDB.getItem(item.id)).quantity,0);
assert([...w.document.querySelectorAll('.toast button')].some(b=>b.textContent==='הוספה לקניות'),'shopping suggestion retained');
if(phone){w.document.querySelector('[aria-label="הוספת מוצר לבדיקה"]').click();await wait();assert.equal(w.document.querySelector('.item-finished').textContent,'נגמר');assert(!w.document.querySelector('.item-finished').disabled);}
w.close();console.log('PASS finished button replaces its label, no duplicate status, restock restores action: '+(phone?'cards':'table'));
}})().catch(e=>{console.error(e);process.exit(1)});
