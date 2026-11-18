'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{for(const phone of [false,true]){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:phone,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const f of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js'])w.eval(fs.readFileSync(f,'utf8'));
 const wait=()=>new Promise(r=>setTimeout(r,30));w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await wait();
 await w.PantryDB.create({name:'עגבנייה',quantity:2,unit:'pack',location:'Fridge',note:'לסלט',barcode:'7291234567890'});
 await w.PantryDB.create({name:'אורז',quantity:1,unit:'pack',location:'Pantry'});
 const before=JSON.stringify(await w.PantryDB.getAll());w.App.start();await wait();
 [...w.document.querySelectorAll('.nav-link')].find(b=>b.getAttribute('aria-label')==='מלאי').click();
 assert.notEqual(w.document.activeElement,w.document.querySelector('.stock-search input'),'no automatic keyboard');
 const rows=()=>w.document.querySelectorAll(phone?'.stock-cards [data-item-id]':'.stock-table [data-item-id]');
 assert.equal(rows().length,2);
 function search(value){const el=w.document.querySelector('.stock-search input');el.focus();el.value=value;el.setSelectionRange(value.length,value.length);el.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(w.document.activeElement,w.document.querySelector('.stock-search input'));assert.equal(w.document.activeElement.selectionStart,value.length);}
 search('עגבניות');assert.equal(rows().length,1);search('עגבנייה');assert.equal(rows().length,1);search('729123');assert.equal(rows().length,1);search('לסלט');assert.equal(rows().length,1);search('לא קיים');assert.equal(rows().length,0);assert(w.document.querySelector('.stock-empty').textContent.includes('לא נמצאו'));
 w.document.querySelector('.stock-search-clear').click();assert.equal(rows().length,2);assert.equal(w.document.querySelector('.stock-search input').value,'');
 assert.equal(JSON.stringify(await w.PantryDB.getAll()),before);w.close();console.log('PASS stock search, plural/singular, barcode/note, empty/clear, typing focus and unchanged data: '+(phone?'phone cards':'desktop table'));
}})().catch(e=>{console.error(e);process.exit(1)});
