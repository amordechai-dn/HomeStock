from playwright.sync_api import sync_playwright
import os
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for width,height in [(390,844),(320,740),(1440,1000)]:
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('HOMESTOCK_QA_URL','http://127.0.0.1:8769'));page.wait_for_load_state('networkidle')
  page.evaluate("""async()=>{localStorage.setItem('homestock.profileChosen','1');App.start();await new Promise(r=>setTimeout(r,150));for(const row of [{id:'qa-milk',name:'חלב',quantity:2,unit:'pack',categoryId:'dairy',unitPriceAgorot:650},{id:'qa-long',name:'נוזל כביסה מרוכז לבגדים צבעוניים בניחוח פרחים',quantity:1,unit:'pack',categoryId:'laundry'},{id:'qa-rice',name:'אורז בסמטי',quantity:3,unit:'pack',categoryId:'grains',unitPriceAgorot:1200}])await PantryDB.putShopping(row);App.start();}""")
  page.get_by_role('button',name='רשימת קניות',exact=True).click();page.wait_for_selector('.shopping-row')
  assert page.locator('.shopping-row').count()==3
  assert page.locator('.shopping-add').count()==1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'page overflow {width}'
  for row in page.locator('.shopping-row').all():
   boxes=[row.locator(s).bounding_box() for s in ['.shopping-item-open','.shopping-quantity','.shopping-line-price','.shopping-buy','.shopping-remove']]
   for i,a in enumerate(boxes):
    for b in boxes[i+1:]:
     overlap=min(a['x']+a['width'],b['x']+b['width'])-max(a['x'],b['x'])>1 and min(a['y']+a['height'],b['y']+b['height'])-max(a['y'],b['y'])>1
     assert not overlap,f'overlap {width}: {boxes}'
  row=page.locator('[data-shopping-id="qa-milk"]');row.get_by_role('button',name='הגדלת כמות חלב',exact=True).click();page.wait_for_function("document.querySelector('[data-shopping-id=qa-milk] .shopping-qty-value').textContent==='3'")
  assert '19.50' in row.locator('.shopping-line-price').inner_text()
  row.locator('.shopping-item-open').click();page.wait_for_selector('.shopping-editor');page.locator('.shopping-editor .sheet-close').click()
  row.locator('.shopping-remove').click();page.wait_for_function("!document.querySelector('[data-shopping-id=qa-milk]')");page.locator('.toast-undo').click();page.wait_for_selector('[data-shopping-id="qa-milk"]')
  row.locator('.shopping-buy').click();page.wait_for_selector('.purchase-review');page.locator('.purchase-review .btn.cancel').click();assert page.locator('[data-shopping-id="qa-milk"]').count()==1
  page.screenshot(path=f'/tmp/homestock-shopping-{width}.png',full_page=True)
  row.locator('.shopping-buy').click();page.locator('.purchase-review .btn.save').click();page.wait_for_function("!document.querySelector('[data-shopping-id=qa-milk]')");assert page.locator('.shopping-bought').count()==0
  result=page.evaluate("async()=>({items:await PantryDB.getAll(),shopping:await PantryDB.getAllShopping(),log:PantryDB.getMonthlyLog()})")
  assert len(result['items'])==1 and result['items'][0]['quantity']==3
  assert sum(e['amountAgorot'] for m in result['log'].values() for e in m.get('expenses',[]))==1950
  assert not errors,errors
  context.close();print(f'PASS {width}px: no overflow/overlap, add/edit, quantity/price, delete/undo, purchase review/cancel/confirm and expense')
 browser.close()
