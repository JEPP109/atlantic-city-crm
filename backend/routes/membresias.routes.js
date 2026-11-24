const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Listar tipos de tarjeta disponibles
router.get('/tipos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tipoTarjeta WHERE vigencia = "S"');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar tarjetas de membresía
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT tm.*,
             c.nombres, c.apellidos, c.numeroidentificacion,
             tt.categoria, tt.Beneficios,
             u.nombreCompleto AS nombreUsuario
      FROM TarjetaMembresia tm
      INNER JOIN cliente c ON tm.cliente_idCliente = c.idCliente
      INNER JOIN tipoTarjeta tt ON tm.tipoTarjeta_idTipoTarjeta = tt.idTipoTarjeta
      INNER JOIN Usuario u ON tm.Usuario_idUsuario = u.idUsuario
      ORDER BY tm.idTarjeta DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Emitir tarjeta de membresía
router.post('/', async (req, res) => {
  try {
    const {
      cliente_idCliente,
      Usuario_idUsuario,
      tipoTarjeta_idTipoTarjeta,
      codTarjeta,
      fechaEmision,
      fechaVencimiento,
      estadoTarjeta
    } = req.body;

    if (!cliente_idCliente || !Usuario_idUsuario || !tipoTarjeta_idTipoTarjeta || !codTarjeta) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios: cliente_idCliente, Usuario_idUsuario, tipoTarjeta_idTipoTarjeta, codTarjeta'
      });
    }

    const emision = fechaEmision || new Date().toISOString().slice(0, 10);

    const [result] = await pool.query(
      `INSERT INTO TarjetaMembresia
        (cliente_idCliente, Usuario_idUsuario, tipoTarjeta_idTipoTarjeta, codTarjeta, fechaEmision, fechaVencimiento, estadoTarjeta)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cliente_idCliente,
        Usuario_idUsuario,
        tipoTarjeta_idTipoTarjeta,
        codTarjeta,
        emision,
        fechaVencimiento || null,
        estadoTarjeta || 'Activa'
      ]
    );

    res.status(201).json({ idTarjeta: result.insertId, message: 'Membresía registrada' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese código de tarjeta ya está registrado' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Dar de baja o actualizar estado de membresía
router.patch('/:id/baja', async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoTarjeta, motivoEliminacion, fechaEliminacion } = req.body;

    const [result] = await pool.query(
      `UPDATE TarjetaMembresia
       SET estadoTarjeta = ?,
           motivoEliminacion = ?,
           fechaEliminacion = ?
       WHERE idTarjeta = ?`,
      [
        estadoTarjeta || 'Inactiva',
        motivoEliminacion || 'Baja registrada en sistema',
        fechaEliminacion || new Date().toISOString().slice(0, 10),
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tarjeta no encontrada' });
    }

    res.json({ message: 'Membresía actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;