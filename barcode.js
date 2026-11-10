/* Shared camera/manual barcode lookup. No public database writes or credentials. */
(function(root){
  'use strict';
  function normalize(value){return String(value||'').trim().replace(/[\u0660-\u0669]/g,function(c){return String(c.charCodeAt(0)-0x660);}).replace(/[\u06f0-\u06f9]/g,function(c){return String(c.charCodeAt(0)-0x6f0);}).replace(/[\s\u200e\u200f\u202a-\u202e]/g,'').slice(0,128);}
  function key(value){var code=normalize(value);if(/^\d{12}$/.test(code))return '0'+code;if(/^0\d{13}$/.test(code))return code.slice(1);return code;}
  function variants(value){var raw=normalize(value),canonical=key(raw),out=[raw];if(out.indexOf(canonical)<0)out.push(canonical);if(/^0\d{12}$/.test(canonical)&&out.indexOf(canonical.slice(1))<0)out.push(canonical.slice(1));if(/^\d{13}$/.test(canonical))out.push('0'+canonical);return out;}
  function checksum(code){code=normalize(code);if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code))return false;var sum=0;for(var i=code.length-2,m=3;i>=0;i--,m=m===3?1:3)sum+=Number(code[i])*m;return (10-sum%10)%10===Number(code[code.length-1]);}
  function sourceUrl(type){return 'https://world.'+({beauty:'openbeautyfacts',product:'openproductsfacts',petfood:'openpetfoodfacts'}[type]||'openfoodfacts')+'.org';}
  function portable(rec){var out=Object.assign({},rec);delete out.image;return out;}
  function createLookup(options){
    var inFlight=new Map(),misses=new Map(),requests=[],blockedUntil=0;
    var now=options.now||Date.now,timeout=options.timeout||8000;
    function fallback(code,reason){return {source:reason==='offline'?'offline':'new',product:{barcode:code,categoryId:'other',unit:'pcs'},reason:reason};}
    async function local(code){
      var canonical=key(code),items=options.items();
      // Exact identity wins before UPC/EAN equivalent representations.
      var item=items.find(function(row){return normalize(row.barcode)===code;})||items.find(function(row){return row.barcode&&key(row.barcode)===canonical;});
      if(item)return {source:'inventory',item:item};
      for(var alias of variants(code)){
        try{var product=await options.db.getBarcode(alias);if(product)return {source:'cache',product:product};}catch(e){/* still allow public lookup */}
      }
      return null;
    }
    async function online(code){
      if(options.online()===false)return fallback(code,'offline');
      if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code))return fallback(code,'format');
      var canonical=key(code),at=now();
      if((misses.get(canonical)||0)>at)return fallback(code,'notfound');
      requests=requests.filter(function(time){return at-time<60000;});
      if(at<blockedUntil||requests.length>=12)return fallback(code,'rate-limit');
      requests.push(at);
      var controller=new AbortController(),timer;
      try{
        var url='https://world.openfoodfacts.org/api/v3/product/'+encodeURIComponent(code)+'?product_type=all&fields=code,product_type,product_name,product_name_en,product_name_he,generic_name,brands,categories_tags,image_front_small_url,image_small_url,image_front_url,quantity,product_quantity,product_quantity_unit';
        var work=Promise.resolve().then(function(){return options.fetch(url,{signal:controller.signal,credentials:'omit'});}).then(async function(response){
          if(response.status===429){var retry=response.headers&&response.headers.get('Retry-After');blockedUntil=now()+Math.max(60000,(Number(retry)||0)*1000);return fallback(code,'rate-limit');}
          if(response.status===404){misses.set(canonical,now()+300000);return fallback(code,'notfound');}
          if(!response.ok)throw new Error('unreachable');
          var data=await response.json(),product=data&&data.product;
          if(!product||!(data.status===1||data.status==='success'||data.result&&data.result.status==='found')){misses.set(canonical,now()+300000);return fallback(code,'notfound');}
          var mapped=await options.map(product,code);
          if(!mapped||!String(mapped.name||mapped.he||'').trim()){misses.set(canonical,now()+300000);return fallback(code,'notfound');}
          mapped.barcode=code;mapped.source='off';
          try{await options.db.putBarcode(mapped);}catch(e){/* product can still be reviewed/saved */}
          return {source:'off',product:mapped};
        });
        return await Promise.race([work,new Promise(function(resolve){timer=setTimeout(function(){controller.abort();resolve(fallback(code,'unreachable'));},timeout);})]);
      }catch(e){return fallback(code,'unreachable');}
      finally{clearTimeout(timer);}
    }
    return async function(value,refresh){
      var code=normalize(value);
      if(!code)return fallback(code,'format');
      try{
        var cached=refresh?null:await local(code);if(cached)return cached;
        var canonical=key(code);if(inFlight.has(canonical))return inFlight.get(canonical);
        var work=online(code);inFlight.set(canonical,work);
        try{return await work;}finally{inFlight.delete(canonical);}
      }catch(e){return fallback(code,options.online()===false?'offline':'unreachable');}
    };
  }
  function cameraErrorKey(error){
    switch(error&&error.name){
      case 'NotAllowedError':case 'PermissionDeniedError':return 'denied';
      case 'NotFoundError':case 'DevicesNotFoundError':return 'cameraMissing';
      case 'NotReadableError':case 'TrackStartError':case 'AbortError':return 'cameraUnavailable';
      case 'OverconstrainedError':case 'ConstraintNotSatisfiedError':return 'cameraConstraints';
      case 'SecurityError':return 'cameraSecurity';
      default:return 'cameraFailed';
    }
  }
  root.HomeBarcode={cameraErrorKey:cameraErrorKey,normalize:normalize,key:key,variants:variants,checksum:checksum,sourceUrl:sourceUrl,portable:portable,createLookup:createLookup};
})(typeof window!=='undefined'?window:globalThis);
