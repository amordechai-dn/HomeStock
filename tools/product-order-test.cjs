'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{for(const phone of [true,false]){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;w.scrollTo=()=>{};w.matchMedia=()=>({matches:phone,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const f of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js'])w.eval(fs.readFileSync(f,'utf8'));
 w.localStorage.setItem('homestock.profileChosen','1');const wait=()=>new Promise(r=>setTimeout(r,30));w.App.start();await wait();
 for(const [id,name] of [['c','תמרים'],['b','Tomato'],['a','חלב']]){await w.PantryDB.create({id,name,quantity:1,unit:'pack',location:'Fridge',categoryId:'dairy'});await w.PantryDB.putShopping({id:'s'+id,name,quantity:1,unit:'pack',categoryId:'dairy'});}
 w.App.start();await wait();const nav=name=>[...w.document.querySelectorAll('.nav-link')].find(b=>b.getAttribute('aria-label')===name).click();
 nav('מלאי');assert.deepEqual([...w.document.querySelectorAll(phone?'.stock-cards .card-name':'.stock-product-label>span')].map(n=>n.textContent),['חלב','עגבניות','תמרים']);
 nav('רשימת קניות');assert.deepEqual([...w.document.querySelectorAll('[data-shopping-id]')].map(n=>n.dataset.shoppingId),['sa','sb','sc']);
 assert.equal((await w.PantryDB.getAll()).find(row=>row.name==='Tomato').name,'Tomato','sorting does not rewrite saved names');w.close();console.log('PASS visible Hebrew alphabetical order in inventory and shopping: '+(phone?'cards':'table'));
}})().catch(e=>{console.error(e);process.exit(1)});
