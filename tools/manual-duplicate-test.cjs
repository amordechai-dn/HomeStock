'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};
for(const f of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js']){let source=fs.readFileSync(f,'utf8');if(f==='app.js')source=source.replace('window.App = {','window.App = {qaEditor:openForm,');w.eval(source);}
const wait=()=>new Promise(r=>setTimeout(r,50));w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await wait();
const db=w.PantryDB;const milk=await db.create({name:'חָלָב',nameHe:'חלב',nameEn:'Milk',quantity:1,desiredAmount:3,unit:'pack',location:'Fridge',categoryId:'dairy',expiryDate:'2026-11-15'});
function set(label,value){const field=w.document.querySelector('[aria-label="'+label+'"]');field.value=value;field.dispatchEvent(new w.Event('input',{bubbles:true}));}
w.App.qaEditor(null);set('שם המוצר',' חלב ');set('כמות במלאי','2');w.document.querySelector('.editor-save').click();await wait();assert.equal((await db.getAll()).length,1);assert(w.document.querySelector('.duplicate-open'));assert.equal((await db.getItem(milk.id)).quantity,1);
w.document.querySelector('.duplicate-open').click();assert.equal(w.document.querySelector('[aria-label="כמות במלאי"]').value,'3');set('תאריך תפוגה','2026-12-01');w.document.querySelector('.editor-save').click();await wait();let saved=await db.getItem(milk.id);assert.equal((await db.getAll()).length,1);assert.equal(saved.quantity,3);assert.equal(saved.desiredAmount,3);assert.equal(saved.location,'Fridge');assert.equal(saved.batches.length,2);assert.equal(Object.values(db.getMonthlyLog()).flatMap(x=>x.expenses||[]).length,0);
w.App.qaEditor(null);set('שם המוצר','mIlK');w.document.querySelector('.editor-save').click();await wait();assert(w.document.querySelector('.duplicate-open'),'English alias match is case insensitive');w.document.querySelector('.product-editor .sheet-close').click();
const rice=await db.create({name:'אורז',quantity:1,unit:'pack'});w.App.qaEditor(rice);set('שם המוצר','חלב');w.document.querySelector('.editor-save').click();await wait();assert(w.document.querySelector('.duplicate-open'),'renaming cannot create a duplicate');assert.equal((await db.getItem(rice.id)).name,'אורז');w.document.querySelector('.product-editor .sheet-close').click();
// A product created after the editor opened must also be detected.
w.App.qaEditor(null);await db.create({name:'חדש',quantity:1,unit:'pack'});set('שם המוצר','חדש');w.document.querySelector('.editor-save').click();await wait();assert(w.document.querySelector('.duplicate-open'));assert.equal((await db.getAll()).length,3);
w.close();console.log('PASS duplicate manual add/rename, normalized Hebrew/English aliases, stale editor check, explicit quantity addition with separate expiry batches and preserved data');
})().catch(error=>{console.error(error);process.exit(1)});
