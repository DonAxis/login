
console.log('*** CARGANDO registroMasivoAsignacion.js ***');

async function mostrarFormAsignacionMasiva() {
    console.log('=== mostrarFormAsignacionMasiva INICIADA ===');
    
    document.getElementById('tituloModal').textContent = 'Asignacion Masiva de Profesores';

    try {
        console.log('1. Iniciando carga de profesores...');
        
        // ====== CARGAR PROFESORES ======
        const profesoresValidos = [];

        const profesoresPurosQuery = db.collection('usuarios')
            .where('rol', '==', 'profesor')
            .where('activo', '==', true);

        const profesoresPurosSnap = await profesoresPurosQuery.get();
        console.log('Profesores puros encontrados:', profesoresPurosSnap.size);

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
        console.log('Coordinadores encontrados:', coordinadoresSnap.size);

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
        console.log('Total profesores validos:', profesoresValidos.length);

        window.profesoresDisponiblesMasivo = profesoresValidos;

        console.log('2. Cargando datos de carrera...');
        const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
        const codigoCarrera = carreraDoc.exists ? carreraDoc.data().codigo : 'XXX';
        window.codigoCarreraAsignacionMasiva = codigoCarrera;
        console.log('Codigo de carrera:', codigoCarrera);

        console.log('3. Generando HTML del formulario...');
        const html = `
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 1200px; margin: 20px auto;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #667eea;">
          <h2 style="margin: 0; color: #667eea; font-size: 1.8rem;">Asignacion Masiva de Profesores</h2>
          <button onclick="cerrarModal()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
        </div>

        <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
          <h4 style="margin: 0 0 10px 0; color: #1565c0; font-size: 1rem;">Como funciona</h4>
          <ol style="margin: 0; padding-left: 20px; color: #1565c0; line-height: 1.8; font-size: 0.85rem;">
            <li>Selecciona el turno y orden del grupo</li>
            <li>Se cargaran todas las materias disponibles para ese turno</li>
            <li>Asigna un profesor a cada materia</li>
            <li>Guarda todas las asignaciones de una vez</li>
          </ol>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 1.1rem;">Configuracion del Grupo</h3>
          
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

        <div id="areaMateriasMasivo" style="display: none;">
          <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: #856404;">Instrucciones:</strong>
            <p style="margin: 8px 0 0 0; color: #856404; font-size: 0.85rem;">
              Asigna un profesor a cada materia. Puedes dejar sin asignar las que no necesites.
              Solo se guardaran las que tengan un profesor seleccionado.
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

        console.log('4. Insertando HTML en modal...');
        document.getElementById('contenidoModal').innerHTML = html;
        document.getElementById('modalGenerico').style.display = 'flex';
        console.log('5. Modal mostrado correctamente');

    } catch (error) {
        console.error('ERROR en mostrarFormAsignacionMasiva:', error);
        alert('Error al cargar formulario: ' + error.message);
    }
}

async function cargarMateriasPorTurno() {
    console.log('=== cargarMateriasPorTurno INICIADA ===');
    
    const turno = document.getElementById('turnoMasivo').value;
    const orden = document.getElementById('ordenMasivo').value;
    const areaMaterias = document.getElementById('areaMateriasMasivo');
    const listaMaterias = document.getElementById('listaMateriasMasivo');

    console.log('Turno seleccionado:', turno);
    console.log('Orden ingresado:', orden);

    if (!turno || !orden) {
        console.log('Faltan turno u orden, ocultando area');
        areaMaterias.style.display = 'none';
        return;
    }

    try {
        console.log('1. Cargando materias de la carrera...');
        const materiasQuery = db.collection('materias')
            .where('carreraId', '==', usuarioActual.carreraId);

        const materiasSnap = await materiasQuery.get();
        console.log('Materias encontradas:', materiasSnap.size);
        
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

        materias.sort((a, b) => {
            if (a.periodo !== b.periodo) return a.periodo - b.periodo;
            return a.nombre.localeCompare(b.nombre);
        });
        console.log('2. Materias ordenadas:', materias.length);

        const profesores = window.profesoresDisponiblesMasivo || [];
        console.log('3. Profesores disponibles:', profesores.length);
        
        let profesoresOptions = '<option value="">Seleccionar profesor...</option>';
        profesores.forEach(prof => {
            const rolDisplay = prof.rol === 'coordinador' ? ' (Coordinador)' : '';
            profesoresOptions += `<option value="${prof.id}" data-nombre="${prof.nombre}">${prof.nombre}${rolDisplay}</option>`;
        });

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

        console.log('4. Codigo carrera:', codigoCarrera);
        console.log('5. Generando HTML de materias...');

        materias.forEach((materia, index) => {
            if (materia.periodo !== periodoActual) {
                if (periodoActual !== null) {
                    html += '</div>';
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
                    
                    <div>
                        <strong style="color: #333; font-size: 0.95rem;">${materia.nombre}</strong>
                        <div style="font-size: 0.75rem; color: #999; margin-top: 3px; font-family: monospace;">
                            ${codigoGrupo}
                        </div>
                    </div>

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

                    <div style="text-align: center;">
                        <span style="color: #999; font-size: 0.8rem;">Sin asignar</span>
                    </div>
                </div>
            `;
        });

        if (periodoActual !== null) {
            html += '</div>';
        }

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

        console.log('6. Insertando HTML en lista...');
        listaMaterias.innerHTML = resumenHtml + html;
        areaMaterias.style.display = 'block';
        console.log('7. Area de materias mostrada');

        document.querySelectorAll('.profesor-select').forEach(select => {
            select.addEventListener('change', function() {
                const indicador = this.parentElement.nextElementSibling;
                if (this.value) {
                    indicador.innerHTML = '<span style="color: #4caf50; font-weight: 600;">Asignado</span>';
                    this.style.borderColor = '#4caf50';
                } else {
                    indicador.innerHTML = '<span style="color: #999; font-size: 0.8rem;">Sin asignar</span>';
                    this.style.borderColor = '#ddd';
                }
            });
        });
        console.log('8. Listeners agregados a selectores');

    } catch (error) {
        console.error('ERROR en cargarMateriasPorTurno:', error);
        alert('Error al cargar materias: ' + error.message);
    }
}

async function guardarAsignacionesMasivas() {
    console.log('=== guardarAsignacionesMasivas INICIADA ===');
    
    const turnoSelect = document.getElementById('turnoMasivo');
    const turno = parseInt(turnoSelect.value);
    const turnoTexto = turnoSelect.options[turnoSelect.selectedIndex].text;
    const orden = document.getElementById('ordenMasivo').value.padStart(2, '0');

    if (!turno || !orden) {
        alert('Selecciona turno y orden primero');
        return;
    }

    const asignaciones = [];
    const selectores = document.querySelectorAll('.profesor-select');
    console.log('Selectores encontrados:', selectores.length);

    selectores.forEach((select, index) => {
        if (select.value) {
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
            console.log(`Asignacion ${index + 1}:`, select.dataset.materiaNombre, '->', profesorNombre);
        }
    });

    console.log('Total asignaciones a guardar:', asignaciones.length);

    if (asignaciones.length === 0) {
        alert('No hay asignaciones para guardar.\n\nSelecciona al menos un profesor.');
        return;
    }

    const confirmar = confirm(
        `Vas a crear ${asignaciones.length} asignaciones\n\n` +
        `Turno: ${turnoTexto}\n` +
        `Orden: ${orden}\n\n` +
        `Continuar?`
    );

    if (!confirmar) return;

    try {
        let exitosas = 0;
        let duplicadas = 0;
        let errores = 0;

        for (const asig of asignaciones) {
            try {
                const existente = await db.collection('profesorMaterias')
                    .where('materiaId', '==', asig.materiaId)
                    .where('codigoGrupo', '==', asig.codigoGrupo)
                    .where('activa', '==', true)
                    .get();

                if (!existente.empty) {
                    const batch = db.batch();
                    existente.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    duplicadas++;
                    console.log('Duplicado eliminado:', asig.materiaNombre);
                }

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
                console.log('Guardado exitoso:', asig.materiaNombre);

            } catch (error) {
                console.error(`Error en ${asig.materiaNombre}:`, error);
                errores++;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        let mensaje = `RESUMEN DE ASIGNACION MASIVA\n\n`;
        mensaje += `Exitosas: ${exitosas}\n`;
        if (duplicadas > 0) mensaje += `Reemplazadas: ${duplicadas}\n`;
        if (errores > 0) mensaje += `Errores: ${errores}\n`;
        mensaje += `\nTurno: ${turnoTexto}\n`;
        mensaje += `Orden: ${orden}`;

        console.log('=== PROCESO COMPLETADO ===');
        console.log(mensaje);
        alert(mensaje);

        cerrarModal();
        if (typeof cargarAsignaciones === 'function') {
            cargarAsignaciones();
        }

    } catch (error) {
        console.error('ERROR general:', error);
        alert('Error al guardar asignaciones: ' + error.message);
    }
}

console.log('*** registroMasivoAsignacion.js CARGADO CORRECTAMENTE ***');
console.log('Funciones disponibles:');
console.log('- mostrarFormAsignacionMasiva()');
console.log('- cargarMateriasPorTurno()');
console.log('- guardarAsignacionesMasivas()');




