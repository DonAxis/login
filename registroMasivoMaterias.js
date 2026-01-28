// ADDON: Captura Masiva de Materias
// Agregar este codigo al archivo coordinador.js o incluirlo como script separado

console.log('=== CARGANDO ADDON: CAPTURA MASIVA DE MATERIAS ===');

// Funcion principal: Mostrar modal de captura masiva de materias
function mostrarModalMateriasMasivas() {
  const html = `
    <div id="modalMateriasMasivas" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 2000; align-items: center; justify-content: center; overflow-y: auto;">
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 1400px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #43a047;">
          <h2 style="margin: 0; color: #43a047; font-size: 1.8rem;">Captura Masiva de Materias</h2>
          <button onclick="cerrarModalMateriasMasivas()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; line-height: 1;">&times;</button>
        </div>

        <form id="formMateriasMasivas" onsubmit="guardarMateriasMasivas(event)">

          <!-- INSTRUCCIONES -->
          <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 1.1rem;">Instrucciones:</h3>
            <ol style="margin: 0; padding-left: 20px; color: #2e7d32; line-height: 1.8;">
              <li><strong>Solo registrar materias por grupo</strong> - No agregues grupos en esta captura</li>
              <li>Pega los datos de Excel/Sheets: cada materia en una linea</li>
              <li>Las columnas deben coincidir en numero de filas</li>
              <li>Creditos: por defecto es 6 (puedes dejarlo vacio o cambiarlo)</li>
              <li>Semestre: indica a que semestre pertenece la materia (1-12)</li>
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
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Semestre</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">Calculo Diferencial</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">6</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">1</td>
                </tr>
                <tr style="background: #f9f9f9;">
                  <td style="padding: 8px; border: 1px solid #ddd;">Algebra Lineal</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">6</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">1</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">Programacion Estructurada</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">8</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">1</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- MENSAJE IMPORTANTE -->
          <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: #856404; font-size: 1rem;">Solo registrar materias por grupo</strong>
            <p style="margin: 5px 0 0 0; color: #856404; font-size: 0.9rem;">
              Las materias se registran sin asignar grupos. Los grupos se asignaran despues mediante la gestion de materias individual.
            </p>
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

            <!-- SEMESTRE -->
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 8px; color: #333;">
                Semestre *
              </label>
              <textarea id="semestresMateriasMasivo" required rows="15" 
                        placeholder="1&#10;1&#10;1&#10;..."
                        style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-family: monospace; font-size: 0.9rem; resize: vertical;"></textarea>
              <small style="color: #666; font-size: 0.8rem;">Numero del semestre (1-12)</small>
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

// Funcion: Previsualizar datos
function previsualizarMaterias() {
  const nombresText = document.getElementById('nombresMateriasMasivo').value.trim();
  const creditosText = document.getElementById('creditosMateriasMasivo').value.trim();
  const semestresText = document.getElementById('semestresMateriasMasivo').value.trim();
  
  if (!nombresText) {
    alert('Debes ingresar al menos los nombres de las materias');
    return;
  }
  
  if (!semestresText) {
    alert('Debes ingresar el semestre de cada materia');
    return;
  }
  
  // Dividir en lineas
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const creditos = creditosText.split('\n').map(l => l.trim()).filter(l => l);
  const semestres = semestresText.split('\n').map(l => l.trim()).filter(l => l);
  
  // Validar que coincidan
  if (semestres.length !== nombres.length) {
    alert(`Error: Numero de materias (${nombres.length}) no coincide con numero de semestres (${semestres.length})`);
    return;
  }
  
  // Si hay creditos, validar
  if (creditos.length > 0 && creditos.length !== nombres.length) {
    alert(`Error: Numero de materias (${nombres.length}) no coincide con numero de creditos (${creditos.length})`);
    return;
  }
  
  // Generar tabla de vista previa
  let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem;">';
  html += '<thead style="background: #43a047; color: white;">';
  html += '<tr>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">#</th>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Nombre Materia</th>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Creditos</th>';
  html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Semestre</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';
  
  nombres.forEach((nombre, i) => {
    const bgColor = i % 2 === 0 ? '#fff' : '#f9f9f9';
    const creditoVal = creditos[i] ? parseInt(creditos[i]) : 6; // Default 6
    const semestreVal = semestres[i] ? parseInt(semestres[i]) : 1;
    
    html += `<tr style="background: ${bgColor};">`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${i + 1}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd;"><strong>${nombre}</strong></td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${creditoVal}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #43a047;">${semestreVal}</td>`;
    html += '</tr>';
  });
  
  html += '</tbody>';
  html += '</table>';
  
  html += `<p style="margin-top: 15px; color: #43a047; font-weight: 600;">Total de materias a registrar: ${nombres.length}</p>`;
  
  document.getElementById('contenidoVistaPreviaMaterias').innerHTML = html;
  document.getElementById('vistaPreviaMaterias').style.display = 'block';
}

// Funcion: Guardar materias masivamente
async function guardarMateriasMasivas(event) {
  event.preventDefault();
  
  const nombresText = document.getElementById('nombresMateriasMasivo').value.trim();
  const creditosText = document.getElementById('creditosMateriasMasivo').value.trim();
  const semestresText = document.getElementById('semestresMateriasMasivo').value.trim();
  
  // Validaciones
  if (!nombresText || !semestresText) {
    alert('Debes completar al menos Nombres y Semestres');
    return;
  }
  
  // Dividir en lineas
  const nombres = nombresText.split('\n').map(l => l.trim()).filter(l => l);
  const creditos = creditosText.split('\n').map(l => l.trim()).filter(l => l);
  const semestres = semestresText.split('\n').map(l => l.trim()).filter(l => l);
  
  // Validar coincidencia
  if (semestres.length !== nombres.length) {
    alert(`Error: Numero de materias (${nombres.length}) no coincide con numero de semestres (${semestres.length})`);
    return;
  }
  
  if (creditos.length > 0 && creditos.length !== nombres.length) {
    alert(`Error: Si ingresas creditos, debe haber uno por cada materia`);
    return;
  }
  
  // Confirmar
  const confirmar = confirm(
    `Vas a registrar ${nombres.length} materias\n\n` +
    `Carrera: ${carreraActual.nombre || 'Sin carrera'}\n\n` +
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
  
  try {
    for (let i = 0; i < nombres.length; i++) {
      const nombreMateria = nombres[i];
      const creditosMateria = creditos[i] ? parseInt(creditos[i]) : 6;
      const semestreMateria = semestres[i] ? parseInt(semestres[i]) : 1;
      
      // Generar codigo automatico
      const codigo = nombreMateria.substring(0, 3).toUpperCase() + '-' + semestreMateria;
      
      try {
        // Crear materia en Firestore
        await db.collection('materias').add({
          nombre: nombreMateria,
          codigo: codigo,
          creditos: creditosMateria,
          semestre: semestreMateria,
          carreraId: usuarioActual.carreraId || null,
          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
          fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        exitosos++;
      } catch (error) {
        console.error(`Error al crear materia ${nombreMateria}:`, error);
        errores++;
      }
      
      // Actualizar progreso
      const progreso = Math.round(((i + 1) / nombres.length) * 100);
      barra.style.width = progreso + '%';
      barra.textContent = progreso + '%';
      texto.textContent = `Procesando materia ${i + 1} de ${nombres.length}...`;
    }
    
    // Finalizado
    barra.style.background = 'linear-gradient(90deg, #4caf50 0%, #2e7d32 100%)';
    texto.innerHTML = `
      <strong style="color: #4caf50;">Proceso completado</strong><br>
      Materias registradas: ${exitosos}<br>
      ${errores > 0 ? `Errores: ${errores}` : ''}
    `;
    
    // Esperar y cerrar
    setTimeout(() => {
      cerrarModalMateriasMasivas();
      if (typeof cargarMaterias === 'function') {
        cargarMaterias(); // Recargar la lista de materias
      }
      alert(`Captura masiva completada\n\nRegistradas: ${exitosos}\nErrores: ${errores}`);
    }, 2000);
    
  } catch (error) {
    console.error('Error general:', error);
    alert('Error al procesar materias: ' + error.message);
    document.getElementById('barraProgresoMaterias').style.display = 'none';
    document.getElementById('formMateriasMasivas').style.display = 'block';
  }
}

console.log('=== ADDON CAPTURA MASIVA DE MATERIAS CARGADO ===');
console.log('Uso: Llama a mostrarModalMateriasMasivas() desde tu interfaz');