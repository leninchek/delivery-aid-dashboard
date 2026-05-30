# Delivery Aid — Plan Maestro

## Visión del sistema

Sistema para la gestión, distribución y trazabilidad de apoyos sociales.
Permite registrar entregas desde campo (App Android, offline-first) y administrar
catálogos, organigrama y reportes desde un panel web (Back Office).

---

## Repositorios

| Repositorio | Stack | Estado |
|---|---|---|
| `Delivery-Aid-Android` | Kotlin + Jetpack Compose + Hilt + Firebase + WorkManager | En producción |
| `Delivery-Aid-BackOffice` | Next.js + TypeScript + Tailwind + Firebase | En producción |
| `Delivery-Aid-CloudFunctions` | Node.js 22 + TypeScript + Firebase Functions v2 | En producción |

**Backend compartido:** Firebase (Firestore + Storage + Auth)
**Hosting Back Office:** Firebase Hosting — Next.js export estático

**Push notifications:** Firebase Cloud Messaging (FCM) + endpoint seguro (Cloud Functions)

---

## Organigrama

El organigrama es un catálogo de personas. No todos son usuarios del sistema.

```
Coordinador General
 └─ Distrital (tipo: ciudad | rural)
     └─ Coordinador  ← usuario App Android
         └─ Seccional  ← usuario App Android
             └─ Activista  ← usuario App Android
                 └─ Promovido  ← beneficiario final
```

Asignación territorial por nivel:
- Distrital Ciudad → `cityId`
- Distrital Rural → `communityId`
- Coordinador → `routeId`
- Seccional / Activista → heredan del árbol (`path[]`)

---

## Usuarios del sistema

### App Android
- Cualquier nivel de `OrgLevels` con `canUseApp = true`
- Autenticación: Firebase Auth (email/password)

### Back Office
- `admin` — Desarrolladores. Acceso total.
- `supervisor` — Lectura amplia y reportes.
- `data_entry` (Capturista) — Alta de información y catálogos.

### Reglas de separación de acceso
- El organigrama (`OrgMembers`) es catálogo de personas y no otorga acceso por sí mismo.
- Los roles de Back Office (`admin`, `supervisor`, `data_entry`) solo existen para usuarios `type = backoffice`.
- Un miembro del organigrama no debe tener acceso al Back Office por pertenecer al organigrama.
- El acceso a la App se gestiona con usuarios `type = app` y su vínculo obligatorio a `orgMemberId`.

### Regla formal: vinculación de usuarios App con organigrama
- No existe doble alta de persona. La persona se registra una sola vez en `OrgMembers`.
- La cuenta App se registra por separado en autenticación y en `SystemUsers` con `type = app`.
- La relación oficial se establece con `SystemUsers.orgMemberId = OrgMembers.id`.
- Referencia inversa opcional para trazabilidad: `OrgMembers.appUserId = SystemUsers.id`.
- Un `org_member` puede tener como máximo una cuenta App activa.
- Si `OrgLevels.canUseApp = false`, no se permite crear cuenta App para ese nivel.
- Si se desactiva un `org_member` (`active = false`), su cuenta App debe quedar bloqueada.

---

## Modelo de datos (Firestore)

> Todos los campos están en inglés.
> Campos obligatorios en todos los registros de personas: `name`, `phone`, `curp`, `birthDate`.

---

### `OrgLevels` — Catálogo dinámico de niveles

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | Auto-generado |
| `name` | string | Ej. "Seccional", "Activista" |
| `rank` | number | Posición jerárquica (1 = más alto) |
| `canUseApp` | bool | ¿Puede iniciar sesión en la App? |
| `capabilities` | string[] | Permisos operativos en la App. Ej. `["can_create_direct_delivery", "can_register_promoted"]` |
| `active` | bool | — |

**Seed inicial:**

| rank | name | canUseApp | capabilities |
|---|---|---|---|
| 1 | Coordinador General | false | [] |
| 2 | Distrital | false | [] |
| 3 | Coordinador | true | [can_create_direct_delivery, can_create_indirect_delivery, can_view_branch_structure, can_view_own_deliveries] |
| 4 | Seccional | true | [can_create_direct_delivery, can_create_indirect_delivery, can_view_branch_structure, can_view_own_deliveries] |
| 5 | Activista | true | [can_create_direct_delivery, can_register_promoted, can_create_indirect_delivery, can_view_own_deliveries] |

> Nota: este seed es inicial. El acceso App no está limitado a estos tres niveles; cualquier nivel nuevo puede habilitarse con `canUseApp = true`.
> Las capacidades pueden modificarse sin cambiar código: agregar/remover permisos operativos por nivel de forma dinámica.

---

### `OrgMembers` — Organigrama / catálogo de personas

| Campo | Tipo |
|---|---|
| `id` | string |
| `name` | string — obligatorio |
| `phone` | string — obligatorio |
| `curp` | string — obligatorio |
| `birthDate` | date — obligatorio |
| `levelId` | ref → `OrgLevels` |
| `parentId` | uid \| null |
| `path` | uid[] — árbol completo para queries |
| `assignment.cityId` | string \| null |
| `assignment.communityId` | string \| null |
| `assignment.routeId` | string \| null |
| `appUserId` | uid \| null — vínculo a cuenta App |
| `active` | bool |
| `createdAt` | timestamp |
| `updatedAt` | timestamp |

---

### `Promoted` — Promovidos / beneficiarios

| Campo | Tipo |
|---|---|
| `id` | string |
| `name` | string — obligatorio |
| `phone` | string — obligatorio |
| `curp` | string — obligatorio |
| `birthDate` | date — obligatorio |
| `activistId` | ref → `OrgMembers` |
| `communityId` | ref → `Communities` \| null |
| `active` | bool |
| `createdAt` | timestamp |

---

### `SystemUsers` — Cuentas de acceso

| Campo | Tipo |
|---|---|
| `id` | string (= Firebase Auth UID) |
| `name` | string |
| `email` | string |
| `birthDate` | date |
| `type` | app \| backoffice |
| `backofficeRole` | admin \| supervisor \| data_entry \| null |
| `orgMemberId` | ref → `OrgMembers` \| null |
| `active` | bool |
| `createdAt` | timestamp |

**Push en App:**
- La App guarda y actualiza su token FCM en una colección de dispositivos.
- Si el usuario App queda inactivo, su dispositivo no debe recibir campañas nuevas.

**Reglas de consistencia:**
- Si `type = backoffice`, `backofficeRole` es obligatorio y `orgMemberId` debe ser `null`.
- Si `type = app`, `orgMemberId` es obligatorio y `backofficeRole` debe ser `null`.
- Ningún usuario puede tener simultáneamente permisos de App y Back Office en la misma cuenta.

**Derivación dinámica de permisos App:**
- El nivel efectivo del usuario App se obtiene por `SystemUsers.orgMemberId -> OrgMembers.levelId`.
- La posibilidad de acceso App se determina por `OrgLevels.canUseApp`.
- Los permisos operativos se determinan por `OrgLevels.capabilities` y por el catálogo `DirectDeliveryTypes`.
- La selección de destinatario siempre se valida contra la jerarquía real en `OrgMembers`: el receptor debe estar bajo su cargo (descendiente en `path`).

> En esta etapa, la validación de permisos y jerarquía se implementa en UI/cliente. No se definen reglas de seguridad de Firestore para este control por ahora.

**Descripción operativa (alta de usuario App):**
1. `data_entry` o `admin` crea/actualiza el registro en `OrgMembers`.
2. Si el nivel permite app (`canUseApp = true`), se habilita la acción "Create App Access" solo para `admin`.
3. El sistema crea credencial en Firebase Auth (email/password temporal).
4. El sistema crea `SystemUsers` con `type = app` y `orgMemberId`.
5. El sistema guarda `appUserId` en `OrgMembers` (opcional pero recomendado).

**Descripción operativa (baja o bloqueo):**
1. Si `OrgMembers.active` cambia a `false`, se deshabilita login de la cuenta App.
2. Si se elimina vínculo `orgMemberId`, la cuenta App queda sin permisos operativos.
3. Nunca se elimina historial: `DirectDeliveries.registeredBy` conserva trazabilidad.

---

### `DirectDeliveryTypes` — Catálogo de tipos de entrega directa

| Campo | Tipo |
|---|---|
| `id` | string |
| `code` | string único |
| `label` | string |
| `fromLevelIds` | levelId[] |
| `toLevelIds` | levelId[] |
| `requiredCapability` | string (ej. `can_create_direct_delivery`) |
| `active` | bool |
| `sortOrder` | number |

Seed inicial recomendado:
- `coordinator_to_sectional`
- `sectional_to_activist`
- `activist_to_promoted`

Notas operativas:
- Nuevos tipos se agregan en este catálogo sin cambiar estructura de `DirectDeliveries`.
- La UI solo muestra tipos activos compatibles con el nivel del usuario y su jerarquía real.

---

### `DirectDeliveries` — Entregas directas (App Android)

| Campo | Tipo |
|---|---|
| `id` | = `idempotencyKey` (UUID del dispositivo) |
| `deliveryType` | string (ref: `DirectDeliveryTypes.code`) |
| `aidTypeId` | ref → `AidTypes` |
| `quantity` | number |
| `unit` | string (de `AidTypes`) |
| `fromOrgId` | ref → `OrgMembers` |
| `toOrgId` | ref → `OrgMembers` \| null |
| `toPromotedId` | ref → `Promoted` \| null |
| `fromName` | string — snapshot |
| `toName` | string — snapshot |
| `registeredBy` | uid → `SystemUsers` |
| `date` | serverTimestamp |
| `localDate` | timestamp (dispositivo) |
| `location.lat` | number |
| `location.lng` | number |
| `evidenceUrls` | string[] |
| `status` | pending_sync \| synced |
| `audit.registeredBy` | uid |
| `audit.offline` | bool |
| `audit.deviceId` | string |

Reglas obligatorias por tipo (`deliveryType`):
- `coordinator_to_sectional`: `toOrgId` requerido (nivel Seccional), `toPromotedId = null`.
- `sectional_to_activist`: `toOrgId` requerido (nivel Activista), `toPromotedId = null`.
- `activist_to_promoted`: `toPromotedId` requerido, `toOrgId = null`.
- Para tipos nuevos, se aplican las reglas definidas en `DirectDeliveryTypes` y validación jerárquica en UI.

---

### `IndirectDeliveries` — Entregas indirectas (Back Office + App)

Disponible en:
- **Back Office:** usuarios `data_entry` y `admin`
- **App Android:** usuarios con capacidad `can_create_indirect_delivery`

| Campo | Tipo |
|---|---|
| `id` | string |
| `aidTypeId` | ref → `AidTypes` |
| `description` | string |
| `comment` | string \| null |
| `amount` | number \| null |
| `quantity` | number \| null |
| `unit` | string \| null |
| `beneficiaryName` | string — texto libre |
| `registeredBy` | uid → `SystemUsers` |
| `date` | timestamp |
| `location.lat` | number \| null |
| `location.lng` | number \| null |
| `evidenceUrls` | string[] |
| `audit.registeredBy` | uid |
| `source` | backoffice \| app — origen del registro |

---

### `AidTypes` — Catálogo de tipos de apoyo

| Campo | Tipo |
|---|---|
| `id` | string |
| `name` | string |
| `unit` | piece \| MXN \| kg \| other |
| `active` | bool |

---

### `Authorities` — Catálogo de autoridades

| Campo | Tipo |
|---|---|
| `id` | string |
| `type` | delegate \| sub_delegate \| mayor \| ejidal_commissioner |
| `name` | string — obligatorio |
| `phone` | string — obligatorio |
| `curp` | string — obligatorio |
| `birthDate` | date — obligatorio |

---

### `Cities`

| Campo | Tipo |
|---|---|
| `id` | string |
| `name` | string |
| `state` | string |
| `delegateId` | ref → `Authorities` \| null |
| `subDelegateId` | ref → `Authorities` \| null |
| `mayorId` | ref → `Authorities` \| null |
| `ejidalCommissionerId` | ref → `Authorities` \| null |
| `createdAt` | timestamp |

---

### `Communities`

| Campo | Tipo |
|---|---|
| `id` | string |
| `name` | string |
| `cityId` | ref → `Cities` \| null |
| `delegateId` | ref → `Authorities` \| null |
| `subDelegateId` | ref → `Authorities` \| null |
| `mayorId` | ref → `Authorities` \| null |
| `ejidalCommissionerId` | ref → `Authorities` \| null |
| `createdAt` | timestamp |

---

### `Routes`

| Campo | Tipo |
|---|---|
| `id` | string |
| `name` | string |
| `description` | string \| null |

---

### `AppDevices` — Dispositivos App para notificaciones

| Campo | Tipo |
|---|---|
| `id` | string |
| `userId` | uid → `SystemUsers` |
| `orgMemberId` | ref → `OrgMembers` |
| `fcmToken` | string |
| `platform` | android |
| `appVersion` | string |
| `active` | bool |
| `lastSeenAt` | timestamp |
| `createdAt` | timestamp |
| `updatedAt` | timestamp |

Notas operativas:
- Un usuario puede tener varios dispositivos activos.
- Se debe desactivar token al cerrar sesión o detectar token inválido.
- Los envíos globales usan todos los `AppDevices.active = true` asociados a usuarios App activos.

---

### `PushCampaigns` — Campañas enviadas desde Back Office

| Campo | Tipo |
|---|---|
| `id` | string |
| `title` | string |
| `body` | string |
| `target` | all_app_users \| level_ids |
| `targetLevelIds` | string[] \| null |
| `status` | draft \| scheduled \| sent \| partial_failed \| failed |
| `scheduledAt` | timestamp \| null |
| `sentAt` | timestamp \| null |
| `createdBy` | uid → `SystemUsers` |
| `stats.total` | number |
| `stats.sent` | number |
| `stats.failed` | number |
| `createdAt` | timestamp |

Notas operativas:
- El Back Office nunca envía push directo con credenciales sensibles desde frontend.
- El envío se hace por endpoint seguro (Cloud Functions) usando Firebase Admin SDK.
- Guardar historial de campañas para auditoría y métricas.

---

## Push notifications — Especificación mínima (MVP)

### Objetivo inicial
- Permitir envío de campañas push desde Back Office a todos los usuarios App activos.
- Soportar segmentación por nivel (`target = level_ids`) sin rediseñar el modelo.

### Payload estándar (notificación)

Campos mínimos del mensaje:

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `title` | string | Sí | Título visible en notificación |
| `body` | string | Sí | Mensaje principal |
| `campaignId` | string | Sí | ID de `PushCampaigns` para trazabilidad |
| `screen` | string | No | Pantalla destino al abrir (ej. `home`, `deliveries`, `reports`) |
| `entityId` | string | No | ID relacionado con `screen` (si aplica) |
| `sentAt` | timestamp ISO | Sí | Fecha/hora de envío |

Convención inicial para `screen`:
- `home`
- `deliveries`
- `IndirectDeliveries`
- `reports`

### Contrato del endpoint seguro (Cloud Functions)

`POST /sendPushCampaign`

Request mínimo:
- `title: string`
- `body: string`
- `target: all_app_users | level_ids`
- `targetLevelIds?: string[]`
- `screen?: string`
- `entityId?: string`

Response mínimo:
- `campaignId: string`
- `status: sent | partial_failed | failed`
- `total: number`
- `sent: number`
- `failed: number`

Reglas mínimas del endpoint:
- Solo usuarios Back Office con rol `admin` pueden ejecutar envíos.
- El endpoint obtiene dispositivos desde `AppDevices` con `active = true` y usuario App activo.
- Tokens inválidos detectados en envío deben marcarse como inactivos.

### Flujo de Back Office (MVP)

1. Admin abre módulo de campañas push.
2. Captura `title` y `body`.
3. Selecciona objetivo (`all_app_users` por defecto; opcional `level_ids`).
4. Opcional: define `screen` y `entityId`.
5. Confirma envío.
6. Back Office invoca `POST /sendPushCampaign`.
7. Se guarda campaña en `PushCampaigns` con estadísticas de resultado.
8. UI muestra resumen: total, enviados, fallidos.

### Comportamiento en App Android (MVP)

- **Foreground:** mostrar banner/toast interno y guardar evento local para consulta en UI.
- **Background/quit:** mostrar notificación del sistema.
- **Tap en notificación:** abrir App y navegar por `screen` si existe; si no existe, abrir `home`.
- Si `entityId` no existe o es inválido, fallback seguro a pantalla lista de módulo.

### Checklist de implementación

- App Android
  - Registrar/refrescar token FCM y sincronizar `AppDevices`.
  - Manejar recepción foreground/background y deep link interno por `screen`.
  - Fallback de navegación y tolerancia a payload incompleto.
- Back Office
  - Formulario de campaña (`title`, `body`, `target`, `targetLevelIds`, `screen`, `entityId`).
  - Vista de historial (`PushCampaigns`) con estado y métricas.
  - Confirmación previa al envío.
- Backend (Cloud Functions)
  - Endpoint `sendPushCampaign` con validación de rol admin.
  - Resolución de audiencia desde `AppDevices`.
  - Envío por lotes, actualización de estadísticas y desactivación de tokens inválidos.

---

## RBAC — Matriz de permisos

### Back Office (roles fijos)

| Acción | admin | supervisor | data_entry |
|---|---|---|---|
| Entrega indirecta | ✅ | ❌ | ✅ |
| Alta OrgMembers | ✅ | ❌ | ✅ |
| Asignar cuenta App a org_member | ✅ | ❌ | ❌ |
| Gestionar catálogos | ✅ | ❌ | ✅ |
| Gestionar OrgLevels | ✅ | ❌ | ❌ |
| Enviar push a App (global/segmentado) | ✅ | ❌ | ❌ |
| Ver reportes completos | ✅ | ✅ | ❌ |
| Ver su rama del organigrama | ✅ | ✅ | ✅ |

### App Android (niveles dinámicos)

- Acceso permitido solo para niveles con `OrgLevels.canUseApp = true`.
- Cada nivel tiene un conjunto de `capabilities` que determinan qué acciones operativas puede realizar.
- Los flujos de entrega directa disponibles se obtienen desde `DirectDeliveryTypes` (fuente única de verdad).
- Capacidades disponibles:
  - `can_create_direct_delivery` — Registrar entregas directas (Coordinador→Seccional, Seccional→Activista, Activista→Promovido)
  - `can_register_promoted` — Dar de alta nuevos promovidos/beneficiarios (solo niveles que atienden `Promovido`, inicialmente Activista)
  - `can_create_indirect_delivery` — Registrar entregas indirectas (beneficiario libre)
  - `can_view_branch_structure` — Ver el organigrama de su rama jerárquica
  - `can_view_own_deliveries` — Ver entregas registradas por el usuario
- Reglas operativas de selección en entrega directa:
  - Coordinador solo puede seleccionar un Seccional bajo su cargo.
  - Seccional solo puede seleccionar un Activista bajo su cargo.
  - Activista solo puede seleccionar un Promovido bajo su cargo.
- Alcance de lectura restringido a su rama jerárquica usando `path`.

> Los permisos de App no dependen de una lista fija de roles; dependen de `OrgLevels.capabilities`, que pueden ajustarse dinámicamente sin cambiar código.
> En esta etapa, el enforcement de estas capacidades se realiza en la UI.

---

## Estrategia offline-first (App Android)

1. **Firestore offline nativo (Android)** — persistencia local habilitada por defecto y también configurada en `AppModule`.
2. **Lecturas/escrituras offline** — Firestore atiende desde caché local y sincroniza automáticamente al reconectar.
3. **`idempotencyKey`** — UUID generado en dispositivo, usado como ID del documento en Firestore para evitar duplicados.
4. **WorkManager solo para imágenes** — `UploadQueueManager` encola `ImageUploadWorker` para subida robusta a Firebase Storage.
5. **Actualización post-subida** — `ImageUploadWorker` actualiza el documento Firestore con `evidenceUrls` y usa reintentos con backoff.
6. **Monitoreo de pendientes** — `SyncMonitor` mantiene el estado de imágenes pendientes para UI/operación.
7. **Conflictos de datos** — last-write-wins por `serverTimestamp`; divergencias se registran en `audit`.

---

## Índices compuestos (Firestore)

| Colección | Campos |
|---|---|
| `DirectDeliveries` | `registeredBy ASC` + `date DESC` |
| `DirectDeliveries` | `fromOrgId ASC` + `date DESC` |
| `DirectDeliveries` | `toOrgId ASC` + `date DESC` |
| `DirectDeliveries` | `deliveryType ASC` + `date DESC` |
| `IndirectDeliveries` | `registeredBy ASC` + `date DESC` |
| `OrgMembers` | `path array-contains` (nativo) |
| `OrgMembers` | `levelId ASC` + `active ASC` |

---

## Decisiones de arquitectura

| Decisión | Elección | Razón |
|---|---|---|
| Niveles del organigrama | Catálogo dinámico `OrgLevels` | Permite agregar figuras sin cambiar código |
| Validación de stock | Sin validación | Simplicidad operativa |
| Campos de personas | `name`, `phone`, `curp`, `birthDate` obligatorios en todos | Trazabilidad y futuro envío de mensajes |
| Hosting Back Office | Firebase Hosting + export estático | Mismo ecosistema Firebase; deploy con CLI junto a Cloud Functions |
| Idioma de campos | Inglés en toda la base de datos | Estándar de desarrollo |
| Persistencia local Android | Firestore offline nativo (sin Room) | Menor complejidad y sincronización automática del SDK |
| Anti-duplicados offline | `idempotencyKey` = ID del documento Firestore | Idempotencia nativa en Firestore |
| Sin lotes | Cada entrega es independiente | Simplificación del modelo |
| Capacidades dinámicas | Array en `OrgLevels.capabilities` | Permite agregar/remover permisos sin cambiar código; diferencia entre Back Office (fijo) y App (dinámico) |
| Entregas indirectas | Disponibles en Back Office y App condicional | Control granular: Back Office por rol, App por capability `can_create_indirect_delivery` |
| Alta de promovidos | Solo por Activista en App | El promovido depende del activista responsable y su estructura territorial |
| Selección de receptor | Restricción por jerarquía real (`path`) | Evita entregas fuera de la cadena de mando (Coordinador→Seccional→Activista→Promovido) |
| Push notifications | FCM + endpoint seguro (Cloud Functions) | Evita exponer credenciales en Back Office estático y permite auditoría/campañas |

---

## Decisiones finales cerradas (v1)

1. **Tipos de entrega directa**
  - Catálogo oficial en `DirectDeliveryTypes`.
  - Valores base: `coordinator_to_sectional`, `sectional_to_activist`, `activist_to_promoted`.

2. **Creación de acceso App**
  - Solo `admin` puede ejecutar "Create App Access".
  - `data_entry` solo administra datos de `OrgMembers` y catálogos permitidos.

3. **Alta de promovidos**
  - Solo Activista desde App (`can_register_promoted`).
  - No se considera alta operativa de `Promoted` desde Back Office en v1.

4. **Alcance de validaciones**
  - En módulos operativos App, enforcement en UI/cliente.
  - En push notifications, validación obligatoria de rol `admin` en endpoint seguro.

5. **Jerarquía obligatoria en entregas directas**
  - Coordinador→Seccional, Seccional→Activista, Activista→Promovido.
  - Siempre validado contra la jerarquía real de `OrgMembers.path`.

---

## Matriz de validación UI (v1)

Aplicable en App Android para formularios y flujos operativos. El objetivo es garantizar consistencia antes de guardar en Firestore.

### Entregas directas

| deliveryType | Nivel emisor permitido | Capability requerida | Reglas de destinatario | Campos obligatorios | Reglas de bloqueo UI |
|---|---|---|---|---|---|
| `coordinator_to_sectional` | Coordinador | `can_create_direct_delivery` | `toOrgId` debe ser Seccional descendiente en `path` | `aidTypeId`, `quantity`, `fromOrgId`, `toOrgId`, `localDate`, `location`, `idempotencyKey` | No mostrar Seccionales fuera de rama; deshabilitar botón Guardar si `toOrgId` no válido |
| `sectional_to_activist` | Seccional | `can_create_direct_delivery` | `toOrgId` debe ser Activista descendiente en `path` | `aidTypeId`, `quantity`, `fromOrgId`, `toOrgId`, `localDate`, `location`, `idempotencyKey` | No mostrar Activistas fuera de rama; deshabilitar botón Guardar si `toOrgId` no válido |
| `activist_to_promoted` | Activista | `can_create_direct_delivery` | `toPromotedId` debe pertenecer al Activista (`Promoted.activistId = fromOrgId`) | `aidTypeId`, `quantity`, `fromOrgId`, `toPromotedId`, `localDate`, `location`, `idempotencyKey` | No mostrar Promovidos de otro Activista; bloquear guardado si `toPromotedId` inválido |

Reglas UI transversales:
- Si el usuario no tiene `can_create_direct_delivery`, ocultar acceso al módulo.
- `quantity` debe ser mayor a 0.
- Si hay evidencia requerida por operación, forzar al menos 1 elemento en `evidenceUrls` antes de finalizar.
- Si no hay conectividad, permitir guardar con estado local y sincronizar luego (offline-first).

### Registro de promovidos

| Acción | Nivel permitido | Capability requerida | Validaciones UI obligatorias | Bloqueos UI |
|---|---|---|---|---|
| Crear `Promoted` | Activista | `can_register_promoted` | `name`, `phone`, `curp`, `birthDate`, `activistId` del usuario logueado | Si no es Activista o no tiene capability, ocultar botón de alta |

### Entregas indirectas

| Canal | Usuario permitido | Regla de autorización | Campos mínimos |
|---|---|---|---|
| Back Office | `admin`, `data_entry` | RBAC Back Office | `aidTypeId`, `description`, `beneficiaryName`, `date` |
| App Android | Nivel con `can_create_indirect_delivery` | Capability en `OrgLevels` | `aidTypeId`, `description`, `beneficiaryName`, `localDate` |

### Push notifications (UI Back Office)

| Acción | Rol permitido | Validaciones UI |
|---|---|---|
| Crear y enviar campaña | `admin` | `title` y `body` obligatorios; confirmar envío; mostrar resumen `total/sent/failed` |

