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
  function packageSize(raw,unit){
    var value=String(raw||'').trim();
    if(!value)return null;
    if(unit)value=value+' '+String(unit).trim();
    value=value.replace(/[״"]/g,'').replace(/\s+/g,' ');
    var match=value.match(/^(\d+(?:[.,]\d+)?)\s*(kg|קג|קילוגרם|g|gr|גרם|גר|ml|מל|מיליליטר|l|ליטר)$/i);
    if(match){var n=Number(match[1].replace(',','.'));if(!Number.isFinite(n)||n<=0||n>1000000)return null;
      var key=match[2].toLowerCase(),label=/^(kg|קג|קילוגרם)$/.test(key)?'ק״ג':/^(g|gr|גרם|גר)$/.test(key)?'גרם':/^(ml|מל|מיליליטר)$/.test(key)?'מ״ל':'ליטר';
      return String(n)+' '+label;
    }
    return !unit&&/[0-9]/.test(value)&&/(?:kg|gr?|ml|\bl\b|גרם|גר|קג|מל|ליטר)/i.test(value)?value.slice(0,80):null;
  }
  // A reviewable storage suggestion; previously saved placement always wins.
  function scanLocation(product){
    product=product||{};
    if(roomFor[product.location])return product.location;
    var text=normalize([product.he,product.name,product.nameHe,product.nameEn,product.generic_name,(product.categories_tags||[]).join(' ')].filter(Boolean).join(' '));
    var category=product.categoryId||product.category||'other',type=product.productType||product.product_type;
    if(/נייר טואלט|אסלה|מנקה אסלות|toilet|toothpaste|toothbrush|dental|משחת שיניים|מברשת שיניים|סבון ידיים|hand soap|תחבושות|טמפונים|tampon|sanitary pad/.test(text))return 'Toilet';
    if(/נייר אפייה|נייר כסף|baking paper|aluminum foil|aluminium foil|kitchen towel|נייר סופג/.test(text))return 'Pantry';
    if(/כביסה|מדיח|ניקוי|אקונומיקה|laundry|dishwash|detergent|bleach|cleaner/.test(text))return 'House';
    if(/שמפו|מרכך שיער|מסכת שיער|גוף|מקלחת|shampoo|conditioner|body wash|shower gel/.test(text))return 'Shower';
    if(type==='beauty'||['care','hair','skincare'].indexOf(category)>=0)return 'Shower';
    if(['dental','hygiene','paper'].indexOf(category)>=0)return 'Toilet';
    if(type==='product'||type==='petfood'||['household','cleaning','laundry','dishwashing','health','baby','pets','disposables'].indexOf(category)>=0)return 'House';
    if(category==='frozen'||/frozen|ice[ -]?cream|גליד[הת]|קפוא|מוקפא|ארטיק|שלגון/.test(text))return 'Freezer';
    if(/canned|tinned|שימור|משומר|אבקת חלב|milk powder|uht|long[ -]?life|עמיד/.test(text))return 'Pantry';
    if(['dairy','meat','produce','fruit'].indexOf(category)>=0)return 'Fridge';
    if(/יוגורט|גבינ[הת]|גבינות|סימפוניה|symphonia|symphony|חלב|חמאה|שמנת|ביצים|yogurt|cheese|milk|butter|cream|eggs/.test(text)&&category==='other')return 'Fridge';
    return 'Pantry';
  }
  function prioritySpace(item){
    if(roomFor[item.location])return space(item);
    if(['care','dental','hair','skincare','hygiene','paper'].indexOf(item.categoryId)>=0)return 'Bathroom';
    if(['produce','fruit','dairy','meat','bakery','grains','pasta','dry','frozen','snacks','spreads','baking','condiments','oils','drinks','hotdrinks','alcohol'].indexOf(item.categoryId)>=0)return 'Kitchen';
    return 'House';
  }
  function comparePriority(a,b,today){
    function priority(item){var due=expiry(item,today);return item.quantity>0&&due&&due.urgent?0:attention(item)?1:2;}
    var delta=priority(a)-priority(b);if(delta)return delta;
    if(priority(a)===0){delta=String(a.expiryDate).localeCompare(String(b.expiryDate));if(delta)return delta;}
    if(priority(a)===1){delta=(state(a)==='out'?0:1)-(state(b)==='out'?0:1);if(delta)return delta;}
    var rooms={Kitchen:0,Bathroom:1,House:2};
    return rooms[prioritySpace(a)]-rooms[prioritySpace(b)]||name(a).localeCompare(name(b),'he')||String(a.id||'').localeCompare(String(b.id||''));
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
      if(!options.sort||options.sort==='attention')return comparePriority(a,b);
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
  // Review only: never remove shopping entries or mutate either source.
  function shoppingCoverage(items,shopping){
    function aliases(row){return [row.name,row.nameHe,row.nameEn].filter(Boolean).map(normalize).filter(Boolean);}
    return shopping.filter(function(row){return !row.purchased;}).map(function(shop){
      var names=aliases(shop),unit=shop.unit||'pcs';
      var matched=items.filter(function(item){return (item.unit||'pcs')===unit&&((item.barcode&&shop.barcode&&item.barcode===shop.barcode)||aliases(item).some(function(value){return names.indexOf(value)>=0;}));});
      if(!matched.length||matched.some(function(item){return !Number.isFinite(item.desiredAmount)||item.desiredAmount<=0||!Number.isFinite(item.quantity)||item.quantity<0;}))return null;
      var quantity=matched.reduce(function(sum,item){return sum+item.quantity;},0),target=matched.reduce(function(sum,item){return sum+item.desiredAmount;},0);
      if(quantity<target)return null;
      var fingerprint=JSON.stringify([unit,shop.quantity,matched.slice().sort(function(a,b){return String(a.id).localeCompare(String(b.id));}).map(function(item){return [item.id,item.quantity,item.desiredAmount,item.updatedAt||''];})]);
      return shop.stockReviewKeep===fingerprint?null:{shop:shop,quantity:quantity,target:target,unit:unit,fingerprint:fingerprint};
    }).filter(Boolean);
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
  function expiry(item,today){
    if(item.noExpiry||!item.expiryDate)return null;
    function utc(value){var p=value.split('-').map(Number);return Date.UTC(p[0],p[1]-1,p[2]);}
    var now=today||new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0');
    var days=Math.round((utc(item.expiryDate)-utc(now))/86400000);
    if(!Number.isFinite(days))return null;
    return {days:days,label:days<0?'פג התוקף':days===0?'התוקף מסתיים היום':days===1?'התוקף מסתיים מחר':'תוקף בעוד '+days+' ימים',urgent:days<=7};
  }
  function expiryPreset(value,base){
    var date=base?new Date(base+'T12:00:00'):new Date();
    if(value==='month'){
      var day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()+1);
      var last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();date.setDate(Math.min(day,last));
    }else date.setDate(date.getDate()+Number(value));
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }
  root.HomeModel={packageSize:packageSize,shoppingCoverage:shoppingCoverage,scanLocation:scanLocation,comparePriority:comparePriority,prioritySpace:prioritySpace,expiryPreset:expiryPreset,expiry:expiry,expenseMonths:expenseMonths,space:space,name:name,normalize:normalize,state:state,attention:attention,summary:summary,select:select,identity:identity,shoppingPlan:shoppingPlan,shoppingEstimate:shoppingEstimate,purchaseAmount:purchaseAmount,expensesBySpace:expensesBySpace};
})(typeof window!=='undefined'?window:globalThis);
