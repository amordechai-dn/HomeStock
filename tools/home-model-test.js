'use strict';
const assert=require('node:assert/strict');
require('../home-model.js');const M=global.HomeModel;
const data=[{id:'milk',name:'חָלָב',nameEn:'Milk',quantity:1,desiredAmount:3,location:'Fridge',unit:'pcs',unitPriceAgorot:650,updatedAt:'2026-11-01'},
 {id:'rice',name:'אורז',quantity:0,location:'Pantry',unit:'kg',unitPriceAgorot:1290,updatedAt:'2026-11-02'},
 {id:'soap',name:'סבון ידיים',note:'לעור רגיש',quantity:2,desiredAmount:1,location:'Shower',unit:'pcs',updatedAt:'2026-11-03'},
 {id:'battery',name:'סוללות',quantity:0,location:'House',unit:'pack',updatedAt:'2026-11-04'},
 {id:'oil',name:'שמן',quantity:.5,desiredAmount:1,location:'Pantry',unit:'liter',updatedAt:'2026-11-05'}];
assert.equal(M.shoppingEstimate([{quantity:.29,unitPriceAgorot:50}]).totalAgorot,15,'estimate rounds decimal half-agora exactly');
const original=JSON.stringify(data),s=M.summary(data);
assert.deepEqual([s.total,s.attention,s.out],[5,4,2]);assert.equal(s.rooms.Kitchen.attention,3);
assert.equal(M.select(data,{query:'חלב',space:'Bathroom'})[0].id,'milk','global search ignores selected room');
assert.equal(M.select(data,{query:'סבון רגיש'})[0].id,'soap','tokens may match names and notes');
assert.equal(M.select(data,{query:'MILK'})[0].id,'milk');
assert.equal(M.select(data,{space:'Kitchen',location:'Pantry',filter:'attention'}).length,2);
assert.equal(M.select(data,{space:'Bathroom',filter:'attention'}).length,0);
assert.equal(M.select(data,{space:'Kitchen',sort:'recent'})[0].id,'oil');
assert.equal(M.select(data,{sort:'attention'})[0].quantity,0);
let plan=M.shoppingPlan(data,[]);assert.equal(plan.length,4);
assert.equal(plan.find(x=>x.item.id==='oil').quantity,.5,'weighed shortages must not round up');
assert.equal(plan.find(x=>x.item.id==='rice').quantity,1,'out-of-stock without target can be planned');
const shopping=plan.map(x=>({...x.item,id:'shopping-'+x.item.id,quantity:x.quantity}));
assert.equal(M.shoppingPlan(data,shopping).length,0,'repeated top-up is idempotent');
shopping.find(x=>x.nameEn==='Milk').quantity=1;
assert.equal(M.shoppingPlan(data,shopping)[0].quantity,1,'only the uncovered quantity is added');
assert.equal(M.shoppingPlan([data[1]],[{name:'אורז',quantity:2,unit:'pcs'}]).length,1,'different units remain independent');
const estimate=M.shoppingEstimate([{quantity:2,unitPriceAgorot:650},{quantity:1},{quantity:1,unitPriceAgorot:0},{quantity:1,unitPriceAgorot:400,purchased:true}]);
assert.deepEqual(estimate,{totalAgorot:1300,unknown:1,count:3});
assert.deepEqual(M.expensesBySpace([{location:'Fridge',amountAgorot:100},{location:'Toilet',amountAgorot:150},{location:'House',amountAgorot:200},{amountAgorot:-4}]),{Kitchen:100,Bathroom:150,House:200});
assert.equal(JSON.stringify(data),original,'all selectors preserve source records');
console.log('PASS: Hebrew/global search, filters, ordering, room summaries, fractional/idempotent shopping plans, unit separation, partial estimates, historical room expenses and immutable selectors');

assert.deepEqual(M.expenseMonths('2026-11',{'2026-08':{}}),['2026-11']);
assert.deepEqual(M.expenseMonths('2027-02',{}),['2027-02','2027-01','2026-12','2026-11']);
assert.deepEqual(M.expenseMonths('2026-12',{'2028-01':{}}),['2026-12','2026-11']);
console.log('PASS: expense month timeline starts November 2026, includes empty months, crosses years and excludes future months');

assert.equal(M.expiry({expiryDate:'2026-11-14'},'2026-11-07').urgent,true);
assert.equal(M.expiry({expiryDate:'2026-11-15'},'2026-11-07').urgent,false);
assert.equal(M.expiry({expiryDate:'2026-11-06'},'2026-11-07').label,'פג התוקף');
assert.equal(M.expiry({expiryDate:'2026-11-07'},'2026-11-07').days,0);
assert.equal(M.expiry({noExpiry:true,expiryDate:'2026-11-07'},'2026-11-07'),null);

assert.equal(M.expiryPreset('1','2026-12-31'),'2027-01-01');
assert.equal(M.expiryPreset('7','2026-11-07'),'2026-11-14');
assert.equal(M.expiryPreset('month','2027-01-31'),'2027-02-28');
assert.equal(M.expiryPreset('month','2028-01-31'),'2028-02-29');
console.log('PASS quick expiry dates across month/year boundaries and leap years');

const priorityRows=[
 {id:'general-ready',name:'א כללי',quantity:2,location:'House'},
 {id:'bath-ready',name:'א רחצה',quantity:2,location:'Shower'},
 {id:'kitchen-ready',name:'ת מטבח',quantity:2,location:'Pantry'},
 {id:'general-low',name:'כללי חסר',quantity:1,desiredAmount:3,location:'House'},
 {id:'bath-out',name:'רחצה אזל',quantity:0,location:'Toilet',expiryDate:'2026-11-01'},
 {id:'kitchen-out',name:'מטבח אזל',quantity:0,location:'Fridge'},
 {id:'general-expiry',name:'כללי תוקף',quantity:1,location:'House',expiryDate:'2026-11-11'},
 {id:'bath-expired',name:'רחצה פג',quantity:1,location:'Shower',expiryDate:'2026-11-09'}
];
const snapshot=JSON.stringify(priorityRows);
assert.deepEqual(priorityRows.slice().sort((a,b)=>M.comparePriority(a,b,'2026-11-10')).map(row=>row.id),['bath-expired','general-expiry','kitchen-out','bath-out','general-low','kitchen-ready','bath-ready','general-ready']);
assert.equal(JSON.stringify(priorityRows),snapshot);
assert.equal(M.prioritySpace({categoryId:'grains'}),'Kitchen','shopping food without a saved location sorts in kitchen');
assert.equal(M.prioritySpace({categoryId:'dental'}),'Bathroom');
assert.equal(M.prioritySpace({categoryId:'laundry'}),'House');
assert.equal(M.prioritySpace({categoryId:'dental',location:'Pantry'}),'Kitchen','explicit placement overrides category');
console.log('PASS shared priority: nearest expiry, shortages, Kitchen/Bathroom/General, shopping category fallback and unchanged records');

const storageCases=[
 [{he:'חלב',categoryId:'dairy'},'Fridge'],
 [{he:'גבינה צהובה',categoryId:'dairy'},'Fridge'],
 [{he:'עגבניות',categoryId:'produce'},'Fridge'],
 [{he:'פסק זמן',categoryId:'snacks'},'Pantry'],
 [{he:'אורז',categoryId:'grains'},'Pantry'],
 [{he:'חלב עמיד',categoryId:'dairy'},'Pantry'],
 [{name:'UHT milk',categoryId:'dairy'},'Pantry'],
 [{name:'Canned tuna',categoryId:'meat'},'Pantry'],
 [{he:'אפונה קפואה',categoryId:'produce'},'Freezer'],
 [{name:'Pizza',categoryId:'other',categories_tags:['en:frozen-foods']},'Freezer'],
 [{he:'גלידת וניל',categoryId:'dairy'},'Freezer'],
 [{he:'נייר טואלט',categoryId:'household'},'Toilet'],
 [{he:'משחת שיניים',productType:'beauty',categoryId:'care'},'Toilet'],
 [{he:'סבון ידיים',categoryId:'care'},'Toilet'],
 [{he:'שמפו',productType:'beauty'},'Shower'],
 [{name:'Body wash',categoryId:'care'},'Shower'],
 [{he:'נוזל כביסה',categoryId:'household'},'House'],
 [{he:'טבליות למדיח',categoryId:'household'},'House'],
 [{he:'נייר אפייה',categoryId:'paper'},'Pantry'],
 [{name:'Dog food',productType:'petfood'},'House'],
 [{categoryId:'other'},'Pantry'],
 [{he:'חלב',categoryId:'dairy',location:'Freezer'},'Freezer'],
 [{he:'חלב',categoryId:'dairy',location:'invalid'},'Fridge']
];
for(const [product,location] of storageCases){const snapshot=JSON.stringify(product);assert.equal(M.scanLocation(product),location,JSON.stringify(product));assert.equal(JSON.stringify(product),snapshot);}
console.log('PASS scan storage: 23 Hebrew/English/category/tag cases, shelf-stable and frozen exceptions, valid saved location priority, no record mutation');

const cracker={id:'cracker',name:'קרקרים',nameEn:'Crackers',unit:'pack',quantity:2,desiredAmount:2,updatedAt:'2026-11-10T10:00:00Z'};
const plannedCracker={id:'buy-cracker',name:'קרקרים',unit:'pack',quantity:1};
let covered=M.shoppingCoverage([cracker],[plannedCracker]);assert.equal(covered.length,1);assert.equal(covered[0].quantity,2);assert.equal(covered[0].target,2);
const kept={...plannedCracker,stockReviewKeep:covered[0].fingerprint};assert.equal(M.shoppingCoverage([cracker],[kept]).length,0);
assert.equal(M.shoppingCoverage([{...cracker,quantity:3}],[kept]).length,1);
assert.equal(M.shoppingCoverage([{...cracker,desiredAmount:3}],[kept]).length,0);
assert.equal(M.shoppingCoverage([{...cracker,desiredAmount:1}],[kept]).length,1);
assert.equal(M.shoppingCoverage([{...cracker,quantity:1}],[plannedCracker]).length,0);
assert.equal(M.shoppingCoverage([{...cracker,desiredAmount:0}],[plannedCracker]).length,0);
assert.equal(M.shoppingCoverage([cracker],[{...plannedCracker,unit:'kg'}]).length,0);
assert.equal(M.shoppingCoverage([cracker],[{...plannedCracker,purchased:true}]).length,0);
assert.equal(M.shoppingCoverage([cracker],[{...plannedCracker,name:'CRACKERS'}]).length,1);
assert.equal(M.shoppingCoverage([cracker],[{...plannedCracker,name:'קרקרים אחרים'}]).length,0);
assert.equal(plannedCracker.stockReviewKeep,undefined,'coverage never mutates the shopping record');
console.log('PASS shopping coverage: target threshold, same-unit/name matching, keep acknowledgement and invalidation, no automatic deletion');

for(const [raw,unit,wanted] of [['200 g',null,'200 גרם'],['100.000','גרם','100 גרם'],['1L',null,'1 ליטר'],['500 מ״ל',null,'500 מ״ל'],['0.5 kg',null,'0.5 ק״ג'],['6 x 125g',null,'6 x 125g'],['100.000',null,null],['',null,null]])assert.equal(M.packageSize(raw,unit),wanted);
console.log('PASS package contents remain separate from stock count, normalized g/kg/ml/L, multipacks retained and unitless quantities not invented');
