// =============================================================================
// boletaPDF.js
// Genera la BOLETA DE CALIFICACIONES del periodo actual de un alumno.
// Muestra sus materias con las calificaciones de los 3 parciales y el promedio.
// Soporta tanto alumnos normales (carga desde profesorMaterias por grupoId)
// como alumnos especiales (carga desde inscripcionesEspeciales).
// El PDF se descarga directamente en el navegador.
// Requiere: jsPDF, jsPDF-AutoTable, Firebase Firestore (db), alumnoActual
// =============================================================================

async function generarPDFBoletaActual() {
  if (!alumnoActual || !alumnoActual.id) {
    alert('No hay datos de alumno cargados');
    return;
  }
  
  try {
    console.log('=== GENERANDO PDF BOLETA ===');
    console.log('Alumno:', alumnoActual.nombre);
    console.log('Tipo:', alumnoActual.tipoAlumno);
    
    // Verificar que jsPDF esté cargado
    if (typeof window.jspdf === 'undefined') {
      alert('Error: jsPDF no está cargado. Recarga la página.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ format: 'letter' });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // DETECTAR TIPO DE ALUMNO (sin cambiar visualización)
    const esAlumnoEspecial = alumnoActual.tipoAlumno === 'especial';
    console.log('Es alumno especial:', esAlumnoEspecial);
    
    let materias = [];

    // Si los datos ya están en memoria desde la vista actual, no releer Firestore
    if (typeof materiasCache !== 'undefined' && materiasCache && materiasCache.length > 0) {
      materias = materiasCache;
    } else if (esAlumnoEspecial) {
      // ===== ALUMNO ESPECIAL: Cargar desde inscripcionesEspeciales =====
      console.log('Cargando materias de inscripciones especiales...');
      
      const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
        .where('alumnoId', '==', alumnoActual.id)
        .where('activa', '==', true)
        .get();
      
      console.log('Inscripciones encontradas:', inscripcionesSnap.size);
      
      if (inscripcionesSnap.empty) {
        alert('No hay materias para generar el PDF');
        return;
      }
      
      // Procesar cada inscripcion
      for (const doc of inscripcionesSnap.docs) {
        const inscripcion = doc.data();
        
        console.log('Procesando materia:', inscripcion.materiaNombre);
        
        // Buscar calificaciones
        const docId = `${alumnoActual.id}_${inscripcion.materiaId}`;
        const calDoc = await db.collection('calificaciones').doc(docId).get();
        
        let parcial1 = '-';
        let parcial2 = '-';
        let parcial3 = '-';
        
        if (calDoc.exists) {
          const data = calDoc.data();
          parcial1 = data.parciales?.parcial1 ?? '-';
          parcial2 = data.parciales?.parcial2 ?? '-';
          parcial3 = data.parciales?.parcial3 ?? '-';
        }
        
        materias.push({
          nombre: inscripcion.materiaNombre,
          codigo: inscripcion.materiaCodigo || '',
          profesor: inscripcion.profesorNombre || 'Sin asignar',
          periodo: inscripcion.periodo,
          parcial1: parcial1,
          parcial2: parcial2,
          parcial3: parcial3
        });
      }
      
    } else {
      // ===== ALUMNO NORMAL: Cargar desde profesorMaterias =====
      // 2713 CORREGIDO: codigoGrupo es el campo real (index.html usa codigoGrupo, no grupoId)
      const grupoRef = alumnoActual.codigoGrupo || alumnoActual.grupoId;
      if (!grupoRef) { alert('No se encontr00f3 el grupo del alumno.'); return; }
      console.log('Cargando materias del grupo:', grupoRef);
      
      const materiasSnap = await db.collection('profesorMaterias')
        .where('codigoGrupo', '==', grupoRef)
        .where('activa', '==', true)
        .get();
      
      console.log('Materias del grupo encontradas:', materiasSnap.size);
      
      if (materiasSnap.empty) {
        alert('No hay materias para generar el PDF');
        return;
      }
      
      // Procesar cada materia
      for (const doc of materiasSnap.docs) {
        const materia = doc.data();
        
        console.log('Procesando materia:', materia.materiaNombre);
        
        // Buscar calificaciones
        const docId = `${alumnoActual.id}_${materia.materiaId}`;
        const calDoc = await db.collection('calificaciones').doc(docId).get();
        
        let parcial1 = '-';
        let parcial2 = '-';
        let parcial3 = '-';
        
        if (calDoc.exists) {
          const data = calDoc.data();
          parcial1 = data.parciales?.parcial1 ?? '-';
          parcial2 = data.parciales?.parcial2 ?? '-';
          parcial3 = data.parciales?.parcial3 ?? '-';
        }
        
        materias.push({
          nombre: materia.materiaNombre,
          codigo: materia.materiaCodigo,
          profesor: materia.profesorNombre,
          periodo: materia.periodo,
          parcial1: parcial1,
          parcial2: parcial2,
          parcial3: parcial3
        });
      }
    }
    
    console.log('Total materias cargadas:', materias.length);

    if (materias.length === 0) {
      alert('No hay materias para generar el PDF');
      return;
    }

    // Determinar si la carrera usa examen final
    const tieneExamenFinalCarrera = alumnoActual.carreraId
      ? await obtenerTieneExamenFinal(alumnoActual.carreraId)
      : false;
    
    // Agregar logos
    if (typeof agregarLogosAlPDF === 'function') {
      agregarLogosAlPDF(doc, tieneExamenFinalCarrera);
    }
    
    // Título
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('BOLETA DE CALIFICACIONES', pageWidth / 2, 25, { align: 'center' });
    
    // Línea separadora
    doc.setLineWidth(0.5);
    doc.line(30, 40, pageWidth - 30, 40);
    
    // Información del alumno
    let y = 50;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    
    // Fecha
    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Fecha: ${fecha}`, pageWidth - 20, y, { align: 'right' });
    y += 7;
    
    doc.text(`Alumno: ${alumnoActual.nombre}`, 20, y);
    y += 7;
    
    if (alumnoActual.matricula) {
      doc.text(`Matrícula: ${alumnoActual.matricula}`, 20, y);
      y += 7;
    }
    
    // Cargar grupo
    // CORREGIDO: soporta grupoId (doc ID en Firestore) o codigoGrupo (campo texto)
    if (alumnoActual.grupoId) {
      try {
        const grupoDoc = await db.collection('grupos').doc(alumnoActual.grupoId).get();
        if (grupoDoc.exists) {
          doc.text(`Grupo: ${grupoDoc.data().nombre}`, 20, y);
          y += 7;
        }
      } catch (error) {
        console.error('Error al cargar grupo:', error);
      }
    } else if (alumnoActual.codigoGrupo) {
      doc.text(`Grupo: ${alumnoActual.codigoGrupo}`, 20, y);
      y += 7;
    }
    
    // Cargar carrera
    if (alumnoActual.carreraId) {
      try {
        const nombreCarrera = (typeof carreraNombreCache !== 'undefined' && carreraNombreCache)
          ? carreraNombreCache
          : (await db.collection('carreras').doc(alumnoActual.carreraId).get()).data()?.nombre;
        if (nombreCarrera) {
          doc.text(`Carrera: ${nombreCarrera}`, 20, y);
          y += 7;
        }
      } catch (error) {
        console.error('Error al cargar carrera:', error);
      }
    }
    
    // Periodo (obtener del primer materia)
    if (materias.length > 0 && materias[0].periodo) {
      doc.text(`Periodo: ${materias[0].periodo}`, 20, y);
      y += 7;
    }
    
    y += 5;
    
    // Preparar datos para la tabla
    const tableData = [];
    let sumaCalificaciones = 0;
    let countCalificaciones = 0;

    materias.forEach(materia => {
      const p1Raw = materia.parcial1;
      const p2Raw = materia.parcial2;
      const p3Raw = materia.parcial3;

      // Normalizar: '-' equivale a null para el cálculo
      const p1 = (p1Raw === '-' || p1Raw === '' || p1Raw === undefined) ? null : p1Raw;
      const p2 = (p2Raw === '-' || p2Raw === '' || p2Raw === undefined) ? null : p2Raw;
      const p3 = (p3Raw === '-' || p3Raw === '' || p3Raw === undefined) ? null : p3Raw;

      // Calcular calificación usando la función centralizada
      const calNum = calcularCalificacion(
        typeof p1 === 'string' && p1 !== 'NP' ? parseFloat(p1) : p1,
        typeof p2 === 'string' && p2 !== 'NP' ? parseFloat(p2) : p2,
        typeof p3 === 'string' && p3 !== 'NP' ? parseFloat(p3) : p3,
        tieneExamenFinalCarrera
      );

      let calTexto = '-';
      if (calNum === 'NP') {
        calTexto = 'NP';
        sumaCalificaciones += 5.0;
        countCalificaciones++;
      } else if (calNum !== null) {
        calTexto = calNum.toFixed(1);
        sumaCalificaciones += calNum;
        countCalificaciones++;
      }

      const p1Txt = p1Raw !== null && p1Raw !== undefined ? p1Raw.toString() : '-';
      const p2Txt = p2Raw !== null && p2Raw !== undefined ? p2Raw.toString() : '-';
      const p3Txt = p3Raw !== null && p3Raw !== undefined ? p3Raw.toString() : '-';

      if (tieneExamenFinalCarrera) {
        tableData.push([
          `${materia.nombre}\n${materia.profesor}`,
          p1Txt, p2Txt, p3Txt, calTexto
        ]);
      } else {
        tableData.push([
          `${materia.nombre}\n${materia.profesor}`,
          p1Txt, p2Txt, p3Txt, calTexto
        ]);
      }
    });

    // Encabezado de columnas según tipo de carrera
    const colHeaders = tieneExamenFinalCarrera
      ? ['Materia / Profesor', 'P1', 'P2', 'Examen Final', 'Calificación']
      : ['Materia / Profesor', 'P1', 'P2', 'P3', 'Calificación'];

    // Generar tabla
    doc.autoTable({
      startY: y,
      head: [colHeaders],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [106, 33, 53],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 10
      },
      styles: {
        fontSize: 9,
        cellPadding: 2
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 90 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 30, fontStyle: 'bold' }
      }
    });

    // Calificación general
    y = doc.lastAutoTable.finalY + 10;
    const promedioGeneral = countCalificaciones > 0
      ? (sumaCalificaciones / countCalificaciones).toFixed(1)
      : '-';

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Calificación General: ${promedioGeneral}`, 20, y);
    
    // Mensaje de no validez
    y = pageHeight - 25;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 200); // azul
    doc.text(
      'Este documento no tiene validez oficial, no contiene sellos originales,\nfirmas autógrafas o firmas electrónicas, se emite para fines informativos',
      pageWidth / 2,
      y,
      { align: 'center' }
    );
    
    // Pie de página
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(128);
    doc.text(
      `Generado el ${fecha}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    
    // Nombre del archivo
    const nombreArchivo = `Boleta_${alumnoActual.nombre.replace(/\s+/g, '_')}.pdf`;
    
    // Descargar
    doc.save(nombreArchivo);
    
    console.log('PDF generado exitosamente:', nombreArchivo);
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Error al generar PDF: ' + error.message);
  }
}

console.log('Función generarPDFBoletaActual cargada - soporte alumnos especiales SIN cambios visuales');