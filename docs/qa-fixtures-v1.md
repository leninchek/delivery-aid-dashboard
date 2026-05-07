# QA Fixtures v1

Fecha: 2026-04-30
Ambito: Back Office + Android MVP

## Objetivo

Definir datos de prueba estables para desarrollo, E2E y QA manual.

## Reglas de uso

- No usar cuentas productivas.
- Mantener estos fixtures en todos los ambientes de prueba.
- Si un fixture cambia, actualizar este documento y los `.env` asociados.

## Fixtures Back Office

### Usuario admin activo

- Email: `lche@xcaret.com`
- Coleccion: `SystemUsers`
- Reglas esperadas:
  - `type = "backoffice"`
  - `backofficeRole = "admin"`
  - `active = true`

Uso:
- Login positivo Back Office.
- Flujo admin de navegacion y modulos protegidos.

### Usuario backoffice inactivo

- Email: `prueba@prueba.com`
- Coleccion: `SystemUsers`
- Reglas esperadas:
  - `type = "backoffice"`
  - `backofficeRole` valido
  - `active = false`

Uso:
- Prueba negativa de login por cuenta inactiva.

## Fixtures de niveles y organigrama

### Nivel no elegible App

- Coleccion: `OrgLevels`
- Nombre sugerido: `Nivel Sin App`
- Reglas esperadas:
  - `canUseApp = false`
  - `capabilities = []`
  - `active = true`

### Miembro no elegible App Access

- Coleccion: `OrgMembers`
- Nombre: `Prueba Miembro`
- Reglas esperadas:
  - `active = true`
  - `appUserId = null`
  - `levelId` apunta a `Nivel Sin App` (`canUseApp = false`)

Uso:
- Validar que no aparezca en selector de elegibles de App Access.

## Variables E2E asociadas

Archivo: `.env.e2e`

- `E2E_ADMIN_EMAIL=lche@xcaret.com`
- `E2E_ADMIN_PASSWORD=<secreto>`
- `E2E_INACTIVE_EMAIL=prueba@prueba.com`
- `E2E_INACTIVE_PASSWORD=<secreto>`
- `E2E_INELIGIBLE_MEMBER_NAME=Prueba Miembro`

## Checklist de verificacion rapida

- [ ] Admin activo inicia sesion en Back Office.
- [ ] Usuario inactivo recibe mensaje "La cuenta de Back Office esta inactiva.".
- [ ] `Prueba Miembro` no aparece en App Access.
- [ ] Suite E2E completa pasa sin skipped.
