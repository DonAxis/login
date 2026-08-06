// Vigía — herramienta de mantenimiento puntual

async function accionVigia() {
  const CARRERAS_DESTINO = ['TA', 'TC', 'TI', 'TT'];
  const NOMBRES_CARRERAS = {
    TA: 'Técnico en Administración',
    TC: 'Técnico en Contaduría',
    TI: 'Técnico en Informática',
    TT: 'Técnico en Admon. Emp. Turísticas'
  };

  function normalizar(nombre) {
    return (nombre || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ');
  }

  try {
    const [tiacSnap, ...destinoSnaps] = await Promise.all([
      db.collection('materias').where('carreraId', '==', 'TIAC').get(),
      ...CARRERAS_DESTINO.map(c => db.collection('materias').where('carreraId', '==', c).get())
    ]);

    const tiacMaterias = tiacSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre, 'es'));

    const destinoMaterias = {};
    CARRERAS_DESTINO.forEach((c, i) => {
      destinoMaterias[c] = destinoSnaps[i].docs.map(d => ({ id: d.id, ...d.data() }));
    });

    let cntExactas = 0, cntNorm = 0, cntSinMatch = 0;

    const filas = tiacMaterias.map(tm => {
      const nmTiac = normalizar(tm.nombre);
      const cols = CARRERAS_DESTINO.map(c => {
        const mats = destinoMaterias[c];
        const exacto = mats.find(m => m.nombre === tm.nombre);
        if (exacto) return { status: 'exacto' };
        const norm = mats.find(m => normalizar(m.nombre) === nmTiac);
        if (norm) return { status: 'norm', nombre: norm.nombre };
        return { status: 'none' };
      });

      const tieneSinMatch = cols.some(c => c.status === 'none');
      const tieneNorm     = cols.some(c => c.status === 'norm');
      if (tieneSinMatch) cntSinMatch++;
      else if (tieneNorm) cntNorm++;
      else cntExactas++;

      return { tm, cols };
    });

    // --- HTML del reporte ---
    const headCols = CARRERAS_DESTINO.map(c =>
      `<th>${c}<br><small>${NOMBRES_CARRERAS[c]}</small></th>`
    ).join('');

    const filasBadRows = filas.filter(({ cols }) =>
      cols.some(c => c.status !== 'exacto')
    );

    const renderTabla = (rows, titulo, color) => {
      if (!rows.length) return `<p style="color:${color};font-weight:600;">✅ Ninguna en esta categoría.</p>`;
      const trs = rows.map(({ tm, cols }) => {
        const celdas = cols.map(col => {
          if (col.status === 'exacto') return `<td class="ok">✅</td>`;
          if (col.status === 'norm')   return `<td class="warn" title="En destino: «${col.nombre}»">⚠️<br><small>${col.nombre}</small></td>`;
          return `<td class="bad">❌<br><small>no encontrada</small></td>`;
        }).join('');
        return `<tr><td class="nombre">${tm.nombre}</td><td class="codigo">${tm.codigo || '—'}</td>${celdas}</tr>`;
      }).join('');
      return `<h3 style="color:${color};margin-top:28px;">${titulo}</h3>
        <table><thead><tr><th>Materia TIAC</th><th>Código</th>${headCols}</tr></thead>
        <tbody>${trs}</tbody></table>`;
    };

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Auditoría TIAC</title>
<style>
  body { font-family: sans-serif; padding: 24px; background: #f5f5f5; color: #222; }
  h2   { color: #1b5e20; margin-bottom: 6px; }
  .resumen { display: flex; gap: 14px; margin: 16px 0 24px; flex-wrap: wrap; }
  .chip    { padding: 8px 18px; border-radius: 20px; font-weight: 700; font-size: 0.9rem; }
  table    { border-collapse: collapse; width: 100%; background: white; margin-bottom: 8px; }
  th       { padding: 9px 12px; background: #37474f; color: white; border: 1px solid #555; font-size: 0.85rem; text-align: left; }
  td       { padding: 8px 12px; border: 1px solid #ddd; font-size: 0.88rem; vertical-align: middle; }
  td.nombre  { font-weight: 600; min-width: 220px; }
  td.codigo  { color: #888; font-size: 0.8rem; }
  td.ok    { background: #e8f5e9; color: #2e7d32; text-align: center; }
  td.warn  { background: #fff8e1; color: #e65100; text-align: center; font-size: 0.8rem; }
  td.bad   { background: #ffebee; color: #c62828; text-align: center; font-weight: 700; font-size: 0.8rem; }
  tr:hover td { background: #fafafa; }
  td.ok:hover, td.warn:hover, td.bad:hover { filter: brightness(0.96); }
</style></head><body>
<h2>Auditoría de Materias: TIAC → Carreras Destino</h2>
<p style="color:#666;">Total materias TIAC: <strong>${tiacMaterias.length}</strong></p>
<div class="resumen">
  <span class="chip" style="background:#e8f5e9;color:#2e7d32;">✅ Exactas en todas: ${cntExactas}</span>
  <span class="chip" style="background:#fff8e1;color:#e65100;">⚠️ Diferencia acento/mayús: ${cntNorm}</span>
  <span class="chip" style="background:#ffebee;color:#c62828;">❌ Sin match en alguna carrera: ${cntSinMatch}</span>
</div>

${renderTabla(
  filas.filter(({ cols }) => cols.some(c => c.status === 'none')),
  '❌ Sin match en alguna carrera destino',
  '#c62828'
)}

${renderTabla(
  filas.filter(({ cols }) => cols.every(c => c.status !== 'none') && cols.some(c => c.status === 'norm')),
  '⚠️ Match por normalización (diferencia de acentos o mayúsculas)',
  '#e65100'
)}

${cntExactas === tiacMaterias.length
  ? '<p style="color:#2e7d32;font-weight:700;font-size:1.1rem;margin-top:20px;">🎉 Todas las materias coinciden exactamente en las 4 carreras.</p>'
  : ''}

</body></html>`;

    const win = window.open('', '_blank', 'width=960,height=720');
    if (!win) { alert('El navegador bloqueó la ventana emergente. Permite popups para este sitio.'); return; }
    win.document.write(html);
    win.document.close();

  } catch (e) {
    alert('Error en Vigía: ' + e.message);
  }
}
