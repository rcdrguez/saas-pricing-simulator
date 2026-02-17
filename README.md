# SaaS Pricing Simulator

Simulador full-stack para cotizar un producto SaaS: seleccionas un plan, número de usuarios, add-ons, ciclo de facturación (mensual/anual), impuestos y prorrateo, y obtienes un **desglose tipo factura** + total final.

- Backend: **.NET 8 / ASP.NET Core Web API**
- Frontend: **Vite + TypeScript + TailwindCSS (sin React)**
- Catálogo de precios: **JSON versionado en el repo**
- API documentada con **Swagger**

---

## Qué puedes hacer

- Cotizar planes (Starter / Pro / Business)
- Calcular:
  - usuarios incluidos vs usuarios extra
  - storage extra
  - add-ons
  - descuentos (anual + volumen)
  - impuestos (taxRate)
  - prorrateo opcional por días
- Ver un **breakdown claro** (items, descuentos, subtotal, impuestos, total)
- Usar **ejemplos rápidos** (Startup / Pyme / Scale)
- Copiar/descargar el resultado como JSON

---

## Screenshots

> (Agrega imágenes luego)
- `docs/ui-form.png`
- `docs/ui-breakdown.png`

---

## Arquitectura del repo

```txt
src/
  backend/
    SaaSPricingSimulator.sln
    API/
    Domain/
    Application/
    Infrastructure/
    tests/
  frontend/
    index.html
    src/
    tailwind.config.*
pricing.json (o dentro de Infrastructure/data)
