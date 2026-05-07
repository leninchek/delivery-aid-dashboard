# Android Capabilities Matrix v1

Fecha: 2026-04-30
Fuente: `OrgLevels.capabilities` + contrato Firestore v1

## Objetivo

Mapear capacidades a modulos y acciones de Android para enforcement en UI.

## Principios

- La autorizacion App es dinamica por `OrgLevels.capabilities`.
- `canUseApp = true` es requisito previo de acceso.
- Si una capability no existe, la accion se oculta o bloquea.

## Matriz capability -> accion

### can_create_direct_delivery

Habilita:
- Acceso al modulo de entregas directas.
- Creacion de registro en `DirectDeliveries`.

Bloquea si falta:
- Boton de nueva entrega directa.
- Guardado de formulario directo.

### can_register_promoted

Habilita:
- Alta de `Promoted` desde App.

Bloquea si falta:
- Boton de registrar promovido.
- Navegacion a formulario de alta de promovido.

### can_create_indirect_delivery

Habilita:
- Acceso al modulo de entregas indirectas.
- Creacion de registro en `IndirectDeliveries`.

Bloquea si falta:
- Boton de nueva entrega indirecta.

### can_view_branch_structure

Habilita:
- Vista de estructura de rama (jerarquia por `path`).

Bloquea si falta:
- Pantalla de estructura o arbol jerarquico.

### can_view_own_deliveries

Habilita:
- Vista de historial propio de entregas.

Bloquea si falta:
- Pantalla de historial personal.

## Matriz por nivel inicial recomendado

### Coordinador

- can_create_direct_delivery
- can_create_indirect_delivery
- can_view_branch_structure
- can_view_own_deliveries

### Seccional

- can_create_direct_delivery
- can_create_indirect_delivery
- can_view_branch_structure
- can_view_own_deliveries

### Activista

- can_create_direct_delivery
- can_register_promoted
- can_create_indirect_delivery
- can_view_own_deliveries

## Fallbacks de seguridad

- Capability desconocida: ignorar.
- Coleccion `OrgLevels` no disponible: bloquear acciones operativas y mostrar estado de error.
- `canUseApp = false`: forzar salida de sesion App.

## Checklist QA

- [ ] Usuario con capability ve el modulo correspondiente.
- [ ] Usuario sin capability no ve ni ejecuta la accion.
- [ ] Cambiar capabilities en `OrgLevels` impacta la App sin redeploy.
