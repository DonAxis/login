# Ventanilla de consulta (consultar-boleta) — Guía paso a paso

## ¿Qué es esto?
Un pequeño programa que corre **en las computadoras de Google** (no en la tuya).
Recibe matrícula + correo de un alumno, verifica que coincidan y devuelve **solo su boleta**.
Sirve para poder cerrar la base de datos al público sin que los alumnos dejen de consultar.

- Tu computadora **no** es el servidor. Solo se usa (el navegador) para pegar el código una vez.
- **Nada de lo actual cambia** al hacer estos pasos. La página sigue funcionando igual.
- Para deshacer: borrar el servicio en Cloud Run (paso 7). No afecta nada más.

## Costo
Se cobra solo por uso, con un nivel gratuito mensual muy por encima del uso de la escuela.
Esperado: **$0** (a lo mucho centavos de dólar al mes). Además se limita a un máximo de 5 copias
simultáneas, para que nunca pueda dispararse.

---

## Paso 0 — Alerta de presupuesto (recomendado, 3 minutos)
1. Entra a https://console.cloud.google.com/billing
2. Elige la cuenta de facturación → **Presupuestos y alertas** → **Crear presupuesto**.
3. Nombre: `ILB aviso`. Proyecto: `registrosescolares9`. Monto: **5 USD**.
4. Deja las alertas en 50%, 90% y 100% → Guardar.
   (Solo envía correos; no corta el servicio.)

## Paso 1 — Ver dónde vive la base de datos ✅ (hecho)
Ubicación confirmada: **`northamerica-south1` (Querétaro, México)**.
La función se crea en esa misma región (ver paso 3).

## Paso 2 — Abrir Cloud Run
1. Entra a https://console.cloud.google.com/run
2. Arriba, asegúrate de que el proyecto seleccionado sea **registrosescolares9**.
3. Si te pide **habilitar APIs** (Cloud Run, Cloud Build, Artifact Registry), acepta. Habilitarlas es gratis.

## Paso 3 — Crear la función
1. Clic en **Escribir una función** (o "Write a function" / "Crear función").
2. Llena:
   - **Nombre del servicio:** `consultar-boleta`
   - **Región:** `northamerica-south1` (México) — la misma que la base de datos.
     Si no aparece en la lista, NO elijas otra: avísame.
   - **Entorno de ejecución (runtime):** **Node.js 24**
   - **Autenticación:** **Permitir acceso público** / "Allow unauthenticated invocations"
     (es correcto: la ventanilla debe estar abierta; lo que protege es que pide matrícula + correo
     y solo entrega la boleta de ese alumno)
3. En **Contenedor(es) / Escalamiento** (puede estar en "Configuración avanzada"):
   - **Número mínimo de instancias:** `0`
   - **Número máximo de instancias:** `5`
   - **Memoria:** `256 MiB`
4. Clic en **Crear**.

## Paso 4 — Pegar el código
1. Se abre un editor con dos archivos: `index.js` y `package.json`.
2. Borra todo el contenido de `index.js` y pega el contenido de
   `_funciones/consultar-boleta/index.js` (de esta carpeta).
3. Borra todo el contenido de `package.json` y pega el de
   `_funciones/consultar-boleta/package.json`.
4. En **Punto de entrada de la función** (Function entry point) escribe: `consultarBoleta`
5. Clic en **Guardar y volver a implementar** (Save and redeploy). Tarda 2–4 minutos.
6. Cuando termine, arriba aparece una **URL** parecida a
   `https://consultar-boleta-xxxxxxxx.northamerica-south1.run.app` (o similar). **Cópiala.**

> ✅ **Desplegada el 2026-11-23.** URL:
> `https://consultar-boleta-1094486519116.northamerica-south1.run.app`
> Punto de entrada: `consultarBoleta` (NO `helloHttp`, el de ejemplo — ese fue el error del primer intento).

## Paso 5 — Probar (no cambia nada)
1. En la carpeta del proyecto: `python -m http.server 8000`
2. Abre `http://localhost:8000/_funciones/prueba.html`
3. Pega la URL del paso 4, una matrícula y correo reales → **Probar consulta**.
4. Compara con lo que muestra hoy https://ilbcontrol.mx para ese mismo alumno. Debe ser igual.
5. Prueba también: un alumno **especial**, un correo **equivocado** (debe decir `no_encontrado`)
   y, si hay, un alumno dado de **baja** (debe decir `inactivo`).
6. Abre "Ver respuesta completa" y confirma que **no** aparecen tutor ni teléfono.

## Paso 6 — Avisar
Mándame la URL y el resultado de las pruebas. Con eso preparo el siguiente cambio
(que la página del alumno use la ventanilla), que también se puede deshacer con un push.

## Paso 7 — Cómo deshacer (si algún día hace falta)
Cloud Run → `consultar-boleta` → **Borrar**. La página actual no depende de esto todavía.

---

## Notas técnicas (para referencia)
- La función usa la cuenta de servicio por defecto del proyecto para leer Firestore
  (no aplica las reglas de seguridad; por eso es ella quien decide qué devolver).
- Lecturas por consulta: las mismas que hoy (alumno, carrera, materias del grupo, una por calificación,
  horario), pero en una sola petición desde el celular en lugar de ~10.
- La carpeta `_funciones` empieza con guion bajo: GitHub Pages (Jekyll) no la publica.
  Verificar tras el push: https://ilbcontrol.mx/_funciones/PASOS.md debe dar error 404.
