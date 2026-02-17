# SaaS Pricing Simulator

Simulador full-stack para generar cotizaciones SaaS con desglose tipo factura: plan, usuarios extra, almacenamiento, add-ons, descuentos, impuestos y prorrateo.

## Features

- Backend .NET 8 (ASP.NET Core Web API) con Swagger.
- Frontend Vite + TypeScript + Tailwind (sin React).
- UI responsive con modo claro/oscuro.
- Ejemplos rápidos (Startup, Pyme, Scale).
- Cotización con breakdown completo y exportación JSON.
- Simulación de 12 meses (MRR/ARR).
- Pricing versionado en JSON (`src/backend/src/Infrastructure/data/pricing.json`).
- Tests xUnit para reglas de cálculo principales.

## Arquitectura

```text
src/
  backend/
    src/
      Domain/          -> Entidades de pricing
      Application/     -> DTOs, interfaces, lógica de cálculo
      Infrastructure/  -> Carga de pricing.json
      Api/             -> Endpoints REST, middleware de errores
    tests/
      QuoteCalculator.Tests/
  frontend/
    src/               -> SPA TypeScript + Tailwind
```

## Requisitos

- .NET SDK 8
- Node.js 20+

## Ejecución local

### 1) Backend

```bash
cd src/backend
 dotnet run --project src/Api/Api.csproj --urls http://localhost:5070
```

Swagger: `http://localhost:5070/swagger`

### 2) Frontend

```bash
cd src/frontend
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Endpoints

### GET `/api/plans`
Retorna planes disponibles.

### GET `/api/addons`
Retorna add-ons disponibles.

### POST `/api/quote`

Request:

```json
{
  "planId": "pro",
  "users": 18,
  "extraStorageGb": 200,
  "addonIds": ["support_premium"],
  "billingCycle": "annual",
  "taxRate": 0.18,
  "prorationDays": 0
}
```

Response (ejemplo):

```json
{
  "currency": "USD",
  "billingCycle": "annual",
  "subtotal": 266,
  "discountTotal": -38.57,
  "subtotalAfterDiscounts": 227.43,
  "tax": 40.94,
  "total": 268.37
}
```

## Reglas de pricing implementadas

- Descuento anual: 10% (antes de impuestos).
- Descuento por volumen:
  - 25-49: 5%
  - 50-99: 10%
  - 100+: 15%
- Impuesto `taxRate` entre 0 y 0.25.
- Prorrateo opcional: `subtotal / 30 * prorationDays`.
- Storage extra: bloques de 100 GB (`Math.Ceiling`).

## Docker Compose (opcional)

```bash
docker compose up --build
```

## Screenshots (placeholders)

- `docs/screenshots/dashboard-light.png`
- `docs/screenshots/dashboard-dark.png`
- `docs/screenshots/quote-example.png`

## Roadmap

- Persistir escenarios de cotización.
- Exportar cotización a PDF.
- Internacionalización de moneda.
- Hot reload real de `pricing.json` con `IOptionsMonitor`.
