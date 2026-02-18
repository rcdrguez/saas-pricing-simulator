import './style.css';

type Tab = 'quote' | 'company' | 'catalog' | 'history';
type Plan = {
  id: string;
  nombre: string;
  precioBaseMensual: number;
  usuariosIncluidos: number;
  storageIncluidoGb: number;
  costoPorUsuarioMensual?: number;
};
type Addon = { id: string; nombre: string; tipo: 'flat' | 'per_unit'; precio: number };
type PricingRules = { costoPorUsuarioMensual: number; costoPor100GbMensual: number };
type PricingCatalog = { currency: string; planes: Plan[]; addons: Addon[]; reglas: PricingRules };
type PricingRequest = {
  planId: string;
  users: number;
  extraStorageGb: number;
  addonIds: string[];
  billingCycle: 'monthly' | 'annual';
  taxRate: number;
  prorationDays: number;
};
type QuoteResponse = {
  currency: string;
  billingCycle: string;
  items: { label: string; amount: number }[];
  discounts: { label: string; amount: number }[];
  subtotal: number;
  tax: number;
  total: number;
};
type CompanySettings = {
  name: string;
  rnc: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  currency: 'USD' | 'DOP';
  legalNotes: string;
  logoBase64: string;
};
type CustomerInfo = { name: string; company: string; email: string; phone: string; address: string };
type QuoteMeta = { quoteNumber: string; issueDate: string; validDays: number; notes: string };
type StoredQuote = {
  id: string;
  createdAt: string;
  company: CompanySettings;
  customer: CustomerInfo;
  quoteMeta: QuoteMeta;
  pricingRequest: PricingRequest;
  pricingResult: QuoteResponse;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:61050';
const app = document.querySelector<HTMLDivElement>('#app')!;

let activeTab: Tab = 'quote';
let dark = localStorage.getItem('dark') === 'true';
let plans: Plan[] = [];
let addons: Addon[] = [];
let catalogDraft: PricingCatalog | null = null;
let quoteResult: QuoteResponse | null = null;
let error = '';
let loading = false;
let savingCatalog = false;
let generatingPdf = false;
let search = '';

const companyDefault: CompanySettings = {
  name: '', rnc: '', address: '', phone: '', email: '', website: '', currency: 'USD', legalNotes: '', logoBase64: ''
};

let company: CompanySettings = readStorage('company_settings', companyDefault);
let quotes: StoredQuote[] = readStorage<StoredQuote[]>('quotes_history', []);

const pricingRequest: PricingRequest = {
  planId: 'starter', users: 3, extraStorageGb: 0, addonIds: [], billingCycle: 'monthly', taxRate: 0.18, prorationDays: 0
};
const customer: CustomerInfo = { name: '', company: '', email: '', phone: '', address: '' };
const quoteMeta: QuoteMeta = { quoteNumber: '', issueDate: todayIso(), validDays: 15, notes: '' };

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

function nextQuoteNumber() {
  const datePart = todayIso().split('-').join('');
  const countToday = quotes.filter(q => q.quoteMeta.quoteNumber.includes(`Q-${datePart}`)).length + 1;
  return `Q-${datePart}-${String(countToday).padStart(4, '0')}`;
}

function setTheme() {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('dark', String(dark));
}

function money(v: number, currency = company.currency) {
  const locale = currency === 'DOP' ? 'es-DO' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(v);
}

async function loadData() {
  try {
    const catalog: PricingCatalog = await fetch(`${API_BASE}/api/pricing`).then(r => r.json());
    plans = catalog.planes;
    addons = catalog.addons;
    catalogDraft = structuredClone(catalog);
    if (plans.length) pricingRequest.planId = plans[0].id;
    if (!quoteMeta.quoteNumber) quoteMeta.quoteNumber = nextQuoteNumber();
  } catch {
    error = 'No se pudo cargar el catálogo desde backend.';
  }
}

async function calculateQuote() {
  loading = true;
  error = '';
  render();
  try {
    const payload = {
      ...pricingRequest,
      users: Number(pricingRequest.users),
      extraStorageGb: Number(pricingRequest.extraStorageGb),
      taxRate: Number(pricingRequest.taxRate),
      prorationDays: Number(pricingRequest.prorationDays)
    };
    const res = await fetch(`${API_BASE}/api/quote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    quoteResult = await res.json();
  } catch (e) {
    error = `Error al calcular: ${String(e)}`;
  } finally {
    loading = false;
    render();
  }
}

function requiredReady() {
  return Boolean(company.name.trim() && customer.name.trim() && quoteMeta.quoteNumber.trim());
}

function saveCompany() {
  if (!company.name.trim()) {
    error = 'El nombre comercial es requerido.';
    render();
    return;
  }
  if (company.rnc && !/^\d{9,11}$/.test(company.rnc)) {
    error = 'El RNC debe contener de 9 a 11 dígitos.';
    render();
    return;
  }
  saveStorage('company_settings', company);
  error = '';
  render();
}

function restoreCompanyExample() {
  company = {
    name: 'Nube Gestión SRL',
    rnc: '132456789',
    address: 'Av. Winston Churchill 123, Santo Domingo, RD',
    phone: '+1 809-555-1010',
    email: 'ventas@nubegestion.do',
    website: 'https://nubegestion.do',
    currency: 'DOP',
    legalNotes: 'Cotización válida por el período indicado. Precios sujetos a cambios sin previo aviso.',
    logoBase64: ''
  };
  saveCompany();
}

function saveQuote() {
  if (!quoteResult || !requiredReady()) {
    error = 'Debes calcular y completar los campos requeridos antes de guardar.';
    render();
    return;
  }

  const item: StoredQuote = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    company: structuredClone(company),
    customer: structuredClone(customer),
    quoteMeta: structuredClone(quoteMeta),
    pricingRequest: structuredClone(pricingRequest),
    pricingResult: structuredClone(quoteResult)
  };

  quotes = [item, ...quotes];
  saveStorage('quotes_history', quotes);
  quoteMeta.quoteNumber = nextQuoteNumber();
  error = '';
  activeTab = 'history';
  render();
}

async function downloadPdf(fromQuote?: StoredQuote) {
  const quoteData = fromQuote ?? (quoteResult ? {
    company,
    customer,
    quoteMeta,
    pricingRequest
  } : null);

  if (!quoteData || !requiredReady()) {
    error = 'Faltan campos requeridos para generar el PDF.';
    render();
    return;
  }

  generatingPdf = true;
  error = '';
  render();

  try {
    const payload = {
      company: quoteData.company,
      customer: quoteData.customer,
      quote: {
        quoteNumber: quoteData.quoteMeta.quoteNumber,
        issueDate: quoteData.quoteMeta.issueDate,
        validDays: Number(quoteData.quoteMeta.validDays),
        notes: quoteData.quoteMeta.notes,
        pricingRequest: quoteData.pricingRequest
      }
    };

    const response = await fetch(`${API_BASE}/api/quotes/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(await response.text());

    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Quote_${payload.quote.quoteNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    error = `No se pudo descargar el PDF: ${String(e)}`;
  } finally {
    generatingPdf = false;
    render();
  }
}

function getCatalogSafe(): PricingCatalog {
  if (!catalogDraft) {
    return {
      currency: 'USD',
      planes: [],
      addons: [],
      reglas: { costoPorUsuarioMensual: 8, costoPor100GbMensual: 10 }
    };
  }
  return catalogDraft;
}

function setCatalog(catalog: PricingCatalog) {
  catalogDraft = catalog;
}

function updateRule(field: keyof PricingRules, value: number) {
  const catalog = getCatalogSafe();
  catalog.reglas[field] = Number.isFinite(value) ? value : 0;
  setCatalog(catalog);
}

function updatePlan(index: number, field: keyof Plan, value: string | number) {
  const catalog = getCatalogSafe();
  const plan = catalog.planes[index];
  if (!plan) return;
  if (field === 'id' || field === 'nombre') {
    (plan[field] as string) = String(value);
  } else {
    (plan[field] as number | undefined) = Number(value);
  }
  setCatalog(catalog);
}

function updateAddon(index: number, field: keyof Addon, value: string | number) {
  const catalog = getCatalogSafe();
  const addon = catalog.addons[index];
  if (!addon) return;
  if (field === 'tipo') addon.tipo = String(value) as Addon['tipo'];
  else if (field === 'id' || field === 'nombre') (addon[field] as string) = String(value);
  else addon.precio = Number(value);
  setCatalog(catalog);
}

function addPlan() {
  const catalog = getCatalogSafe();
  catalog.planes.push({
    id: `plan_${Date.now()}`,
    nombre: 'Nuevo plan',
    precioBaseMensual: 0,
    usuariosIncluidos: 1,
    storageIncluidoGb: 10,
    costoPorUsuarioMensual: catalog.reglas.costoPorUsuarioMensual
  });
  setCatalog(catalog);
  render();
}

function removePlan(index: number) {
  const catalog = getCatalogSafe();
  catalog.planes.splice(index, 1);
  if (!catalog.planes.length) {
    catalog.planes.push({
      id: 'starter', nombre: 'Starter', precioBaseMensual: 0, usuariosIncluidos: 1, storageIncluidoGb: 10
    });
  }
  setCatalog(catalog);
  render();
}

function addAddon() {
  const catalog = getCatalogSafe();
  catalog.addons.push({ id: `addon_${Date.now()}`, nombre: 'Nuevo add-on', tipo: 'flat', precio: 0 });
  setCatalog(catalog);
  render();
}

function removeAddon(index: number) {
  const catalog = getCatalogSafe();
  catalog.addons.splice(index, 1);
  setCatalog(catalog);
  render();
}

function restoreCatalogTemplate() {
  catalogDraft = {
    currency: 'USD',
    planes: [
      { id: 'starter', nombre: 'Starter', precioBaseMensual: 19, usuariosIncluidos: 3, storageIncluidoGb: 50 },
      { id: 'pro', nombre: 'Pro', precioBaseMensual: 49, usuariosIncluidos: 10, storageIncluidoGb: 200, costoPorUsuarioMensual: 6 }
    ],
    addons: [{ id: 'support_premium', nombre: 'Soporte premium', tipo: 'flat', precio: 149 }],
    reglas: { costoPorUsuarioMensual: 8, costoPor100GbMensual: 10 }
  };
  render();
}

async function saveCatalog() {
  const catalog = getCatalogSafe();
  savingCatalog = true;
  error = '';
  render();

  try {
    if (!catalog.currency.trim()) throw new Error('La moneda es requerida.');
    if (!catalog.planes.length) throw new Error('Debe existir al menos un plan.');

    const normalized: PricingCatalog = {
      currency: catalog.currency.trim().toUpperCase(),
      planes: catalog.planes.map(p => ({
        ...p,
        id: p.id.trim(),
        nombre: p.nombre.trim(),
        precioBaseMensual: Number(p.precioBaseMensual),
        usuariosIncluidos: Number(p.usuariosIncluidos),
        storageIncluidoGb: Number(p.storageIncluidoGb),
        costoPorUsuarioMensual: p.costoPorUsuarioMensual === undefined ? undefined : Number(p.costoPorUsuarioMensual)
      })),
      addons: catalog.addons.map(a => ({
        ...a,
        id: a.id.trim(),
        nombre: a.nombre.trim(),
        precio: Number(a.precio)
      })),
      reglas: {
        costoPorUsuarioMensual: Number(catalog.reglas.costoPorUsuarioMensual),
        costoPor100GbMensual: Number(catalog.reglas.costoPor100GbMensual)
      }
    };

    const res = await fetch(`${API_BASE}/api/pricing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized)
    });

    if (!res.ok) throw new Error(await res.text());

    const updated = await res.json() as PricingCatalog;
    catalogDraft = updated;
    plans = updated.planes;
    addons = updated.addons;
    if (!plans.some(p => p.id === pricingRequest.planId) && plans.length) {
      pricingRequest.planId = plans[0].id;
    }
  } catch (e) {
    error = `No se pudo guardar catálogo: ${String(e)}`;
  } finally {
    savingCatalog = false;
    render();
  }
}

function loadForDuplicate(item: StoredQuote) {
  Object.assign(company, item.company);
  Object.assign(customer, item.customer);
  Object.assign(quoteMeta, item.quoteMeta);
  Object.assign(pricingRequest, item.pricingRequest);
  quoteResult = item.pricingResult;
  activeTab = 'quote';
  render();
}

function removeQuote(id: string) {
  quotes = quotes.filter(q => q.id !== id);
  saveStorage('quotes_history', quotes);
  render();
}

function renderCatalogTab() {
  const catalog = getCatalogSafe();
  return `<section class='card'>
    <div class='section-header'>
      <div>
        <h2 class='text-lg font-semibold'>Catálogo de servicios</h2>
        <p class='text-sm text-slate-500 mt-1'>Edita precios y servicios con formularios (sin JSON manual).</p>
      </div>
      <div class='flex gap-2'>
        <button id='restoreCatalogTemplate' class='btn-muted'>Plantilla</button>
        <button id='saveCatalog' class='btn-primary'>${savingCatalog ? 'Guardando...' : 'Guardar catálogo'}</button>
      </div>
    </div>

    <div class='catalog-grid mt-4'>
      <article class='panel'>
        <h3 class='panel-title'>Configuración general</h3>
        <label>Moneda
          <input id='catalog_currency' class='field' value='${catalog.currency}' />
        </label>
        <div class='grid md:grid-cols-2 gap-3 mt-3'>
          <label>Costo por usuario/mes
            <input id='rule_user' type='number' step='0.01' class='field' value='${catalog.reglas.costoPorUsuarioMensual}' />
          </label>
          <label>Costo por 100GB/mes
            <input id='rule_storage' type='number' step='0.01' class='field' value='${catalog.reglas.costoPor100GbMensual}' />
          </label>
        </div>
      </article>

      <article class='panel'>
        <div class='flex items-center justify-between'>
          <h3 class='panel-title'>Planes</h3>
          <button id='addPlan' class='btn-muted'>+ Plan</button>
        </div>
        <div class='space-y-3 mt-3'>
          ${catalog.planes.map((plan, index) => `
            <div class='item-card'>
              <div class='grid md:grid-cols-2 gap-2'>
                <label>ID<input data-plan='${index}' data-field='id' class='field' value='${plan.id}' /></label>
                <label>Nombre<input data-plan='${index}' data-field='nombre' class='field' value='${plan.nombre}' /></label>
                <label>Base mensual<input data-plan='${index}' data-field='precioBaseMensual' type='number' step='0.01' class='field' value='${plan.precioBaseMensual}' /></label>
                <label>Usuarios incluidos<input data-plan='${index}' data-field='usuariosIncluidos' type='number' min='1' class='field' value='${plan.usuariosIncluidos}' /></label>
                <label>Storage incluido (GB)<input data-plan='${index}' data-field='storageIncluidoGb' type='number' min='0' class='field' value='${plan.storageIncluidoGb}' /></label>
                <label>Costo extra usuario<input data-plan='${index}' data-field='costoPorUsuarioMensual' type='number' step='0.01' class='field' value='${plan.costoPorUsuarioMensual ?? ''}' placeholder='Opcional' /></label>
              </div>
              <div class='text-right mt-2'>
                <button data-remove-plan='${index}' class='btn-danger'>Eliminar plan</button>
              </div>
            </div>
          `).join('')}
        </div>
      </article>

      <article class='panel'>
        <div class='flex items-center justify-between'>
          <h3 class='panel-title'>Add-ons</h3>
          <button id='addAddon' class='btn-muted'>+ Add-on</button>
        </div>
        <div class='space-y-3 mt-3'>
          ${catalog.addons.map((addon, index) => `
            <div class='item-card'>
              <div class='grid md:grid-cols-2 gap-2'>
                <label>ID<input data-addon='${index}' data-field='id' class='field' value='${addon.id}' /></label>
                <label>Nombre<input data-addon='${index}' data-field='nombre' class='field' value='${addon.nombre}' /></label>
                <label>Tipo
                  <select data-addon='${index}' data-field='tipo' class='field'>
                    <option value='flat' ${addon.tipo === 'flat' ? 'selected' : ''}>Tarifa fija</option>
                    <option value='per_unit' ${addon.tipo === 'per_unit' ? 'selected' : ''}>Por unidad</option>
                  </select>
                </label>
                <label>Precio<input data-addon='${index}' data-field='precio' type='number' step='0.01' class='field' value='${addon.precio}' /></label>
              </div>
              <div class='text-right mt-2'>
                <button data-remove-addon='${index}' class='btn-danger'>Eliminar add-on</button>
              </div>
            </div>
          `).join('')}
        </div>
      </article>
    </div>
  </section>`;
}

function renderCompanyTab() {
  return `<section class='card'>
    <h2 class='text-lg font-semibold'>Mi Empresa</h2>
    <div class='grid md:grid-cols-2 gap-3 mt-3'>
      <label>Nombre comercial*<input id='company_name' class='field' value='${company.name}' /></label>
      <label>RNC<input id='company_rnc' class='field' value='${company.rnc}' /></label>
      <label>Dirección<input id='company_address' class='field' value='${company.address}' /></label>
      <label>Teléfono<input id='company_phone' class='field' value='${company.phone}' /></label>
      <label>Email<input id='company_email' class='field' value='${company.email}' /></label>
      <label>Website<input id='company_website' class='field' value='${company.website}' /></label>
      <label>Moneda
        <select id='company_currency' class='field'>
          <option value='USD' ${company.currency === 'USD' ? 'selected' : ''}>USD</option>
          <option value='DOP' ${company.currency === 'DOP' ? 'selected' : ''}>DOP</option>
        </select>
      </label>
      <label>Logo (PNG/JPG)
        <input id='company_logo' class='field' type='file' accept='image/png,image/jpeg' />
      </label>
    </div>
    ${company.logoBase64 ? `<img src='${company.logoBase64}' class='mt-3 h-16 object-contain rounded bg-slate-100 p-2' />` : ''}
    <label class='block mt-3'>Notas legales<textarea id='company_legalNotes' class='field min-h-20'>${company.legalNotes}</textarea></label>
    <div class='flex gap-2 mt-4'>
      <button id='saveCompany' class='btn-primary'>Guardar cambios</button>
      <button id='restoreCompany' class='btn-muted'>Restaurar ejemplo</button>
      <button id='removeLogo' class='btn-muted'>Quitar logo</button>
    </div>
  </section>`;
}

function renderQuoteTab() {
  return `<main class='grid lg:grid-cols-2 gap-4'>
    <section class='card'>
      <h2 class='font-semibold text-lg'>Cotizar</h2>
      <h3 class='font-semibold mt-3'>Cliente</h3>
      <div class='grid md:grid-cols-2 gap-3'>
        <label>Nombre cliente*<input id='customer_name' class='field' value='${customer.name}' /></label>
        <label>Empresa cliente<input id='customer_company' class='field' value='${customer.company}' /></label>
        <label>Email<input id='customer_email' class='field' value='${customer.email}' /></label>
        <label>Teléfono<input id='customer_phone' class='field' value='${customer.phone}' /></label>
        <label class='md:col-span-2'>Dirección<input id='customer_address' class='field' value='${customer.address}' /></label>
      </div>
      <h3 class='font-semibold mt-4'>Datos de cotización</h3>
      <div class='grid md:grid-cols-2 gap-3'>
        <label>Fecha<input id='quote_issueDate' type='date' class='field' value='${quoteMeta.issueDate}' /></label>
        <label>Validez (días)<input id='quote_validDays' type='number' min='1' class='field' value='${quoteMeta.validDays}' /></label>
        <label class='md:col-span-2'>Número de cotización*<input id='quote_quoteNumber' class='field' value='${quoteMeta.quoteNumber}' /></label>
      </div>
      <h3 class='font-semibold mt-4'>Pricing</h3>
      <label>Plan<select id='planId' class='field'>${plans.map(p => `<option value='${p.id}' ${pricingRequest.planId === p.id ? 'selected' : ''}>${p.nombre}</option>`)}</select></label>
      <div class='grid md:grid-cols-2 gap-3'>
        <label>Usuarios<input id='users' type='number' min='1' class='field' value='${pricingRequest.users}'></label>
        <label>Storage extra GB<input id='extraStorageGb' type='number' min='0' class='field' value='${pricingRequest.extraStorageGb}'></label>
        <label>Add-ons<select id='addonIds' class='field' multiple>${addons.map(a => `<option value='${a.id}' ${pricingRequest.addonIds.includes(a.id) ? 'selected' : ''}>${a.nombre}</option>`)}</select></label>
        <label>Ciclo<select id='billingCycle' class='field'><option value='monthly' ${pricingRequest.billingCycle === 'monthly' ? 'selected' : ''}>Mensual</option><option value='annual' ${pricingRequest.billingCycle === 'annual' ? 'selected' : ''}>Anual</option></select></label>
        <label>Impuesto<input id='taxRate' step='0.01' type='number' min='0' max='0.25' class='field' value='${pricingRequest.taxRate}'></label>
        <label>Prorrateo días<input id='prorationDays' type='number' min='0' max='30' class='field' value='${pricingRequest.prorationDays}'></label>
      </div>
      <label class='block mt-3'>Notas para cliente<textarea id='quote_notes' class='field min-h-20'>${quoteMeta.notes}</textarea></label>
      <div class='grid md:grid-cols-3 gap-2 mt-4'>
        <button id='calculate' class='btn-primary'>${loading ? 'Calculando...' : 'Calcular'}</button>
        <button id='saveQuote' class='btn-muted'>Guardar cotización</button>
        <button id='downloadPdf' class='btn-muted' ${!requiredReady() ? 'disabled' : ''}>${generatingPdf ? 'Generando PDF...' : 'Descargar PDF'}</button>
      </div>
    </section>
    <section class='card'>
      <h2 class='font-semibold text-lg'>Breakdown</h2>
      ${!quoteResult ? `<p class='text-slate-500 mt-2'>Calcula para ver resultados.</p>` : `
      <div class='mt-3 space-y-1'>${quoteResult.items.map(i => `<div class='flex justify-between'><span>${i.label}</span><span>${money(i.amount)}</span></div>`).join('')}</div>
      <div class='mt-3 space-y-1 text-emerald-600'>${quoteResult.discounts.map(i => `<div class='flex justify-between'><span>${i.label}</span><span>${money(i.amount)}</span></div>`).join('')}</div>
      <hr class='my-3 border-slate-300 dark:border-slate-700' />
      <div class='space-y-1'>
        <div class='flex justify-between'><span>Subtotal</span><span>${money(quoteResult.subtotal)}</span></div>
        <div class='flex justify-between'><span>Impuestos</span><span>${money(quoteResult.tax)}</span></div>
        <div class='flex justify-between font-bold text-xl'><span>Total</span><span>${money(quoteResult.total)}</span></div>
      </div>`}
    </section>
  </main>`;
}

function renderHistoryTab() {
  const filtered = quotes.filter(q => (`${q.customer.name} ${q.quoteMeta.quoteNumber}`).toLowerCase().includes(search.toLowerCase()));
  return `<section class='card'>
    <h2 class='font-semibold text-lg'>Cotizaciones</h2>
    <input id='search' placeholder='Buscar por cliente o número...' class='field mt-3' value='${search}' />
    <div class='mt-3 space-y-2'>
      ${filtered.length === 0 ? `<p class='text-slate-500'>Sin resultados.</p>` : filtered.map(q => `<div class='border border-slate-200 dark:border-slate-700 rounded-lg p-3'>
        <div class='flex flex-wrap justify-between items-center gap-2'>
          <div>
            <p class='font-medium'>${q.quoteMeta.quoteNumber} · ${q.customer.name}</p>
            <p class='text-sm text-slate-500'>${new Date(q.createdAt).toLocaleString()}</p>
          </div>
          <div class='flex gap-2'>
            <button class='btn-muted' data-action='view' data-id='${q.id}'>Ver</button>
            <button class='btn-muted' data-action='pdf' data-id='${q.id}'>PDF</button>
            <button class='btn-muted' data-action='dup' data-id='${q.id}'>Duplicar</button>
            <button class='btn-muted' data-action='del' data-id='${q.id}'>Eliminar</button>
          </div>
        </div>
        <details class='mt-2'><summary class='cursor-pointer text-sm'>Detalle rápido</summary>
          <pre class='text-xs mt-2 overflow-auto bg-slate-100 dark:bg-slate-800 p-2 rounded'>${JSON.stringify(q, null, 2)}</pre>
        </details>
      </div>`).join('')}
    </div>
  </section>`;
}

function render() {
  setTheme();
  app.innerHTML = `<div class='max-w-7xl mx-auto p-4 space-y-4'>
    <header class='card hero-header flex flex-wrap items-center justify-between gap-2'>
      <h1 class='text-xl font-bold'>SaaS Pricing Simulator</h1>
      <div class='flex gap-2'>
        <button class='btn-muted tab-btn ${activeTab === 'quote' ? 'ring-2 ring-indigo-500' : ''}' data-tab='quote'>Cotizar</button>
        <button class='btn-muted tab-btn ${activeTab === 'company' ? 'ring-2 ring-indigo-500' : ''}' data-tab='company'>Mi Empresa</button>
        <button class='btn-muted tab-btn ${activeTab === 'history' ? 'ring-2 ring-indigo-500' : ''}' data-tab='history'>Cotizaciones</button>
        <button class='btn-muted tab-btn ${activeTab === 'catalog' ? 'ring-2 ring-indigo-500' : ''}' data-tab='catalog'>Catálogo</button>
        <button id='toggleDark' class='btn-muted'>${dark ? '☀️ Claro' : '🌙 Oscuro'}</button>
      </div>
    </header>
    ${error ? `<p class='card text-red-500'>${error}</p>` : ''}
    ${activeTab === 'quote' ? renderQuoteTab() : activeTab === 'company' ? renderCompanyTab() : activeTab === 'catalog' ? renderCatalogTab() : renderHistoryTab()}
  </div>`;

  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    activeTab = (btn as HTMLButtonElement).dataset.tab as Tab;
    render();
  }));
  document.getElementById('toggleDark')?.addEventListener('click', () => {
    dark = !dark;
    render();
  });

  bindCommonEvents();
}

function bindCommonEvents() {
  const bindInput = <T extends object>(id: string, obj: T, key: keyof T) => {
    document.getElementById(id)?.addEventListener('input', (e) => { (obj[key] as string) = (e.target as HTMLInputElement).value; });
  };

  if (activeTab === 'company') {
    bindInput('company_name', company, 'name');
    bindInput('company_rnc', company, 'rnc');
    bindInput('company_address', company, 'address');
    bindInput('company_phone', company, 'phone');
    bindInput('company_email', company, 'email');
    bindInput('company_website', company, 'website');
    bindInput('company_legalNotes', company, 'legalNotes');
    document.getElementById('company_currency')?.addEventListener('change', e => { company.currency = (e.target as HTMLSelectElement).value as 'USD' | 'DOP'; });
    document.getElementById('company_logo')?.addEventListener('change', async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg'].includes(file.type)) { error = 'Solo se permiten logos PNG/JPG.'; render(); return; }
      company.logoBase64 = await fileToBase64(file);
      render();
    });
    document.getElementById('saveCompany')?.addEventListener('click', saveCompany);
    document.getElementById('restoreCompany')?.addEventListener('click', restoreCompanyExample);
    document.getElementById('removeLogo')?.addEventListener('click', () => { company.logoBase64 = ''; render(); });
  }

  if (activeTab === 'quote') {
    bindInput('customer_name', customer, 'name');
    bindInput('customer_company', customer, 'company');
    bindInput('customer_email', customer, 'email');
    bindInput('customer_phone', customer, 'phone');
    bindInput('customer_address', customer, 'address');
    bindInput('quote_issueDate', quoteMeta, 'issueDate');
    bindInput('quote_quoteNumber', quoteMeta, 'quoteNumber');
    bindInput('quote_notes', quoteMeta, 'notes');

    document.getElementById('quote_validDays')?.addEventListener('input', e => quoteMeta.validDays = Number((e.target as HTMLInputElement).value));
    document.getElementById('planId')?.addEventListener('change', e => pricingRequest.planId = (e.target as HTMLSelectElement).value);
    document.getElementById('billingCycle')?.addEventListener('change', e => pricingRequest.billingCycle = (e.target as HTMLSelectElement).value as 'monthly' | 'annual');
    document.getElementById('addonIds')?.addEventListener('change', e => pricingRequest.addonIds = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value));
    document.getElementById('users')?.addEventListener('input', e => pricingRequest.users = Number((e.target as HTMLInputElement).value));
    document.getElementById('extraStorageGb')?.addEventListener('input', e => pricingRequest.extraStorageGb = Number((e.target as HTMLInputElement).value));
    document.getElementById('taxRate')?.addEventListener('input', e => pricingRequest.taxRate = Number((e.target as HTMLInputElement).value));
    document.getElementById('prorationDays')?.addEventListener('input', e => pricingRequest.prorationDays = Number((e.target as HTMLInputElement).value));

    document.getElementById('calculate')?.addEventListener('click', calculateQuote);
    document.getElementById('saveQuote')?.addEventListener('click', saveQuote);
    document.getElementById('downloadPdf')?.addEventListener('click', () => downloadPdf());
  }

  if (activeTab === 'catalog') {
    const catalog = getCatalogSafe();

    document.getElementById('catalog_currency')?.addEventListener('input', e => {
      catalog.currency = (e.target as HTMLInputElement).value;
    });
    document.getElementById('rule_user')?.addEventListener('input', e => updateRule('costoPorUsuarioMensual', Number((e.target as HTMLInputElement).value)));
    document.getElementById('rule_storage')?.addEventListener('input', e => updateRule('costoPor100GbMensual', Number((e.target as HTMLInputElement).value)));

    document.querySelectorAll('[data-plan]').forEach(el => {
      el.addEventListener('input', e => {
        const target = e.target as HTMLInputElement;
        const i = Number(target.dataset.plan);
        const field = target.dataset.field as keyof Plan;
        updatePlan(i, field, target.value);
      });
    });

    document.querySelectorAll('[data-addon]').forEach(el => {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, e => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        const i = Number(target.dataset.addon);
        const field = target.dataset.field as keyof Addon;
        updateAddon(i, field, target.value);
      });
    });

    document.querySelectorAll('[data-remove-plan]').forEach(btn => {
      btn.addEventListener('click', () => removePlan(Number((btn as HTMLButtonElement).dataset.removePlan)));
    });
    document.querySelectorAll('[data-remove-addon]').forEach(btn => {
      btn.addEventListener('click', () => removeAddon(Number((btn as HTMLButtonElement).dataset.removeAddon)));
    });

    document.getElementById('addPlan')?.addEventListener('click', addPlan);
    document.getElementById('addAddon')?.addEventListener('click', addAddon);
    document.getElementById('saveCatalog')?.addEventListener('click', saveCatalog);
    document.getElementById('restoreCatalogTemplate')?.addEventListener('click', restoreCatalogTemplate);
  }

  if (activeTab === 'history') {
    document.getElementById('search')?.addEventListener('input', e => { search = (e.target as HTMLInputElement).value; render(); });
    document.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', () => {
      const id = (el as HTMLButtonElement).dataset.id!;
      const action = (el as HTMLButtonElement).dataset.action;
      const item = quotes.find(q => q.id === id);
      if (!item) return;
      if (action === 'view') alert(JSON.stringify(item, null, 2));
      if (action === 'pdf') downloadPdf(item);
      if (action === 'dup') loadForDuplicate(item);
      if (action === 'del') removeQuote(id);
    }));
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

(async () => {
  await loadData();
  render();
})();
