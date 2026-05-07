# Delivery Aid Back Office

Panel Back Office para administracion de catalogos, organigrama, accesos y campanas.

## Requisitos

- Node.js 20+
- npm 10+

## Configuracion local

1. Instala dependencias:

```bash
npm install
```

2. Configura variables de entorno:

```bash
cp .env.example .env
cp .env.e2e.example .env.e2e
```

## Comandos

Ejecuta siempre desde esta carpeta (`Delivery-Aid-BackOffice`).

```bash
npm run dev
```

```bash
npm run test:e2e
```

```bash
npm run test:e2e:headed
```

## Notas

- Desarrollo y pruebas E2E usan `127.0.0.1:3000` para mantener el mismo origen.
- Si hay un servidor anterior abierto, detenlo antes de volver a correr E2E.
