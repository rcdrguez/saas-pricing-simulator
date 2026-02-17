# SaaS Pricing Simulator

Simulador full-stack para cotizaciones SaaS con motor de pricing en backend y generación de PDF profesional bajo demanda.

## Novedades (MVP)

- Nueva navegación por tabs: **Cotizar**, **Mi Empresa**, **Cotizaciones**.
- Configuración de empresa persistida en `LocalStorage` (incluye logo base64).
- Gestión de cotizaciones guardadas en `LocalStorage`.
- Descarga de cotización en PDF vía backend (`POST /api/quotes/pdf`) usando QuestPDF.
- Se mantiene la lógica de pricing en backend (`POST /api/quote`) y se reutiliza al generar PDF.

## Stack

- **Backend**: .NET 8 ASP.NET Core Web API + Swagger + QuestPDF.
- **Frontend**: Vite + TypeScript + TailwindCSS (sin React).

## Pantallas

## 1) Cotizar

Incluye:
- Formulario de pricing: plan, usuarios, storage extra, add-ons, ciclo, impuesto y prorrateo.
- Sección de cliente: nombre (requerido), empresa, email, teléfono, dirección.
- Datos de cotización: fecha, validez, número autogenerado `Q-YYYYMMDD-0001`.
- Notas para el cliente.

Acciones:
- **Calcular**: obtiene breakdown desde backend.
- **Guardar cotización**: persiste en `LocalStorage`.
- **Descargar PDF**: envía payload al backend y descarga archivo `Quote_<quoteNumber>.pdf`.

## 2) Mi Empresa

Campos:
- Nombre comercial (requerido)
- RNC (opcional, 9-11 dígitos si se completa)
- Dirección, teléfono, email, website
- Moneda (USD/DOP)
- Notas legales
- Logo PNG/JPG (preview + quitar)

Acciones:
- **Guardar cambios**
- **Restaurar ejemplo**

## 3) Cotizaciones

- Lista histórica desde `LocalStorage`
- Búsqueda por cliente o número
- Acciones por registro:
  - Ver detalle
  - Descargar PDF (re-generación)
  - Duplicar (carga datos en Cotizar)
  - Eliminar

## Ejecución local

### Backend

```bash
cd src/backend
dotnet run --project src/Api/Api.csproj --urls http://localhost:5070
```

Swagger: `http://localhost:5070/swagger`

### Frontend

```bash
cd src/frontend
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
Calcula breakdown de pricing.

### POST `/api/quotes/pdf`
Genera PDF de cotización.

Request de ejemplo:

```json
{
  "company": {
    "name": "Mi Empresa SRL",
    "rnc": "123456789",
    "address": "Santo Domingo...",
    "phone": "+1 ...",
    "email": "info@empresa.do",
    "website": "https://empresa.do",
    "currency": "USD",
    "legalNotes": "Condiciones...",
    "logoBase64": "data:image/png;base64,iVBORw0KGgo..."
  },
  "customer": {
    "name": "Ricardo Rodríguez",
    "company": "Cliente SRL",
    "email": "cliente@correo.com",
    "phone": "809-000-0000",
    "address": "Santo Domingo"
  },
  "quote": {
    "quoteNumber": "Q-20260217-0001",
    "issueDate": "2026-02-17",
    "validDays": 15,
    "notes": "Notas para el cliente",
    "pricingRequest": {
      "planId": "pro",
      "users": 18,
      "extraStorageGb": 200,
      "addonIds": ["support_premium"],
      "billingCycle": "annual",
      "taxRate": 0.18,
      "prorationDays": 0
    }
  }
}
```

Response:
- `200 OK`
- `Content-Type: application/pdf`
- Archivo: `Quote_<quoteNumber>.pdf`

## Cómo funciona el logo (base64)

1. El usuario sube un PNG/JPG en **Mi Empresa**.
2. El frontend lo convierte a Data URL base64 (`FileReader.readAsDataURL`).
3. Se guarda en `LocalStorage` dentro de `company_settings.logoBase64`.
4. Al generar PDF, se envía al backend en `company.logoBase64`.
5. El backend intenta decodificarlo; si falla o no existe, genera el PDF sin logo.

## Validaciones principales

- `users >= 1`
- `taxRate` entre `0` y `0.25`
- `prorationDays` entre `0` y `30`
- `company.name` requerido
- `customer.name` requerido
- `quoteNumber` requerido

## Tests

Proyecto con pruebas xUnit para el cálculo del motor de pricing (`src/backend/tests/QuoteCalculator.Tests`).

## Docker Compose (opcional)

```bash
docker compose up --build
```
