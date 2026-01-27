// boletaPDF.js - Función para generar PDF de la boleta actual
// SOPORTA alumnos especiales SIN cambiar el formato visual

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
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // DETECTAR TIPO DE ALUMNO (sin cambiar visualización)
    const esAlumnoEspecial = alumnoActual.tipoAlumno === 'especial';
    console.log('Es alumno especial:', esAlumnoEspecial);
    
    let materias = [];
    
    // Obtener materias según tipo de alumno
    if (esAlumnoEspecial) {
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
      console.log('Cargando materias del grupo:', alumnoActual.grupoId);
      
      const materiasSnap = await db.collection('profesorMaterias')
        .where('grupoId', '==', alumnoActual.grupoId)
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
    
    // Agregar logos si existen
    if (typeof logosEscuela !== 'undefined') {
      try {
        if (logosEscuela.logoIzquierdo) {
          doc.addImage(logosEscuela.logoIzquierdo, 'PNG', 15, 8, 25, 25);
        }
      } catch (e) {
        console.log('Error al cargar logo izquierdo:', e);
      }
      
      try {
        if (logosEscuela.logoDerecho) {
          doc.addImage(logosEscuela.logoDerecho, 'PNG', pageWidth - 40, 8, 25, 15);
        }
      } catch (e) {
        console.log('Error al cargar logo derecho:', e);
      }
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
    }
    
    // Cargar carrera
    if (alumnoActual.carreraId) {
      try {
        const carreraDoc = await db.collection('carreras').doc(alumnoActual.carreraId).get();
        if (carreraDoc.exists) {
          doc.text(`Carrera: ${carreraDoc.data().nombre}`, 20, y);
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
    let sumaPromedios = 0;
    let countPromedios = 0;
    
    materias.forEach(materia => {
      const p1 = materia.parcial1;
      const p2 = materia.parcial2;
      const p3 = materia.parcial3;
      
      // Calcular promedio
      let promedio = '-';
      const tieneNP = p1 === 'NP' || p2 === 'NP' || p3 === 'NP';
      
      if (tieneNP) {
        promedio = '5.0';
        sumaPromedios += 5.0;
        countPromedios++;
      } else {
        const cals = [p1, p2, p3]
          .filter(c => c !== '-' && c !== null && c !== undefined && c !== '')
          .map(c => parseFloat(c))
          .filter(c => !isNaN(c));
        
        if (cals.length > 0) {
          const prom = cals.reduce((a, b) => a + b, 0) / cals.length;
          promedio = prom.toFixed(1);
          sumaPromedios += prom;
          countPromedios++;
        }
      }
      
      tableData.push([
        `${materia.nombre}\n${materia.profesor}`,
        p1.toString(),
        p2.toString(),
        p3.toString(),
        promedio
      ]);
    });
    
    // Generar tabla (MISMO FORMATO para ambos tipos)
    doc.autoTable({
      startY: y,
      head: [['Materia / Profesor', 'P1', 'P2', 'P3', 'Promedio']],
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
        cellPadding: 4
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 90 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 30, fontStyle: 'bold' }
      }
    });
    
    // Promedio general
    y = doc.lastAutoTable.finalY + 10;
    const promedioGeneral = countPromedios > 0 
      ? (sumaPromedios / countPromedios).toFixed(1) 
      : '-';
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Promedio General: ${promedioGeneral}`, 20, y);
    
    // Mensaje de no validez
    y = pageHeight - 25;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(200, 0, 0); // Rojo
    doc.text(
      'ESTE DOCUMENTO NO TIENE VALIDEZ OFICIAL Y NO CONTIENE LAS FIRMAS Y SELLOS NECESARIOS',
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