// REGISTRO MASIVO DE MATERIAS - VERSION 2.0
// Con sincronizacion automatica de grupos paralelos (matutino, vespertino, nocturno)

console.log('=== CARGANDO REGISTRO MASIVO DE MATERIAS V2.0 ===');

// Funcion principal: Mostrar modal de captura masiva de materias
async function mostrarModalMateriasMasivas() {
  
  // Cargar grupos disponibles
  let gruposHTML = '<option value="">Seleccionar grupo...</option>';
  
  try {
    const gruposSnap = await db.collection('grupos')
      .where('carreraId', '==', usuarioActual.carreraId)
      .where('activo', '==', true)
      .get();
    
    const grupos = [];
    gruposSnap.forEach(doc => {
      grupos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar por semestre y turno
    grupos.sort((a, b) => {
      if (a.semestre !== b.semestre) return a.semestre - b.semestre;
      const turnoOrder = {'Matutino': 1, 'Vespertino': 2, 'Nocturno': 3};
      return (turnoOrder[a.turno] || 99) - (turnoOrder[b.turno] || 99);
    });
    
    grupos.forEach(grupo => {
      gruposHTML += `<option value="${grupo.id}">${grupo.nombre} - ${grupo.turno} (Semestre ${grupo.semestre})</option>`;
    });
    
  } catch (error) {
    console.error('Error al cargar grupos:', error);
  }
  
  const html = `
    <div id="modalMateriasMasivas" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; overflow-y: auto;">
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 1200px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #43a047;">
          <h2 style="margin: 0; color: #43a047; font-size: 1.8rem;">Carga Masiva de Materias</h2>
          <button onclick="cerrarModalMateriasMasivas()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
        </div>

        <form id="formMateriasMasivas" onsubmit="guardarMateriasMasivas(event)">

          <!-- SELECTOR DE GRUPO -->
          <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 1.2rem;">Selecciona el Grupo</h3>
            <select id="grupoMateriasMasivo" required 
                    style="width: 100%; padding: 12px; border: 2px solid #4caf50; border-radius: 8px; font-size: 1rem; background: white; font-weight: 600;">
              ${gruposHTML}
            </select>
            <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-top: 15px; border-left: 3px solid #ff9800;">
              <strong style="color: #856404; font-size: 0.95rem;">Sistema de Grupos Paralelos:</strong>
              <p style="margin: 8px 0 0 0; color: #856404; font-size: 0.85rem;">
                Si seleccionas un grupo (ejemplo: 1101-Matutino), las materias se registraran automaticamente en TODOS los turnos del mismo semestre:
              </p>
              <ul style="margin: 8px 0 0 20px; color: #856404; font-size: 0.85rem; line-height: 1.6;">
                <li>1101 (Matutino)</li>
                <li>2101 (Vespertino)</li>
                <li>3101 (Nocturno)</li>
              </ul>
              <p style="margin: 8px 0 0 0; color: #856404; font-size: 0.85rem;">
                <strong>Esto garantiza que todos los turnos tengan las mismas materias.</strong>
              </p>
            </div>
          </div>

          <!-- INSTRUCCIONES -->
          <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #1565c0; font-size: 1rem;">Instrucciones:</h3>
            <ol style="margin: 0; padding-left: 20px; color: #1565c0; line-height: 1.8; font-size: 0.9rem;">
              <li>Selecciona el grupo donde se registraran las materias</li>
              <li>Pega los datos de Excel/Sheets: cada materia en una linea</li>
              <li>Las columnas deben coincidir en numero de filas</li>
              <li>Creditos: por defecto es 6 (puedes dejarlo vacio o cambiarlo)</li>
              <li>Las materias se registraran automaticamente en todos los turnos (Matutino, Vespertino, Nocturno)</li>
              <li>Revisa la vista previa antes de guardar</li>
            </ol>
          </div>

          <!-- EJEMPLO -->
          <div style="background: #fff8e1; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 1rem;">Ejemplo de datos:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead style="background: #f5f5f5;">
                <tr>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Nombres de Materias</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Creditos (opcional)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">Calculo Diferencial</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">6</td>
                </tr>
                <tr style="background: #f9f9f9;">
                  <td style="padding: 8px; border: 1px solid #ddd;">Algebra Lineal</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">6</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">Programacion Estructurada</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">8</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- CAMPOS PARA PEGAR DATOS -->
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 20px;">
            
            <!-- NOMBRES DE MATERIAS -->
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Nombres de Materias *
              </label>
              <textarea id="nombresMateriasMasivo" required rows="15" 
                        placeholder="Calculo Diferencial&#10;Algebra Lineal&#10;Programacion Estructurada&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Una materia por linea</small>
            </div>

            <!-- CREDITOS -->
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Creditos (opcional)
              </label>
              <textarea id="creditosMateriasMasivo" rows="15" 
                        placeholder="6&#10;6&#10;8&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Por defecto: 6 creditos</small>
            </div>

          </div>

          <!-- AREA DE VISTA PREVIA -->
          <div id="vistaPreviaMaterias" style="display: none; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; max-height: 400px; overflow-y: auto;">
            <h3 style="margin-top: 0; color: #333; display: inline;">Vista Previa:</h3> 
            <span style="color: #666;">Revisa que este correcto</span>
            <div id="contenidoVistaPreviaMaterias"></div>
          </div>

          <!-- BOTONES DE ACCION -->
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" onclick="previsualizarMaterias()" 
                    style="padding: 12px 24px; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Vista Previa
            </button>
            <button type="submit" 
                    style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Guardar Todas
            </button>
            <button type="button" onclick="cerrarModalMateriasMasivas()" 
                    style="padding: 12px 24px; background: #e0e0e0; color: #333; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Cancelar
            </button>
          </div>

        </form>

        <!-- BARRA DE PROGRESO -->
        <div id="barraProgresoMaterias" style="display: none; margin-top: 20px;">
          <div style="background: #e0e0e0; border-radius: 10px; height: 30px; overflow: hidden;">
            <div id="barraProgresoMateriasFill" 
                 style="height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); width: 0%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.9rem;">
              0%
            </div>
          </div>
          <p id="textoProgresoMaterias" style="text-align: center; margin-top: 10px; color: #666;">
            Procesando...
          </p>
        </div>

      </div>
    </div>
  `;

  // Insertar en el body
  const modalExistente = document.getElementById('modalMateriasMasivas');
  if (modalExistente) {
    modalExistente.remove();
  }
  
  document.body.insertAdjacentHTML('beforeend', html);
}

// Funcion: Cerrar modal
function cerrarModalMateriasMasivas() {
  const modal = document.getElementById('modalMateriasMasivas');
  if (modal) {
    modal.remove();
  }
}

// NUEVA FUNCION: Obtener grupos paralelos
async function obtenerGruposParalelos(grupoId) {
  try {
    // Obtener datos del grupo seleccionado
    const grupoDoc = await db.collection('grupos').doc(grupoId).get();
    if (!grupoDoc.exists) {
      console.error('Grupo no encontrado');
      return [grupoId]; // Solo el grupo original
    }
    
    const grupoData = grupoDoc.data();
    const semestre = grupoData.semestre;
    const carreraId = grupoData.carreraId;
    
    console.log('Buscando grupos paralelos para semestre:', semestre, 'carrera:', carreraId);
    
    // Buscar TODOS los grupos del mismo semestre (sin importar el turno)
    const gruposParalelosSnap = await db.collection('grupos')
      .where('carreraId', '==', carreraId)
      .where('semestre', '==', semestre)
      .where('activo', '==', true)
      .get();
    
    const gruposParalelos = [];
    gruposParalelosSnap.forEach(doc => {
      gruposParalelos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log('Grupos paralelos encontrados:', gruposParalelos.length);
    gruposParalelos.forEach(g => {
      console.log('  -', g.nombre, g.turno);
    });
    
    return gruposParalelos.map(g => g.id);
    
  } catch (error) {
    console.error('Error al obtener grupos paralelos:', error);
    return [grupoId]; // Solo el grupo original si hay error
  }
}

// Funcion: Previsualizar datos
async function previsualizarMaterias() {
  const grupoId = document.getElementById('grupoMateriasMasivo').value;
  const nombresText = document.getElementById('nombresMateriasMasivo').value.trim();
  const creditosText = document.getElementById('creditosMateriasMasivo').value.trim();
  
  if (!grupoId) {
    alert('Debes seleccionar un grupo');
    return;
  }
  
  if (!nombresText) {
    alert('Debes ingresar al menos los nombres de las materias');
    return;
  }
  
  // Dividir en lineas
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const creditos = creditosText.split('\n').map(l => l.trim()).filter(l => l);
  
  // Si hay creditos, validar
  if (creditos.length > 0 && creditos.length !== nombres.length) {
    alert(`Error: Numero de materias (${nombres.length}) no coincide con numero de creditos (${creditos.length})`);
    return;
  }
  
  // Obtener grupos paralelos
  const gruposParalelos = await obtenerGruposParalelos(grupoId);
  
  // Obtener datos de los grupos para mostrar
  let infoGrupos = '';
  try {
    for (const gId of gruposParalelos) {
      const gDoc = await db.collection('grupos').doc(gId).get();
      if (gDoc.exists) {
        const gData = gDoc.data();
        infoGrupos += `<div style="display: inline-block; background: #e8f5e9; padding: 5px 10px; border-radius: 5px; margin: 3px; font-size: 0.85rem;">
          ${gData.nombre} - ${gData.turno}
        </div>`;
      }
    }
  } catch (error) {
    console.error('Error al obtener info de grupos:', error);
  }
  
  // Generar tabla de vista previa
  let html = `
    <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin: 15px 0; border-left: 3px solid #ff9800;">
      <strong style="color: #856404;">Las materias se registraran en los siguientes grupos:</strong>
      <div style="margin-top: 8px;">
        ${infoGrupos}
      </div>
      <p style="margin: 8px 0 0 0; color: #856404; font-size: 0.85rem;">
        Total de grupos: <strong>${gruposParalelos.length}</strong>
      </p>
    </div>
  `;
  
  html += '<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem;">';
  html += '<thead style="background: #43a047; color: white;">';
  html += '<tr>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">#</th>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Nombre Materia</th>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Creditos</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';
  
  nombres.forEach((nombre, i) => {
    const bgColor = i % 2 === 0 ? '#fff' : '#f9f9f9';
    const creditoVal = creditos[i] ? parseInt(creditos[i]) : 6;
    
    html += `<tr style="background: ${bgColor};">`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${i + 1}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd;"><strong>${nombre}</strong></td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${creditoVal}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody>';
  html += '</table>';
  
  html += `<p style="margin-top: 15px; color: #43a047; font-weight: 600;">
    Total de materias: ${nombres.length} x ${gruposParalelos.length} grupos = ${nombres.length * gruposParalelos.length} registros
  </p>`;
  
  document.getElementById('contenidoVistaPreviaMaterias').innerHTML = html;
  document.getElementById('vistaPreviaMaterias').style.display = 'block';
}

// Funcion: Guardar materias masivamente con sincronizacion
async function guardarMateriasMasivas(event) {
  event.preventDefault();
  
  const grupoId = document.getElementById('grupoMateriasMasivo').value;
  const nombresText = document.getElementById('nombresMateriasMasivo').value.trim();
  const creditosText = document.getElementById('creditosMateriasMasivo').value.trim();
  
  // Validaciones
  if (!grupoId) {
    alert('Debes seleccionar un grupo');
    return;
  }
  
  if (!nombresText) {
    alert('Debes completar al menos los Nombres de las materias');
    return;
  }
  
  // Dividir en lineas
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const creditos = creditosText.split('\n').map(l => l.trim()).filter(l => l);
  
  // Validar coincidencia
  if (creditos.length > 0 && creditos.length !== nombres.length) {
    alert(`Error: Si ingresas creditos, debe haber uno por cada materia`);
    return;
  }
  
  // Obtener grupos paralelos
  const gruposParalelos = await obtenerGruposParalelos(grupoId);
  
  // Confirmar
  const confirmar = confirm(
    `Vas a registrar ${nombres.length} materias en ${gruposParalelos.length} grupos\n\n` +
    `Total de registros: ${nombres.length * gruposParalelos.length}\n\n` +
    `Las materias se sincronizaran automaticamente en todos los turnos (Matutino, Vespertino, Nocturno)\n\n` +
    `Continuar?`
  );
  
  if (!confirmar) return;
  
  // Mostrar barra de progreso
  document.getElementById('barraProgresoMaterias').style.display = 'block';
  document.getElementById('formMateriasMasivas').style.display = 'none';
  
  const barra = document.getElementById('barraProgresoMateriasFill');
  const texto = document.getElementById('textoProgresoMaterias');
  
  let exitosos = 0;
  let errores = 0;
  let totalOperaciones = nombres.length * gruposParalelos.length;
  let operacionActual = 0;
  
  try {
    // Obtener semestre del grupo seleccionado
    const grupoDoc = await db.collection('grupos').doc(grupoId).get();
    const semestreGrupo = grupoDoc.exists ? grupoDoc.data().semestre : 1;
    
    for (let i = 0; i < nombres.length; i++) {
      const nombreMateria = nombres[i];
      const creditosMateria = creditos[i] ? parseInt(creditos[i]) : 6;
      
      // Generar codigo automatico
      const codigo = nombreMateria.substring(0, 3).toUpperCase() + '-' + semestreGrupo;
      
      // Registrar materia en TODOS los grupos paralelos
      for (const gId of gruposParalelos) {
        try {
          await db.collection('materias').add({
            nombre: nombreMateria,
            codigo: codigo,
            creditos: creditosMateria,
            semestre: semestreGrupo,
            grupoId: gId,
            carreraId: usuarioActual.carreraId || null,
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          exitosos++;
        } catch (error) {
          console.error(`Error al crear materia ${nombreMateria} en grupo ${gId}:`, error);
          errores++;
        }
        
        // Actualizar progreso
        operacionActual++;
        const progreso = Math.round((operacionActual / totalOperaciones) * 100);
        barra.style.width = progreso + '%';
        barra.textContent = progreso + '%';
        texto.textContent = `Procesando: ${operacionActual} de ${totalOperaciones}...`;
      }
    }
    
    // Finalizado
    barra.style.background = 'linear-gradient(90deg, #4caf50 0%, #2e7d32 100%)';
    texto.innerHTML = `
      <strong style="color: #4caf50;">Proceso completado</strong><br>
      Materias registradas: ${exitosos}<br>
      En ${gruposParalelos.length} grupos (sincronizados)<br>
      ${errores > 0 ? `Errores: ${errores}` : ''}
    `;
    
    // Esperar y cerrar
    setTimeout(() => {
      cerrarModalMateriasMasivas();
      if (typeof cargarMaterias === 'function') {
        cargarMaterias();
      }
      alert(`Carga masiva completada con sincronizacion\n\nRegistradas: ${exitosos}\nErrores: ${errores}\n\nLas materias estan disponibles en todos los turnos`);
    }, 2500);
    
  } catch (error) {
    console.error('Error general:', error);
    alert('Error al procesar materias: ' + error.message);
    document.getElementById('barraProgresoMaterias').style.display = 'none';
    document.getElementById('formMateriasMasivas').style.display = 'block';
  }
}

console.log('=== REGISTRO MASIVO DE MATERIAS V2.0 CARGADO ===');
console.log('Con sincronizacion automatica de grupos paralelos');