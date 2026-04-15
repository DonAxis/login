// =============================================================================
// Historial académico de un alumno (para coordinador)
// Genera el HISTORIAL ACADÉMICO de un alumno, para uso del coordinador.

// Requiere: jsPDF, jsPDF-AutoTable, Firebase Firestore (db)
// Parámetros: alumnoId (string), nombreAlumno (string)
// =============================================================================

async function descargarHistorialAlumnoPDF(alumnoId, nombreAlumno) {
  try {
    // Verificar que jsPDF este cargado
    if (typeof window.jspdf === 'undefined') {
      alert('Error: jsPDF no esta cargado. Recarga la pagina.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Obtener calificaciones del alumno
    console.log('Buscando calificaciones para alumno:', alumnoId);
    const calificaciones = await db.collection('calificaciones')
      .where('alumnoId', '==', alumnoId)
      .get();
    
    if (calificaciones.empty) {
      alert('Este alumno no tiene calificaciones registradas');
      return;
    }
    
    console.log('Calificaciones encontradas:', calificaciones.size);
    
    // Construir mapa de materias con cache
    const materiasMapPDF = {}; // Nombre unico para evitar conflictos
    const materiasCachePDF = {};
    
    for (const calDoc of calificaciones.docs) {
      const cal = calDoc.data();
      const key = `${cal.materiaId}_${cal.periodo}`;
      
      let materiaNombre = cal.materiaNombre || 'Sin nombre';
      let materiaCodigo = cal.materiaCodigo || '';
      
      // Si no tiene nombre, buscarlo en la coleccion materias
      if (!cal.materiaNombre && cal.materiaId) {
        if (!materiasCachePDF[cal.materiaId]) {
          try {
            const materiaDoc = await db.collection('materias').doc(cal.materiaId).get();
            if (materiaDoc.exists) {
              materiasCachePDF[cal.materiaId] = materiaDoc.data();
              console.log('Materia cargada:', cal.materiaId, materiasCachePDF[cal.materiaId]);
            }
          } catch (error) {
            console.error('Error al cargar materia:', error);
          }
        }
        
        if (materiasCachePDF[cal.materiaId]) {
          materiaNombre = materiasCachePDF[cal.materiaId].nombre;
          materiaCodigo = materiasCachePDF[cal.materiaId].codigo || '';
        }
      }
      
      materiasMapPDF[key] = {
        materiaNombre: materiaNombre,
        materiaCodigo: materiaCodigo,
        periodo: cal.periodo || 'N/A',
        parcial1: cal.parciales?.parcial1 ?? '-',
        parcial2: cal.parciales?.parcial2 ?? '-',
        parcial3: cal.parciales?.parcial3 ?? '-'
      };
    }
    
    console.log('Materias procesadas:', Object.keys(materiasMapPDF).length);
    
    // Verificar que hay materias
    if (Object.keys(materiasMapPDF).length === 0) {
      alert('No se pudieron procesar las calificaciones');
      return;
    }
    
    // Fecha actual
    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Agregar logos si existe la funcion
    if (typeof logosEscuela !== 'undefined' && typeof logosEscuela.agregarLogosAlPDF === 'function') {
      logosEscuela.agregarLogosAlPDF(doc);
    }
    
    // Encabezado
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('HISTORIAL ACADEMICO', pageWidth / 2, 25, { align: 'center' });
    
    // Linea separadora
    doc.setLineWidth(0.5);
    doc.line(20, 30, pageWidth - 20, 30);
    
    // Informacion del alumno
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    
    let y = 40;
    let tieneExamenFinalCoor = false;

    doc.text(`Fecha: ${fecha}`, pageWidth - 20, y, { align: 'right' });
    y += 7;
    doc.text(`Alumno: ${nombreAlumno}`, 20, y);
    y += 7;

    // Cargar datos adicionales del alumno
    try {
      const alumnoDoc = await db.collection('usuarios').doc(alumnoId).get();
      if (alumnoDoc.exists) {
        const alumno = alumnoDoc.data();

        if (alumno.matricula) {
          doc.text(`Matricula: ${alumno.matricula}`, 20, y);
          y += 7;
        }

        if (alumno.carreraId) {
          try {
            const carreraDoc = await db.collection('carreras').doc(alumno.carreraId).get();
            if (carreraDoc.exists) {
              doc.text(`Carrera: ${carreraDoc.data().nombre}`, 20, y);
              y += 7;
              tieneExamenFinalCoor = carreraDoc.data().tieneExamenFinal === true;
            }
          } catch (error) {
            console.error('Error al cargar carrera:', error);
          }
        }

        if (alumno.grupoId) {
          try {
            const grupoDoc = await db.collection('grupos').doc(alumno.grupoId).get();
            if (grupoDoc.exists) {
              doc.text(`Grupo: ${grupoDoc.data().nombre}`, 20, y);
              y += 7;
            }
          } catch (error) {
            console.error('Error al cargar grupo:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del alumno:', error);
    }
    
    y += 5;
    
    // Agrupar materias por periodo
    const periodosPDF = {};
    
    const materiasArray = Object.values(materiasMapPDF);
    console.log('Materias a procesar:', materiasArray.length);
    
    materiasArray.forEach(materia => {
      const periodo = materia.periodo || 'N/A';
      if (!periodosPDF[periodo]) {
        periodosPDF[periodo] = [];
      }
      periodosPDF[periodo].push(materia);
    });
    
    // Ordenar periodos
    const periodosOrdenados = Object.keys(periodosPDF).sort().reverse();
    console.log('Periodos encontrados:', periodosOrdenados);
    
    if (periodosOrdenados.length === 0) {
      alert('No se encontraron periodos para generar el PDF');
      return;
    }
    
    // Generar tabla por cada periodo
    for (let i = 0; i < periodosOrdenados.length; i++) {
      const periodo = periodosOrdenados[i];
      const materias = periodosPDF[periodo];
      
      console.log(`Procesando periodo ${periodo}: ${materias.length} materias`);
      
      // Verificar espacio en la pagina
      if (i > 0 && y > pageHeight - 80) {
        doc.addPage();
        y = 20;
      }
      
      // Titulo del periodo
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(102, 126, 234);
      doc.text(`Periodo: ${periodo}`, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
      
      // Preparar datos de la tabla
      const tableData = [];
      let sumaPromedios = 0;
      let countPromedios = 0;
      
      materias.forEach(materia => {
        const p1Raw = materia.parcial1;
        const p2Raw = materia.parcial2;
        const p3Raw = materia.parcial3;

        const p1 = (p1Raw === '-' || p1Raw === null || p1Raw === undefined) ? null : p1Raw;
        const p2 = (p2Raw === '-' || p2Raw === null || p2Raw === undefined) ? null : p2Raw;
        const p3 = (p3Raw === '-' || p3Raw === null || p3Raw === undefined) ? null : p3Raw;

        const p1Num = (p1 !== null && p1 !== 'NP') ? parseFloat(p1) : p1;
        const p2Num = (p2 !== null && p2 !== 'NP') ? parseFloat(p2) : p2;
        const p3Num = (p3 !== null && p3 !== 'NP') ? parseFloat(p3) : p3;

        const calNum = calcularCalificacion(p1Num, p2Num, p3Num, tieneExamenFinalCoor);
        let promedio = '-';
        if (calNum === 'NP') {
          promedio = 'NP';
        } else if (calNum !== null) {
          promedio = calNum.toFixed(1);
          sumaPromedios += calNum;
          countPromedios++;
        }

        tableData.push([
          materia.materiaNombre,
          p1Raw !== null && p1Raw !== undefined ? String(p1Raw) : '-',
          p2Raw !== null && p2Raw !== undefined ? String(p2Raw) : '-',
          p3Raw !== null && p3Raw !== undefined ? String(p3Raw) : '-',
          promedio
        ]);
      });

      // Calificación del periodo
      const promedioPeriodo = countPromedios > 0
        ? (sumaPromedios / countPromedios).toFixed(1)
        : '-';

      // Generar tabla
      doc.autoTable({
        startY: y,
        head: [['Materia', 'P1', 'P2', tieneExamenFinalCoor ? 'Examen Final' : 'P3', 'Calificación']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [102, 126, 234],
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
      
      // Actualizar y
      y = doc.lastAutoTable.finalY + 5;
      
      // Promedio del periodo
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`Calificación del periodo: ${promedioPeriodo}`, 20, y);
      
      y += 15;
    }
    
    // --- SECCION DE PIE DE PAGINA Y LEYENDA ---
    
    const numPages = doc.internal.getNumberOfPages();
    const lastPageHeight = doc.internal.pageSize.getHeight();
    const lastPageWidth = doc.internal.pageSize.getWidth();

    // Mensaje de no validez (solo en la ultima pagina)
    doc.setPage(numPages);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 200); 
    
    // Usamos un array para forzar el salto de linea centrado
    doc.text(
      [
        'Este documento no tiene validez oficial, no contiene sellos originales, firmas autógrafas o firmas electrónicas,',
        'se emite para fines informativos.'
      ],
      lastPageWidth / 2,
      lastPageHeight - 25,
      { align: 'center' }
    );
    
    doc.setTextColor(0, 0, 0);

    // Numeracion de paginas (en todas las paginas)
    for (let i = 1; i <= numPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(128);
      doc.text(
        `Pagina ${i} de ${numPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
    
    // Nombre del archivo
    const nombreArchivo = `Historial_${nombreAlumno.replace(/\s+/g, '_')}.pdf`;
    
    // Descargar
    doc.save(nombreArchivo);
    
    console.log('PDF generado exitosamente:', nombreArchivo);
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    console.error('Stack trace:', error.stack);
    alert('Error al generar PDF: ' + error.message);
  }
}

console.log('Funcion descargarHistorialAlumnoPDF cargada desde HistorialCoorPDF.js');