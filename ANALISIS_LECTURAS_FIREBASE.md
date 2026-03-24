# Análisis de Lecturas Excesivas en Firebase Firestore
**Proyecto:** SICE - Sistema de Control Escolar ILB
**Fecha:** 2026-03-24
**Contexto:** 600 usuarios, superando 50,000 lecturas/día

---

## Resumen Ejecutivo

El problema no es el número de usuarios sino los **patrones de lectura ineficientes**. Cada vez que un usuario abre cualquier página del sistema se hacen múltiples lecturas completas a colecciones enteras, sin ningún tipo de caché. A continuación se identifican los principales culpables ordenados por impacto.

---

## Colecciones y su costo base

| Colección | Documentos estimados | Lecturas por query completo |
|---|---|---|
| `usuarios` | ~600 | **600 lecturas** |
| `calificaciones` | ~600 alumnos × ~8 materias = ~4,800 | **4,800 lecturas** |
| `profesorMaterias` | ~50–100 asignaciones | ~50–100 |
| `carreras` | ~5–10 | ~10 |
| `materias` | ~50–100 | ~100 |
| `grupos` | ~20–40 | ~40 |
| `config` | ~10 | ~10 |

> **Nota:** Cada documento leído = 1 lectura en Firebase, independientemente de cuántos campos tenga.

---

## Problema 1 — `cargarAlumnos()` lee TODOS los alumnos en múltiples módulos

**Severidad: CRÍTICA** — Este es probablemente el mayor culpable.

### Dónde ocurre

| Archivo | Código |
|---|---|
| `sice/js/escolar/controlEscolar.js` | `db.collection('usuarios').where('rol', '==', 'alumno').get()` |
| `sice/js/prefecto/controlPrefecto.js` | `db.collection('usuarios').where('rol', '==', 'alumno').get()` |
| `sice/js/caja/controlCaja.js` | `db.collection('usuarios').where('rol', '==', 'alumno').orderBy('nombre').get()` |
| `sice/js/admin/gestionUsuarios.js` | `db.collection('usuarios').orderBy('nombre').get()` |
| `sice/js/admin/reportes.js` | `db.collection('usuarios').get()` |

### Costo actual
- Cada vez que cualquiera de estos 5 módulos carga = **~500 lecturas** (solo de `usuarios`)
- Si 10 usuarios abren sus paneles en el día = **5,000 lecturas** solo en este punto

### Solución
```javascript
// ANTES: Lee todos los alumnos cada vez que se abre la página
async function cargarAlumnos() {
  const snapshot = await db.collection('usuarios')
    .where('rol', '==', 'alumno')
    .get(); // 500 lecturas
}

// DESPUÉS: Cachear en sessionStorage por sesión
async function cargarAlumnos() {
  const cacheKey = 'cache_alumnos';
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    alumnosData = JSON.parse(cached);
    renderizarAlumnos();
    return;
  }

  const snapshot = await db.collection('usuarios')
    .where('rol', '==', 'alumno')
    .get();

  alumnosData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  sessionStorage.setItem(cacheKey, JSON.stringify(alumnosData));
  renderizarAlumnos();
}
```

> **Ahorro estimado:** 60–80% de lecturas en módulos de gestión por sesión de usuario.

---

## Problema 2 — `onAuthStateChanged` lanza una lectura por CADA página

**Severidad: ALTA** — Ocurre en absolutamente todos los módulos.

### Dónde ocurre (TODOS los archivos JS)

```javascript
// Patrón repetido en ~15 archivos diferentes
firebase.auth().onAuthStateChanged(async (user) => {
  const userDoc = await db.collection('usuarios').doc(user.uid).get(); // 1 lectura
  const userData = userDoc.data();
  // ...
});
```

### Costo actual
- Cada cambio de página = 1 lectura a `usuarios`
- Un usuario que navega 10 páginas en su sesión = **10 lecturas** solo para verificar su sesión
- 100 usuarios navegando = **1,000 lecturas/día** solo en este punto

### Solución
```javascript
// En login.js, al hacer login exitoso, guardar el usuario en sessionStorage
async function manejarLogin(user) {
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  const userData = userDoc.data();

  // Guardar en sessionStorage para no volver a leer en otras páginas
  sessionStorage.setItem('usuarioActual', JSON.stringify({
    uid: user.uid,
    ...userData
  }));

  redirigirSegunRol(userData.rol);
}

// En TODAS las demás páginas, leer de sessionStorage primero
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = '/sice/';
    return;
  }

  const cached = sessionStorage.getItem('usuarioActual');
  if (cached) {
    usuarioActual = JSON.parse(cached);
    inicializarPagina(); // sin leer Firestore
    return;
  }

  // Solo leer de Firestore si no hay caché (primera vez o sesión expirada)
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  usuarioActual = { uid: user.uid, ...userDoc.data() };
  sessionStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
  inicializarPagina();
});
```

> **Ahorro estimado:** Eliminar ~90% de las lecturas de `usuarios` por sesión.

---

## Problema 3 — `index.html` (consulta pública de calificaciones) hace N+1 lecturas

**Severidad: ALTA** — Es la página más visitada y hace múltiples lecturas en cascada.

### Flujo actual de lecturas por consulta de alumno

```
1. db.collection('usuarios').where('matricula', ...).where('email', ...) → ~500 lecturas
2. db.collection('carreras').doc(carreraId).get()                        → 1 lectura
3. db.collection('profesorMaterias').where('codigoGrupo', ...).get()     → N lecturas (todas las materias del grupo)
4. db.collection('calificaciones').doc(id_materia1).get()                → 1 lectura por materia
5. db.collection('calificaciones').doc(id_materia2).get()                → 1 lectura
   ... (8 materias = 8 lecturas individuales)
```

**Total por consulta de un alumno: ~500 + 1 + N + 8 = ~515+ lecturas**

### El problema principal: query sin índice eficiente
La búsqueda por `matricula` + `email` requiere escanear TODA la colección `usuarios` (500 docs) para encontrar 1.

### Solución
```javascript
// OPCIÓN A: Buscar solo por matricula (más selectivo) y validar email en cliente
const snapshot = await db.collection('usuarios')
  .where('rol', '==', 'alumno')
  .where('matricula', '==', matricula)
  .limit(1)
  .get(); // Sigue leyendo toda la colección pero retorna 1

// El problema real es que Firestore no tiene índice en matricula sin uid.
// La solución real es guardar una colección auxiliar:

// COLECCIÓN AUXILIAR: matriculas/{matricula} = { uid: '...', email: '...' }
// Esto permite buscar con 1 sola lectura en vez de 500

async function buscarAlumnoPorMatricula(matricula, email) {
  // 1 lectura exacta por ID de documento
  const matriculaDoc = await db.collection('matriculas').doc(matricula).get();

  if (!matriculaDoc.exists) return null;

  const { uid, emailRegistrado } = matriculaDoc.data();

  if (emailRegistrado !== email) return null; // Validar en cliente

  // 1 lectura exacta por UID
  const alumnoDoc = await db.collection('usuarios').doc(uid).get();
  return { id: uid, ...alumnoDoc.data() };
}
// Total: 2 lecturas en vez de 500+
```

> **Ahorro estimado:** De ~515 lecturas a ~12 por consulta de alumno.

---

## Problema 4 — Admin reportes hace scan completo de 3 colecciones

**Severidad: ALTA** — Una sola visita al panel de reportes cuesta miles de lecturas.

### Código actual en `sice/js/admin/reportes.js`

```javascript
async function cargarReporte() {
  var snapCarreras = await db.collection('carreras').get();   // ~10 lecturas
  var snap = await db.collection('materias').get();           // ~100 lecturas
  var snapU = await db.collection('usuarios').get();          // ~600 lecturas
  // Total: ~710 lecturas por visita al panel de reportes
}
```

### Solución: Documento de estadísticas pre-calculado
```javascript
// Crear una función Cloud Function o actualizar este documento al hacer cambios
// config/estadisticas → { totalAlumnos: 480, totalProfesores: 50, totalMaterias: 100, ... }

async function cargarReporte() {
  // 1 sola lectura en vez de 710
  const statsDoc = await db.collection('config').doc('estadisticas').get();
  const stats = statsDoc.data();

  mostrarEstadisticas(stats);
}

// Actualizar estadisticas al registrar/eliminar usuarios (ya que escribes igualmente)
async function registrarNuevoAlumno(data) {
  const batch = db.batch();
  batch.set(db.collection('usuarios').doc(), data);
  batch.update(db.collection('config').doc('estadisticas'), {
    totalAlumnos: firebase.firestore.FieldValue.increment(1)
  });
  await batch.commit();
}
```

> **Ahorro estimado:** De ~710 a 1 lectura por visita al panel de admin.

---

## Problema 5 — `cargarCarreras()` se llama en ~15 archivos diferentes sin caché

**Severidad: MEDIA**

### Dónde ocurre

- `controlEscolar.js`, `controlAdmin.js`, `gestionUsuarios.js`, `reportes.js`, `controlCaja.js`, `controlProfesor.js`, `coordinaModules.js`, `boletaPDF.js`, y más...

```javascript
// Este patrón se repite en cada módulo independientemente
async function cargarCarreras() {
  const snapshot = await db.collection('carreras').get(); // ~10 lecturas cada vez
}
```

### Solución: Caché compartido en sessionStorage
```javascript
// utils/cache.js — un archivo centralizado de caché
const Cache = {
  async getCarreras() {
    const key = 'cache_carreras';
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);

    const snap = await db.collection('carreras').get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    sessionStorage.setItem(key, JSON.stringify(data));
    return data;
  },

  async getConfig(docId) {
    const key = `cache_config_${docId}`;
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);

    const doc = await db.collection('config').doc(docId).get();
    const data = doc.data();
    sessionStorage.setItem(key, JSON.stringify(data));
    return data;
  },

  invalidar(key) {
    sessionStorage.removeItem(key);
  }
};

// Uso en cualquier módulo — solo lee Firestore la primera vez en la sesión
const carreras = await Cache.getCarreras();
```

> **Ahorro estimado:** 80% de las lecturas de `carreras` y `config` eliminadas por sesión.

---

## Problema 6 — Generación de PDF lee múltiples colecciones de forma redundante

**Severidad: MEDIA**

### Flujo en `sice/js/utils/boletaPDF.js`

```javascript
// Por cada boleta generada:
const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
  .where('alumnoId', '==', alumnoId).get();       // N lecturas

const materiasSnap = await db.collection('profesorMaterias')
  .where('codigoGrupo', '==', codigoGrupo).get(); // ~8 lecturas

// POR CADA MATERIA (8 lecturas individuales en bucle):
for (const materia of materias) {
  const calDoc = await db.collection('calificaciones').doc(docId).get(); // ← en bucle!
}

const grupoDoc = await db.collection('grupos').doc(grupoId).get();       // 1 lectura
const carreraDoc = await db.collection('carreras').doc(carreraId).get(); // 1 lectura
```

**Total por boleta: ~20+ lecturas**

### Solución: Leer todo en batch antes del bucle
```javascript
// En vez de leer calificaciones de una en una, usar getAll o una sola query
async function generarBoletaOptimizada(alumno) {
  // Leer todo en paralelo (no esperar una por una)
  const [materiasSnap, inscripcionesSnap, grupoDoc, carreraDoc] = await Promise.all([
    db.collection('profesorMaterias').where('codigoGrupo', '==', alumno.codigoGrupo).get(),
    db.collection('inscripcionesEspeciales').where('alumnoId', '==', alumno.id).get(),
    db.collection('grupos').doc(alumno.grupoId).get(),
    db.collection('carreras').doc(alumno.carreraId).get()
  ]);

  // Construir IDs de calificaciones y leerlas en una sola operación
  const calIds = materias.map(m => `${alumno.id}_${m.materiaId}`);
  const calRefs = calIds.map(id => db.collection('calificaciones').doc(id));
  const calDocs = await db.getAll(...calRefs); // 1 operación en vez de N
}
```

> **Ahorro estimado:** De ~20 a ~5 lecturas por boleta, más tiempo de carga reducido.

---

## Problema 7 — `controlProfesor.js` carga TODOS los alumnos para filtrar en cliente

**Severidad: MEDIA**

```javascript
// ANTES: Carga todos los alumnos y luego filtra por grupo en JavaScript
const alumnosSnap = await db.collection('usuarios')
  .where('rol', '==', 'alumno')
  .where('codigoGrupo', '==', asignacion.codigoGrupo)
  .get(); // Firestore sí filtra, pero si hay muchos alumnos sin índice compuesto lee más
```

### Verificar índices compuestos en Firebase Console
Si la query `rol + codigoGrupo` no tiene índice compuesto, Firestore puede hacer full scan.

**Acción requerida:** Verificar en Firebase Console → Firestore → Índices que existan índices para:
- `usuarios`: `rol ASC, codigoGrupo ASC`
- `usuarios`: `rol ASC, carreraId ASC`
- `profesorMaterias`: `profesorId ASC, activa ASC`
- `calificaciones`: `alumnoId ASC, carreraId ASC`

---

## Problema 8 — No hay listeners en tiempo real pero tampoco caché persistente

**Severidad: BAJA-MEDIA**

El sistema usa `.get()` (one-time reads) en vez de `.onSnapshot()` (listeners), lo cual es correcto para reducir lecturas. Pero sin caché, cada recarga de página repite todas las queries.

### Datos que raramente cambian y se pueden cachear agresivamente

| Dato | Frecuencia de cambio | Estrategia |
|---|---|---|
| Lista de carreras | Muy rara (admin) | sessionStorage o localStorage (1 hora) |
| Lista de materias | Rara (por periodo) | sessionStorage |
| Configuración de periodo | Por periodo académico | sessionStorage + invalidar al cambiar |
| Datos del usuario actual | Por sesión | sessionStorage |
| Lista de grupos | Por periodo | sessionStorage |

### Datos que NO deben cachearse agresivamente

| Dato | Razón |
|---|---|
| Calificaciones | Profesores las actualizan frecuentemente |
| Estado activo/inactivo de alumnos | Lo cambia caja en tiempo real |
| Reportes de prefecto | Se generan en tiempo real |

---

## Plan de Acción Priorizado

### Fase 1 — Impacto inmediato (1–2 días de trabajo)

| # | Acción | Reducción estimada |
|---|---|---|
| 1 | Cachear `usuarioActual` en `sessionStorage` al hacer login | -50% lecturas de `usuarios` |
| 2 | Cachear `carreras`, `config`, `grupos` en `sessionStorage` | -80% lecturas de colecciones estáticas |
| 3 | Cachear `alumnos` en `sessionStorage` por sesión (con TTL de 30 min) | -70% lecturas en módulos admin/escolar |

**Implementación mínima:**
```javascript
// Agregar al inicio de cada módulo que carga alumnos
function getFromCache(key, ttlMinutes = 30) {
  const item = sessionStorage.getItem(key);
  if (!item) return null;
  const { data, timestamp } = JSON.parse(item);
  if (Date.now() - timestamp > ttlMinutes * 60 * 1000) {
    sessionStorage.removeItem(key);
    return null;
  }
  return data;
}

function saveToCache(key, data) {
  sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}
```

### Fase 2 — Mejoras estructurales (3–5 días de trabajo)

| # | Acción | Reducción estimada |
|---|---|---|
| 4 | Crear colección `matriculas/{matricula}` para búsqueda O(1) en `index.html` | -98% en consulta pública |
| 5 | Crear documento `config/estadisticas` para panel de reportes de admin | -99% en reportes |
| 6 | Agregar índices compuestos en Firebase Console | -30–50% en queries filtradas |
| 7 | Usar `Promise.all()` en generación de PDF | Mismo número de lecturas, más rápido |

### Fase 3 — Optimización avanzada (opcional)

| # | Acción | Reducción estimada |
|---|---|---|
| 8 | Desnormalizar datos de alumno en `calificaciones` (ya existe `alumnoNombre`) | Evitar joins innecesarios |
| 9 | Implementar paginación en listas grandes | Limitar lecturas a 20–50 por página |
| 10 | Mover lógica de reportes a Cloud Functions | 0 lecturas del cliente |

---

## Estimación de lecturas antes y después

### Escenario típico: 50 usuarios activos en el día

| Módulo | Lecturas actuales/día | Lecturas con Fase 1 | Lecturas con Fase 1+2 |
|---|---|---|---|
| Login (50 logins) | 50 | **50** | **50** |
| Navegación entre páginas (50×5 páginas) | 250 | **0** (caché) | **0** |
| Control Escolar (5 usuarios × carga) | 2,500 | **0** (caché) | **0** |
| Control Caja (2 usuarios × carga) | 1,000 | **0** (caché) | **0** |
| Consulta pública de calificaciones (100 alumnos) | 51,500 | 51,500 | **1,200** |
| Admin reportes (2 visitas) | 1,420 | 1,420 | **2** |
| Profesores cargando sus grupos (10 profesores) | 5,000 | **0** (caché) | **0** |
| **TOTAL ESTIMADO** | **~61,720** | **~15,000** | **~2,000** |

> **Nota:** La consulta pública de `index.html` es el mayor culpable si los alumnos la usan frecuentemente. La colección `matriculas` es la optimización más importante.

---

## Checklist de implementación

- [ ] Crear archivo `sice/js/utils/cache.js` con funciones `getFromCache` y `saveToCache`
- [ ] Modificar `login.js` para guardar `usuarioActual` en sessionStorage
- [ ] Modificar todos los `onAuthStateChanged` para leer de sessionStorage primero
- [ ] Modificar `cargarAlumnos()` en escolar, caja, prefecto para usar caché
- [ ] Modificar `cargarCarreras()` en todos los módulos para usar caché
- [ ] Crear colección `matriculas` en Firestore y poblarla desde alumnos existentes
- [ ] Modificar `index.html` para buscar por `matriculas/{matricula}`
- [ ] Crear documento `config/estadisticas` y actualizar en writes de usuarios
- [ ] Verificar y crear índices compuestos en Firebase Console
- [ ] Monitorear lecturas en Firebase Console → Usage durante 1 semana post-cambios

---

## Notas importantes

1. **`sessionStorage` vs `localStorage`:** Se recomienda `sessionStorage` para datos de usuario (se limpia al cerrar el tab). Para datos muy estáticos como carreras se puede usar `localStorage` con TTL de 1 hora.

2. **Invalidar caché al escribir:** Cuando se modifique un alumno, carrera, etc., llamar `sessionStorage.removeItem('cache_alumnos')` para que la próxima carga lea de Firestore.

3. **El problema de la consulta pública es sistémico:** Si hay 500 alumnos que consultan sus calificaciones una vez al día, con el sistema actual son **250,000 lecturas solo de esa funcionalidad**. La colección `matriculas` es crítica.

4. **Firestore cobra por documentos leídos, no por bytes:** Un documento con 1 campo o 50 campos cuesta igual. No ayuda reducir campos, hay que reducir documentos leídos.
