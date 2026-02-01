// ============================================
// ASIGNACION MASIVA DE PROFESORES
// Selecciona turno + orden → Asigna múltiples materias
// ============================================

async function mostrarFormAsignacionMasiva() {
    document.getElementById('tituloModal').textContent = 'Asignación Masiva de Profesores';

    try {
        // ====== CARGAR PROFESORES ======
        const profesoresValidos = [];

        const profesoresPurosQuery = db.collection('usuarios')
            .where('rol', '==', 'profesor')
            .where('activo', '==', true);

        const profesoresPurosSnap = await profesoresPurosQuery.get();

        profesoresPurosSnap.forEach(doc => {
            const data = doc.data();
            if (data.carreras && Array.isArray(data.carreras)) {
                const tieneCarrera = data.carreras.some(c => {
                    if (typeof c === 'string') return c === usuarioActual.carreraId;
                    else if (typeof c === 'object' && c.carreraId) return c.carreraId === usuarioActual.carreraId;
                    return false;
                });
                if (tieneCarrera) profesoresValidos.push({ id: doc.id, ...data });
            }
        });

        const coordinadoresQuery = db.collection('usuarios')
            .where('rol', '==', 'coordinador')
            .where('activo', '==', true);

        const coordinadoresSnap = await coordinadoresQuery.get();

        coordinadoresSnap.forEach(doc => {
            const data = doc.data();
            if (!data.roles || !data.roles.includes('profesor')) return;

            let tieneAcceso = false;
            if (data.carreras && Array.isArray(data.carreras)) {
                tieneAcceso = data.carreras.some(c => {
                    if (typeof c === 'string') return c === usuarioActual.carreraId;
                    else if (typeof c === 'object' && c.carreraId) return c.carreraId === usuarioActual.carreraId;
                    return false;
                });
            } else if (data.carreraId === usuarioActual.carreraId) {
                tieneAcceso = true;
            }
            if (tieneAcceso) profesoresValidos.push({ id: doc.id, ...data });
        });

        profesoresValidos.sort((a, b) => a.nombre.localeCompare(b.nombre));

        // Guardar profesores para uso posterior
        window.profesoresDisponiblesMasivo = profesoresValidos;

        // ====== CARGAR DATOS DE LA CARRERA ======
        const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
        const codigoCarrera = carreraDoc.exists ? carreraDoc.data().codigo : 'XXX';
        window.codigoCarreraAsignacionMasiva = codigoCarrera;

        // ====== GENERAR FORMULARIO ======
        const html = `
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 1200px; margin: 20px auto;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #667eea;">
          <h2 style="margin: 0; color: #667eea; font-size: 1.8rem;">Asignación Masiva de Profesores</h2>
          <button onclick="cerrarModal()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
        </div>

        <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
          <h4 style="margin: 0 0 10px 0; color: #1565c0; font-size: 1rem;">¿Cómo funciona?</h4>
          <ol style="margin: 0; padding-left: 20px; color: #1565c0; line-height: 1.8; font-size: 0.85rem;">
            <li>Selecciona el <strong>turno</strong> y <strong>orden</strong> del grupo</li>
            <li>Se cargarán todas las materias disponibles para ese turno</li>
            <li>Asigna un profesor a cada materia</li>
            <li>Guarda todas las asignaciones de una vez</li>
          </ol>
        </div>

        <!-- SELECTORES: TURNO Y ORDEN -->
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 1.1rem;">Configuración del Grupo</h3>
          
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px;">
            
            <div>
              <label style="font-weight: 600; color: #333; display: block; margin-bottom: 8px;">Turno: *</label>
              <select id="turnoMasivo" required onchange="cargarMateriasPorTurno()"
                      style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem;">
                <option value="">Seleccionar turno...</option>
                <option value="1">Matutino</option>
                <option value="2">Vespertino</option>
                <option value="3">Nocturno</option>
                <option value="4">Sabatino</option>
              </select>
            </div>

            <div>
              <label style="font-weight: 600; color: #333; display: block; margin-bottom: 8px;">Orden: *</label>
              <input type="text" id="ordenMasivo" required value="01" maxlength="2" onchange="cargarMateriasPorTurno()"
                     style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem;" placeholder="01">
              <small style="color: #666; font-size: 0.75rem;">01, 02, 03...</small>
            </div>
          </div>
        </div>

        <!-- AREA DE MATERIAS (se llena dinámicamente) -->
        <div id="areaMateriasMasivo" style="display: none;">
          <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: #856404;">Instrucciones:</strong>
            <p style="margin: 8px 0 0 0; color: #856404; font-size: 0.85rem;">
              Asigna un profesor a cada materia. Puedes dejar sin asignar las que no necesites.
              Solo se guardarán las que tengan un profesor seleccionado.
            </p>
          </div>

          <div id="listaMateriasMasivo"></div>

          <div style="margin-top: 25px; display: flex; gap: 15px; justify-content: flex-end;">
            <button type="button" onclick="guardarAsignacionesMasivas()" 
                    style="padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer;">
              Guardar Todas las Asignaciones
            </button>
            <button type="button" onclick="cerrarModal()" 
                    style="padding: 14px 28px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Cancelar
            </button>
          </div>
        </div>

      </div>
    `;

        document.getElementById('contenidoModal').innerHTML = html;
        document.getElementById('modalGenerico').style.display = 'flex';

    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar formulario: ' + error.message);
    }
}

// ====== CARGAR MATERIAS POR TURNO ======
async function cargarMateriasPorTurno() {
    const turno = document.getElementById('turnoMasivo').value;
    const orden = document.getElementById('ordenMasivo').value;
    const areaMaterias = document.getElementById('areaMateriasMasivo');
    const listaMaterias = document.getElementById('listaMateriasMasivo');

    if (!turno || !orden) {
        areaMaterias.style.display = 'none';
        return;
    }

    try {
        // Cargar todas las materias de la carrera
        const materiasQuery = db.collection('materias')
            .where('carreraId', '==', usuarioActual.carreraId);

        const materiasSnap = await materiasQuery.get();
        
        if (materiasSnap.empty) {
            listaMaterias.innerHTML = '<p style="color: #999; text-align: center; padding: 40px;">No hay materias registradas</p>';
            areaMaterias.style.display = 'block';
            return;
        }

        const materias = [];
        materiasSnap.forEach(doc => {
            const materia = doc.data();
            materias.push({
                id: doc.id,
                nombre: materia.nombre,
                periodo: materia.periodo || 1
            });
        });

        // Ordenar por periodo y nombre
        materias.sort((a, b) => {
            if (a.periodo !== b.periodo) return a.periodo - b.periodo;
            return a.nombre.localeCompare(b.nombre);
        });

        // Generar opciones de profesores (reutilizar del global)
        const profesores = window.profesoresDisponiblesMasivo || [];
        let profesoresOptions = '<option value="">Seleccionar profesor...</option>';
        profesores.forEach(prof => {
            const rolDisplay = prof.rol === 'coordinador' ? ' (Coordinador)' : '';
            profesoresOptions += `<option value="${prof.id}" data-nombre="${prof.nombre}">${prof.nombre}${rolDisplay}</option>`;
        });

        // Generar HTML por periodo
        let html = '';
        let periodoActual = null;

        const codigoCarrera = window.codigoCarreraAsignacionMasiva || 'XXX';
        const ordenFormateado = orden.padStart(2, '0');
        const turnosNombres = {
            '1': 'Matutino',
            '2': 'Vespertino',
            '3': 'Nocturno',
            '4': 'Sabatino'
        };

        materias.forEach((materia, index) => {
            // Encabezado de periodo
            if (materia.periodo !== periodoActual) {
                if (periodoActual !== null) {
                    html += '</div>'; // Cerrar contenedor anterior
                }
                html += `
                    <div style="margin-bottom: 25px;">
                        <h3 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; border-radius: 8px; margin: 0 0 15px 0; font-size: 1.1rem;">
                            Periodo ${materia.periodo}
                        </h3>
                `;
                periodoActual = materia.periodo;
            }

            const codigoGrupo = `${codigoCarrera}-${turno}${materia.periodo}${ordenFormateado}`;

            html += `
                <div style="display: grid; grid-template-columns: 2fr 3fr 1fr; gap: 15px; align-items: center; padding: 15px; background: ${index % 2 === 0 ? '#fff' : '#f9f9f9'}; border-radius: 8px; margin-bottom: 10px;">
                    
                    <!-- Nombre de la materia -->
                    <div>
                        <strong style="color: #333; font-size: 0.95rem;">${materia.nombre}</strong>
                        <div style="font-size: 0.75rem; color: #999; margin-top: 3px; font-family: monospace;">
                            ${codigoGrupo}
                        </div>
                    </div>

                    <!-- Selector de profesor -->
                    <div>
                        <select class="profesor-select" 
                                data-materia-id="${materia.id}" 
                                data-materia-nombre="${materia.nombre}"
                                data-periodo="${materia.periodo}"
                                data-codigo-grupo="${codigoGrupo}"
                                style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 0.9rem;">
                            ${profesoresOptions}
                        </select>
                    </div>

                    <!-- Indicador visual -->
                    <div style="text-align: center;">
                        <span style="color: #999; font-size: 0.8rem;">Sin asignar</span>
                    </div>
                </div>
            `;
        });

        if (periodoActual !== null) {
            html += '</div>'; // Cerrar último contenedor
        }

        // Resumen al inicio
        const resumenHtml = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 8px;">
                    ${turnosNombres[turno]} - Grupo ${ordenFormateado}
                </div>
                <div style="font-size: 0.95rem; opacity: 0.95;">
                    ${materias.length} materias disponibles para asignar
                </div>
            </div>
        `;

        listaMaterias.innerHTML = resumenHtml + html;
        areaMaterias.style.display = 'block';

        // Agregar listener para cambios en selectores
        document.querySelectorAll('.profesor-select').forEach(select => {
            select.addEventListener('change', function() {
                const indicador = this.parentElement.nextElementSibling;
                if (this.value) {
                    indicador.innerHTML = '<span style="color: #4caf50; font-weight: 600;">✓ Asignado</span>';
                    this.style.borderColor = '#4caf50';
                } else {
                    indicador.innerHTML = '<span style="color: #999; font-size: 0.8rem;">Sin asignar</span>';
                    this.style.borderColor = '#ddd';
                }
            });
        });

    } catch (error) {
        console.error('Error al cargar materias:', error);
        alert('Error al cargar materias: ' + error.message);
    }
}

// ====== GUARDAR ASIGNACIONES MASIVAS ======
async function guardarAsignacionesMasivas() {
    const turnoSelect = document.getElementById('turnoMasivo');
    const turno = parseInt(turnoSelect.value);
    const turnoTexto = turnoSelect.options[turnoSelect.selectedIndex].text;
    const orden = document.getElementById('ordenMasivo').value.padStart(2, '0');

    if (!turno || !orden) {
        alert('Selecciona turno y orden primero');
        return;
    }

    // Recopilar todas las asignaciones
    const asignaciones = [];
    const selectores = document.querySelectorAll('.profesor-select');

    selectores.forEach(select => {
        if (select.value) { // Solo las que tienen profesor asignado
            const profesorNombre = select.options[select.selectedIndex].dataset.nombre;
            
            asignaciones.push({
                materiaId: select.dataset.materiaId,
                materiaNombre: select.dataset.materiaNombre,
                profesorId: select.value,
                profesorNombre: profesorNombre,
                codigoGrupo: select.dataset.codigoGrupo,
                periodo: parseInt(select.dataset.periodo),
                turno: turno,
                turnoNombre: turnoTexto,
                orden: orden
            });
        }
    });

    if (asignaciones.length === 0) {
        alert('No hay asignaciones para guardar.\n\nSelecciona al menos un profesor.');
        return;
    }

    const confirmar = confirm(
        `Vas a crear ${asignaciones.length} asignaciones\n\n` +
        `Turno: ${turnoTexto}\n` +
        `Orden: ${orden}\n\n` +
        `¿Continuar?`
    );

    if (!confirmar) return;

    try {
        let exitosas = 0;
        let duplicadas = 0;
        let errores = 0;

        for (const asig of asignaciones) {
            try {
                // Verificar si ya existe
                const existente = await db.collection('profesorMaterias')
                    .where('materiaId', '==', asig.materiaId)
                    .where('codigoGrupo', '==', asig.codigoGrupo)
                    .where('activa', '==', true)
                    .get();

                if (!existente.empty) {
                    // Eliminar duplicado
                    const batch = db.batch();
                    existente.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    duplicadas++;
                }

                // Crear nueva asignación
                await db.collection('profesorMaterias').add({
                    materiaId: asig.materiaId,
                    materiaNombre: asig.materiaNombre,
                    profesorId: asig.profesorId,
                    profesorNombre: asig.profesorNombre,
                    codigoGrupo: asig.codigoGrupo,
                    periodo: asig.periodo,
                    turno: asig.turno,
                    turnoNombre: asig.turnoNombre,
                    orden: asig.orden,
                    carreraId: usuarioActual.carreraId,
                    activa: true,
                    fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
                });

                exitosas++;

            } catch (error) {
                console.error(`Error en ${asig.materiaNombre}:`, error);
                errores++;
            }

            // Pequeña pausa para no saturar
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        let mensaje = `RESUMEN DE ASIGNACION MASIVA\n\n`;
        mensaje += `Exitosas: ${exitosas}\n`;
        if (duplicadas > 0) mensaje += `Reemplazadas: ${duplicadas}\n`;
        if (errores > 0) mensaje += `Errores: ${errores}\n`;
        mensaje += `\nTurno: ${turnoTexto}\n`;
        mensaje += `Orden: ${orden}`;

        alert(mensaje);

        cerrarModal();
        if (typeof cargarAsignaciones === 'function') {
            cargarAsignaciones();
        }

    } catch (error) {
        console.error('Error general:', error);
        alert('Error al guardar asignaciones: ' + error.message);
    }
}

console.log('Sistema de asignación masiva cargado');