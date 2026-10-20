# Manual de Usuario — Back Office "Cuenta Conmigo"

Esta guía explica cómo usar el panel administrativo del programa Cuenta Conmigo. Está pensada
para quien usa el sistema día a día — no requiere conocimientos técnicos.

> Si buscas documentación técnica (para desarrolladores), consulta `README.md` o `plan.md` en
> este mismo repositorio.

---

## Índice

0. [Introducción](#0-introducción)
1. [Conceptos clave](#1-conceptos-clave)
2. [Captura](#2-captura)
3. [Catálogos](#3-catálogos)
4. [Reportes](#4-reportes)
5. [Acceso App](#5-acceso-app)
6. [Campañas Push](#6-campañas-push)
7. [Administración](#7-administración)
8. [Preguntas frecuentes](#8-preguntas-frecuentes)

---

## 0. Introducción

### ¿Qué es el Back Office?

Es el panel desde donde se administra todo el programa: catálogos, organigrama, cuentas de
acceso a la App móvil, registro de entregas y reportes de avance.

### Cómo iniciar sesión

1. Entra a la dirección del Back Office que te compartió tu administrador.
2. Ingresa tu correo y contraseña.
3. Si es tu primera vez y no tienes cuenta, pide a un **Administrador** que te la cree desde
   **Administración → Usuarios Back Office** (ver [sección 7.2](#72-usuarios-back-office)).

### ¿Qué verás al entrar?

Depende de tu rol:

| Rol | Pantalla al iniciar sesión |
|---|---|
| Administrador | Reportes → Panel de Control |
| Supervisor | Reportes → Panel de Control |
| Capturista | Captura → Promovidos |

El menú lateral solo muestra las secciones a las que tu rol tiene acceso — si no ves una
sección mencionada en este manual, tu rol no la necesita.

---

## 1. Conceptos clave

Antes de usar el sistema, conviene entender dos cosas: la cadena organizacional y los tipos
de entrega.

### La cadena organizacional

El programa funciona en niveles, de arriba hacia abajo:

```
Coordinador General
      │
  Distrital
      │
 Coordinador
      │
  Seccional
      │
  Activista
      │
  Promovido
```

- **Coordinador General** y **Distrital** son niveles de supervisión — no entregan apoyos
  directamente, solo coordinan.
- **Coordinador** entrega apoyos a sus **Seccionales**.
- **Seccional** entrega apoyos a sus **Activistas**.
- **Activista** entrega apoyos directamente a sus **Promovidos** (los beneficiarios finales),
  y es quien da de alta a cada Promovido en el sistema.
- **Promovido** es la persona que recibe el apoyo — el beneficiario.

Cada persona en el organigrama solo puede entregar al nivel que le sigue inmediatamente abajo
de ella. Por eso, si eliges a alguien de nivel Coordinador General como "quien entrega", el
sistema te va a avisar que no tiene nada configurado — es un nivel que solo supervisa.

### Entrega Interna vs. Entrega Externa

- **Entrega Interna**: ocurre dentro de la cadena organizacional de arriba (Coordinador →
  Seccional → Activista → Promovido). Queda ligada a personas y promovidos ya registrados en
  el sistema.
- **Entrega Externa**: un apoyo que se le da a alguien que **no** está registrado como
  Promovido — se captura con su nombre y CURP directamente, sin pasarlo por el organigrama.

### Los 3 roles

| Rol | Para qué es | Qué puede hacer |
|---|---|---|
| **Administrador** | Dueño del sistema | Todo: captura, catálogos, reportes, cuentas, roles |
| **Supervisor** | Dar seguimiento al avance | Solo ver Reportes |
| **Capturista** | Trabajo de campo diario | Captura (entregas, promovidos) y Catálogos |

---

## 2. Captura

### 2.1 Registrar una Entrega Interna

**Ruta:** Captura → Entrega Interna

1. En **Entrega**, elige quién está distribuyendo el apoyo (cualquier miembro del
   organigrama).
2. Si esa persona tiene más de un tipo de entrega posible según su nivel, aparecerá el campo
   **Tipo de entrega** — elige el que corresponda. Si solo hay un tipo posible, se aplica solo
   y no verás este campo.
   - Si en vez de eso aparece el aviso **"Este miembro no tiene tipos de entrega configurados
     para su nivel"**, significa que elegiste a alguien de nivel Coordinador General o
     Distrital — esos niveles no entregan directamente. Elige a otra persona.
3. En **Recibe**, elige al destinatario:
   - Si el tipo de entrega es "Activista a Promovido", busca al promovido por nombre o CURP.
     Solo aparecerán los promovidos que pertenecen a la persona que elegiste en "Entrega".
   - Para cualquier otro tipo, elige entre los subordinados directos de esa persona.
4. Elige el **Tipo de apoyo** y la **Cantidad**.
5. El comentario es opcional.
6. La foto de evidencia es opcional — puedes subir cualquier formato de imagen (PNG, HEIC,
   JPEG), el sistema la convierte automáticamente.
7. Pulsa **Registrar entrega**.

> **Si no encuentras a un promovido esperado:** revisa que el "Activista" que se le asignó al
> crear ese promovido (en [Captura → Promovidos](#23-dar-de-alta-y-editar-promovidos)) sea
> exactamente la misma persona que elegiste en "Entrega". Si fue asignado a alguien más, edita
> el promovido para corregirlo.

### 2.2 Registrar una Entrega Externa

**Ruta:** Captura → Entrega Externa

1. Elige el **Miembro organizacional** que está registrando la entrega.
2. Elige el **Tipo de apoyo** y la **Cantidad**.
3. Captura el **Nombre** y **CURP** del beneficiario (no necesita estar registrado como
   Promovido).
4. Comentario y foto de evidencia son opcionales (mismo manejo de formato que en Entrega
   Interna).
5. Pulsa **Registrar entrega**.

### 2.3 Dar de alta y editar Promovidos

**Ruta:** Captura → Promovidos

**Antes de crear uno nuevo**, usa el buscador del listado (por nombre o CURP) para confirmar
que no esté ya registrado.

**Para crear un promovido:**

1. Llena nombre completo, teléfono, fecha de nacimiento y CURP.
2. Elige el **Activista** al que pertenece — importante: esta es la persona que después podrá
   "entregarle" apoyos a este promovido desde Entrega Interna.
3. Elige la **Comunidad**.
4. Opcionalmente, sube fotos de la credencial de elector (frente y reverso).
5. Pulsa **Registrar promovido**.

**Para corregir un promovido ya existente** (por ejemplo, si quedó asignado al activista
equivocado): en el listado, pulsa **Editar** en su fila. Se precarga el formulario — corrige
lo que haga falta y pulsa **Guardar cambios**. Si no subes una foto nueva de credencial, se
conserva la que ya tenía. Pulsa **Cancelar** para salir sin guardar.

---

## 3. Catálogos

### 3.1 Miembros Organizacionales

**Ruta:** Catálogos → Miembros Organizacionales

Aquí se administra el organigrama completo (todos los niveles, de Coordinador General a
Activista).

- **Crear:** nombre, teléfono, CURP, fecha de nacimiento, nivel, superior directo, asignación
  territorial (ciudad/comunidad/ruta), y opcionalmente el ID de su cuenta de App si ya tiene
  una vinculada.
- **Editar:** mismo formulario. Si cambias el **superior directo** de alguien, el sistema
  actualiza automáticamente la posición de todo su equipo debajo de él en el organigrama — no
  hace falta corregir a cada subordinado uno por uno.
- **Eliminar:** solo es posible si la persona no tiene subordinados. Si los tiene, primero hay
  que reasignarlos a alguien más.

### 3.2 Otros catálogos

Las siguientes pantallas son catálogos simples (crear, editar, activar/desactivar):

| Catálogo | Ruta | Para qué sirve |
|---|---|---|
| Comunidades | Catálogos → Comunidades | Localidades donde opera el programa |
| Ciudades | Catálogos → Ciudades | Municipios |
| Rutas | Catálogos → Rutas | Rutas operativas de distribución |
| Tipos de Apoyo | Catálogos → Tipos de Apoyo | Qué se puede entregar (despensa, cobija, etc.) y su unidad |
| Autoridades | Catálogos → Autoridades | Delegados, subdelegados y otras autoridades municipales |

---

## 4. Reportes

**Acceso:** Administrador y Supervisor.

| Reporte | Ruta | Qué muestra |
|---|---|---|
| Panel de Control | Reportes → Panel de Control | Gráficas generales: entregas, promovidos, campañas |
| Entregas | Reportes → Entregas | Listado filtrable por fecha de todas las entregas (internas y externas) |
| Actividad por Activista | Reportes → Actividad por Activista | Qué ha registrado cada activista, filtrable por nivel |
| Promovidos | Reportes → Promovidos | Listado completo de beneficiarios, filtrable por activista/nivel/comunidad |
| Credenciales | Reportes → Credenciales | Estado de credenciales de elector capturadas |
| Cobertura por Comunidad | Reportes → Comunidades | Entregas y activistas por comunidad |
| Autoridades por Comunidad | Reportes → Autoridades | Directorio de autoridades por comunidad |
| Rama Jerárquica | Reportes → Rama | Avance agrupado por rama del organigrama |

Todos estos reportes permiten filtrar por rango de fechas y, en la mayoría, exportar o
revisar el detalle de cada registro.

---

## 5. Acceso App

**Ruta:** Operación → Acceso App — **solo Administrador**

Aquí se gestionan las cuentas de quienes usan la App móvil (Seccionales, Activistas, etc.).

### Crear una cuenta individual

1. Captura el **teléfono** (10 dígitos — será su usuario para iniciar sesión en la App).
2. Elige el **nivel organizacional** y, si aplica, su **superior directo** y asignación
   territorial.
3. Al crear la cuenta, el sistema genera una **contraseña temporal** (los últimos 6 dígitos
   del teléfono) — compártesela a la persona junto con su número. La App le pedirá cambiarla
   en su primer inicio de sesión.

### Importar varios usuarios por CSV

Para dar de alta muchas cuentas a la vez, sube un archivo CSV con las columnas:
`phone, levelId, parentId, cityId, communityId, routeId` (máximo 500 filas por archivo). El
sistema te muestra un resumen de cuántas se crearon y cuáles fallaron, con el motivo.

### Restablecer contraseña

Genera una nueva contraseña temporal aleatoria para una cuenta existente — útil si alguien
olvidó la suya. Compártesela a la persona; se le pedirá cambiarla al iniciar sesión.

### Activar / desactivar una cuenta

Bloquea o desbloquea el acceso de alguien sin borrar su información ni su historial.

---

## 6. Campañas Push

**Ruta:** Operación → Campañas Push — **solo Administrador**

Permite enviar notificaciones a los celulares de los usuarios de la App.

1. Captura **título** y **mensaje**.
2. Elige el destino: a **todos** los dispositivos activos, o solo a quienes pertenezcan a
   ciertos **niveles organizacionales**.
3. Envía la campaña y confirma.
4. El historial de campañas muestra cuántos dispositivos recibieron el mensaje exitosamente y
   cuántos fallaron.

---

## 7. Administración

**Acceso:** solo Administrador.

### 7.1 Roles y Permisos

**Ruta:** Administración → Roles y Permisos

Aquí se crean los roles que se pueden asignar a cuentas del Back Office (por ejemplo,
"Capturista" o "Supervisor"). El rol **Administrador** es fijo y no se puede editar ni crear
desde aquí.

Para crear un rol: ponle un nombre y marca qué puede hacer (Captura, Reportes, Catálogos).

> **Importante:** si al crear un usuario Back Office el campo "Rol" aparece vacío, significa
> que todavía no se ha creado ningún rol aquí — crea primero el rol antes de poder asignarlo.

### 7.2 Usuarios Back Office

**Ruta:** Administración → Usuarios Back Office

Aquí se crean las cuentas con acceso a este panel (no a la App móvil — para eso es
[Acceso App](#5-acceso-app)).

1. Captura correo, contraseña, nombre.
2. Elige un **rol** ya creado (ver sección anterior).
3. Comparte el correo y la contraseña con la persona.

Para editar: cambia nombre, rol o estado activo/inactivo de una cuenta existente.

### 7.3 Niveles Organizacionales

**Ruta:** Administración → Niveles Organizacionales

Define los niveles de la jerarquía (Coordinador General, Distrital, Coordinador, Seccional,
Activista, etc.), su rango, si pueden usar la App, y qué pueden hacer dentro de ella
(registrar entregas, dar de alta promovidos, ver notificaciones, etc.).

### 7.4 Tipos de Entrega Directa

**Ruta:** Administración → Tipos de Entrega

Define la cadena de quién puede entregarle a quién (por ejemplo, "Coordinador a Seccional").
Esto es lo que determina qué opciones aparecen en [Entrega Interna](#21-registrar-una-entrega-interna)
según el nivel de quien entrega.

---

## 8. Preguntas frecuentes

**Me sale "Missing or insufficient permissions" (permisos insuficientes).**
Tu rol no tiene acceso a esa acción. Si crees que deberías tenerlo, contacta a un
Administrador.

**Al crear un usuario Back Office, el campo "Rol" está vacío.**
Nadie ha creado todavía ningún rol. Un Administrador debe crear al menos uno en
[Administración → Roles y Permisos](#71-roles-y-permisos) antes de poder asignarlo.

**Subí una foto y parece que no se guardó.**
Revisa tu conexión a internet e intenta de nuevo. El sistema acepta cualquier formato de
imagen y la convierte automáticamente — si el archivo está dañado o no es una imagen válida,
verás un mensaje de error específico en rojo debajo del formulario.

**No encuentro a un promovido al registrar una Entrega Interna.**
Revisa que el "Activista" asignado a ese promovido (en Captura → Promovidos) sea exactamente
la misma persona que elegiste como "Entrega". Puedes corregirlo editando el promovido.

**Olvidé mi contraseña.**
- Si usas el **Back Office**: pide a un Administrador que edite tu usuario en
  [Administración → Usuarios Back Office](#72-usuarios-back-office).
- Si usas la **App móvil**: pide a un Administrador que te restablezca la contraseña desde
  [Acceso App](#5-acceso-app).

**No veo una sección que se menciona en este manual.**
Tu rol no tiene acceso a ella — revisa la tabla de la [sección 1](#los-3-roles) para confirmar
qué le corresponde a tu rol.
