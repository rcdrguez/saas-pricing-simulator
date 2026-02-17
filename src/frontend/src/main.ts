import './style.css';

type Plan = { id: string; nombre: string; precioBaseMensual: number; usuariosIncluidos: number; storageIncluidoGb: number };
type Addon = { id: string; nombre: string; tipo: 'flat' | 'per_unit'; precio: number };
type QuoteResponse = {
  currency: string; billingCycle: string; items: {label:string; amount:number}[]; discounts:{label:string; amount:number}[];
  subtotal:number; discountTotal:number; subtotalAfterDiscounts:number; tax:number; total:number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:61050';

const app = document.querySelector<HTMLDivElement>('#app')!;
let plans: Plan[] = [];
let addons: Addon[] = [];
let quote: QuoteResponse | null = null;
let loading = false;
let error = '';
let dark = localStorage.getItem('dark') === 'true';

const state = { planId:'starter', users:3, extraStorageGB:0, addonIds: [] as string[], billingCycle:'monthly', taxRate:0.18, prorationDays:0 };

function setTheme() {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('dark', String(dark));
}

async function loadData() {
  try {
    const [p,a] = await Promise.all([
      fetch(`${API_BASE}/api/plans`).then(r=>r.json()),
      fetch(`${API_BASE}/api/addons`).then(r=>r.json())
    ]);
    plans = p; addons = a;
    if (plans.length) state.planId = plans[0].id;
  } catch {
    error = 'No se pudo conectar al backend.';
  }
}

async function cotizar() {
  loading = true; error = ''; render();
  try {
    const res = await fetch(`${API_BASE}/api/quote`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(state) });
    if (!res.ok) throw new Error(await res.text());
    quote = await res.json();
  } catch (e) {
    error = `Error al cotizar: ${String(e)}`;
  } finally { loading = false; render(); }
}

function money(v:number){ return new Intl.NumberFormat('es-ES',{style:'currency',currency:'USD'}).format(v); }

function applyExample(type:'startup'|'pyme'|'scale') {
  if (type==='startup') Object.assign(state,{planId:'starter',users:3,extraStorageGB:0,addonIds:[],billingCycle:'monthly',taxRate:0.18,prorationDays:0});
  if (type==='pyme') Object.assign(state,{planId:'pro',users:18,extraStorageGB:200,addonIds:['support_premium'],billingCycle:'annual',taxRate:0.18,prorationDays:0});
  if (type==='scale') Object.assign(state,{planId:'business',users:120,extraStorageGB:1000,addonIds:['backup_avanzado'],billingCycle:'annual',taxRate:0.18,prorationDays:0});
  render();
}

function simulationRows() {
  if (!quote) return '';
  const mrr = quote.total;
  return Array.from({length:12}).map((_,i)=>`<tr><td class='py-1'>Mes ${i+1}</td><td>${money(mrr)}</td><td>${money(mrr*12)}</td></tr>`).join('');
}

function render(){
  setTheme();
  app.innerHTML = `
  <div class="max-w-7xl mx-auto p-4 space-y-4">
    <header class="flex items-center justify-between card">
      <h1 class="text-xl font-bold">SaaS Pricing Simulator</h1>
      <button id="toggleDark" class="btn-muted">${dark?'☀️ Claro':'🌙 Oscuro'}</button>
    </header>

    <section class='card'><h2 class='font-semibold mb-2'>Ejemplos rápidos</h2>
      <div class='flex gap-2 flex-wrap'>
        <button class='btn-muted' id='exStartup'>Startup</button>
        <button class='btn-muted' id='exPyme'>Pyme</button>
        <button class='btn-muted' id='exScale'>Scale</button>
      </div>
    </section>

    <main class="grid lg:grid-cols-2 gap-4">
      <section class="card">
        <h2 class="font-semibold text-lg">Formulario de cotización</h2>
        <label class='block mt-3'>Plan<select id='planId' class='field'>${plans.map(p=>`<option value='${p.id}' ${state.planId===p.id?'selected':''}>${p.nombre}</option>`)}</select></label>
        <label class='block mt-3'>Usuarios<input id='users' type='number' class='field' min='1' value='${state.users}'></label>
        <label class='block mt-3'>Storage extra (GB)<input id='extraStorageGB' type='number' class='field' min='0' value='${state.extraStorageGB}'></label>
        <label class='block mt-3'>Add-ons<select id='addonIds' class='field' multiple>${addons.map(a=>`<option value='${a.id}' ${state.addonIds.includes(a.id)?'selected':''}>${a.nombre}</option>`)}</select></label>
        <label class='block mt-3'>Ciclo<select id='billingCycle' class='field'><option value='monthly' ${state.billingCycle==='monthly'?'selected':''}>Mensual</option><option value='annual' ${state.billingCycle==='annual'?'selected':''}>Anual</option></select></label>
        <label class='block mt-3'>Impuesto (0-0.25)<input id='taxRate' step='0.01' type='number' class='field' value='${state.taxRate}'></label>
        <label class='block mt-3'>Prorrateo días (0-30)<input id='prorationDays' type='number' class='field' value='${state.prorationDays}'></label>
        <button id='cotizar' class='btn-primary mt-4 w-full'>${loading?'Calculando...':'Calcular cotización'}</button>
      </section>

      <section class="card">
        <h2 class="font-semibold text-lg">Resultado</h2>
        ${error ? `<p class='text-red-500 mt-2'>${error}</p>` : ''}
        ${!quote ? `<p class='text-slate-500 mt-3'>Sin resultados aún.</p>` : `
        <div class='mt-3 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950'><p class='text-sm'>Total</p><p class='text-3xl font-bold'>${money(quote.total)}</p></div>
        <div class='mt-3 space-y-1'>${quote.items.map(i=>`<div class='flex justify-between'><span>${i.label}</span><span>${money(i.amount)}</span></div>`).join('')}</div>
        <div class='mt-3 space-y-1 text-emerald-600'>${quote.discounts.map(i=>`<div class='flex justify-between'><span>${i.label}</span><span>${money(i.amount)}</span></div>`).join('')}</div>
        <hr class='my-3 border-slate-300 dark:border-slate-700' />
        <div class='space-y-1'>
          <div class='flex justify-between'><span>Subtotal</span><span>${money(quote.subtotal)}</span></div>
          <div class='flex justify-between'><span>Impuestos</span><span>${money(quote.tax)}</span></div>
          <div class='flex justify-between font-bold'><span>Total</span><span>${money(quote.total)}</span></div>
        </div>
        <div class='flex gap-2 mt-4'><button id='copyJson' class='btn-muted'>Copiar JSON</button><button id='downloadJson' class='btn-muted'>Descargar .json</button></div>
        <h3 class='font-semibold mt-5'>Simulación 12 meses</h3>
        <table class='w-full text-sm mt-2'><thead><tr><th class='text-left'>Mes</th><th class='text-left'>MRR</th><th class='text-left'>ARR</th></tr></thead><tbody>${simulationRows()}</tbody></table>
        `}
      </section>
    </main>
  </div>`;

  document.getElementById('toggleDark')?.addEventListener('click', ()=>{dark=!dark; render();});
  document.getElementById('exStartup')?.addEventListener('click', ()=>applyExample('startup'));
  document.getElementById('exPyme')?.addEventListener('click', ()=>applyExample('pyme'));
  document.getElementById('exScale')?.addEventListener('click', ()=>applyExample('scale'));

  const bindNum = (id:keyof typeof state) => (document.getElementById(id as string) as HTMLInputElement | null)?.addEventListener('input',(e)=>{(state as any)[id] = Number((e.target as HTMLInputElement).value);});
  (document.getElementById('planId') as HTMLSelectElement | null)?.addEventListener('change',e=>state.planId=(e.target as HTMLSelectElement).value);
  (document.getElementById('billingCycle') as HTMLSelectElement | null)?.addEventListener('change',e=>state.billingCycle=(e.target as HTMLSelectElement).value);
  (document.getElementById('addonIds') as HTMLSelectElement | null)?.addEventListener('change',e=>state.addonIds = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o=>o.value));
  bindNum('users'); bindNum('extraStorageGB'); bindNum('taxRate'); bindNum('prorationDays');
  document.getElementById('cotizar')?.addEventListener('click', cotizar);
  document.getElementById('copyJson')?.addEventListener('click',()=>quote && navigator.clipboard.writeText(JSON.stringify(quote,null,2)));
  document.getElementById('downloadJson')?.addEventListener('click',()=>{
    if (!quote) return;
    const blob = new Blob([JSON.stringify(quote,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='cotizacion.json'; a.click();
  });
}

await loadData();
render();
