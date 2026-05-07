# Android Offline Sync Rules v1

Fecha: 2026-04-30
Estado: especificacion operativa inicial

## Objetivo

Definir reglas de sincronizacion offline-first para Android usando Firestore como base.

## Entidades con prioridad de cache

- `SystemUsers`
- `OrgMembers`
- `OrgLevels`
- `AidTypes`
- `DirectDeliveryTypes`
- `Cities`
- `Communities`
- `Routes`

## Estrategia de lectura

- Priorizar cache local de Firestore.
- Actualizar en segundo plano cuando haya red.
- Mostrar indicadores de stale data solo en modulos criticos.

## Estrategia de escritura

- Permitir guardado offline para entregas.
- Usar `idempotencyKey` como ID de documento para evitar duplicados al reconectar.
- Mantener `localDate` y `audit.offline=true` en registros creados sin red.

## Resolucion de conflictos

Regla general:
- Last-write-wins por `updatedAt`/`serverTimestamp`.

Regla de trazabilidad:
- Mantener campos `audit` para origen, dispositivo y modo offline.

## Reintentos

- Reintento automatico con backoff exponencial para subidas de evidencia.
- No bloquear UI durante reintentos.
- Registrar estado local del item: pendiente, sincronizando, error, sincronizado.

## Integridad minima por modulo

### Login y perfil

- Si no hay `SystemUsers/{uid}` valido, bloquear sesion aunque exista autenticacion local.
- Si `active=false`, forzar cierre de sesion en App.

### Entregas directas

- Guardar localmente aun sin red.
- Sincronizar cuando regrese conectividad.
- Evitar duplicados usando `idempotencyKey`.

### Evidencias

- Cola separada para carga de archivos.
- Si falla upload, conservar entrega y marcar evidencia pendiente.

## Reglas de UX

- Mostrar etiqueta visible de estado offline.
- Mostrar contador de pendientes por sincronizar.
- Permitir reintento manual por registro en estado error.

## Criterios de aceptacion

- [ ] Registro de entrega funciona sin red.
- [ ] No hay duplicados al reconectar.
- [ ] Evidencias pendientes se suben automaticamente.
- [ ] Estados de sincronizacion son visibles y consistentes.
