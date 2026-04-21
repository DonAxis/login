// actaMateriaPDF.js - Generar acta de calificaciones de una materia
// Formato idéntico al acta del coordinador

async function descargarActaMateria(materiaId, nombreMateria, alumnosEnMateria) {
  try {
    if (typeof window.jspdf === 'undefined') {
      alert('Error: jsPDF no está cargado. Recarga la página.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ format: 'letter' });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // Determinar tieneExamenFinal para logo y calificación
    let tieneExamenFinalActa = false;
    try {
      const materiaDoc = await db.collection('materias').doc(materiaId).get();
      if (materiaDoc.exists && materiaDoc.data().carreraId) {
        tieneExamenFinalActa = await obtenerTieneExamenFinal(materiaDoc.data().carreraId);
      }
    } catch (_) {}

    // Logos
    if (typeof agregarLogosAlPDF === 'function') {
      agregarLogosAlPDF(doc, tieneExamenFinalActa);
    }

    // Encabezado
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('ACTA DE CALIFICACIONES', 105, 25, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(30, 38, 180, 38);

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    let y = 45;

    doc.text(`Fecha: ${fecha}`, pageWidth - 20, y, { align: 'right' });
    y += 5;
    doc.text(`Materia: ${nombreMateria}`, 20, y);  y += 5;
    doc.text(`Grupo: ${alumnosEnMateria[0]?.codigoGrupo || '-'}`, 20, y);  y += 5;
    doc.text(`Periodo: ${alumnosEnMateria[0]?.periodo || '-'}`, 20, y);
    y += 10;

    // Datos de tabla
    const tableData = [];
    alumnosEnMateria.forEach((alumno, index) => {
      const p1 = alumno.parcial1, p2 = alumno.parcial2, p3 = alumno.parcial3;
      const toNum = v => (v !== null && v !== undefined && v !== '-' && v !== 'NP') ? parseFloat(v) : (v === 'NP' ? 'NP' : null);
      const calNum = calcularCalificacion(toNum(p1), toNum(p2), toNum(p3), tieneExamenFinalActa);
      const promedio = calNum === 'NP' ? 'NP' : calNum !== null ? calNum.toFixed(1) : '-';
      tableData.push([(index + 1).toString(), alumno.matricula || 'N/A', alumno.nombre, promedio]);
    });

    doc.autoTable({
      startY: y,
      margin: { bottom: 40 },
      head: [['No.', 'Matrícula', 'Nombre del Alumno', 'Calificación']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [108, 29, 69], textColor: 255, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'center', cellWidth: 35 },
        2: { halign: 'left',   cellWidth: 95 },
        3: { halign: 'center', cellWidth: 35, fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        if (data.column.index === 3 && data.section === 'body') {
          const v = parseFloat(data.cell.text[0]);
          if (!isNaN(v)) {
            data.cell.styles.textColor = v < 6 ? [244, 67, 54] : v >= 8 ? [76, 175, 80] : [255, 152, 0];
          }
        }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 10;
    if (finalY + 45 > pageHeight) { doc.addPage(); finalY = 20; }

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Total de alumnos: ${alumnosEnMateria.length}`, 20, finalY);

    const firmasY = finalY + 30;
    doc.setLineWidth(0.3);
    doc.line(30,  firmasY, 90,  firmasY);
    doc.line(120, firmasY, 180, firmasY);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Profesor',     60,  firmasY + 5, { align: 'center' });
    doc.text('Coordinación', 150, firmasY + 5, { align: 'center' });

    doc.save(`Acta_${nombreMateria.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF del acta:', error);
    alert('Error al generar PDF: ' + error.message);
  }
}

console.log('Función descargarActaMateria cargada');
