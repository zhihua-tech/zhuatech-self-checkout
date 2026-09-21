/**
 * 上海如静知华信息科技有限公司 https://www.zhuatech.cn/
 * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
 */
import crypto from 'node:crypto';
const now=()=>new Date().toISOString(),uid=p=>`${p}_${crypto.randomUUID().replaceAll('-','').slice(0,12)}`,clone=v=>structuredClone(v);
const required=(v,n)=>{if(v===undefined||v===null||String(v).trim()==='')throw new Error(`${n}不能为空`);return String(v).trim()},positive=(v,n)=>{const x=Number(v);if(!Number.isFinite(x)||x<=0)throw new Error(`${n}必须大于0`);return x},money=v=>Number(Number(v).toFixed(2));

/**
 * 零售自助结算领域服务，覆盖商品、库存、购物篮、促销、挂单、防损例外、支付、票据和审计。
 * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
 */
export class CheckoutService {
  /** 初始化自助结算领域状态。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  constructor(seed={}) {
    for(const key of ['stores','terminals','products','stocks','baskets','exceptions','receipts'])this[key]=new Map((seed[key]||[]).map(x=>[x.id,x]));
    this.payments=new Map((seed.payments||[]).map(x=>[x.id,x])); this.paymentRequests=new Map(seed.paymentRequests||[]); this.audit=seed.audit||[];
  }

  /** 新建门店并配置税率与币种。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  createStore(input,actor='admin') {const code=required(input.code,'门店编码');if([...this.stores.values()].some(x=>x.code===code))throw new Error('门店编码已存在');const store={id:uid('store'),code,name:required(input.name,'门店名称'),address:required(input.address,'地址'),currency:'CNY',taxRate:Number(input.taxRate||0),status:'active',createdAt:now()};this.stores.set(store.id,store);this.#record(actor,'STORE_CREATED',store.id,{code});return clone(store)}

  /** 注册自助收银机并生成设备令牌。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  registerTerminal(input,actor='engineer') {if(!this.stores.has(input.storeId))throw new Error('门店不存在');const code=required(input.code,'终端编码');if([...this.terminals.values()].some(x=>x.code===code))throw new Error('终端编码已存在');const terminal={id:uid('sco'),storeId:input.storeId,code,model:input.model||'SCO-15',status:'online',laneStatus:'open',appVersion:input.appVersion||'1.0.0',token:crypto.randomBytes(18).toString('hex'),lastHeartbeatAt:now(),createdAt:now()};this.terminals.set(terminal.id,terminal);this.#record(actor,'TERMINAL_REGISTERED',terminal.id,{code});return clone(terminal)}

  /** 建立商品档案并约束条码唯一性和防损属性。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  createProduct(input,actor='merchandiser') {const barcode=required(input.barcode,'商品条码');if([...this.products.values()].some(x=>x.barcode===barcode))throw new Error('商品条码已存在');const product={id:uid('sku'),sku:required(input.sku,'SKU'),barcode,name:required(input.name,'商品名称'),price:money(positive(input.price,'售价')),unitWeightGrams:Number(input.unitWeightGrams||0),ageRestricted:Boolean(input.ageRestricted),status:'active',createdAt:now()};this.products.set(product.id,product);this.#record(actor,'PRODUCT_CREATED',product.id,{barcode});return clone(product)}

  /** 入库或调整门店可售库存，库存不得为负。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  adjustStock(input,actor='inventory') {if(!this.stores.has(input.storeId)||!this.products.has(input.productId))throw new Error('门店或商品不存在');const found=[...this.stocks.values()].find(x=>x.storeId===input.storeId&&x.productId===input.productId);const delta=Number(input.delta);if(!Number.isInteger(delta)||delta===0)throw new Error('库存变更量必须为非零整数');const next=(found?.quantity||0)+delta;if(next<0)throw new Error('库存不足');const stock=found||{id:uid('stock'),storeId:input.storeId,productId:input.productId,quantity:0,reserved:0,updatedAt:now()};stock.quantity=next;stock.updatedAt=now();this.stocks.set(stock.id,stock);this.#record(actor,'STOCK_ADJUSTED',stock.id,{delta,quantity:next});return clone(stock)}

  /** 在可用终端开启唯一购物篮。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  openBasket(input,actor='shopper') {const terminal=this.terminals.get(input.terminalId);if(!terminal||terminal.status!=='online'||terminal.laneStatus!=='open')throw new Error('终端当前不可结算');if([...this.baskets.values()].some(x=>x.terminalId===terminal.id&&x.status==='active'))throw new Error('终端已有进行中的购物篮');const basket={id:uid('basket'),terminalId:terminal.id,storeId:terminal.storeId,memberId:input.memberId||null,lines:[],subtotal:0,discount:0,payable:0,status:'active',createdAt:now()};this.baskets.set(basket.id,basket);this.#record(actor,'BASKET_OPENED',basket.id,{terminalId:terminal.id});return clone(basket)}

  /** 扫码加入商品，校验库存并对称重偏差和年龄限制创建防损例外。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  scanItem(basketId,input,actor='shopper') {const basket=this.#activeBasket(basketId),product=[...this.products.values()].find(x=>x.barcode===String(input.barcode)&&x.status==='active');if(!product)throw new Error('商品条码无效');const qty=Number(input.quantity||1);if(!Number.isInteger(qty)||qty<=0)throw new Error('数量必须为正整数');const stock=[...this.stocks.values()].find(x=>x.storeId===basket.storeId&&x.productId===product.id);const inBasket=basket.lines.filter(x=>x.productId===product.id).reduce((s,x)=>s+x.quantity,0);if(!stock||stock.quantity-stock.reserved<inBasket+qty)throw new Error('门店库存不足');const line={id:uid('line'),productId:product.id,name:product.name,barcode:product.barcode,quantity:qty,unitPrice:product.price,amount:money(product.price*qty),voided:false};basket.lines.push(line);
    if(product.ageRestricted)this.#exception(basket,'AGE_VERIFICATION',`商品 ${product.name} 需要人工核验年龄`,line.id);
    if(product.unitWeightGrams>0&&input.measuredWeightGrams!==undefined&&Math.abs(Number(input.measuredWeightGrams)-product.unitWeightGrams*qty)>Math.max(30,product.unitWeightGrams*qty*.08))this.#exception(basket,'WEIGHT_MISMATCH',`商品 ${product.name} 称重不一致`,line.id);
    this.#reprice(basket);this.#record(actor,'ITEM_SCANNED',basket.id,{productId:product.id,qty});return clone(basket)}

  /** 主管授权作废购物篮行并重新计价。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  voidLine(basketId,lineId,supervisor,actor='attendant') {const basket=this.#activeBasket(basketId),line=basket.lines.find(x=>x.id===lineId&&!x.voided);if(!line)throw new Error('商品行不存在');line.voided=true;line.voidedBy=required(supervisor,'主管');line.voidedAt=now();this.#reprice(basket);this.#record(actor,'LINE_VOIDED',basket.id,{lineId,supervisor});return clone(basket)}

  /** 应用可验证的满减优惠券，避免折扣超过小计。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  applyCoupon(basketId,input,actor='shopper') {const basket=this.#activeBasket(basketId),threshold=positive(input.threshold,'使用门槛'),amount=positive(input.amount,'优惠金额');if(basket.subtotal<threshold)throw new Error('未达到优惠券门槛');basket.couponCode=required(input.code,'优惠码');basket.discount=money(Math.min(amount,basket.subtotal));basket.payable=money(basket.subtotal-basket.discount);this.#record(actor,'COUPON_APPLIED',basket.id,{code:basket.couponCode,amount:basket.discount});return clone(basket)}

  /** 人工核销防损例外并记录处理人员和证据。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  resolveException(exceptionId,input,actor='attendant') {const item=this.exceptions.get(exceptionId);if(!item||item.status!=='open')throw new Error('例外不存在或已处理');item.status='resolved';item.resolution=required(input.resolution,'处理结果');item.resolvedBy=required(input.resolvedBy,'处理人');item.resolvedAt=now();this.#record(actor,'EXCEPTION_RESOLVED',item.id,{basketId:item.basketId});return clone(item)}

  /** 幂等收款、扣减库存并开具不可变电子小票。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  pay(basketId,input,actor='shopper',idempotencyKey='') {if(idempotencyKey&&this.paymentRequests.has(idempotencyKey))return clone(this.payments.get(this.paymentRequests.get(idempotencyKey)));const basket=this.#activeBasket(basketId);if(!basket.lines.some(x=>!x.voided))throw new Error('购物篮为空');if([...this.exceptions.values()].some(x=>x.basketId===basket.id&&x.status==='open'))throw new Error('存在未处理的防损例外');for(const line of basket.lines.filter(x=>!x.voided)){const stock=[...this.stocks.values()].find(x=>x.storeId===basket.storeId&&x.productId===line.productId);if(!stock||stock.quantity<line.quantity)throw new Error('支付前库存校验失败')}
    const payment={id:uid('pay'),basketId:basket.id,channel:input.channel||'wechat',tradeNo:required(input.tradeNo,'交易号'),amount:basket.payable,status:'paid',paidAt:now()};if([...this.payments.values()].some(x=>x.tradeNo===payment.tradeNo))throw new Error('交易号已使用');for(const line of basket.lines.filter(x=>!x.voided)){const stock=[...this.stocks.values()].find(x=>x.storeId===basket.storeId&&x.productId===line.productId);stock.quantity-=line.quantity;stock.updatedAt=now()}basket.status='paid';basket.paidAt=payment.paidAt;this.payments.set(payment.id,payment);if(idempotencyKey)this.paymentRequests.set(idempotencyKey,payment.id);const receipt={id:uid('receipt'),receiptNo:`R${Date.now()}`,basketId:basket.id,paymentId:payment.id,storeId:basket.storeId,lines:basket.lines.filter(x=>!x.voided),subtotal:basket.subtotal,discount:basket.discount,payable:basket.payable,issuedAt:now()};this.receipts.set(receipt.id,receipt);payment.receiptId=receipt.id;this.#record(actor,'PAYMENT_CAPTURED',payment.id,{basketId:basket.id,amount:payment.amount});return clone(payment)}

  /** 挂起活动购物篮或在空闲终端恢复挂单。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  setSuspended(basketId,suspended,terminalId=null,actor='attendant') {const basket=this.baskets.get(basketId);if(!basket||!['active','suspended'].includes(basket.status))throw new Error('购物篮当前不可挂起或恢复');if(suspended&&basket.status==='active')basket.status='suspended';else if(!suspended&&basket.status==='suspended'){const terminal=this.terminals.get(terminalId||basket.terminalId);if(!terminal||[...this.baskets.values()].some(x=>x.terminalId===terminal.id&&x.status==='active'))throw new Error('目标终端不可恢复挂单');basket.status='active';basket.terminalId=terminal.id}else throw new Error('购物篮状态未发生变化');this.#record(actor,suspended?'BASKET_SUSPENDED':'BASKET_RESUMED',basket.id,{terminalId:basket.terminalId});return clone(basket)}

  /** 汇总销售、库存、终端和防损指标。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  dashboard(){const baskets=[...this.baskets.values()],payments=[...this.payments.values()],exceptions=[...this.exceptions.values()],stocks=[...this.stocks.values()];return{metrics:{terminals:this.terminals.size,online:[...this.terminals.values()].filter(x=>x.status==='online').length,transactions:payments.filter(x=>x.status==='paid').length,sales:money(payments.filter(x=>x.status==='paid').reduce((s,x)=>s+x.amount,0)),activeBaskets:baskets.filter(x=>x.status==='active').length,openExceptions:exceptions.filter(x=>x.status==='open').length},terminals:[...this.terminals.values()],products:[...this.products.values()],stocks,activeBaskets:baskets.filter(x=>['active','suspended'].includes(x.status)),exceptions:exceptions.slice(-20).reverse(),receipts:[...this.receipts.values()].slice(-20).reverse(),audit:this.audit.slice(-30).reverse()}}

  /** 导出本地持久化快照。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  dump(){const out={audit:this.audit,paymentRequests:[...this.paymentRequests.entries()],payments:[...this.payments.values()]};for(const k of ['stores','terminals','products','stocks','baskets','exceptions','receipts'])out[k]=[...this[k].values()];return out}
  /** 获取可操作购物篮。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  #activeBasket(id){const b=this.baskets.get(id);if(!b||b.status!=='active')throw new Error('购物篮不存在或不可操作');return b}
  /** 重新计算购物篮金额。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  #reprice(b){b.subtotal=money(b.lines.filter(x=>!x.voided).reduce((s,x)=>s+x.amount,0));b.discount=money(Math.min(b.discount||0,b.subtotal));b.payable=money(b.subtotal-b.discount)}
  /** 创建防损例外。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  #exception(basket,type,message,lineId){const item={id:uid('exc'),basketId:basket.id,terminalId:basket.terminalId,lineId,type,message,status:'open',createdAt:now()};this.exceptions.set(item.id,item);return item}
  /** 写入不可变审计事件。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  #record(actor,action,resourceId,detail){this.audit.push({id:uid('aud'),actor,action,resourceId,detail,occurredAt:now()})}
}

/** 构造可直接体验的便利店自助结算数据。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
export function createDemoService(){const s=new CheckoutService(),store=s.createStore({code:'SH-001',name:'知华智慧便利店·浦东店',address:'上海市浦东新区示范路66号'}),t1=s.registerTerminal({storeId:store.id,code:'SCO-01',model:'双屏自助机'}),t2=s.registerTerminal({storeId:store.id,code:'SCO-02',model:'双屏自助机'}),water=s.createProduct({sku:'WATER-550',barcode:'690000000001',name:'天然饮用水 550ml',price:3,unitWeightGrams:570}),coffee=s.createProduct({sku:'COFFEE-01',barcode:'690000000002',name:'精品即饮咖啡',price:12});s.adjustStock({storeId:store.id,productId:water.id,delta:80});s.adjustStock({storeId:store.id,productId:coffee.id,delta:36});const basket=s.openBasket({terminalId:t1.id});s.scanItem(basket.id,{barcode:water.barcode,quantity:2,measuredWeightGrams:1140});s.scanItem(basket.id,{barcode:coffee.barcode});s.openBasket({terminalId:t2.id});return s}
