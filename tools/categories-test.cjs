'use strict';
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.invalid/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const file of ['config.js','data/foods.js','i18n.js','packages.js','db.js','auth.js','dropdown.js','home-model.js','brand.js','barcode.js','app.js']){let source=fs.readFileSync(file,'utf8');if(file==='app.js')source=source.replace('window.App = {','window.App = {qaEditor:openForm,qaShopping:openShoppingForm,qaBarcode:openBarcodeProduct,');w.eval(source);}
 const wait=()=>new Promise(r=>setTimeout(r,50));w.localStorage.setItem('homestock.profileChosen','1');w.App.start();await wait();
 function choices(){w.document.querySelector('[role="combobox"][aria-label="קטגוריה"]').click();return [...w.document.querySelectorAll('[role="option"]')];}
 w.App.qaEditor(null);let options=choices();assert.equal(options.length,32);assert.equal(new Set(options.map(n=>n.textContent)).size,32);assert(options.every(n=>/[א-ת]/.test(n.textContent)));options.find(n=>n.textContent.includes('כביסה')).click();
 let name=w.document.querySelector('[aria-label="שם המוצר"]');name.value='מוצר בדיקה';name.dispatchEvent(new w.Event('input',{bubbles:true}));w.document.querySelector('.editor-save').click();await wait();const item=(await w.PantryDB.getAll())[0];assert.equal(item.categoryId,'laundry');
 w.App.qaEditor(item);assert(w.document.querySelector('[aria-label="קטגוריה"]').textContent.includes('כביסה'));w.document.querySelector('.product-editor .sheet-close').click();
 w.App.qaBarcode({barcode:'12345678',product:{he:'מוצר ברקוד',categoryId:'paper'}});assert.equal(choices().length,32);w.document.querySelector('[role="option"][aria-selected="true"]').click();w.document.querySelector('.product-editor .sheet-close').click();
 w.App.qaShopping(null);options=choices();assert.equal(options.length,32);options.find(n=>n.textContent.includes('חיות מחמד')).click();name=w.document.querySelector('[aria-label="שם המוצר לקנייה"]');name.value='מוצר לחיית מחמד';w.document.querySelector('.shopping-editor .btn.save').click();await wait();assert.equal((await w.PantryDB.getAllShopping())[0].categoryId,'pets');assert.equal((await w.PantryDB.getAll())[0].categoryId,'laundry');
 w.close();console.log('PASS 32 unique Hebrew category choices in manual/barcode/shopping editors; category saves, restores on edit, and existing inventory stays unchanged');
})().catch(error=>{console.error(error);process.exit(1)});
