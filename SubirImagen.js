const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

const PORT = 3000;
const MAIN_URL="http://localhost";

app.use(cors());
// Middlewares esenciales (DEBEN estar antes de tus rutas)
app.use(express.json({ limit: '10mb' }));  // Para parsear application/json
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Para parsear formularios


// Configura tu conexión PostgreSQL
/*const pool = new Pool({
  user: 'debbiezuleta',
  host: 'localhost',
  database: 'pompositienda',
  password: 'Debmary44!',
  port: 5433, // usualmente es este
});*/

//postgresql://neondb_owner:npg_5OdN9KPeqiIc@ep-rough-thunder-acuwnpfk-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
const pool = new Pool({
  user: 'neondb_owner',
  host: 'ep-rough-thunder-acuwnpfk-pooler.sa-east-1.aws.neon.tech',
  database: 'neondb',
  password: 'npg_5OdN9KPeqiIc',
  port: 5432, // Puerto estándar para PostgreSQL
  ssl: {
    rejectUnauthorized: false
  }
});




const fs = require('fs').promises;
const path = require('path');


app.use('/images/empresas', express.static(path.join(__dirname, 'images', 'empresas'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

app.use('/images/productos', express.static(path.join(__dirname, 'images', 'productos'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));




// 🎨 Función reutilizable para procesar imágenes base64
async function procesarImagenBase64(imagenBase64, nombreArchivo, carpeta = 'images') {
  if (!imagenBase64 || !imagenBase64.startsWith('data:image')) return null;

  const matches = imagenBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) throw { code: 'FORMATO_IMAGEN_INVALIDO' };

  const [_, ext, data] = matches;
  const filename = `${nombreArchivo}.${ext}`;
  const imagesDir = path.join(__dirname, carpeta);
  const filepath = path.join(imagesDir, filename);

  await fs.mkdir(imagesDir, { recursive: true });
  await fs.writeFile(filepath, Buffer.from(data, 'base64'));

  return {
    filename,
    url: `${MAIN_URL}:${PORT}/${carpeta}/${filename}`
  };
}



app.post('/registroEmpresas', async (req, res) => {
  try {
    const { imagen_1, imagen, id_empresa, razon_social, id_usuario, id_categoria, nombre_empresa, ...empresaData } = req.body;

    if (!id_empresa || !razon_social || !id_categoria || !id_usuario || !nombre_empresa) {
      return res.status(400).json({
        success: false,
        error: 'id_empresa, razon_social, nombre_empresa, id_categoria e id_usuario son obligatorios'
      });
    }

    const imagenProcesada = await procesarImagenBase64(imagen_1, razon_social, 'images/empresas');
    const imagenUrl = imagenProcesada?.url || imagen;
     const fecha_creacion = new Date();

    const result = await pool.query(
      `INSERT INTO empresa (
        id_empresa, nombre_empresa, descripcion, imagen, 
        id_categoria, direccion, telefono, facebook,
        instagram, tiktok, web, razon_social, id_usuario, fecha_creacion, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        id_empresa,
        nombre_empresa,
        empresaData.descripcion,
        imagenUrl,
        id_categoria,
        empresaData.direccion,
        empresaData.telefono,
        empresaData.facebook,
        empresaData.instagram,
        empresaData.tiktok,
        empresaData.web,
        razon_social,
        id_usuario,
        fecha_creacion,
         empresaData.status,
      ]
    );

    res.status(201).json({
      success: true,
      empresa: result.rows[0],
      imagen_url: imagenUrl
    });

  } catch (err) {
    console.error('Error:', err);

    let errorMessage = 'Error del servidor';
    if (err.code === '23505') errorMessage = `La empresa con ID ${req.body.id_empresa} ya existe`;
    if (err.code === 'ENOENT') errorMessage = 'Error al crear directorio de imágenes';
    if (err.code === 'FORMATO_IMAGEN_INVALIDO') errorMessage = 'Formato de imagen inválido';

    res.status(500).json({ success: false, error: errorMessage });
  }
});




app.post('/registroProductos', async (req, res) => {
  try {
    const { imagen_2, id_producto, cantidad_stock: cs, id_empresa, id_categoria, sku_id, id_usuario, precio: p, descuento: d, ...productoData } = req.body;

    // Convertir a números
    const cantidad_stock = Number(cs);
    const precio = Number(p);
    const descuento = d !== undefined ? Number(d) : 0;

    if (
      !id_producto || !sku_id || isNaN(cantidad_stock) || !id_empresa ||
      !id_categoria || !id_usuario || isNaN(precio) || isNaN(descuento)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios o precio/cantidad_stock/descuento no son números válidos'
      });
    }

  

    const imagenProcesada = await procesarImagenBase64(imagen_2, id_producto, 'images/productos');
    const imagenUrl = imagenProcesada?.url || productoData.imagen;

    const fecha_creacion = new Date();

    const result = await pool.query(
      `INSERT INTO producto (
        id_producto, nombre_producto, precio, descripcion, id_empresa, imagen, descuento, id_categoria, cantidad_stock,
        sku_id, id_usuario, fecha_creacion, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        id_producto,
        productoData.nombre_producto,
        precio,
        productoData.descripcion,
        id_empresa,
        imagenUrl,
        descuento,
        id_categoria,
        cantidad_stock,
        sku_id,
        id_usuario,
        fecha_creacion,
        productoData.status
      ]
    );

    res.status(201).json({
      success: true,
      producto: result.rows[0],
      imagen_url: imagenUrl
    });

  } catch (err) {
    console.error('Error:', err);

    let errorMessage = 'Error del servidor';
    if (err.code === '23505') errorMessage = `El producto con ID ${req.body.id_producto} ya existe`;
    if (err.code === 'ENOENT') errorMessage = 'Error al crear directorio de imágenes';
    if (err.code === 'FORMATO_IMAGEN_INVALIDO') errorMessage = 'Formato de imagen inválido';

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});



app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});

