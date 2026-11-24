const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Listar incidencias
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.*,
             c.nombres, c.apellidos, c.numeroidentificacion,
             u.nombreCompleto AS nombreUsuario
      FROM Incidencia i
      INNER JOIN cliente c ON i.cliente_idCliente = c.idCliente
      INNER JOIN Usuario u ON i.Usuario_idUsuario = u.idUsuario
      ORDER BY i.idIncidencia DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar incidencia
router.post('/', async (req, res) => {
  try {
    const {
      cliente_idCliente,
      Usuario_idUsuario,
      categoriaIncidencia,
      descripcionIncidencia,
      prioridad,
      estadoIncidencia,
      fechaRegistros
    } = req.body;

    if (!cliente_idCliente || !Usuario_idUsuario || !categoriaIncidencia || !descripcionIncidencia || !prioridad) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios de la incidencia'
      });
    }

    const fechaReg = fechaRegistros || new Date().toISOString().slice(0, 10);

    const [result] = await pool.query(
      `INSERT INTO Incidencia
        (cliente_idCliente, Usuario_idUsuario, categoriaIncidencia, descripcionIncidencia, prioridad, estadoIncidencia, fechaRegistros)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cliente_idCliente,
        Usuario_idUsuario,
        categoriaIncidencia,
        descripcionIncidencia,
        prioridad,
        estadoIncidencia || 'Abierta',
        fechaReg
      ]
    );

    res.status(201).json({ idIncidencia: result.insertId, message: 'Incidencia registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar estado o cerrar incidencia
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoIncidencia, fechaCierre } = req.body;

    const cierre =
      estadoIncidencia === 'Cerrada' || estadoIncidencia === 'Resuelta'
        ? fechaCierre || new Date().toISOString().slice(0, 10)
        : fechaCierre || null;

    const [result] = await pool.query(
      `UPDATE Incidencia
       SET estadoIncidencia = COALESCE(?, estadoIncidencia),
           fechaCierre = ?
       WHERE idIncidencia = ?`,
      [estadoIncidencia || null, cierre, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Incidencia no encontrada' });
    }

    res.json({ message: 'Incidencia actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;