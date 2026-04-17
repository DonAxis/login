// actaMateriaPDF.js - Generar acta de calificaciones de una materia
// Muestra todos los alumnos inscritos en una materia específica

async function descargarActaMateria(materiaId, nombreMateria, alumnosEnMateria) {
  try {
    console.log('=== GENERANDO ACTA DE MATERIA ===');
    console.log('Materia:', nombreMateria);
    console.log('Alumnos:', alumnosEnMateria.length);
    
    // Verificar que jsPDF esté cargado
    if (typeof window.jspdf === 'undefined') {
      alert('Error: jsPDF no está cargado. Recarga la página.');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ format: 'letter' });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Fecha actual
    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Determinar si la carrera usa examen final (necesario para elegir logo)
    let tieneExamenFinalActa = false;
    try {
      const materiaDoc = await db.collection('materias').doc(materiaId).get();
      if (materiaDoc.exists && materiaDoc.data().carreraId) {
        tieneExamenFinalActa = await obtenerTieneExamenFinal(materiaDoc.data().carreraId);
      }
    } catch (_) {}

    // Agregar logos
    if (typeof agregarLogosAlPDF === 'function') {
      agregarLogosAlPDF(doc, tieneExamenFinalActa);
    }
    
    // Título
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('ACTA DE CALIFICACIONES', pageWidth / 2, 25, { align: 'center' });
    
    // Línea separadora
    doc.setLineWidth(0.5);
    doc.line(30, 40, pageWidth - 30, 40);
    
    // Información de la materia
    let y = 50;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    
    doc.text(`Fecha: ${fecha}`, pageWidth - 20, y, { align: 'right' });
    y += 7;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Materia: ${nombreMateria}`, 20, y);
    y += 7;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.text(`Total de Alumnos: ${alumnosEnMateria.length}`, 20, y);
    y += 15;
    
    const colP3Label = tieneExamenFinalActa ? 'E.Final' : 'P3';

    // Preparar datos para la tabla
    const tableData = [];
    let totalP1 = 0, countP1 = 0;
    let totalP2 = 0, countP2 = 0;
    let totalP3 = 0, countP3 = 0;
    let totalPromedio = 0, countPromedio = 0;
    let aprobados = 0;

    alumnosEnMateria.forEach((alumno, index) => {
      const p1Raw = alumno.parcial1;
      const p2Raw = alumno.parcial2;
      const p3Raw = alumno.parcial3;

      const p1 = (p1Raw === '-' || p1Raw === null || p1Raw === undefined) ? null : p1Raw;
      const p2 = (p2Raw === '-' || p2Raw === null || p2Raw === undefined) ? null : p2Raw;
      const p3 = (p3Raw === '-' || p3Raw === null || p3Raw === undefined) ? null : p3Raw;

      const p1Num = (p1 !== null && p1 !== 'NP') ? parseFloat(p1) : p1;
      const p2Num = (p2 !== null && p2 !== 'NP') ? parseFloat(p2) : p2;
      const p3Num = (p3 !== null && p3 !== 'NP') ? parseFloat(p3) : p3;

      const calNum = calcularCalificacion(p1Num, p2Num, p3Num, tieneExamenFinalActa);
      let promedio = '-';
      if (calNum === 'NP') {
        promedio = 'NP';
      } else if (calNum !== null) {
        promedio = calNum.toFixed(1);
        totalPromedio += calNum;
        countPromedio++;
        if (!esReprobado(calNum, tieneExamenFinalActa)) {
          aprobados++;
        }
      }

      // Estadísticas por parcial
      if (p1 !== null && p1 !== 'NP') { totalP1 += parseFloat(p1); countP1++; }
      if (p2 !== null && p2 !== 'NP') { totalP2 += parseFloat(p2); countP2++; }
      if (p3 !== null && p3 !== 'NP') { totalP3 += parseFloat(p3); countP3++; }

      tableData.push([
        (index + 1).toString(),
        alumno.matricula || 'N/A',
        alumno.nombre,
        alumno.codigoGrupo || alumno.grupoNombre || 'N/A',
        p1Raw !== null && p1Raw !== undefined ? String(p1Raw) : '-',
        p2Raw !== null && p2Raw !== undefined ? String(p2Raw) : '-',
        p3Raw !== null && p3Raw !== undefined ? String(p3Raw) : '-',
        promedio
      ]);
    });

    // Generar tabla
    doc.autoTable({
      startY: y,
      head: [['#', 'Matrícula', 'Nombre', 'Grupo', 'P1', 'P2', colP3Label, 'Cal.']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [106, 33, 53],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9
      },
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'left', cellWidth: 60 },
        3: { halign: 'center', cellWidth: 25 },
        4: { halign: 'center', cellWidth: 15 },
        5: { halign: 'center', cellWidth: 15 },
        6: { halign: 'center', cellWidth: 15 },
        7: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        // Colorear promedios
        if (data.column.index === 7 && data.section === 'body') {
          const promedio = data.cell.text[0];
          if (promedio !== '-' && promedio !== 'NP') {
            const prom = parseFloat(promedio);
            if (prom < 6) {
              data.cell.styles.textColor = [244, 67, 54]; // Rojo
            } else if (prom >= 8) {
              data.cell.styles.textColor = [76, 175, 80]; // Verde
            } else {
              data.cell.styles.textColor = [255, 152, 0]; // Naranja
            }
          }
        }
      }
    });
    
    // Estadísticas
    y = doc.lastAutoTable.finalY + 15;

    // Si no hay espacio para estadísticas + firmas, agregar nueva página
    const espacioNecesarioStats = 50; // encabezado + 4 líneas de stats + firma
    let paginaNueva = false;
    if (y + espacioNecesarioStats > pageHeight - 65) {
      doc.addPage();
      y = 20;
      paginaNueva = true;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('ESTADÍSTICAS', 20, y);

    y += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const promedioP1 = countP1 > 0 ? (totalP1 / countP1).toFixed(1) : '-';
    const promedioP2 = countP2 > 0 ? (totalP2 / countP2).toFixed(1) : '-';
    const promedioP3 = countP3 > 0 ? (totalP3 / countP3).toFixed(1) : '-';
    const promedioGeneral = countPromedio > 0 ? (totalPromedio / countPromedio).toFixed(1) : '-';
    const porcentajeAprobados = countPromedio > 0 ? ((aprobados / countPromedio) * 100).toFixed(1) : '0';

    const labelP3Stats = tieneExamenFinalActa ? 'Prom. E.Final' : 'Promedio Parcial 3';
    doc.text(`Promedio Parcial 1: ${promedioP1}`, 20, y);
    doc.text(`Promedio Parcial 2: ${promedioP2}`, 80, y);
    doc.text(`${labelP3Stats}: ${promedioP3}`, 140, y);

    y += 7;
    doc.setFont(undefined, 'bold');
    doc.text(`Calificación General de la Materia: ${promedioGeneral}`, 20, y);

    y += 7;
    doc.setFont(undefined, 'normal');
    doc.text(`Alumnos Aprobados: ${aprobados} de ${countPromedio} (${porcentajeAprobados}%)`, 20, y);

    y += 7;
    const reprobados = countPromedio - aprobados;
    doc.text(`Alumnos Reprobados: ${reprobados} de ${countPromedio} (${(100 - parseFloat(porcentajeAprobados)).toFixed(1)}%)`, 20, y);

    // Espacio para firmas: si es página nueva va justo después de stats, si no se ancla al fondo
    const yFirma = paginaNueva ? y + 30 : pageHeight - 60;

    doc.setLineWidth(0.3);

    // Firma profesor
    doc.line(30, yFirma, 90, yFirma);
    doc.setFontSize(9);
    doc.text('Profesor', 60, yFirma + 5, { align: 'center' });

    // Firma coordinador
    doc.line(120, yFirma, 180, yFirma);
    doc.text('Coordinación', 150, yFirma + 5, { align: 'center' });
    
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
    const nombreArchivo = `Acta_${nombreMateria.replace(/\s+/g, '_')}_${fecha.replace(/\s+/g, '_')}.pdf`;
    
    // Descargar
    doc.save(nombreArchivo);
    
    console.log('PDF de acta generado exitosamente:', nombreArchivo);
    
  } catch (error) {
    console.error('Error al generar PDF del acta:', error);
    alert('Error al generar PDF: ' + error.message);
  }
}

console.log('Función descargarActaMateria cargada');