/* Pure migration and package accounting. Existing stock is never invented. */
(function(root){'use strict';
function normalize(item){
 var out=Object.assign({},item),qty=Math.max(0,Number(item.quantity)||0);
 var batches=Array.isArray(item.batches)?item.batches.filter(b=>b&&Number.isFinite(b.quantity)&&b.quantity>0).map(b=>Object.assign({},b,{expiryDate:typeof b.expiryDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.expiryDate)?b.expiryDate:null})):[];
 if(!Array.isArray(item.batches)&&qty)batches=[{id:'legacy-'+item.id,quantity:qty,expiryDate:item.noExpiry?null:item.expiryDate||null}];
 batches.sort((a,b)=>(a.expiryDate||'9999').localeCompare(b.expiryDate||'9999'));
 var total=batches.reduce((n,b)=>n+b.quantity,0),delta=qty-total;
 if(delta>0)batches.push({id:'batch-'+Date.now()+'-'+Math.random().toString(36).slice(2),quantity:delta,expiryDate:item.expiryDate||null});
 if(delta<0){var remaining=-delta;batches.forEach(b=>{var used=Math.min(remaining,b.quantity);b.quantity-=used;remaining-=used;});}
 out.batches=batches.filter(b=>b.quantity>0);out.expiryDate=out.batches.map(b=>b.expiryDate).filter(Boolean).sort()[0]||null;out.quantity=qty;return out;
}
function add(item,quantity,date){var out=normalize(item);out.batches.push({id:'batch-'+Date.now()+'-'+Math.random().toString(36).slice(2),quantity:quantity,expiryDate:date||null});out.quantity+=quantity;return normalize(out);}
root.HomePackages={normalize:normalize,add:add};
})(typeof window!=='undefined'?window:globalThis);
