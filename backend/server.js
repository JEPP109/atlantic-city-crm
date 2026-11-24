require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Pool de conexión a MySQL (con soporte SSL para bases en la nube)
const useSSL =
  process.env.DB_SSL === 'true' ||
  (process.env.DB_HOST &&
    process.env.DB_HOST !== 'localhost' &&
    process.env.DB_HOST !== '127.0.0.1');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'atlantic_city_crm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {})
});

// Servir frontend estático
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Healthcheck
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, message: 'API y MySQL conectados' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- CLIENTES ---
app.get('/api/clientes', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q) {
      const like = `%${q}%`;
      const [rows] = await pool.query(
        `SELECT * FROM cliente
         WHERE numeroidentificacion LIKE ? OR nombres LIKE ? OR apellidos LIKE ?
         ORDER BY idCliente DESC`,
        [like, like, like]
      );
      return res.json(rows);
    }
    const [rows] = await pool.query('SELECT * FROM cliente ORDER BY idCliente DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const {
      tipoDocumento,
      numeroidentificacion,
      nombres,
      apellidos,
      telefono,
      correoelectronico
    } = req.body;

    if (!tipoDocumento || !numeroidentificacion || !nombres || !apellidos) {
      return res.status(400).json({ error: 'Faltan campos obligatorios del cliente' });
    }

    const fechaRegistro = new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      `INSERT INTO cliente
        (numeroidentificacion, tipoDocumento, nombres, apellidos, telefono, correoelectronico, fechaRegistro)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        numeroidentificacion,
        tipoDocumento,
        nombres,
        apellidos,
        telefono || null,
        correoelectronico || null,
        fechaRegistro
      ]
    );
    res.status(201).json({ idCliente: result.insertId, message: 'Cliente creado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipoDocumento,
      numeroidentificacion,
      nombres,
      apellidos,
      telefono,
      correoelectronico
    } = req.body;

    await pool.query(
      `UPDATE cliente
       SET tipoDocumento = ?, numeroidentificacion = ?, nombres = ?, apellidos = ?, telefono = ?, correoelectronico = ?
       WHERE idCliente = ?`,
      [
        tipoDocumento,
        numeroidentificacion,
        nombres,
        apellidos,
        telefono || null,
        correoelectronico || null,
        id
      ]
    );
    res.json({ message: 'Cliente actualizado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- CITAS Y VISITAS ---
app.get('/api/citas', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cv.*, c.nombres, c.apellidos, c.numeroidentificacion
       FROM CitaVisita cv
       INNER JOIN cliente c ON cv.cliente_idCliente = c.idCliente
       ORDER BY cv.idCita DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/citas', async (req, res) => {
  try {
    const {
      cliente_idCliente,
      Usuario_idUsuario,
      fechaHoraCita,
      motivoVisita,
      estadoCita,
      observaciones
    } = req.body;

    if (!cliente_idCliente || !Usuario_idUsuario || !fechaHoraCita || !motivoVisita) {
      return res.status(400).json({ error: 'Faltan campos obligatorios de la cita' });
    }

    const formattedDate = String(fechaHoraCita).replace('T', ' ') + ':00';
    const [result] = await pool.query(
      `INSERT INTO CitaVisita
        (cliente_idCliente, Usuario_idUsuario, fechaHoraCita, motivoVisita, estadoCita, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cliente_idCliente,
        Usuario_idUsuario,
        formattedDate.slice(0, 19),
        motivoVisita,
        estadoCita || 'Programada',
        observaciones || null
      ]
    );
    res.status(201).json({ idCita: result.insertId, message: 'Cita registrada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- MEMBRESÍAS ---
app.get('/api/membresias/tipos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tipoTarjeta WHERE vigencia = "S" ORDER BY idTipoTarjeta');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/membresias', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT tm.*, c.nombres, c.apellidos, tt.categoria
       FROM TarjetaMembresia tm
       INNER JOIN cliente c ON tm.cliente_idCliente = c.idCliente
       INNER JOIN tipoTarjeta tt ON tm.tipoTarjeta_idTipoTarjeta = tt.idTipoTarjeta
       ORDER BY tm.idTarjeta DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/membresias', async (req, res) => {
  try {
    const {
      cliente_idCliente,
      Usuario_idUsuario,
      tipoTarjeta_idTipoTarjeta,
      codTarjeta,
      fechaEmision,
      fechaVencimiento
    } = req.body;

    if (!cliente_idCliente || !Usuario_idUsuario || !tipoTarjeta_idTipoTarjeta || !codTarjeta) {
      return res.status(400).json({ error: 'Faltan campos obligatorios de membresía' });
    }

    const emision = fechaEmision || new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      `INSERT INTO TarjetaMembresia
        (cliente_idCliente, Usuario_idUsuario, tipoTarjeta_idTipoTarjeta, codTarjeta, fechaEmision, fechaVencimiento, estadoTarjeta)
       VALUES (?, ?, ?, ?, ?, ?, 'Activa')`,
      [
        cliente_idCliente,
        Usuario_idUsuario,
        tipoTarjeta_idTipoTarjeta,
        codTarjeta,
        emision,
        fechaVencimiento || null
      ]
    );
    res.status(201).json({ idTarjeta: result.insertId, message: 'Membresía emitida' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/membresias/:id/baja', async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoTarjeta, motivoEliminacion } = req.body;
    const fechaEliminacion = new Date().toISOString().slice(0, 10);

    await pool.query(
      `UPDATE TarjetaMembresia
       SET estadoTarjeta = ?, motivoEliminacion = ?, fechaEliminacion = ?
       WHERE idTarjeta = ?`,
      [estadoTarjeta || 'Inactiva', motivoEliminacion || 'Baja registrada', fechaEliminacion, id]
    );
    res.json({ message: 'Membresía actualizada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- INCIDENCIAS ---
app.get('/api/incidencias', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, c.nombres, c.apellidos
       FROM Incidencia i
       INNER JOIN cliente c ON i.cliente_idCliente = c.idCliente
       ORDER BY i.idIncidencia DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/incidencias', async (req, res) => {
  try {
    const {
      cliente_idCliente,
      Usuario_idUsuario,
      categoriaIncidencia,
      prioridad,
      descripcionIncidencia
    } = req.body;

    if (!cliente_idCliente || !Usuario_idUsuario || !categoriaIncidencia || !prioridad || !descripcionIncidencia) {
      return res.status(400).json({ error: 'Faltan campos obligatorios de la incidencia' });
    }

    const fechaRegistros = new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      `INSERT INTO Incidencia
        (cliente_idCliente, Usuario_idUsuario, categoriaIncidencia, descripcionIncidencia, prioridad, estadoIncidencia, fechaRegistros)
       VALUES (?, ?, ?, ?, ?, 'Abierta', ?)`,
      [
        cliente_idCliente,
        Usuario_idUsuario,
        categoriaIncidencia,
        descripcionIncidencia,
        prioridad,
        fechaRegistros
      ]
    );
    res.status(201).json({ idIncidencia: result.insertId, message: 'Incidencia registrada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/incidencias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const estado = req.body.estadoIncidencia || 'Cerrada';
    const fechaCierre = estado === 'Cerrada' ? new Date().toISOString().slice(0, 10) : null;

    await pool.query(
      `UPDATE Incidencia
       SET estadoIncidencia = ?, fechaCierre = ?
       WHERE idIncidencia = ?`,
      [estado, fechaCierre, id]
    );
    res.json({ message: 'Incidencia actualizada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cualquier otra ruta devuelve el index.html del frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});