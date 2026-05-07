# 🌱 Delivery Aid BackOffice Seeds

Este directorio contiene scripts para poblar datos maestros (seeds) en Firebase Firestore.

## Seeds disponibles

### 1. **Ciudades de Quintana Roo** (`seed-cities.ts`)
Puebla 11 municipios de Quintana Roo:
- Othón P. Blanco (Chetumal)
- Benito Juárez (Cancún)
- Felipe Carrillo Puerto
- Lázaro Cárdenas
- Cozumel
- José María Morelos
- Isla Mujeres
- Solidaridad
- Tulum
- Bacalar
- Puerto Morelos

**Ejecutar:**
```bash
npm run seed:cities
```

### 2. **Comunidades de Felipe Carrillo Puerto** (`seed-communities.ts`)
Puebla 16 comunidades principales del municipio de Felipe Carrillo Puerto:
- Felipe Carrillo Puerto (cabecera)
- Tihosuco
- Noh-Bec
- X-Hazil
- Señor
- Chan Santa Cruz
- Uh-May
- Chancenote
- Y más...

**Ejecutar:**
```bash
npm run seed:communities
```

### 3. **Tipos de Apoyo Comunes** (`seed-aid-types.ts`)
20 tipos de apoyo típicos en programas sociales:
- Despensa básica (paquete)
- Canasta navideña (paquete)
- Tarjeta de despensa (tarjeta)
- Kit escolar (paquete)
- Módulo de fármacos (paquete)
- Kit de higiene (paquete)
- Combustible (litro)
- Apoyo ganadero (pieza)
- Fertilizante (kg)
- Semillas (kg)
- Y más...

**Unidades estándar utilizadas:**
- `paquete` — Conjuntos/grupos de artículos
- `tarjeta` — Beneficiarios/dinero electrónico
- `pieza` — Artículos individuales
- `kg` — Productos a granel
- `litro` — Líquidos
- `par` — Prendas de a dos (calzado)

**Ejecutar:**
```bash
npm run seed:aid-types
```

### 4. **Ejecutar todos los seeds**
Ejecuta todos los seeds disponibles en el sistema (org-levels, direct-delivery-types, cities, communities, aid-types):

```bash
npm run seed:all
```

## Configuración de entorno

Los scripts requieren que las siguientes variables de entorno estén configuradas en `.env.local` o `.env`:

```env
# Firebase Authentication
FIREBASE_SERVICE_ACCOUNT_JSON=<json_service_account>
# O alternativamente:
FIREBASE_ADMIN_PROJECT_ID=<project_id>
FIREBASE_ADMIN_CLIENT_EMAIL=<client_email>
FIREBASE_ADMIN_PRIVATE_KEY=<private_key>

# Firebase Project IDs
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project_id>
```

## Estructura de datos

### Cities
```typescript
{
  id: string; // Auto-generado
  name: string; // Nombre del municipio
  state: string; // "Quintana Roo"
  active: boolean; // true
}
```

### Communities
```typescript
{
  id: string; // Auto-generado
  name: string; // Nombre de la comunidad
  cityId: string; // ID del documento de la ciudad (referencia)
  active: boolean; // true
}
```
**Nota:** El seed busca automáticamente la ciudad "Felipe Carrillo Puerto" y obtiene su ID antes de crear las comunidades.

### AidTypes
```typescript
{
  id: string; // Auto-generado
  name: string; // Nombre del tipo de apoyo
  unit: string; // Unidad estándar: "paquete" | "tarjeta" | "pieza" | "kg" | "litro" | "par"
  active: boolean; // true
}
```

## Comportamiento de los seeds

- **No sobrescriben datos existentes:** Si un registro con el mismo nombre ya existe en la colección, el seed lo omite.
- **Transacciones atómicas:** Cada registro se inserta de forma independiente.
- **Reporte de resultados:** Los scripts muestran un resumen con:
  - Total de registros procesados
  - Registros añadidos
  - Registros omitidos (ya existentes)
  - Registros fallidos (errores)

## Ejemplo de ejecución

```bash
# Ejecutar seed de ciudades
$ npm run seed:cities

Starting cities seed...
Collection: Cities
[ADD] Othón P. Blanco
[ADD] Benito Juárez
[ADD] Felipe Carrillo Puerto
... (más registros)
[SKIP] <municipio_ya_existente>

✅ Seed completed!
Total: 11 | Added: 11 | Skipped: 0 | Failed: 0
```

## Notas importantes

1. **Ejecución en producción:** Estos scripts están diseñados para ejecutarse contra tu proyecto de Firebase. Asegúrate de tener las credenciales correctas.

2. **Idempotencia:** Los scripts son idempotentes. Puedes ejecutarlos múltiples veces sin duplicar datos.

3. **Orden de ejecución recomendado:**
   - Primero: `seed:org-levels` (estructura organizacional)
   - Luego: `seed:direct-delivery-types` (tipos de entrega)
   - Luego: `seed:cities` (ciudades) ⚠️ **OBLIGATORIO antes de seed:communities**
   - Luego: `seed:communities` (comunidades) — Busca automáticamente las ciudades y se relaciona por cityId
   - Finalmente: `seed:aid-types` (tipos de apoyo)

4. **Personalización:** Para modificar los datos, edita directamente los arrays `*Seeds` en cada archivo `.ts`.

## Troubleshooting

### Error: "Missing required environment variable"
Verifica que todas las variables de entorno estén configuradas en `.env.local` o `.env`.

### Error: "Permission denied" al conectar a Firebase
Verifica que:
- El archivo de credenciales de Firebase es válido
- Las credenciales tienen permisos de escritura en Firestore
- El proyecto ID coincide entre las credenciales y la configuración

### Registros no se insertan pero tampoco hay errores
Revisa la consola para ver si hay registros siendo "skipped". Si el nombre existe, el seed los omite.

---

**Última actualización:** Mayo 7, 2026
