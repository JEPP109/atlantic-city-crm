const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Listar citas con datos del cliente y usuario
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cv.*,
             c.nombres, c.apellidos, c.numeroidentificacion,
             u.nombreCompleto AS nombreUsuario
      FROM CitaVisita cv
      INNER JOIN cliente c ON cv.cliente_idCliente = c.idCliente
      INNER JOIN Usuario u ON cv.Usuario_idUsuario = u.idUsuario
      ORDER BY cv.fechaHoraCita DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar cita o visita
router.post('/', async (req, res) => {
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
      return res.status(400).json({
        error: 'Faltan campos obligatorios: cliente_idCliente, Usuario_idUsuario, fechaHoraCita, motivoVisita'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO CitaVisita
        (cliente_idCliente, Usuario_idUsuario, fechaHoraCita, motivoVisita, estadoCita, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cliente_idCliente,
        Usuario_idUsuario,
        fechaHoraCita,
        motivoVisita,
        estadoCita || 'Programada',
        observaciones || null
      ]
    );

    res.status(201).json({ idCita: result.insertId, message: 'Cita registrada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar estado de cita
router.patch('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoCita, observaciones } = req.body;

    const [result] = await pool.query(
      `UPDATE CitaVisita
       SET estadoCita = COALESCE(?, estadoCita),
           observaciones = COALESCE(?, observaciones)
       WHERE idCita = ?`,
      [estadoCita || null, observaciones !== undefined ? observaciones : null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    res.json({ message: 'Estado de cita actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;