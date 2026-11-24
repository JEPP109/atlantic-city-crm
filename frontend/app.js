const API_BASE = '/api';
const DEFAULT_USER_ID = 1;

let clientesCache = [];
let tiposTarjetaCache = [];

function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('err', isError);
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3000);
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

async function checkStatus() {
  const badge = document.getElementById('dbStatus');
  try {
    await request('/health');
    badge.textContent = 'Conectado';
    badge.className = 'status ok';
  } catch {
    badge.textContent = 'Sin conexión';
    badge.className = 'status err';
  }
}

const titles = {
  clientes: 'Clientes',
  citas: 'Citas',
  membresias: 'Membresías',
  incidencias: 'Incidencias'
};

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`panel-${tab}`).classList.add('active');
    document.getElementById('sectionTitle').textContent = titles[tab];
    loadAll();
  });
});

function populateClienteSelects() {
  const selects = [
    document.getElementById('citaClienteSelect'),
    document.getElementById('memClienteSelect'),
    document.getElementById('incClienteSelect')
  ];
  const html = clientesCache.length
    ? clientesCache
        .map(
          (c) =>
            `<option value="${c.idCliente}">${esc(c.numeroidentificacion)} — ${esc(c.nombres)} ${esc(c.apellidos)}</option>`
        )
        .join('')
    : '<option value="">Sin clientes registrados</option>';

  selects.forEach((s) => {
    if (s) s.innerHTML = html;
  });
}

// CLIENTES
async function loadClientes(q = '') {
  const query = q ? `?q=${encodeURIComponent(q)}` : '';
  const rows = await request(`/clientes${query}`);
  if (!q) {
    clientesCache = rows;
    populateClienteSelects();
  }

  const tbody = document.getElementById('clientesTableBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">No hay clientes.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      (c) => `
      <tr>
        <td><span class="pill">${esc(c.tipoDocumento)}</span> ${esc(c.numeroidentificacion)}</td>
        <td>${esc(c.nombres)} ${esc(c.apellidos)}</td>
        <td>
          ${esc(c.telefono || '—')}
          <span class="sub">${esc(c.correoelectronico || '')}</span>
        </td>
        <td><button class="btn btn-secondary btn-sm" onclick="editCliente(${c.idCliente})">Editar</button></td>
      </tr>
    `
    )
    .join('');
}

window.editCliente = function (id) {
  const c = clientesCache.find((x) => x.idCliente === id);
  if (!c) return;
  document.getElementById('clienteId').value = c.idCliente;
  document.getElementById('tipoDocumento').value = c.tipoDocumento;
  document.getElementById('numeroidentificacion').value = c.numeroidentificacion;
  document.getElementById('nombres').value = c.nombres;
  document.getElementById('apellidos').value = c.apellidos;
  document.getElementById('telefono').value = c.telefono || '';
  document.getElementById('correoelectronico').value = c.correoelectronico || '';
  document.getElementById('clienteFormTitle').textContent = 'Editar cliente';
  document.getElementById('clienteSubmitBtn').textContent = 'Actualizar';
};

function resetClienteForm() {
  document.getElementById('clienteForm').reset();
  document.getElementById('clienteId').value = '';
  document.getElementById('clienteFormTitle').textContent = 'Nuevo cliente';
  document.getElementById('clienteSubmitBtn').textContent = 'Guardar';
}

document.getElementById('clienteCancelBtn').addEventListener('click', resetClienteForm);

document.getElementById('clienteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('clienteId').value;
  const body = JSON.stringify({
    tipoDocumento: document.getElementById('tipoDocumento').value,
    numeroidentificacion: document.getElementById('numeroidentificacion').value.trim(),
    nombres: document.getElementById('nombres').value.trim(),
    apellidos: document.getElementById('apellidos').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    correoelectronico: document.getElementById('correoelectronico').value.trim()
  });

  try {
    if (id) {
      await request(`/clientes/${id}`, { method: 'PUT', body });
      toast('Cliente actualizado');
    } else {
      await request('/clientes', { method: 'POST', body });
      toast('Cliente guardado');
    }
    resetClienteForm();
    await loadClientes(document.getElementById('buscarCliente').value.trim());
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('buscarCliente').addEventListener('input', (e) => {
  loadClientes(e.target.value.trim()).catch((err) => toast(err.message, true));
});

// CITAS
async function loadCitas() {
  const rows = await request('/citas');
  const tbody = document.getElementById('citasTableBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">No hay citas.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${esc(r.nombres)} ${esc(r.apellidos)}</td>
        <td>${esc(String(r.fechaHoraCita).replace('T', ' ').slice(0, 16))}</td>
        <td>${esc(r.motivoVisita)}</td>
        <td><span class="pill">${esc(r.estadoCita)}</span></td>
      </tr>
    `
    )
    .join('');
}

document.getElementById('citaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await request('/citas', {
      method: 'POST',
      body: JSON.stringify({
        cliente_idCliente: Number(document.getElementById('citaClienteSelect').value),
        Usuario_idUsuario: DEFAULT_USER_ID,
        fechaHoraCita: document.getElementById('fechaHoraCita').value,
        motivoVisita: document.getElementById('motivoVisita').value.trim(),
        estadoCita: document.getElementById('estadoCita').value,
        observaciones: document.getElementById('observacionesCita').value.trim()
      })
    });
    toast('Cita guardada');
    e.target.reset();
    await loadCitas();
  } catch (err) {
    toast(err.message, true);
  }
});

// MEMBRESÍAS
async function loadTiposTarjeta() {
  tiposTarjetaCache = await request('/membresias/tipos');
  const sel = document.getElementById('tipoTarjetaSelect');
  sel.innerHTML = tiposTarjetaCache
    .map((t) => `<option value="${t.idTipoTarjeta}">${esc(t.categoria)}</option>`)
    .join('');
}

async function loadMembresias() {
  const rows = await request('/membresias');
  const tbody = document.getElementById('membresiasTableBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay tarjetas.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      (m) => `
      <tr>
        <td><strong>${esc(m.codTarjeta)}</strong></td>
        <td>${esc(m.nombres)} ${esc(m.apellidos)}</td>
        <td>${esc(m.categoria)}</td>
        <td><span class="pill">${esc(m.estadoTarjeta)}</span></td>
        <td>
          ${
            m.estadoTarjeta === 'Activa'
              ? `<button class="btn btn-secondary btn-sm" onclick="darBajaMembresia(${m.idTarjeta})">Dar baja</button>`
              : ''
          }
        </td>
      </tr>
    `
    )
    .join('');
}

window.darBajaMembresia = async function (id) {
  try {
    await request(`/membresias/${id}/baja`, {
      method: 'PATCH',
      body: JSON.stringify({ estadoTarjeta: 'Inactiva', motivoEliminacion: 'Baja desde CRM' })
    });
    toast('Tarjeta dada de baja');
    await loadMembresias();
  } catch (err) {
    toast(err.message, true);
  }
};

document.getElementById('membresiaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await request('/membresias', {
      method: 'POST',
      body: JSON.stringify({
        cliente_idCliente: Number(document.getElementById('memClienteSelect').value),
        Usuario_idUsuario: DEFAULT_USER_ID,
        tipoTarjeta_idTipoTarjeta: Number(document.getElementById('tipoTarjetaSelect').value),
        codTarjeta: document.getElementById('codTarjeta').value.trim(),
        fechaEmision: document.getElementById('fechaEmision').value || undefined,
        fechaVencimiento: document.getElementById('fechaVencimiento').value || undefined
      })
    });
    toast('Tarjeta emitida');
    e.target.reset();
    await loadMembresias();
  } catch (err) {
    toast(err.message, true);
  }
});

// INCIDENCIAS
async function loadIncidencias() {
  const rows = await request('/incidencias');
  const tbody = document.getElementById('incidenciasTableBody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay incidencias.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      (i) => `
      <tr>
        <td>${esc(i.nombres)} ${esc(i.apellidos)}</td>
        <td>${esc(i.categoriaIncidencia)}</td>
        <td>${esc(i.prioridad)}</td>
        <td><span class="pill">${esc(i.estadoIncidencia)}</span></td>
        <td>
          ${
            i.estadoIncidencia !== 'Cerrada'
              ? `<button class="btn btn-secondary btn-sm" onclick="cerrarIncidencia(${i.idIncidencia})">Cerrar</button>`
              : ''
          }
        </td>
      </tr>
    `
    )
    .join('');
}

window.cerrarIncidencia = async function (id) {
  try {
    await request(`/incidencias/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estadoIncidencia: 'Cerrada' })
    });
    toast('Incidencia cerrada');
    await loadIncidencias();
  } catch (err) {
    toast(err.message, true);
  }
};

document.getElementById('incidenciaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await request('/incidencias', {
      method: 'POST',
      body: JSON.stringify({
        cliente_idCliente: Number(document.getElementById('incClienteSelect').value),
        Usuario_idUsuario: DEFAULT_USER_ID,
        categoriaIncidencia: document.getElementById('categoriaIncidencia').value,
        prioridad: document.getElementById('prioridad').value,
        descripcionIncidencia: document.getElementById('descripcionIncidencia').value.trim()
      })
    });
    toast('Incidencia registrada');
    e.target.reset();
    await loadIncidencias();
  } catch (err) {
    toast(err.message, true);
  }
});

async function loadAll() {
  try {
    await Promise.all([loadClientes(), loadTiposTarjeta(), loadCitas(), loadMembresias(), loadIncidencias()]);
  } catch (err) {
    toast(err.message, true);
  }
}

checkStatus();
loadAll();