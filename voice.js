/* Parse Hebrew shopping descriptions locally; always review before saving. */
(function(root){
'use strict';
function parse(text){
 var s=String(text||'').trim(),result={};
 var numbers={'אחד':1,'אחת':1,'שני':2,'שתי':2,'שניים':2,'שתיים':2,'שלוש':3,'שלושה':3,'ארבע':4,'ארבעה':4,'חמש':5,'חמישה':5,'שש':6,'שישה':6,'שבע':7,'שבעה':7,'שמונה':8,'תשע':9,'תשעה':9,'עשר':10,'עשרה':10,'חצי':0.5};
 var n='(?:\\d+(?:[.,]\\d+)?|'+Object.keys(numbers).sort(function(a,b){return b.length-a.length;}).join('|')+')';
 var units={'קילו':'kg','קילוגרם':'kg','קילוגרמים':'kg','ק״ג':'kg','ק"ג':'kg','גרם':'g','ליטר':'L','מיליליטר':'ml','חבילות':'pack','חבילה':'pack','יחידות':'pcs','יחידה':'pcs','קרטונים':'pack','קרטוני':'pack','קופסאות':'box','קופסה':'box'};
 var u='(?:'+Object.keys(units).sort(function(a,b){return b.length-a.length;}).join('|')+')';
 function number(v){return Object.prototype.hasOwnProperty.call(numbers,v)?numbers[v]:Number(v.replace(',','.'));}
 s=s.replace(/^(?:תוסיף|תוסיפי|הוסף|הוסיפי|להוסיף)\s+/,'');
 var price=s.match(new RegExp('(?:כל\\s+('+u+')\\s+|(?:במחיר|מחיר)\\s+|ב[-־]?)('+n+')\\s*(?:שקלים|שקל|ש״ח|ש"ח)(?:\\s*(?:ליחידה|לקילו|לקילוגרם))?'));
 // A price introduced explicitly also works when the currency was omitted.
 if(!price)price=s.match(new RegExp('(?:במחיר|מחיר)\\s+()('+n+')(?:\\s+ליחידה)?'));
 if(price){result.unitPriceAgorot=Math.round(number(price[2])*100);if(price[1])result.unit=units[price[1]];s=s.replace(price[0],' ');}
 var places=[['מקרר','Fridge'],['מקפיא','Freezer'],['מזווה','Pantry'],['מקלחת','Shower'],['שירותים','Toilet'],['כללי','House']];
 places.forEach(function(p){var pattern=new RegExp('(?:^|\\s)[לב]?'+p[0]+'(?=\\s|$|[,.])');if(pattern.test(s)){result.location=p[1];s=s.replace(pattern,' ');}});
 var date=s.match(/(?:בתוקף עד|תאריך תפוגה|תוקף עד)\s+(\d{4}-\d{2}-\d{2})/);
 if(date){result.expiryDate=date[1];s=s.replace(date[0],' ');}
 var qty=s.match(new RegExp('(?:^|\\s)('+n+')\\s+('+u+')(?=\\s|$|[,.])'));
 if(qty){result.quantity=number(qty[1]);result.unit=units[qty[2]];s=s.replace(qty[0],' ');}
 else {qty=s.match(new RegExp('^('+n+')\\s+'));if(qty){result.quantity=number(qty[1]);s=s.slice(qty[0].length);}}
 result.name=s.replace(/^[\s,]+|[\s,.]+$/g,'').replace(/\s+/g,' ');return result;
}
root.HomeVoice={parse:parse};
})(typeof window!=='undefined'?window:globalThis);
