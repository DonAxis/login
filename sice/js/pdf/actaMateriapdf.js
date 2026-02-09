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
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Fecha actual
    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
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
          doc.addImage(logosEscuela.logoDerecho, 'PNG', pageWidth - 40, 8, 25, 30);
        }
      } catch (e) {
        console.log('Error al cargar logo derecho:', e);
      }
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
    
    // Preparar datos para la tabla
    const tableData = [];
    let totalP1 = 0, countP1 = 0;
    let totalP2 = 0, countP2 = 0;
    let totalP3 = 0, countP3 = 0;
    let totalPromedio = 0, countPromedio = 0;
    let aprobados = 0;
    
    alumnosEnMateria.forEach((alumno, index) => {
      const p1 = alumno.parcial1;
      const p2 = alumno.parcial2;
      const p3 = alumno.parcial3;
      
      // Calcular promedio
      let promedio = '-';
      const tieneNP = p1 === 'NP' || p2 === 'NP' || p3 === 'NP';
      
      if (tieneNP) {
        promedio = '5.0';
        totalPromedio += 5.0;
        countPromedio++;
      } else {
        const cals = [p1, p2, p3]
          .filter(c => c !== '-' && c !== null && c !== undefined && c !== '')
          .map(c => parseFloat(c))
          .filter(c => !isNaN(c));
        
        if (cals.length > 0) {
          const prom = cals.reduce((a, b) => a + b, 0) / cals.length;
          promedio = prom.toFixed(1);
          totalPromedio += prom;
          countPromedio++;
          
          if (prom >= 6) {
            aprobados++;
          }
        }
      }
      
      // Estadísticas por parcial
      if (p1 !== '-' && p1 !== 'NP') {
        totalP1 += parseFloat(p1);
        countP1++;
      }
      if (p2 !== '-' && p2 !== 'NP') {
        totalP2 += parseFloat(p2);
        countP2++;
      }
      if (p3 !== '-' && p3 !== 'NP') {
        totalP3 += parseFloat(p3);
        countP3++;
      }
      
      tableData.push([
        (index + 1).toString(),
        alumno.matricula || 'N/A',
        alumno.nombre,
        alumno.codigoGrupo || alumno.grupoNombre || 'N/A',
        p1.toString(),
        p2.toString(),
        p3.toString(),
        promedio
      ]);
    });
    
    // Generar tabla
    doc.autoTable({
      startY: y,
      head: [['#', 'Matrícula', 'Nombre', 'Grupo', 'P1', 'P2', 'P3', 'Prom.']],
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
        cellPadding: 3
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
    
    doc.text(`Promedio Parcial 1: ${promedioP1}`, 20, y);
    doc.text(`Promedio Parcial 2: ${promedioP2}`, 80, y);
    doc.text(`Promedio Parcial 3: ${promedioP3}`, 140, y);
    
    y += 7;
    doc.setFont(undefined, 'bold');
    doc.text(`Promedio General de la Materia: ${promedioGeneral}`, 20, y);
    
    y += 7;
    doc.setFont(undefined, 'normal');
    doc.text(`Alumnos Aprobados: ${aprobados} de ${countPromedio} (${porcentajeAprobados}%)`, 20, y);
    
    y += 7;
    const reprobados = countPromedio - aprobados;
    doc.text(`Alumnos Reprobados: ${reprobados} de ${countPromedio} (${(100 - parseFloat(porcentajeAprobados)).toFixed(1)}%)`, 20, y);
    
    // Espacio para firmas
    y = pageHeight - 60;
    
    doc.setLineWidth(0.3);
    
    // Firma profesor
    doc.line(30, y, 90, y);
    doc.setFontSize(9);
    doc.text('Profesor', 60, y + 5, { align: 'center' });
    
    // Firma coordinador
    doc.line(120, y, 180, y);
    doc.text('Coordinación', 150, y + 5, { align: 'center' });
    
    // Mensaje de no validez
    y = pageHeight - 25;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text(
      'ESTE DOCUMENTO NO TIENE VALIDEZ OFICIAL',
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