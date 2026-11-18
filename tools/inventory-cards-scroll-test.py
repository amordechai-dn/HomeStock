"""Browser regression for scroll-preserving stock/shopping updates and card preference.
Run through webapp-testing's with_server helper against an isolated local server.
"""
from playwright.sync_api import sync_playwright
import os
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for width,height in [(320,740),(390,844),(1440,1000)]:
  context=browser.new_context(viewport={'width':width,'height':height},service_workers='block')
  page=context.new_page();page.add_init_script("window.__scrollCalls=[];const originalScrollTo=window.scrollTo.bind(window);window.scrollTo=(...args)=>{const before=scrollY;originalScrollTo(...args);window.__scrollCalls.push({args,before,after:scrollY,stack:new Error().stack});};window.addEventListener('pointerdown',()=>window.__pointerY=scrollY);");errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('HOMESTOCK_QA_URL','http://127.0.0.1:8769'));page.wait_for_load_state('networkidle')
  page.evaluate("""async()=>{localStorage.setItem('homestock.profileChosen','1');App.start();await new Promise(r=>setTimeout(r,100));for(let i=0;i<60;i++){await PantryDB.create({name:'מוצר בדיקה '+String(i).padStart(2,'0'),quantity:2,desiredAmount:1,unit:'pack',location:'Pantry',categoryId:'dry'});await PantryDB.putShopping({id:'qa-shop-'+i,name:'ברשימה '+String(i).padStart(2,'0'),quantity:1,unit:'pack'});}App.start();}""")
  page.get_by_role('button',name='מלאי',exact=True).click();page.wait_for_selector('.stock-view-switch');page.wait_for_timeout(250)
  assert page.locator('.stock-cards').count()==(1 if width<=760 else 0),'phone default is cards'
  def stationary(before,label):
   page.wait_for_timeout(200);after=page.evaluate('scrollY');assert abs(after-before)<3,(width,label,before,after,page.evaluate('({pointer:window.__pointerY,calls:window.__scrollCalls.slice(-5)})'))
  for view in ['טבלה','כרטיסיות']:
   page.get_by_role('button',name=view,exact=True).click();page.wait_for_timeout(100)
   selector='.stock-table tbody tr[data-item-id]' if view=='טבלה' else '.stock-cards>.card'
   row=page.locator(selector).nth(25);identity=row.get_attribute('data-item-id');finished=row.locator('.item-finished');finished.scroll_into_view_if_needed();page.wait_for_timeout(100)
   before=page.evaluate('scrollY');assert before>300
   horizontal=page.locator('.stock-table-scroll').evaluate('(e)=>e.scrollLeft') if view=='טבלה' else None
   finished.click();page.wait_for_function('async(id)=>(await PantryDB.getItem(id)).quantity===0',arg=identity);stationary(before,view+' finished')
   if horizontal is not None:assert abs(page.locator('.stock-table-scroll').evaluate('(e)=>e.scrollLeft')-horizontal)<3
   page.get_by_role('button',name='הוספה לקניות',exact=True).click();page.wait_for_function('async()=>(await PantryDB.getAllShopping()).length>=61');stationary(before,view+' add to shopping')
   assert page.url.endswith('#/stock')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,view,'page overflow')
  # The card layout itself must fit its quantity buttons and text.
  for card in page.locator('.stock-cards>.card').all():
   assert card.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(width,'card overflow')
  edit=page.locator('.stock-cards>.card').nth(18);edit_id=edit.get_attribute('data-item-id');edit.locator('.item-open').scroll_into_view_if_needed();before=page.evaluate('scrollY');edit.locator('.item-open').click();page.locator('textarea[aria-label="הערה למוצר"]').fill('עריכת כרטיסייה לבדיקה');page.locator('.editor-save').click();page.wait_for_selector('.product-editor',state='detached');stationary(before,'card edit/save');assert page.evaluate('async(id)=>(await PantryDB.getItem(id)).note',edit_id)=='עריכת כרטיסייה לבדיקה'
  page.get_by_role('combobox',name='מצב המוצרים',exact=True).click();page.get_by_role('option',name='להשלמה',exact=True).click();assert page.locator('.stock-cards>.card').count()==2
  page.get_by_role('combobox',name='מצב המוצרים',exact=True).click();page.get_by_role('option',name='כל המוצרים',exact=True).click()
  page.evaluate('scrollTo(0,0)');page.screenshot(path=f'/tmp/homestock-inventory-cards-{width}.png')
  page.reload();page.wait_for_load_state('networkidle');page.wait_for_selector('.stock-cards');assert page.locator('.stock-view-switch [aria-pressed=true]').inner_text()=='כרטיסיות'
  page.get_by_role('button',name='רשימת קניות',exact=True).click();page.wait_for_selector('.shopping-row');page.wait_for_timeout(300);row=page.locator('[data-shopping-id="qa-shop-25"]');plus=row.get_by_role('button',name='הגדלת כמות ברשימה 25',exact=True);plus.scroll_into_view_if_needed();before=page.evaluate('scrollY');plus.click();page.wait_for_function("document.querySelector('[data-shopping-id=qa-shop-25] .shopping-qty-value').textContent==='2'");stationary(before,'shopping quantity')
  row=page.locator('[data-shopping-id="qa-shop-25"]');row.locator('.shopping-remove').click();page.wait_for_selector('[data-shopping-id="qa-shop-25"]',state='detached');stationary(before,'shopping remove')
  assert not errors,errors
  context.close();print(f'PASS {width}px: cards/table, finished/add-to-shopping scroll, table horizontal scroll, remembered view, shopping quantity/remove and no overflow',flush=True)
 browser.close()
