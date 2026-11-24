const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Listar clientes (con búsqueda opcional por documento, nombre o apellido)
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q) {
      const like = `%${q}%`;
      const [rows] = await pool.query(
        `SELECT * FROM cliente
         WHERE numeroidentificacion LIKE ?
            OR nombres LIKE ?
            OR apellidos LIKE ?
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

// Crear cliente
router.post('/', async (req, res) => {
  try {
    const {
      numeroidentificacion,
      tipoDocumento,
      nombres,
      apellidos,
      telefono,
      correoelectronico,
      fechaRegistro
    } = req.body;

    if (!numeroidentificacion || !tipoDocumento || !nombres || !apellidos) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios: numeroidentificacion, tipoDocumento, nombres, apellidos'
      });
    }

    const fecha = fechaRegistro || new Date().toISOString().slice(0, 10);

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
        fecha
      ]
    );

    const [creado] = await pool.query('SELECT * FROM cliente WHERE idCliente = ?', [result.insertId]);
    res.status(201).json(creado[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un cliente con ese número de identificación' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Editar cliente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      numeroidentificacion,
      tipoDocumento,
      nombres,
      apellidos,
      telefono,
      correoelectronico
    } = req.body;

    const [result] = await pool.query(
      `UPDATE cliente
       SET numeroidentificacion = ?, tipoDocumento = ?, nombres = ?, apellidos = ?, telefono = ?, correoelectronico = ?
       WHERE idCliente = ?`,
      [numeroidentificacion, tipoDocumento, nombres, apellidos, telefono || null, correoelectronico || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const [actualizado] = await pool.query('SELECT * FROM cliente WHERE idCliente = ?', [id]);
    res.json(actualizado[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese número de identificación ya pertenece a otro cliente' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;