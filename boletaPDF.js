// boletaPDF.js - ACTUALIZADO para alumnos especiales
// Genera PDF de boleta de calificaciones

async function generarPDFBoletaActual() {
  try {
    console.log('=== GENERANDO PDF BOLETA ===');
    
    if (!alumnoActual) {
      alert('No hay datos del alumno');
      return;
    }
    
    console.log('Alumno:', alumnoActual.nombre);
    console.log('Tipo:', alumnoActual.tipoAlumno);
    console.log('Grupo:', alumnoActual.grupoId);
    
    // Verificar jsPDF
    if (typeof window.jspdf === 'undefined') {
      alert('Error: jsPDF no esta cargado. Recarga la pagina.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // DETECTAR TIPO DE ALUMNO
    const esAlumnoEspecial = alumnoActual.tipoAlumno === 'especial';
    console.log('Es alumno especial:', esAlumnoEspecial);
    
    let materias = [];
    
    if (esAlumnoEspecial) {
      // ===== ALUMNO ESPECIAL =====
      console.log('Cargando materias de inscripciones especiales...');
      
      const inscripcionesSnap = await db.collection('inscripcionesEspeciales')
        .where('alumnoId', '==', alumnoActual.id)
        .where('activa', '==', true)
        .get();
      
      console.log('Inscripciones encontradas:', inscripcionesSnap.size);
      
      if (inscripcionesSnap.empty) {
        alert('No tienes materias inscritas');
        return;
      }
      
      // Procesar cada inscripcion
      for (const doc of inscripcionesSnap.docs) {
        const inscripcion = doc.data();
        
        console.log('Procesando materia:', inscripcion.materiaNombre);
        
        // Buscar calificaciones
        const docId = alumnoActual.id + '_' + inscripcion.materiaId;
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
          grupo: inscripcion.grupoNombre,  // IMPORTANTE: incluir grupo
          parcial1: parcial1,
          parcial2: parcial2,
          parcial3: parcial3
        });
      }
      
    } else {
      // ===== ALUMNO NORMAL =====
      console.log('Cargando materias del grupo:', alumnoActual.grupoId);
      
      if (!alumnoActual.grupoId) {
        alert('No estas asignado a ningun grupo');
        return;
      }
      
      const materiasSnap = await db.collection('profesorMaterias')
        .where('grupoId', '==', alumnoActual.grupoId)
        .where('activa', '==', true)
        .get();
      
      console.log('Materias del grupo encontradas:', materiasSnap.size);
      
      if (materiasSnap.empty) {
        alert('Tu grupo no tiene materias asignadas');
        return;
      }
      
      for (const doc of materiasSnap.docs) {
        const materia = doc.data();
        
        console.log('Procesando materia:', materia.materiaNombre);
        
        // Buscar calificaciones
        const docId = alumnoActual.id + '_' + materia.materiaId;
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
          codigo: materia.materiaCodigo || '',
          profesor: materia.profesorNombre,
          parcial1: parcial1,
          parcial2: parcial2,
          parcial3: parcial3
        });
      }
    }
    
    console.log('Total materias procesadas:', materias.length);
    
    if (materias.length === 0) {
      alert('No hay materias para generar el PDF');
      return;
    }
    
    // Ordenar materias alfabeticamente
    materias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Fecha actual
    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Agregar logos
    if (typeof logosEscuela !== 'undefined') {
      if (typeof agregarLogosAlPDF === 'function') {
        agregarLogosAlPDF(doc);
      } else if (typeof logosEscuela.agregarLogosAlPDF === 'function') {
        logosEscuela.agregarLogosAlPDF(doc);
      } else if (logosEscuela.logoIzquierdo || logosEscuela.logoDerecho) {
        try {
          if (logosEscuela.logoIzquierdo) {
            doc.addImage(logosEscuela.logoIzquierdo, 'PNG', 15, 8, 25, 15);
          }
        } catch (e) {
          console.log('Error logo izquierdo:', e);
        }
        
        try {
          if (logosEscuela.logoDerecho) {
            doc.addImage(logosEscuela.logoDerecho, 'PNG', pageWidth - 40, 8, 25, 15);
          }
        } catch (e) {
          console.log('Error logo derecho:', e);
        }
      }
    }
    
    // Encabezado
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('BOLETA DE CALIFICACIONES', pageWidth / 2, 25, { align: 'center' });
    
    // Linea separadora
    doc.setLineWidth(0.5);
    doc.line(20, 30, pageWidth - 20, 30);
    
    // Informacion del alumno
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    
    let y = 40;
    
    doc.text(`Fecha: ${fecha}`, pageWidth - 20, y, { align: 'right' });
    y += 7;
    doc.text(`Alumno: ${alumnoActual.nombre}`, 20, y);
    y += 7;
    doc.text(`Matricula: ${alumnoActual.matricula || 'N/A'}`, 20, y);
    y += 7;
    
    // Carrera
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
    
    // Grupo
    if (esAlumnoEspecial) {
      doc.setTextColor(255, 152, 0); // Naranja
      doc.setFont(undefined, 'bold');
      
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      y += 7;
    } else if (alumnoActual.grupoId) {
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
    
    y += 5;
    
    // Preparar datos de la tabla
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
      
      // Construir fila segun tipo de alumno
      if (esAlumnoEspecial) {
        // Alumno especial: incluir columna de grupo
        tableData.push([
          materia.nombre,
          materia.grupo,  // Columna extra
          p1.toString(),
          p2.toString(),
          p3.toString(),
          promedio
        ]);
      } else {
        // Alumno normal: sin columna de grupo
        tableData.push([
          materia.nombre,
          p1.toString(),
          p2.toString(),
          p3.toString(),
          promedio
        ]);
      }
    });
    
    // Promedio general
    const promedioGeneral = countPromedios > 0 
      ? (sumaPromedios / countPromedios).toFixed(1) 
      : '-';
    
    // Configuracion de columnas segun tipo de alumno
    let headConfig, columnConfig;
    
    if (esAlumnoEspecial) {
      headConfig = [['Materia', 'Grupo', 'P1', 'P2', 'P3', 'Promedio']];
      columnConfig = {
        0: { halign: 'left', cellWidth: 70 },
        1: { halign: 'center', cellWidth: 30 },  // Columna grupo
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 26, fontStyle: 'bold' }
      };
    } else {
      headConfig = [['Materia', 'P1', 'P2', 'P3', 'Promedio']];
      columnConfig = {
        0: { halign: 'left', cellWidth: 90 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 30, fontStyle: 'bold' }
      };
    }
    
    // Generar tabla
    doc.autoTable({
      startY: y,
      head: headConfig,
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [106, 33, 53], // Color IPN
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 10
      },
      styles: {
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: columnConfig
    });
    
    // Promedio general
    y = doc.lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`PROMEDIO GENERAL: ${promedioGeneral}`, pageWidth / 2, y, { align: 'center' });
    
    // Pie de pagina
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
    console.error('Stack trace:', error.stack);
    alert('Error al generar PDF: ' + error.message);
  }
}

console.log('boletaPDF.js cargado - soporte para alumnos especiales ACTIVADO');