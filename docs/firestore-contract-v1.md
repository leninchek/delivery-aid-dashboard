# Firestore Contract v1

Fecha de congelamiento: 2026-04-30
Estado: vigente para integracion Android MVP
Fuente de verdad: implementacion actual del Back Office + plan maestro validado

## Objetivo

Este documento define el contrato Firestore v1 que Android puede consumir con bajo riesgo de retrabajo.

Separa dos grupos:
- Colecciones ya operativas en Back Office.
- Colecciones previstas en arquitectura, pero no implementadas aun como modulo funcional en Back Office.

## Convenciones generales

- Todos los nombres de coleccion usan PascalCase.
- IDs de documentos:
  - Catalogos CRUD: auto-generados por Firestore.
  - `SystemUsers`: el ID del documento es el UID de Firebase Authentication.
- Fechas:
  - En escritura desde Back Office se usan `createdAt` y `updatedAt` con `serverTimestamp()` cuando aplica.
  - En lectura cliente pueden llegar como `Timestamp` de Firestore.
- Campos booleanos sin valor explicito en documentos legados deben tratarse como:
  - `active = true` por defecto operativo cuando la UI ya lo hace asi.
- Campos de relacion usan ID de documento, no `DocumentReference`.

## Colecciones operativas hoy

### OrgLevels

Estado: operativa
Origen Back Office: CRUD completo
Consumida por Android: si

Campos:
- `name: string` obligatorio
- `rank: number` obligatorio
- `canUseApp: boolean` obligatorio
- `capabilities: string[]` obligatorio, puede ser arreglo vacio
- `active: boolean` obligatorio
- `createdAt: timestamp` en altas nuevas
- `updatedAt: timestamp` en altas y ediciones

Reglas operativas:
- `rank` define orden jerarquico ascendente.
- Si `canUseApp = false`, ese nivel no debe recibir acceso App.
- Si `canUseApp = true`, Android puede habilitar login solo si el usuario llega a este nivel via `SystemUsers.orgMemberId -> OrgMembers.levelId`.
- `capabilities` es la fuente dinamica de permisos App.

Capacidades actualmente previstas:
- `can_create_direct_delivery`
- `can_register_promoted`
- `can_create_indirect_delivery`
- `can_view_branch_structure`
- `can_view_own_deliveries`

Notas Android:
- Tratar `capabilities` como lista abierta, no enum cerrada en UI.
- Si una capability desconocida aparece, ignorarla de forma segura.

### OrgMembers

Estado: operativa
Origen Back Office: CRUD completo
Consumida por Android: si

Campos:
- `name: string` obligatorio
- `phone: string` obligatorio
- `curp: string` obligatorio, Back Office lo normaliza a uppercase
- `birthDate: timestamp | Date` obligatorio
- `levelId: string` obligatorio, referencia logica a `OrgLevels`
- `parentId: string | null`
- `path: string[]` obligatorio
- `assignment.cityId: string | null`
- `assignment.communityId: string | null`
- `assignment.routeId: string | null`
- `appUserId: string | null`
- `active: boolean` obligatorio
- `createdAt: timestamp` en altas nuevas
- `updatedAt: timestamp` en altas y ediciones

Reglas operativas:
- `path` representa la cadena completa de ancestros y se recalcula desde `parentId`.
- No se permite:
  - `parentId` igual al propio ID.
  - asignar como parent a un descendiente.
- No se permite eliminar un miembro con descendientes.
- `appUserId` es vinculo inverso opcional a `SystemUsers` de tipo `app`.

Notas Android:
- Para alcance jerarquico, usar `path` como fuente principal.
- Para resolver nivel efectivo del usuario App, leer `OrgMembers.levelId`.
- `assignment` puede tener los tres campos en `null`.

### SystemUsers

Estado: operativa
Origen Back Office: autenticacion Back Office + App Access
Consumida por Android: si

Campos usados hoy:
- `name: string`
- `email: string`
- `birthDate: timestamp | Date | null`
- `type: "app" | "backoffice"`
- `backofficeRole: "admin" | "supervisor" | "data_entry" | null`
- `orgMemberId: string | null`
- `active: boolean`
- `createdAt: timestamp`
- `updatedAt: timestamp`

Reglas operativas:
- Si `type = "backoffice"`:
  - `backofficeRole` obligatorio
  - `orgMemberId = null`
- Si `type = "app"`:
  - `orgMemberId` obligatorio
  - `backofficeRole = null`
- El login Back Office exige:
  - documento existente en `SystemUsers`
  - `type = "backoffice"`
  - `active = true`
  - `backofficeRole` valido
- El flujo App Access crea:
  - usuario en Firebase Auth
  - documento `SystemUsers/{uid}` con `type = "app"`
  - actualizacion de `OrgMembers.appUserId`

Notas Android:
- Android debe iniciar desde `SystemUsers/{auth.uid}`.
- Si `active = false`, bloquear acceso App.
- Si `type != "app"`, bloquear acceso App.

### AidTypes

Estado: operativa
Origen Back Office: CRUD completo
Consumida por Android: si

Campos:
- `name: string` obligatorio
- `unit: "piece" | "MXN" | "kg" | "other"` obligatorio
- `active: boolean` obligatorio
- `createdAt: timestamp` en altas nuevas
- `updatedAt: timestamp` en altas y ediciones

Reglas operativas:
- Back Office permite alta, edicion y cambio de estado.
- Android debe usar `unit` como fuente de unidad visible y validacion de capturas.

### Authorities

Estado: operativa
Origen Back Office: CRUD completo
Consumida por Android: indirectamente

Campos:
- `type: "delegate" | "sub_delegate" | "mayor" | "ejidal_commissioner"` obligatorio
- `name: string` obligatorio
- `phone: string` obligatorio
- `curp: string` obligatorio, Back Office lo normaliza a uppercase
- `birthDate: timestamp | Date` obligatorio
- `createdAt: timestamp` en altas nuevas
- `updatedAt: timestamp` en altas y ediciones

### Cities

Estado: operativa
Origen Back Office: CRUD completo
Consumida por Android: si, por asignacion territorial

Campos:
- `name: string` obligatorio
- `state: string` obligatorio
- `delegateId: string | null`
- `subDelegateId: string | null`
- `mayorId: string | null`
- `ejidalCommissionerId: string | null`
- `createdAt: timestamp` en altas nuevas
- `updatedAt: timestamp` en altas y ediciones

### Communities

Estado: operativa
Origen Back Office: CRUD completo
Consumida por Android: si, por asignacion territorial

Campos:
- `name: string` obligatorio
- `cityId: string | null`
- `delegateId: string | null`
- `subDelegateId: string | null`
- `mayorId: string | null`
- `ejidalCommissionerId: string | null`
- `createdAt: timestamp` en altas nuevas
- `updatedAt: timestamp` en altas y ediciones

### Routes

Estado: operativa
Origen Back Office: CRUD completo
Consumida por Android: si, por asignacion territorial

Campos:
- `name: string` obligatorio y unico a nivel operativo
- `description: string | null`
- `createdAt: timestamp` en altas nuevas
- `updatedAt: timestamp` en altas y ediciones

Reglas operativas:
- Back Office bloquea nombres duplicados por comparacion case-insensitive.

### PushCampaigns

Estado: operativa MVP
Origen Back Office: modulo de campañas
Consumida por Android: indirectamente via FCM payload

Campos:
- `title: string` obligatorio
- `body: string` obligatorio
- `target: "all_app_users" | "level_ids"` obligatorio
- `targetLevelIds: string[] | null`
- `status: "draft" | "scheduled" | "sent" | "partial_failed" | "failed"`
- `scheduledAt: timestamp | null`
- `sentAt: timestamp | null`
- `createdBy: string | null`
- `stats.total: number`
- `stats.sent: number`
- `stats.failed: number`
- `payload.screen: string | null`
- `payload.entityId: string | null`
- `createdAt: timestamp`
- `updatedAt: timestamp`

Reglas operativas:
- Solo `admin` puede crear o enviar.
- Si el endpoint externo no existe, la campaña puede quedar en `failed`.
- `targetLevelIds` solo aplica cuando `target = "level_ids"`.

Notas Android:
- `payload.screen` y `payload.entityId` deben tratarse como opcionales.
- Fallback seguro a home si el destino no existe.

## Colecciones operativas parciales

### SystemUsers tipo app

Estado: operativa via App Access
Observacion:
- No existe CRUD general de `SystemUsers`; el Back Office gestiona principalmente:
  - validacion de usuarios backoffice en login
  - lectura de cuentas `type = app`
  - toggle de `active`
  - creacion de cuentas App

### App access eligibility

Regla derivada actual:
- Un `OrgMember` es elegible para App Access si:
  - `active = true`
  - `appUserId = null`
  - el `OrgLevels` vinculado tiene `canUseApp = true`

## Colecciones planeadas pero no implementadas aun en Back Office

Estas colecciones existen en el plan y deben mantenerse como parte del contrato objetivo, pero no hay modulo Back Office consolidado hoy:
- `DirectDeliveryTypes`
- `DirectDeliveries`
- `IndirectDeliveries`
- `Promoted`
- `AppDevices`

Decision v1 para Android:
- Android puede implementar lectura/escritura de estas colecciones segun el plan maestro.
- Back Office no debe asumirse como fuente de validacion funcional para ellas todavia.
- Si se materializan en Android antes que en Back Office, Android debe respetar exactamente los nombres y campos definidos en `plan.md`.

## Reglas de integracion Android

### Resolucion de sesion App

1. Firebase Auth entrega `uid`.
2. Leer `SystemUsers/{uid}`.
3. Validar:
- `type = "app"`
- `active = true`
- `orgMemberId` presente
4. Leer `OrgMembers/{orgMemberId}`.
5. Leer `OrgLevels/{levelId}`.
6. Resolver capacidades desde `OrgLevels.capabilities`.

### Bloqueos obligatorios en App

Bloquear acceso si cualquiera de estas condiciones ocurre:
- no existe `SystemUsers/{uid}`
- `SystemUsers.active = false`
- `SystemUsers.type != "app"`
- falta `orgMemberId`
- no existe `OrgMembers/{orgMemberId}`
- no existe `OrgLevels/{levelId}`
- `OrgLevels.canUseApp = false`

### Campos que Android debe tolerar como null

- `OrgMembers.parentId`
- `OrgMembers.assignment.cityId`
- `OrgMembers.assignment.communityId`
- `OrgMembers.assignment.routeId`
- `OrgMembers.appUserId`
- `SystemUsers.birthDate`
- `SystemUsers.orgMemberId` solo en backoffice
- `Cities.*AuthorityId`
- `Communities.cityId`
- `Communities.*AuthorityId`
- `Routes.description`
- `PushCampaigns.targetLevelIds`
- `PushCampaigns.sentAt`
- `PushCampaigns.scheduledAt`
- `PushCampaigns.payload.screen`
- `PushCampaigns.payload.entityId`

## Cambios que rompen contrato v1

Cualquier cambio en estos puntos debe versionarse antes de que Android lo adopte:
- renombre de colecciones
- renombre de `type`, `backofficeRole`, `orgMemberId`, `levelId`, `path`, `canUseApp`, `capabilities`
- cambio de `SystemUsers` para que deje de usar UID como document ID
- cambio de `OrgMembers.path` a otra estrategia jerarquica
- cambio de enums de `AidTypes.unit`, `Authorities.type`, `PushCampaigns.target`, `PushCampaigns.status`

## Estado de cierre del contrato

Congelado para arrancar Android con estas bases:
- estable: `OrgLevels`, `OrgMembers`, `SystemUsers`, `AidTypes`, `Authorities`, `Cities`, `Communities`, `Routes`, `PushCampaigns`
- planificado: `DirectDeliveryTypes`, `DirectDeliveries`, `IndirectDeliveries`, `Promoted`, `AppDevices`

## Siguiente paso recomendado

Antes de iniciar implementacion Android:
- crear seeds controlados para `OrgLevels`
- definir un documento de fixtures QA para `SystemUsers` y `OrgMembers`
- decidir si `DirectDeliveryTypes` se sembrara manualmente desde consola o si se agregara CRUD Back Office antes de Android
