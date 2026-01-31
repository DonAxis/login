// REGISTRO MASIVO DE MATERIAS aqui todo bien 

console.log('=== CARGANDO REGISTRO MASIVO DE MATERIAS - CON CREDITOS LOCAL/EXTERNO ===');

async function mostrarModalMateriasMasivas() {
  
  let periodosHTML = '<option value="">Seleccionar periodo...</option>';
  
  try {
    const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
    
    if (carreraDoc.exists) {
      const numeroPeriodos = carreraDoc.data().numeroPeriodos || 8;
      
      for (let i = 1; i <= numeroPeriodos; i++) {
        periodosHTML += `<option value="${i}">Periodo ${i}</option>`;
      }
    }
    
  } catch (error) {
    console.error('Error al cargar periodos:', error);
  }
  
  const html = `
    <div id="modalMateriasMasivas" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; overflow-y: auto;">
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 1200px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #43a047;">
          <h2 style="margin: 0; color: #43a047; font-size: 1.8rem;">Carga Masiva de Materias</h2>
          <button onclick="cerrarModalMateriasMasivas()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
        </div>

        <form id="formMateriasMasivas" onsubmit="guardarMateriasMasivas(event)">

          <!-- INSTRUCCIONES -->
          <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #1565c0; font-size: 1rem;">Notas:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #1565c0; line-height: 1.8; font-size: 0.9rem;">
              <li>Las materias deben pertenecer al mismo periodo</li>
              <li>Pega los nombres de materias (uno por linea)</li>
              <li>Pega los creditos locales y externos (uno por linea cada columna)</li>
            </ul>

            <h3 style="margin: 15px 0 10px 0; color: #1565c0; font-size: 1rem;">Ejemplo:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead style="background: #f5f5f5;">
                <tr>
                  <th style="padding: 8px; border: 1px solid #000000; text-align: left;">Periodo</th>
                  <th style="padding: 8px; border: 1px solid #000000; text-align: left;">Nombres de Materias</th>
                  <th style="padding: 8px; border: 1px solid #000000; text-align: center;">Cred. Local</th>
                  <th style="padding: 8px; border: 1px solid #000000; text-align: center;">Cred. Externo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">2</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">Calculo Diferencial</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">6</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">0</td>
                </tr>
                <tr style="background: #f9f9f9;">
                  <td style="padding: 8px; border: 1px solid #ddd;">2</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">Algebra Lineal</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">5</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">1</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">2</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">Programacion Estructurada</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">4</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">4</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SELECTOR DE PERIODO -->
          <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 1.2rem;">Selecciona el Periodo</h3>
            <select id="periodoMateriasMasivo" required onchange="actualizarPreviewPeriodo()"
                    style="width: 100%; padding: 12px; border: 2px solid #4caf50; border-radius: 8px; font-size: 1rem; background: white; font-weight: 600;">
              ${periodosHTML}
            </select>
            <div id="infoGruposPeriodo" style="margin-top: 10px; color: #666; font-size: 0.9rem;"></div>
          </div>

          <!-- CAMPOS PARA PEGAR DATOS -->
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            
            <!-- NOMBRES DE MATERIAS -->
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Nombres de Materias *
              </label>
              <textarea id="nombresMateriasMasivo" required rows="15" 
                        placeholder="Calculo Diferencial&#10;Algebra Lineal&#10;Programacion Estructurada&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Una materia por renglon</small>
            </div>

            <!-- CREDITOS LOCAL -->
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Cred. Local *
              </label>
              <textarea id="creditosLocalMasivo" required rows="15" 
                        placeholder="6&#10;5&#10;4&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Acepta 0</small>
            </div>

            <!-- CREDITOS EXTERNO -->
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Cred. Externo *
              </label>
              <textarea id="creditosExternoMasivo" required rows="15" 
                        placeholder="0&#10;1&#10;4&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Acepta 0</small>
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
                 style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.9rem;">
              0%
            </div>
          </div>
          <p id="textoProgresoMaterias" style="text-align: center; margin-top: 10px; color: #666; font-size: 0.9rem;">
            Preparando...
          </p>
        </div>

      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

async function actualizarPreviewPeriodo() {
  const periodo = document.getElementById('periodoMateriasMasivo').value;
  const infoDiv = document.getElementById('infoGruposPeriodo');
  
  if (!periodo) {
    infoDiv.innerHTML = '';
    return;
  }
  
  try {
    const gruposDoc = await db.collection('grupos').doc(usuarioActual.carreraId).get();
    
    if (gruposDoc.exists) {
      const turnos = ['Matutino', 'Vespertino', 'Nocturno', 'Sabatino'];
      
      infoDiv.innerHTML = `
        <strong>Ingresa nombre de materia y creditos</strong>
  
      `;
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function cerrarModalMateriasMasivas() {
  const modal = document.getElementById('modalMateriasMasivas');
  if (modal) modal.remove();
}

async function previsualizarMaterias() {
  const periodo = parseInt(document.getElementById('periodoMateriasMasivo').value);
  const nombresText = document.getElementById('nombresMateriasMasivo').value.trim();
  const creditosLocalText = document.getElementById('creditosLocalMasivo').value.trim();
  const creditosExternoText = document.getElementById('creditosExternoMasivo').value.trim();
  
  if (!periodo) {
    alert('Selecciona un periodo');
    return;
  }
  
  if (!nombresText) {
    alert('Ingresa los nombres de las materias');
    return;
  }
  
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const creditosLocal = creditosLocalText.split('\n').map(l => l.trim()).filter(l => l);
  const creditosExterno = creditosExternoText.split('\n').map(l => l.trim()).filter(l => l);
  
  if (creditosLocal.length !== nombres.length) {
    alert('Error: Debe haber un credito local por cada materia');
    return;
  }
  
  if (creditosExterno.length !== nombres.length) {
    alert('Error: Debe haber un credito externo por cada materia');
    return;
  }
  
  try {
    const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
    const codigoCarrera = carreraDoc.data().codigo;
    
    const turnos = [
      { num: 1, nombre: 'Matutino' },
      { num: 2, nombre: 'Vespertino' },
      { num: 3, nombre: 'Nocturno' },
      { num: 4, nombre: 'Sabatino' }
    ];
    
    let html = `
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <strong style="color: #856404;">Cada materia se registrara en 4 grupos (uno por turno):</strong>
        <div style="margin-top: 8px; font-family: monospace; font-size: 0.85rem;">
          ${turnos.map(t => `${codigoCarrera}-${t.num}${periodo}00 (${t.nombre})`).join('<br>')}
        </div>
      </div>
    `;
    
    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem;">';
    html += '<thead style="background: #43a047; color: white;">';
    html += '<tr>';
    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">#</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Nombre Materia</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Cred. Local</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Cred. Externo</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Total</th>';
    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Periodo</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    nombres.forEach((nombre, i) => {
      const bgColor = i % 2 === 0 ? '#fff' : '#f9f9f9';
      const credLocal = parseInt(creditosLocal[i]) || 0;
      const credExterno = parseInt(creditosExterno[i]) || 0;
      const total = credLocal + credExterno;
      
      html += `<tr style="background: ${bgColor};">`;
      html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${i + 1}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #ddd;"><strong>${nombre}</strong></td>`;
      html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${credLocal}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${credExterno}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #43a047;">${total}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${periodo}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody>';
    html += '</table>';
    
    html += `<p style="margin-top: 15px; color: #43a047; font-weight: 600;">
      Total: ${nombres.length} materias x 4 turnos = ${nombres.length * 4} registros
    </p>`;
    
    document.getElementById('contenidoVistaPreviaMaterias').innerHTML = html;
    document.getElementById('vistaPreviaMaterias').style.display = 'block';
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al previsualizar: ' + error.message);
  }
}

async function guardarMateriasMasivas(event) {
  event.preventDefault();
  
  const periodo = parseInt(document.getElementById('periodoMateriasMasivo').value);
  const nombresText = document.getElementById('nombresMateriasMasivo').value.trim();
  const creditosLocalText = document.getElementById('creditosLocalMasivo').value.trim();
  const creditosExternoText = document.getElementById('creditosExternoMasivo').value.trim();
  
  if (!periodo || !nombresText) {
    alert('Completa todos los campos requeridos');
    return;
  }
  
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const creditosLocal = creditosLocalText.split('\n').map(l => l.trim()).filter(l => l);
  const creditosExterno = creditosExternoText.split('\n').map(l => l.trim()).filter(l => l);
  
  if (creditosLocal.length !== nombres.length || creditosExterno.length !== nombres.length) {
    alert('Error: Debe haber creditos local y externo para cada materia');
    return;
  }
  
  const confirmar = confirm(
    `Vas a registrar ${nombres.length} materias en el periodo ${periodo}\n\n` +
    `Cada materia se creara para 4 turnos\n\n` +
    `Total de registros: ${nombres.length}\n\n` +
    `Continuar?`
  );
  
  if (!confirmar) return;
  
  document.getElementById('barraProgresoMaterias').style.display = 'block';
  document.getElementById('formMateriasMasivas').style.display = 'none';
  
  const barra = document.getElementById('barraProgresoMateriasFill');
  const texto = document.getElementById('textoProgresoMaterias');
  
  let exitosos = 0;
  let errores = 0;
  
  try {
    const carreraDoc = await db.collection('carreras').doc(usuarioActual.carreraId).get();
    const codigoCarrera = carreraDoc.data().codigo;
    
    const gruposDoc = await db.collection('grupos').doc(usuarioActual.carreraId).get();
    if (!gruposDoc.exists) {
      throw new Error('No existe matriz de grupos para esta carrera');
    }
    
    const turnos = [
      { num: 1, nombre: 'Matutino' },
      { num: 2, nombre: 'Vespertino' },
      { num: 3, nombre: 'Nocturno' },
      { num: 4, nombre: 'Sabatino' }
    ];
    
    for (let i = 0; i < nombres.length; i++) {
      const nombreMateria = nombres[i];
      const credLocal = parseInt(creditosLocal[i]) || 0;
      const credExterno = parseInt(creditosExterno[i]) || 0;
      
      const codigosGenerados = [];
      const gruposEnlazados = [];
      
      turnos.forEach(turno => {
        const codigoGrupo = `${turno.num}${periodo}00`;
        const codigoCompleto = `${codigoCarrera}-${codigoGrupo}`;
        
        codigosGenerados.push(codigoCompleto);
        gruposEnlazados.push({
          codigo: codigoGrupo,
          codigoCompleto: codigoCompleto,
          turno: turno.num,
          nombreTurno: turno.nombre,
          periodo: periodo
        });
      });
      
      try {
        await db.collection('materias').add({
          nombre: nombreMateria,
          codigos: codigosGenerados,
          grupos: gruposEnlazados,
          periodo: periodo,
          creditosLocal: credLocal,
          creditosExterno: credExterno,
          creditosTotal: credLocal + credExterno,
          carreraId: usuarioActual.carreraId,
          codigoCarrera: codigoCarrera,
          activa: true,
          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
          fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        exitosos++;
      } catch (error) {
        console.error(`Error al crear materia ${nombreMateria}:`, error);
        errores++;
      }
      
      const progreso = Math.round(((i + 1) / nombres.length) * 100);
      barra.style.width = progreso + '%';
      barra.textContent = progreso + '%';
      texto.textContent = `Procesando: ${i + 1} de ${nombres.length}...`;
    }
    
    barra.style.background = 'linear-gradient(90deg, #4caf50 0%, #2e7d32 100%)';
    texto.innerHTML = `
      <strong style="color: #4caf50;">Proceso completado</strong><br>
      Materias registradas: ${exitosos}<br>
      ${errores > 0 ? `Errores: ${errores}` : ''}
    `;
    
    setTimeout(() => {
      cerrarModalMateriasMasivas();
      if (typeof cargarMaterias === 'function') {
        cargarMaterias();
      }
      alert(`Carga masiva completada\n\nRegistradas: ${exitosos}\nErrores: ${errores}`);
    }, 2500);
    
  } catch (error) {
    console.error('Error general:', error);
    alert('Error al procesar materias: ' + error.message);
    document.getElementById('barraProgresoMaterias').style.display = 'none';
    document.getElementById('formMateriasMasivas').style.display = 'block';
  }
}

console.log('=== REGISTRO MASIVO CON CREDITOS LOCAL/EXTERNO CARGADO ===');