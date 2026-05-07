# DirectDeliveryTypes Seed v1

Fecha: 2026-04-30
Estado: base inicial para Android MVP

## Objetivo

Proveer valores iniciales de `DirectDeliveryTypes` para habilitar flujos directos en Android.

## Coleccion

`DirectDeliveryTypes`

## Registros semilla

### 1) coordinator_to_sectional

```json
{
  "code": "coordinator_to_sectional",
  "label": "Coordinador a Seccional",
  "fromLevelIds": ["<LEVEL_ID_COORDINADOR>"],
  "toLevelIds": ["<LEVEL_ID_SECCIONAL>"],
  "requiredCapability": "can_create_direct_delivery",
  "active": true,
  "sortOrder": 1,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

### 2) sectional_to_activist

```json
{
  "code": "sectional_to_activist",
  "label": "Seccional a Activista",
  "fromLevelIds": ["<LEVEL_ID_SECCIONAL>"],
  "toLevelIds": ["<LEVEL_ID_ACTIVISTA>"],
  "requiredCapability": "can_create_direct_delivery",
  "active": true,
  "sortOrder": 2,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

### 3) activist_to_promoted

```json
{
  "code": "activist_to_promoted",
  "label": "Activista a Promovido",
  "fromLevelIds": ["<LEVEL_ID_ACTIVISTA>"],
  "toLevelIds": [],
  "requiredCapability": "can_create_direct_delivery",
  "active": true,
  "sortOrder": 3,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

## Fuente de IDs

Los placeholders `<LEVEL_ID_...>` se obtienen de la coleccion `OrgLevels`.

Mapeo esperado:
- `LEVEL_ID_COORDINADOR` -> nivel Coordinador
- `LEVEL_ID_SECCIONAL` -> nivel Seccional
- `LEVEL_ID_ACTIVISTA` -> nivel Activista

## Reglas Android asociadas

- Mostrar solo registros con `active = true`.
- Filtrar por `fromLevelIds` segun nivel del usuario autenticado.
- Validar capability requerida (`requiredCapability`) contra `OrgLevels.capabilities`.
- Ordenar por `sortOrder` ascendente.

## Estrategia recomendada de seed

Decision operativa para v1:
- Resolver el seed con un script idempotente de administracion y no esperar al CRUD del Back Office.
- Mantener el CRUD de `DirectDeliveryTypes` como trabajo posterior de Fase 2.

Motivo:
- Android ya depende de esta coleccion para habilitar flujos reales.
- El Back Office actual usa SDK cliente y hoy no expone una via administrativa segura para sembrar catalogos base.
- El catalogo inicial es pequeno, estable y conocido; no justifica bloquear Android por una UI de administracion completa.

Implementacion propuesta:
1. Crear un script de seed fuera de la UI web usando credenciales administrativas.
2. Leer `OrgLevels` activos y resolver por nombre los IDs de Coordinador, Seccional y Activista.
3. Ejecutar `set` por `code` en `DirectDeliveryTypes` para que el proceso sea idempotente.
4. Registrar `createdAt` en altas nuevas y `updatedAt` en cada ejecucion.
5. Reutilizar el mismo mecanismo para otros catalogos base pequenos si hace falta.

Reglas del script:
- No insertar duplicados: usar `code` como clave natural de negocio.
- Fallar si no existen los niveles requeridos en `OrgLevels`.
- Fallar si hay mas de un `OrgLevels` con el mismo nombre esperado.
- Imprimir resumen final con `created`, `updated` y `skipped`.

Secuencia sugerida:
1. Sembrar primero `OrgLevels`.
2. Ejecutar seed de `DirectDeliveryTypes`.
3. Validar en Firestore que existan los 3 registros y que `fromLevelIds` apunten a IDs reales.
4. Dejar CRUD Back Office para una iteracion posterior, ya con Android desbloqueado.

No recomendado para v1:
- Captura manual desde consola de Firebase en cada ambiente.
- Esperar a construir el CRUD de `DirectDeliveryTypes` antes de liberar la App Android.

## Ejecucion del seed

Comando de validacion sin escribir cambios:

```bash
npm run seed:direct-delivery-types:dry
```

Comando real:

```bash
npm run seed:direct-delivery-types
```

Precondiciones:
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` debe apuntar al proyecto correcto.
- Debe existir autenticacion administrativa por una de estas vias:
  - `GOOGLE_APPLICATION_CREDENTIALS` con ruta a un JSON de service account.
  - `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`.
  - `FIREBASE_SERVICE_ACCOUNT_JSON` con el JSON completo serializado.
- `OrgLevels` debe contener un unico registro activo para `Coordinador`, `Seccional` y `Activista`.

Comportamiento del script:
- Resuelve IDs reales desde `OrgLevels` por nombre.
- Busca documentos existentes por `code`.
- Si no existe, crea el documento.
- Si existe uno, lo actualiza en sitio.
- Si encuentra duplicados por `code`, falla para evitar inconsistencia.

## Criterios de aceptacion

- [ ] Existen los 3 registros en `DirectDeliveryTypes`.
- [ ] `code` es unico en cada registro.
- [ ] Android puede leer y mostrar tipos disponibles para cada nivel.
