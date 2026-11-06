/* Pure household view models: no DOM, storage, network, or mutations. */
(function(root){
  'use strict';
  var roomFor={Fridge:'Kitchen',Freezer:'Kitchen',Pantry:'Kitchen',Shower:'Bathroom',Toilet:'Bathroom',House:'House'};
  function space(item){return roomFor[item.location]||'House';}
  function name(item){return item.nameHe||item.name||item.nameEn||'';}
  function normalize(text){return String(text||'').normalize('NFKD').replace(/[\u0591-\u05c7]/g,'').toLocaleLowerCase('he').replace(/["׳״']/g,'').trim().replace(/\s+/g,' ');}
  function state(item){return item.quantity<=0?'out':item.desiredAmount>0&&item.quantity<item.desiredAmount?'low':'ready';}
  function attention(item){return state(item)!=='ready';}
  function summary(items){
    var result={total:items.length,attention:0,out:0,rooms:{}};
    ['Kitchen','Bathroom','House'].forEach(function(id){result.rooms[id]={total:0,attention:0,out:0};});
    items.forEach(function(item){var room=result.rooms[space(item)];room.total++;if(attention(item)){room.attention++;result.attention++;}if(state(item)==='out'){room.out++;result.out++;}});
    return result;
  }
  function select(items,options){
    options=options||{};
    var query=normalize(options.query),terms=query.split(' ').filter(Boolean);
    var rows=items.filter(function(item){
      if(!query&&options.space&&space(item)!==options.space)return false;
      if(!query&&options.location&&options.location!=='all'&&item.location!==options.location)return false;
      var haystack=normalize([item.nameHe,item.name,item.nameEn,item.note].filter(Boolean).join(' '));
      if(!terms.every(function(term){return haystack.indexOf(term)>=0;}))return false;
      if(options.filter==='attention'&&!attention(item))return false;
      if(options.filter==='out'&&state(item)!=='out')return false;
      return true;
    });
    return rows.sort(function(a,b){
      if(options.sort==='recent'){var delta=String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));if(delta)return delta;}
      if(options.sort==='attention'){var score={out:0,low:1,ready:2},delta=score[state(a)]-score[state(b)];if(delta)return delta;}
      return name(a).localeCompare(name(b),'he')||String(a.id).localeCompare(String(b.id));
    });
  }
  function identity(row){return normalize(row.nameEn||row.name||row.nameHe)+'|'+(row.unit||'pcs');}
  // Top up a planned quantity instead of repeatedly increasing it. Include
  // out-of-stock items without a target, using a useful default of one unit.
  function shoppingPlan(items,shopping){
    var wanted={},active={};
    shopping.filter(function(row){return !row.purchased;}).forEach(function(row){var key=identity(row);if(!active[key])active[key]={row:row,quantity:0};active[key].quantity+=row.quantity||1;});
    items.filter(attention).forEach(function(item){var key=identity(item),missing=item.desiredAmount>0?Math.max(0,item.desiredAmount-item.quantity):1;if(!wanted[key])wanted[key]={item:item,quantity:0};wanted[key].quantity+=missing;});
    return Object.keys(wanted).map(function(key){var need=wanted[key],already=active[key];return {item:need.item,quantity:need.quantity-(already?already.quantity:0),existing:already?already.row:null};}).filter(function(row){return row.quantity>0;});
  }
  function purchaseAmount(quantity, unitPrice) {
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || !Number.isFinite(quantity) || quantity <= 0) return null;
    // Multiply the entered decimal quantity as a rational number. Floating
    // point multiplication would incorrectly round e.g. 0.29 × 50 to 14.
    var parts = quantity.toString().toLowerCase().split('e');
    var point = parts[0].indexOf('.');
    var scale = (point < 0 ? 0 : parts[0].length-point-1) - Number(parts[1] || 0);
    var numerator = BigInt(parts[0].replace('.','')) * BigInt(unitPrice);
    var denominator = 1n;
    if(scale > 0) denominator = 10n ** BigInt(scale);
    else if(scale < 0) numerator *= 10n ** BigInt(-scale);
    var amount = (numerator * 2n + denominator) / (denominator * 2n);
    return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
  }

  function shoppingEstimate(rows){
    var total=0,unknown=0;
    rows.filter(function(row){return !row.purchased;}).forEach(function(row){
      if(!Number.isSafeInteger(row.unitPriceAgorot)||row.unitPriceAgorot<0){unknown++;return;}
      var amount=purchaseAmount(row.quantity||1,row.unitPriceAgorot);
      if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(total+amount)){unknown++;return;}
      total+=amount;
    });
    return {totalAgorot:total,unknown:unknown,count:rows.filter(function(row){return !row.purchased;}).length};
  }
  function expensesBySpace(entries){
    var result={Kitchen:0,Bathroom:0,House:0};
    entries.forEach(function(entry){if(Number.isSafeInteger(entry.amountAgorot)&&entry.amountAgorot>=0)result[space(entry)]+=entry.amountAgorot;});
    return result;
  }
  function expenseMonths(current,log){
    var start='2026-11',end=current<start?start:current,keys=[];
    var year=2026,month=11;
    while(year+'-'+String(month).padStart(2,'0')<=end){
      keys.push(year+'-'+String(month).padStart(2,'0'));
      month++;if(month===13){month=1;year++;}
    }
    // Preserve access to recorded past months without generating future months.
    Object.keys(log||{}).forEach(function(key){
      if(/^\d{4}-(0[1-9]|1[0-2])$/.test(key)&&key>=start&&key<=end&&keys.indexOf(key)<0)keys.push(key);
    });
    return keys.sort().reverse();
  }
  root.HomeModel={expenseMonths:expenseMonths,space:space,name:name,normalize:normalize,state:state,attention:attention,summary:summary,select:select,identity:identity,shoppingPlan:shoppingPlan,shoppingEstimate:shoppingEstimate,purchaseAmount:purchaseAmount,expensesBySpace:expensesBySpace};
})(typeof window!=='undefined'?window:globalThis);
