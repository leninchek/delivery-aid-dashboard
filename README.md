# Delivery Aid — Back Office

Panel web de administración para el sistema de gestión, distribución y trazabilidad de apoyos sociales. Permite registrar entregas, administrar catálogos y organigrama, gestionar accesos a la App Android y generar reportes.

---

## Stack tecnológico

| Categoría | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router, export estático) | 16.2.4 |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Base de datos | Firebase Firestore | 12.x |
| Autenticación | Firebase Auth | 12.x |
| Almacenamiento | Firebase Storage | 12.x |
| Gráficas | Recharts | 3.x |
| Pruebas E2E | Playwright | 1.x |
| Runtime | Node.js | 20+ |

---

## Arquitectura

```
Back Office (Next.js export estático)
    │
    ├── Firebase Auth         — Autenticación de usuarios Back Office
    ├── Firebase Firestore     — Base de datos en tiempo real
    ├── Firebase Storage       — Almacenamiento de evidencias
    │
    └── Cloud Functions        — Operaciones con Firebase Admin SDK
           ├── createAppUser
           ├── importUsers
           ├── resetAppUserPassword
           ├── toggleAppUserStatus
           └── sendPushCampaign
```

El Back Office se despliega como **export estático** (carpeta `out/`) en **Firebase Hosting**. No hay servidor Node.js en producción; todas las operaciones que requieren privilegios de Admin SDK se delegan a Cloud Functions.

---

## Módulos

### Captura
Registro de entregas e información de campo.

| Ruta | Módulo | Rol mínimo |
|---|---|---|
| `/captura/interna` | Entrega Interna (DirectDeliveries) | `data_entry` |
| `/captura/externa` | Entrega Externa (IndirectDeliveries) | `data_entry` |
| `/captura/promovidos` | Promovidos (Promoted) | `data_entry` |

### Reportes
Consulta y exportación de datos operativos.

| Ruta | Módulo |
|---|---|
| `/reports/charts` | Panel de Control (gráficas y métricas) |
| `/reports/deliveries` | Reporte de Entregas |
| `/reports/promoted` | Reporte de Promovidos |
| `/reports/branch` | Reporte por Rama Organizacional |
| `/reports/communities` | Reporte por Comunidad |
| `/reports/activists` | Reporte por Activista |
| `/reports/authorities` | Directorio de Autoridades |
| `/reports/credentials` | Credenciales de Miembros |

### Operación
Gestión de cuentas de la App Android.

| Ruta | Módulo |
|---|---|
| `/access/app-users` | Acceso App — crear, importar CSV, resetear contraseña, activar/desactivar |

### Catálogos
Administración de catálogos del sistema.

| Ruta | Módulo |
|---|---|
| `/organization/members` | Miembros Organizacionales (organigrama) |
| `/catalogs/communities` | Comunidades |
| `/catalogs/cities` | Ciudades |
| `/catalogs/routes` | Rutas |
| `/catalogs/aid-types` | Tipos de Apoyo |
| `/catalogs/authorities` | Autoridades |

### Administración
Configuración y acceso al sistema.

| Ruta | Módulo | Rol |
|---|---|---|
| `/admin/roles` | Roles y Permisos | `admin` |
| `/admin/users` | Usuarios Back Office | `admin` |
| `/admin/org-levels` | Niveles Organizacionales | `admin` |
| `/admin/delivery-types` | Tipos de Entrega Directa | `admin` |

### Push
| Ruta | Módulo |
|---|---|
| `/push/campaigns` | Campañas de Notificaciones Push | `admin` |

---

## Roles y permisos

### Roles Back Office

| Acción | `admin` | `supervisor` | `data_entry` |
|---|---|---|---|
| Gestionar catálogos | ✅ | — | ✅ |
| Gestionar miembros org | ✅ | — | ✅ |
| Registrar entregas y promovidos | ✅ | — | ✅ |
| Ver reportes | ✅ | ✅ | — |
| Gestionar cuentas App | ✅ | — | — |
| Gestionar niveles org | ✅ | — | — |
| Gestionar roles / usuarios BO | ✅ | — | — |
| Enviar campañas push | ✅ | — | — |

Los roles se almacenan en `BackofficeRoles` (Firestore) y se asignan desde **Administración → Roles y Permisos**. El rol `admin` es fijo y no editable desde el panel.

### Capacidades dinámicas (App Android)

Los permisos de la App son dinámicos y se configuran por nivel en **Administración → Niveles Organizacionales**.

| Capacidad | Acción habilitada en App |
|---|---|
| `can_create_direct_delivery` | Registrar entrega interna |
| `can_create_indirect_delivery` | Registrar entrega externa |
| `can_register_promoted` | Dar de alta promovidos |
| `can_view_own_deliveries` | Ver propias entregas |
| `can_view_own_promoted` | Ver propios promovidos |
| `can_edit_own_promoted` | Editar propios promovidos |
| `can_delete_own_promoted` | Eliminar propios promovidos |
| `can_view_notifications` | Ver notificaciones |

---

## Colecciones Firestore

| Colección | Descripción | Origen |
|---|---|---|
| `SystemUsers` | Cuentas de acceso (Back Office y App). ID = UID de Firebase Auth | Back Office + Cloud Functions |
| `OrgLevels` | Niveles jerárquicos con capacidades dinámicas | Back Office |
| `OrgMembers` | Organigrama — catálogo de personas con jerarquía y asignación territorial | Back Office + Cloud Functions |
| `AidTypes` | Tipos de apoyo con unidad de medida | Back Office |
| `Authorities` | Autoridades municipales (delegados, presidentes, etc.) | Back Office |
| `Cities` | Ciudades/municipios con referencias a autoridades | Back Office |
| `Communities` | Comunidades con referencias a ciudad y autoridades | Back Office |
| `Routes` | Rutas operativas de distribución | Back Office |
| `DirectDeliveryTypes` | Tipos de entrega directa (quién puede entregar a quién) | Back Office |
| `DirectDeliveries` | Registros de entregas directas (App Android) | App Android |
| `IndirectDeliveries` | Registros de entregas externas | Back Office + App |
| `Promoted` | Beneficiarios/promovidos registrados | App Android |
| `BackofficeRoles` | Roles del Back Office con permisos asignados | Back Office |
| `PushCampaigns` | Historial de campañas push enviadas | Back Office |
| `AppDevices` | Dispositivos App con token FCM para notificaciones | App Android |

> El contrato completo de campos y reglas está en [`plan.md`](plan.md).

---

## Configuración local

### Requisitos

- Node.js 20+
- npm 10+

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
```

Editar `.env` con los valores del proyecto Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FUNCTIONS_REGION=us-central1

# Para seed scripts — elegir una opción:
# Opción A: ruta a archivo service account JSON
GOOGLE_APPLICATION_CREDENTIALS=

# Opción B: credenciales explícitas
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Opción C: JSON completo en una variable
FIREBASE_SERVICE_ACCOUNT_JSON=
```

```bash
# 3. Iniciar servidor de desarrollo
npm run dev
# Acceder en http://127.0.0.1:3000
```

> El desarrollo y las pruebas E2E usan `127.0.0.1:3000` como origen para mantener cookies de sesión válidas.

---

## Seed scripts

Poblan datos maestros en Firestore. Ejecutar siempre en orden:

| Orden | Comando | Descripción |
|---|---|---|
| 1 | `npm run seed:org-levels` | Niveles organizacionales base |
| 2 | `npm run seed:direct-delivery-types` | Tipos de entrega directa |
| 3 | `npm run seed:cities` | Municipios de Quintana Roo |
| 4 | `npm run seed:communities` | Comunidades de Felipe Carrillo Puerto |
| 5 | `npm run seed:aid-types` | Tipos de apoyo comunes |

Para ejecutar todos en una sola operación:

```bash
npm run seed:all
```

Cada seed tiene modo `dry-run` para verificar sin escribir:

```bash
npm run seed:cities:dry
npm run seed:direct-delivery-types:dry
```

Los seeds son idempotentes: omiten registros que ya existen por nombre o código.

---

## Pruebas E2E

```bash
# Configurar entorno E2E
cp .env.e2e.example .env.e2e
# Editar .env.e2e con credenciales de prueba

# Ejecutar pruebas (detener el servidor de dev si está corriendo)
npm run test:e2e

# Con navegador visible
npm run test:e2e:headed
```

> Las pruebas E2E requieren que NO haya un servidor `npm run dev` activo. Playwright inicia el servidor internamente.

---

## Build y despliegue

```bash
npm run build
```

Genera la carpeta `out/` con el export estático. Luego desplegar desde la raíz del workspace:

```bash
firebase deploy --only hosting
```

> Al ser export estático, las API routes de Next.js **no están disponibles en producción**. Todas las operaciones privilegiadas se ejecutan a través de **Cloud Functions** (`Delivery-Aid-CloudFunctions`).

---

## Cloud Functions utilizadas

| Función | Método | Descripción |
|---|---|---|
| `createAppUser` | POST | Crear cuenta App para un miembro del organigrama |
| `importUsers` | POST | Importar usuarios App desde CSV (máx. 500 filas) |
| `resetAppUserPassword` | POST | Generar contraseña temporal para cuenta App |
| `toggleAppUserStatus` | POST | Activar o desactivar cuenta App |
| `sendPushCampaign` | POST | Enviar campaña de notificaciones push |

Todas las funciones requieren un token `Bearer` de un usuario Back Office con rol `admin`.

El endpoint base de las funciones se configura con `NEXT_PUBLIC_FUNCTIONS_REGION` y el `NEXT_PUBLIC_FIREBASE_PROJECT_ID` del proyecto.
