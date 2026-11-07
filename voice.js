/* Small local parser: ambiguous speech remains visible for review. */
(function(root){
'use strict';
function parse(text){
 var s=String(text||'').trim(),result={quantity:1},numbers={'אחד':1,'אחת':1,'שני':2,'שתי':2,'שניים':2,'שתיים':2,'שלוש':3,'שלושה':3,'ארבע':4,'ארבעה':4,'חמש':5,'חמישה':5,'שש':6,'שישה':6,'שבע':7,'שבעה':7,'שמונה':8,'תשע':9,'עשר':10};
 s=s.replace(/^(?:תוסיף|תוסיפי|הוסף|הוסיפי|להוסיף)\s+/,'');
 var price=s.match(/(?:במחיר|מחיר)\s+(\d+(?:[.,]\d{1,2})?|[א-ת]+)\s*(?:שקלים|שקל|ש״ח)?(?:\s*ליחידה)?/);
 if(price){var amount=Number(price[1].replace(',','.'));if(!Number.isFinite(amount))amount=numbers[price[1]];if(Number.isFinite(amount))result.unitPriceAgorot=Math.round(amount*100);s=s.replace(price[0],'');}
 var places=[['למקרר','Fridge'],['למקפיא','Freezer'],['למזווה','Pantry'],['למקלחת','Shower'],['לשירותים','Toilet'],['לכללי','House']];
 places.forEach(function(p){if(s.includes(p[0])){result.location=p[1];s=s.replace(p[0],'');}});
 var date=s.match(/(?:בתוקף עד|תאריך תפוגה|תוקף עד)\s+(\d{4}-\d{2}-\d{2})/);
 if(date){result.expiryDate=date[1];s=s.replace(date[0],'');}
 var qty=s.match(/^(\d+(?:[.,]\d+)?|אחד|אחת|שני|שתי|שניים|שתיים|שלוש|שלושה|ארבע|ארבעה|חמש|חמישה|שש|שישה|שבע|שבעה|שמונה|תשע|עשר)\s+/);
 if(qty){result.quantity=numbers[qty[1]]||Number(qty[1].replace(',','.'));s=s.slice(qty[0].length);}
 result.name=s.replace(/^[\s,]+|[\s,.]+$/g,'').replace(/\s+/g,' ');return result;
}
root.HomeVoice={parse:parse};
})(typeof window!=='undefined'?window:globalThis);
