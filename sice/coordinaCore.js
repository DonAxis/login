// =====================================================
// CORE.JS - Sistema Central del Coordinador
// =====================================================
// Contiene:
// - Autenticación y sesión de usuario
// - Inicialización de Firebase
// - Sistema de periodos (gestión y cambio)
// - Sistema multi-carrera (selección y cambio)
// - Navegación entre secciones
// - Protección de rutas
// =====================================================

// coordinador.js
// Panel de Coordinador - Gestión Completa

const auth = firebase.auth();
let usuarioActual = null;
let carreraActual = null;

// ===== SISTEMA DE PERIODOS =====

let periodoActualCarrera = '2026-1'; // Periodo especifico de la carrera

// Generar lista de periodos (2024-1 a 2030-2)
// 2 años antes del actual (2024-2025) + actual (2026) + 4 años futuros (2027-2030)
function generarPeriodos() {
    const periodos = [];
    for (let year = 2024; year <= 2030; year++) {
        periodos.push(`${year}-1`);
        periodos.push(`${year}-2`);
    }
    return periodos;
}

// Cargar periodo actual desde Firebase o usar default


async function cargarPeriodoActual() {
    try {
        // Cargar periodo especifico de la carrera del coordinador
        const docRef = db.collection('config').doc(`periodo_${usuarioActual.carreraId}`);
        const doc = await docRef.get();

        if (doc.exists) {
            periodoActualCarrera = doc.data().periodo || '2026-1';
        } else {
            // Crear documento inicial si no existe
            await docRef.set({
                carreraId: usuarioActual.carreraId,
                periodo: '2026-1',
                fechaCambio: firebase.firestore.FieldValue.serverTimestamp(),
                periodoAnterior: null
            });
            periodoActualCarrera = '2026-1';
        }

        // Actualizar displays
        const elementos = ['periodoActualDisplay', 'periodoUsuario', 'periodoFooter'];
        elementos.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.textContent = periodoActualCarrera;
        });

        // NUEVO: Obtener y mostrar tipo de periodo de la carrera
        try {
            const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();

            if (carreraDoc.exists) {
                const carreraData = carreraDoc.data();
                const periodosAnio = carreraData.periodosAnio || 2; // Default: Semestral

                // Determinar el tipo de periodo
                let tipoPeriodo = '';
                switch (periodosAnio) {
                    case 2:
                        tipoPeriodo = 'Semestral (2 periodos por año)';
                        break;
                    case 3:
                        tipoPeriodo = 'Cuatrimestral (3 periodos por año)';
                        break;
                    case 4:
                        tipoPeriodo = 'Trimestral (4 periodos por año)';
                        break;
                    default:
                        tipoPeriodo = `${periodosAnio} periodos por año`;
                }

                // Actualizar display del tipo de periodo
                const tipoPeriodoElem = document.getElementById('tipoPeriodoDisplay');
                if (tipoPeriodoElem) {
                    tipoPeriodoElem.textContent = tipoPeriodo;
                }
            } else {
                // Si no existe la carrera, mostrar mensaje
                const tipoPeriodoElem = document.getElementById('tipoPeriodoDisplay');
                if (tipoPeriodoElem) {
                    tipoPeriodoElem.textContent = 'Semestral (por defecto)';
                }
            }
        } catch (error) {
            console.error('Error al obtener tipo de periodo:', error);
            const tipoPeriodoElem = document.getElementById('tipoPeriodoDisplay');
            if (tipoPeriodoElem) {
                tipoPeriodoElem.textContent = 'No disponible';
            }
        }

        // Cargar estadisticas del periodo
        await cargarEstadisticasPeriodo();

    } catch (error) {
        console.error('Error al cargar periodo:', error);
        periodoActualCarrera = '2026-1';
        const elem = document.getElementById('periodoActualDisplay');
        if (elem) elem.textContent = periodoActualCarrera;
    }
}



// Cargar estadisticas del periodo actual
async function cargarEstadisticasPeriodo() {
    try {
        console.log('=== Cargando estadísticas del periodo ===');
        console.log('Periodo actual:', periodoActualCarrera);
        console.log('Carrera ID:', usuarioActual.carreraId);
        
            const alumnosSnap = await db.collection('usuarios')
            .where('rol', '==', 'alumno')
            .where('carreraId', '==', usuarioActual.carreraId)
            .where('activo', '==', true)
            .get();

        console.log('✓ Alumnos activos encontrados:', alumnosSnap.size);

        // Contar grupos activos de esta carrera
        const gruposSnap = await db.collection('grupos')
            .where('carreraId', '==', usuarioActual.carreraId)
            .where('activo', '==', true)
            .get();

        console.log('✓ Grupos activos encontrados:', gruposSnap.size);

        // Contar asignaciones activas del periodo actual
        const asignacionesSnap = await db.collection('profesorMaterias')
            .where('carreraId', '==', usuarioActual.carreraId)
            .where('periodo', '==', periodoActualCarrera)
            .where('activa', '==', true)
            .get();

        console.log('✓ Asignaciones activas encontradas:', asignacionesSnap.size);

        // Actualizar displays
        const elemAlumnos = document.getElementById('alumnosActivosDisplay');
        if (elemAlumnos) {
            elemAlumnos.textContent = alumnosSnap.size;
            console.log('Display alumnos actualizado:', alumnosSnap.size);
        } else {
            console.warn('Elemento alumnosActivosDisplay no encontrado');
        }

        const elemGrupos = document.getElementById('gruposActivosDisplay');
        if (elemGrupos) {
            elemGrupos.textContent = gruposSnap.size;
            console.log('Display grupos actualizado:', gruposSnap.size);
        } else {
            console.warn('Elemento gruposActivosDisplay no encontrado');
        }

        const elemAsignaciones = document.getElementById('asignacionesActivasDisplay');
        if (elemAsignaciones) {
            elemAsignaciones.textContent = asignacionesSnap.size;
            console.log('Display asignaciones actualizado:', asignacionesSnap.size);
        } else {
            console.warn('Elemento asignacionesActivasDisplay no encontrado');
        }

        console.log('Estadísticas del periodo actualizadas correctamente');

    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        console.error('Stack trace:', error.stack);
        
        // Mostrar 0 en caso de error
        ['alumnosActivosDisplay', 'gruposActivosDisplay', 'asignacionesActivasDisplay'].forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.textContent = '0';
        });
    }
}

// NUEVA FUNCION: Mostrar seccion de periodos
async function mostrarSeccionPeriodos() {
    // Cargar datos actualizados
    await cargarPeriodoActual();
    await cargarEstadisticasPeriodo();

    // Mostrar seccion usando la misma lógica que las demás secciones
    document.querySelectorAll('.menu-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.seccion-contenido').forEach(s => s.classList.remove('active'));
    document.getElementById('seccionPeriodos').classList.add('active');
    document.getElementById('menuPrincipal').style.display = 'none';
}
////////////

// ===== SISTEMA MULTI-CARRERA PARA COORDINADOR =====

let carrerasDisponibles = []; // Carreras que puede gestionar el coordinador
let carreraActualData = null; // Datos de la carrera actualmente seleccionada

// ===== CARGAR CARRERAS DEL COORDINADOR =====
async function cargarCarrerasCoordinador() {
    try {
        if (!usuarioActual) {
            console.error('No hay usuario actual');
            return;
        }

        console.log('Cargando carreras del coordinador...');

        // Verificar si tiene múltiples carreras (SISTEMA NUEVO)
        if (usuarioActual.carreras && Array.isArray(usuarioActual.carreras) && usuarioActual.carreras.length > 0) {
            // SISTEMA NUEVO: Múltiples carreras
            console.log(`Sistema NUEVO: Coordinador con ${usuarioActual.carreras.length} carrera(s)`);

            // Cargar datos completos de cada carrera
            carrerasDisponibles = [];
            for (const c of usuarioActual.carreras) {
                try {
                    const carreraDoc = await db.collection('carreras').doc(c.carreraId).get();
                    if (carreraDoc.exists) {
                        carrerasDisponibles.push({
                            id: c.carreraId,
                            color: c.color,
                            ...carreraDoc.data()
                        });
                        console.log(`Carrera cargada: ${carreraDoc.data().nombre} (${c.color})`);
                    } else {
                        console.warn(`Carrera no encontrada: ${c.carreraId}`);
                    }
                } catch (error) {
                    console.error(`Error al cargar carrera ${c.carreraId}:`, error);
                }
            }

            if (carrerasDisponibles.length === 0) {
                throw new Error('No se pudieron cargar las carreras asignadas');
            }

            // Si hay múltiples carreras, mostrar selector
            if (carrerasDisponibles.length > 1) {
                console.log('Mostrando selector de carreras (múltiples carreras)');
                mostrarSelectorCarreras();
            } else {
                console.log('Solo una carrera, no se muestra selector');
            }

            // Establecer la carrera actual (primera o la guardada en carreraActual)
            const carreraInicialId = usuarioActual.carreraActual || carrerasDisponibles[0].id;
            const carreraInicial = carrerasDisponibles.find(c => c.id === carreraInicialId) || carrerasDisponibles[0];

            await establecerCarreraActual(carreraInicial.id, carreraInicial.color);

        } else if (usuarioActual.carreraId) {
            // SISTEMA ANTIGUO: Solo una carrera
            console.log('Sistema ANTIGUO: Coordinador con una sola carrera');

            const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
            if (carreraDoc.exists) {
                carrerasDisponibles = [{
                    id: usuarioActual.carreraId,
                    color: '#43a047', // Color por defecto verde
                    ...carreraDoc.data()
                }];
                await establecerCarreraActual(usuarioActual.carreraId, '#43a047');
                console.log(`Carrera cargada: ${carreraDoc.data().nombre} (sistema antiguo)`);
            } else {
                throw new Error('Carrera asignada no encontrada');
            }
        } else {
            // Sin carreras asignadas
            console.error('Coordinador sin carreras asignadas');
            alert(
                'SIN CARRERAS ASIGNADAS\n\n' +
                'No tienes carreras asignadas en este momento.\n\n' +
                'Por favor, contacta al administrador del sistema\n' +
                'para que te asigne al menos una carrera.'
            );
            throw new Error('Coordinador sin carreras asignadas');
        }

        // Actualizar contador de carreras en la UI
        const cantidadElem = document.getElementById('cantidadCarreras');
        if (cantidadElem) {
            cantidadElem.textContent = carrerasDisponibles.length;
        }

        console.log(`Sistema de carreras cargado: ${carrerasDisponibles.length} carrera(s)`);

    } catch (error) {
        console.error('Error al cargar carreras:', error);
        alert('Error al cargar carreras: ' + error.message);
        // No redirigir automáticamente para permitir debug
    }
}

// ===== MOSTRAR SELECTOR DE CARRERAS =====
function mostrarSelectorCarreras() {
    const container = document.getElementById('selectorCarreras');
    const select = document.getElementById('selectCarrera');

    if (!container || !select) {
        console.error('No se encontraron elementos del selector de carreras');
        return;
    }

    // Generar opciones del selector
    let html = '';
    carrerasDisponibles.forEach(carrera => {
        const selected = carrera.id === usuarioActual.carreraActual ? 'selected' : '';

        html += `<option value="${carrera.id}" ${selected}> ${carrera.nombre}</option>`;
    });

    select.innerHTML = html;
    container.style.display = 'block';

    console.log(`Selector de carreras mostrado con ${carrerasDisponibles.length} opciones`);
}

// ===== ESTABLECER CARRERA ACTUAL =====
async function establecerCarreraActual(carreraId, color) {
    try {
        console.log(`Estableciendo carrera actual: ${carreraId}`);

        // Buscar datos de la carrera
        const carrera = carrerasDisponibles.find(c => c.id === carreraId);

        if (!carrera) {
            console.error('Carrera no encontrada en carreras disponibles:', carreraId);
            return;
        }

        // Actualizar variables globales
        carreraActualData = carrera;
        usuarioActual.carreraId = carreraId; // Para compatibilidad con código existente
        usuarioActual.carreraActual = carreraId;

        // Actualizar color del header
        const header = document.getElementById('headerCoordinador');
        if (header) {
            const colorOscuro = ajustarColorOscuro(color);
            header.style.background = `linear-gradient(135deg, ${color} 0%, ${colorOscuro} 100%)`;
            header.style.opacity = '1'; // AÑADIR ESTA LINEA
            header.style.transition = 'all 0.5s ease';
            console.log(`Header actualizado con color ${color}`);
        } else {
            console.warn('Elemento headerCoordinador no encontrado');
        }
        // Actualizar nombre de carrera en el header
        const carreraNombreDisplay = document.getElementById('carreraNombreDisplay');
        if (carreraNombreDisplay) {
            carreraNombreDisplay.textContent = carrera.nombre.toUpperCase();
        }

        // Actualizar en user-info (si existe)
        const carreraUsuario = document.getElementById('carreraUsuario');
        if (carreraUsuario) {
            carreraUsuario.textContent = carrera.nombre;
        }

        // Guardar en Firestore para recordar la selección
        try {
            await db.collection('usuarios').doc(usuarioActual.uid).update({
                carreraActual: carreraId,
                ultimaActualizacionCarrera: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Carrera actual guardada en Firestore');
        } catch (error) {
            console.warn('No se pudo guardar carrera actual en Firestore:', error);
        }

        // Recargar periodo específico de esta carrera
        await cargarPeriodoActual();

        console.log(`Carrera actual establecida: ${carrera.nombre} (${color})`);

    } catch (error) {
        console.error('Error al establecer carrera actual:', error);
    }
}

// ===== CAMBIAR CARRERA ACTIVA (cuando el usuario selecciona otra del dropdown) =====
async function cambiarCarreraActiva() {
    const select = document.getElementById('selectCarrera');
    if (!select) return;

    const nuevoCarreraId = select.value;
    const carrera = carrerasDisponibles.find(c => c.id === nuevoCarreraId);

    if (!carrera) {
        console.error('Carrera seleccionada no encontrada');
        return;
    }

    // Si es la misma carrera, no hacer nada
    if (nuevoCarreraId === usuarioActual.carreraActual) {
        console.log('Misma carrera seleccionada, ignorando');
        return;
    }

    //console.log(`Usuario solicita cambio de carrera a: ${carrera.nombre}`);

    console.log(`Cambiando de carrera a: ${carrera.nombre}`);

    // Mostrar indicador de carga
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
  `;
    loadingOverlay.innerHTML = `
    <div style="font-size: 4rem; margin-bottom: 20px; animation: spin 1s linear infinite;"></div>
    <div style="font-size: 1.5rem; font-weight: 600;">Cambiando a ${carrera.nombre}...</div>
    <div style="font-size: 1rem; margin-top: 10px; opacity: 0.8;">Por favor espera</div>
    <style>
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;
    document.body.appendChild(loadingOverlay);

    try {
        // Establecer nueva carrera
        await establecerCarreraActual(carrera.id, carrera.color);

        // Esperar un momento para que se vea el cambio
        await new Promise(resolve => setTimeout(resolve, 500));

        // Recargar la página para aplicar todos los cambios
        console.log('Recargando página...');
        location.reload();

    } catch (error) {
        console.error('Error al cambiar carrera:', error);
        document.body.removeChild(loadingOverlay);
        alert('Error al cambiar de carrera. Por favor, intenta de nuevo.');
        // Revertir selección
        select.value = usuarioActual.carreraActual;
    }
}

// ===== FUNCIÓN AUXILIAR: AJUSTAR COLOR PARA GRADIENTE =====
function ajustarColorOscuro(hex) {
    try {
        // Eliminar # si existe
        hex = hex.replace('#', '');

        // Convertir hex a RGB
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);

        // Oscurecer 20% (multiplicar por 0.8)
        const factor = 0.75;
        const nr = Math.floor(r * factor);
        const ng = Math.floor(g * factor);
        const nb = Math.floor(b * factor);

        // Convertir de vuelta a hex
        const toHex = (n) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
    } catch (error) {
        console.error('Error al ajustar color:', error);
        return hex; // Devolver color original si hay error
    }
}

// ===== INFORMACIÓN DE CARRERA ACTUAL (para debugging) =====
function obtenerInfoCarreraActual() {
    return {
        carreraId: usuarioActual.carreraId,
        carreraActual: usuarioActual.carreraActual,
        nombreCarrera: carreraActualData ? carreraActualData.nombre : null,
        colorCarrera: carreraActualData ? carreraActualData.color : null,
        totalCarreras: carrerasDisponibles.length,
        carreras: carrerasDisponibles.map(c => ({
            id: c.id,
            nombre: c.nombre,
            color: c.color
        }))
    };
}

// Exponer función para debugging en consola
window.debugCarreras = obtenerInfoCarreraActual;


console.log('amm Sistema multi-carrera para coordinador cargado');
console.log('amm Para debug, usa: debugCarreras() en la consola');


// ===== PROTECCIÓN Y AUTENTICACIÓN =====
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        console.log('No hay sesión activa');
        // alert('Debes iniciar sesión');
        window.location.href = 'https://ilbcontrol.mx/sice';
        return;
    }

    try {
        const userDoc = await db.collection('usuarios').doc(user.uid).get();

        if (!userDoc.exists) {
            console.log('Usuario no encontrado');
            await auth.signOut();
            window.location.href = 'https://ilbcontrol.mx/sice';
            return;
        }

        usuarioActual = userDoc.data();
        usuarioActual.uid = user.uid;

        // Verificar rol (coordinador o admin)
        if (usuarioActual.rol !== 'coordinador' && usuarioActual.rol !== 'admin') {
            console.log('No tienes permisos de coordinador');
            alert('No tienes permisos para acceder');
            window.location.href = 'https://ilbcontrol.mx/sice';
            return;
        }

        console.log('Coordinador autorizado:', usuarioActual.nombre);


        // Cargar carreras del coordinador ANTES de cargar el periodo
        await cargarCarrerasCoordinador();

        // Cargar periodo actual
        await cargarPeriodoActual();

        // Mostrar info del usuario (intentar con ambos IDs por compatibilidad)
        const nombreElem = document.getElementById('nombreUsuario') || document.getElementById('userName');
        const emailElem = document.getElementById('emailUsuario') || document.getElementById('userEmail');
        const carreraInfoElem = document.getElementById('carreraInfo');

        if (nombreElem) nombreElem.textContent = usuarioActual.nombre;
        if (emailElem) emailElem.textContent = user.email;

        // Mostrar opción de carreras solo para admin
        if (usuarioActual.rol === 'admin') {
            const menuCarreras = document.getElementById('menuCarreras');
            if (menuCarreras) menuCarreras.style.display = 'block';
        }

        // Cargar carrera
        if (usuarioActual.rol === 'admin') {
            if (carreraInfoElem) carreraInfoElem.textContent = 'Administrador - Todas las carreras';
        } else if (usuarioActual.carreraId) {
            try {
                const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
                if (carreraDoc.exists) {
                    const carrera = carreraDoc.data();
                    if (carreraInfoElem) carreraInfoElem.textContent = `Carrera: ${carrera.nombre}`;

                    // También actualizar en user-info si existe
                    const carreraUsuarioElem = document.getElementById('carreraUsuario');
                    if (carreraUsuarioElem) carreraUsuarioElem.textContent = carrera.nombre;

                    carreraActual = carrera;
                } else {
                    if (carreraInfoElem) carreraInfoElem.textContent = 'Carrera no encontrada';
                }
            } catch (error) {
                console.error('Error al cargar carrera:', error);
                if (carreraInfoElem) carreraInfoElem.textContent = 'Error al cargar carrera';
            }
        } else {
            if (carreraInfoElem) carreraInfoElem.textContent = 'Sin carrera asignada';
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error al verificar permisos: ' + error.message);
        window.location.href = 'https://ilbcontrol.mx/sice';
    }
});

// Cerrar sesión
async function cerrarSesion() {
    if (confirm('¿Cerrar sesión?')) {
        try {
            await auth.signOut();
            sessionStorage.clear();
            window.location.href = 'https://ilbcontrol.mx/sice/';
        } catch (error) {
            console.error('Error:', error);
            alert('Error al cerrar sesión');
        }
    }
}


console.log('✓ core.js cargado');
