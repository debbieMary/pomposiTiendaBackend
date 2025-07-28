const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;

const app = express();


//const MAIN_URL="http://localhost"; -> esto solo para localhost

const MAIN_URL="https://pompositiendabackend.onrender.com"; 


//const PORT = 3000; -> esto solo sirve para el local host
const PORT = process.env.PORT || 3000;



app.use(cors());
// Middlewares esenciales (DEBEN estar antes de tus rutas)
app.use(express.json({ limit: '10mb' }));  // Para parsear application/json
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Para parsear formularios





/**************************VARIABLES CLOUDINARY**********************/ 

/*Product Environment Credentials

Cloud name  :dz99fowem
API key :327959427437958
API secret :l2SpHtQUWGiimxnTAkepjW3jwmA

API environment variable:  
CLOUDINARY_URL=cloudinary://327959427437958:l2SpHtQUWGiimxnTAkepjW3jwmA@dz99fowemcloudinary://327959427437958:**********@dz99fowem*/


cloudinary.config({ 
  cloud_name: 'dz99fowem', 
  api_key: '327959427437958', 
  api_secret: 'l2SpHtQUWGiimxnTAkepjW3jwmA' // 🔒 Obtén esto desde tu dashboard
});



/**************************VARIABLES BASE DE DATOS****************************/


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




// 🎨 Función reutilizable para procesar imágenes base64 este solo funciona en local
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



// 🆕 Función para subir imágenes a Cloudinary (reemplaza procesarImagenBase64) pero sin optimizacion de imagen
/*async function uploadToCloudinary(imagenBase64, folder, public_id) {
  if (!imagenBase64 || !imagenBase64.startsWith('data:image')) return null;

  try {
    const result = await cloudinary.uploader.upload(imagenBase64, {
      folder: folder,       // Ej: 'pompositienda/empresas'
      public_id: public_id, // ID único (ej: razon_social o id_producto)
      overwrite: true,      // Permite actualizar imágenes existentes
      resource_type: 'auto' // Detecta si es imagen/video
    });

    return {
      url: result.secure_url,
      public_id: result.public_id
    };
  } catch (err) {
    console.error('Error uploading to Cloudinary:', err);
    throw { code: 'CLOUDINARY_ERROR' };
  }
}*/
// 🆕 Función para subir imágenes a Cloudinary (reemplaza procesarImagenBase64) con imagen optimizada

async function uploadToCloudinary(imagenBase64, folder, public_id) {
  try {
    const result = await cloudinary.uploader.upload(imagenBase64, {
      folder: folder,
      public_id: public_id,
      overwrite: true,
      resource_type: "image",
      // ✅ Parámetros de optimización compatibles:
      quality: "auto:good",       // Balance calidad-peso
      fetch_format: "auto",       // Conversión a WebP/AVIF
      width: 1200,                // Ancho máximo
      crop: "scale",             // Escala proporcional SIN recortar
      dpr: "auto",               // Optimización para pantallas retina
      effect: "improve:outdoor"  // Mejora automática de imagen
      // ❌ Eliminado: background (no compatible con 'scale' o 'limit')
    });

    return {
      url: result.secure_url,
      bytes: result.bytes,
      format: result.format
    };
  } catch (err) {
    console.error("Error en Cloudinary:", err);
    throw new Error("No se pudo optimizar la imagen");
  }
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

    /*const imagenProcesada = await procesarImagenBase64(imagen_1, razon_social, 'images/empresas');
    const imagenUrl = imagenProcesada?.url || imagen;*/

    const imagenCloudinary = await uploadToCloudinary(
  imagen_1, 
  'pompositienda/empresas', // Carpeta en Cloudinary
  `empresa_${id_empresa}`   // Identificador único (evita duplicados)
   );
  const imagenUrl = imagenCloudinary?.url || null; // Usa la URL de Cloudinary


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

  

    /*const imagenProcesada = await procesarImagenBase64(imagen_2, id_producto, 'images/productos');
    const imagenUrl = imagenProcesada?.url || productoData.imagen;*/



    const imagenCloudinary = await uploadToCloudinary(
  imagen_2, 
  'pompositienda/productos', // Carpeta en Cloudinary
  `empresa_${id_producto}`   // Identificador único (evita duplicados)
   );
 const imagenUrl = imagenCloudinary?.url || null; // Usa la URL de Cloudinary



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




app.post('/registroCategoria', async (req, res) => {
  const {
    id_categoria,
    nombre_categoria,
    descripcion,
    id_usuario,
    status
  } = req.body;

  // Verificar campos obligatorios
  if (!id_categoria || !nombre_categoria || !descripcion || !id_usuario ) {
    return res.status(400).json({
      status: 'error',
      message: 'Faltan campos requeridos'
    });
  }

 const fecha_creacion = new Date();


  try {
    // Insertar en la base de datos
    await pool.query(
      `INSERT INTO categoria (
        id_categoria,
        nombre_categoria,
        descripcion,
        id_usuario, fecha_creacion, status
      ) VALUES ($1, $2, $3 , $4, $5 , $6)`,
      [id_categoria, nombre_categoria, descripcion, id_usuario, fecha_creacion, status]
    );

    res.json({
      status: 'success',
      categoria: {
        id_categoria,
        nombre_categoria,
        descripcion,
        id_usuario,
        fecha_creacion,
        status
      }
    });

  } catch (err) {
    console.error('Error al registrar categoría', err);
    res.status(500).json({
      status: 'error',
      message: 'Error del servidor al registrar la categoría'
    });
  }
});




// Endpoint GET para obtener empresas
app.get('/empresas', async (req, res) => {
  try {
    const result = await pool.query("SELECT e.*, c.id_categoria, c.nombre_categoria AS nombre_categoria FROM empresa e JOIN categoria c ON e.id_categoria = c.id_categoria;");  const empresas = result.rows.map((e) => ({
      id_empresa: e.id_empresa,
      nombre_empresa: e.nombre_empresa,
      descripcion: e.descripcion,
      imagen: e.imagen,
      id_categoria: e.id_categoria,
      nombre_categoria: e.nombre_categoria,
      direccion: e.direccion,
      telefono: e.telefono,
      redesSociales: {
        instagram: e.instagram,
        facebook: e.facebook,
        tiktok: e.tiktok,
        web: e.web,
      },
      status: e.status,
    }));
    res.json(empresas);
  } catch (err) {
    console.error('Error al obtener empresas', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});



// Endpoint GET para obtener empresas
app.get('/empresas_activas', async (req, res) => {
  try {
    const result = await pool.query("SELECT e.*, c.id_categoria, c.nombre_categoria AS nombre_categoria FROM empresa e JOIN categoria c ON e.id_categoria = c.id_categoria where e.status='active';");  const empresas = result.rows.map((e) => ({
      id_empresa: e.id_empresa,
      nombre_empresa: e.nombre_empresa,
      descripcion: e.descripcion,
      imagen: e.imagen,
      id_categoria: e.id_categoria,
      nombre_categoria: e.nombre_categoria,
      direccion: e.direccion,
      telefono: e.telefono,
      redesSociales: {
        instagram: e.instagram,
        facebook: e.facebook,
        tiktok: e.tiktok,
        web: e.web,
      },
      status: e.status,
    }));
    res.json(empresas);
  } catch (err) {
    console.error('Error al obtener empresas', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});



// Endpoint GET para obtener usuarios
app.get('/all_usuarios', async (req, res) => {
  try {
    const result = await pool.query("SELECT *  from usuario;");  const usuarios = result.rows.map((u) => ({
      id_usuario: u.id_usuario,
      nombre1_usuario: u.nombre1_usuario,
      nombre2_usuario: u.nombre2_usuario,
      apellido1_usuario: u.apellido1_usuario,
      apellido2_usuario: u.apellido2_usuario,
      ci_usuario: u.ci_usuario,
      exp_ci_usuario: u.exp_ci_usuario,
      celular_usuario: u.celular_usuario,
      email_usuario: u.email_usuario,
      fecha_nac_usuario: u.fecha_nac_usuario,
      rol_usuario: u.rol_usuario,
      status: u.status,
    }));
    res.json(usuarios);
  } catch (err) {
    console.error('Error al obtener usuarios', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});





app.put('/eliminar/:tipo/:id/:id_usuario', async (req, res) => {
  const { tipo, id, id_usuario } = req.params;

  try {
    let totalRowsAffected = 0;

    switch (tipo) {
      case 'usuario': {
        const result = await pool.query("UPDATE usuario SET status = 'inactive' WHERE id_usuario = $1 AND status <> 'inactive'", [id]);
        totalRowsAffected += result.rowCount;
        break;
      }

      case 'producto': {
        const result = await pool.query("UPDATE producto SET status = 'inactive' WHERE id_producto = $1 AND status <> 'inactive'", [id]);
        totalRowsAffected += result.rowCount;
        break;
      }

      case 'empresa': {
        const resProd = await pool.query("UPDATE producto SET status = 'inactive' WHERE id_empresa = $1 AND status <> 'inactive'", [id]);
        totalRowsAffected += resProd.rowCount;

        const resEmp = await pool.query("UPDATE empresa SET status = 'inactive' WHERE id_empresa = $1 AND status <> 'inactive'", [id]);
        totalRowsAffected += resEmp.rowCount;
        break;
      }

      case 'categoria': {
        const resProd = await pool.query(`
          UPDATE producto 
          SET status = 'inactive' 
          WHERE id_empresa IN (
            SELECT id_empresa FROM empresa WHERE id_categoria = $1
          ) AND status <> 'inactive'
        `, [id]);
        totalRowsAffected += resProd.rowCount;

        const resEmp = await pool.query("UPDATE empresa SET status = 'inactive' WHERE id_categoria = $1 AND status <> 'inactive'", [id]);
        totalRowsAffected += resEmp.rowCount;

        const resCat = await pool.query("UPDATE categoria SET status = 'inactive' WHERE id_categoria = $1 AND status <> 'inactive'", [id]);
        totalRowsAffected += resCat.rowCount;
        break;
      }

      default:
        return res.status(400).json({ error: 'Tipo no válido' });
    }

    if (totalRowsAffected > 0) {
      await pool.query(`
        INSERT INTO registro_crud_datos (id_usuario, tabla, fecha_creacion, id_alterado, status, tipo_trans)
        VALUES ($1, $2, NOW(), $3, 'inactive', $4)
      `, [id_usuario, tipo, id , "delete"]);
      res.json({ mensaje: `Se marcó como inactivo correctamente en ${tipo}` });
    } else {
      res.json({ mensaje: `No se realizó ningún cambio en ${tipo} porque ya estaba inactivo o no existe.` });
    }

  } catch (err) {
    console.error(`Error al eliminar ${tipo}:`, err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});




app.put('/actualizar/:tipo/:id/:id_usuario', async (req, res) => {
  const { tipo, id, id_usuario } = req.params;
  const datos = req.body;

  try {
    let totalRowsAffected = 0;

    switch (tipo) {
      case 'usuario': {
        const result = await pool.query(
          `UPDATE usuario 
           SET celular_usuario = $1, email_usuario = $2, rol_usuario = $3
           WHERE id_usuario = $4`,
          [datos.celular_usuario, datos.email_usuario, datos.rol_usuario, id]
        );
        totalRowsAffected += result.rowCount;
        break;
      }

      case 'producto': {
        const result = await pool.query(
          `UPDATE producto 
           SET nombre_producto = $1, precio = $2, descuento = $3 
           WHERE id_producto = $4`,
          [datos.nombre_producto, datos.precio, datos.descuento, id]
        );
        totalRowsAffected += result.rowCount;
        break;
      }

      case 'empresa': {
        const result = await pool.query(
          `UPDATE empresa 
           SET nombre_empresa = $1, descripcion = $2, direccion = $3, telefono = $4 
           WHERE id_empresa = $5`,
          [datos.nombre_empresa, datos.descripcion, datos.direccion, datos.telefono, id]
        );
        totalRowsAffected += result.rowCount;
        break;
      }

      case 'categoria': {
        const result = await pool.query(
          `UPDATE categoria 
           SET nombre_categoria = $1, descripcion = $2 
           WHERE id_categoria = $3`,
          [datos.nombre_categoria, datos.descripcion, id]
        );
        totalRowsAffected += result.rowCount;
        break;
      }

      case 'compra_total': {
        // Actualizar compra_total
        const result = await pool.query(
          `UPDATE compra_total 
           SET nombre_factura = $1, nit_factura = $2, estado = $3 
           WHERE id_compra_total = $4`,
          [datos.nombre_factura, datos.nit_factura, datos.estado, id]
        );
        totalRowsAffected += result.rowCount;

        // Si la compra se cancela, se revierte el stock y se registra en control_inventario
        if (datos.estado.toLowerCase() === 'cancelado') {
          const detalles = await pool.query(
            `SELECT id_producto, cantidad 
             FROM compra_detalle 
             WHERE id_compra_total = $1`,
            [id]
          );

          // Obtener la hora de Bolivia (UTC-4)
          const fechaBolivia = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

          for (let detalle of detalles.rows) {
            const { id_producto, cantidad } = detalle;

            // Devolver al stock
            await pool.query(
              `UPDATE producto 
               SET cantidad_stock = cantidad_stock + $1 
               WHERE id_producto = $2`,
              [cantidad, id_producto]
            );

            // Insertar movimiento en control_inventario
            await pool.query(
              `INSERT INTO control_inventario (
                 id_usuario, fecha_creacion, tipo, cantidad, observaciones, id_producto, id_compra_total
               )
               VALUES ($1, $2, 'devolucion', $3, $4, $5, $6)`,
              [
                id_usuario,
                fechaBolivia,
                cantidad,
                'Devolución por cancelación',
                id_producto,
                id
              ]
            );
          }
        }
        break;
      }

      default:
        return res.status(400).json({ error: 'Tipo no válido' });
    }

    if (totalRowsAffected > 0) {
      await pool.query(
        `INSERT INTO registro_crud_datos 
         (id_usuario, tabla, fecha_creacion, id_alterado, status, tipo_trans, columnas_alteradas)
         VALUES ($1, $2, NOW(), $3, 'activo', $4, $5)`,
        [id_usuario, tipo, id, "update", JSON.stringify(datos)]
      );

      return res.json({ mensaje: `Registro de la tabla ${tipo} actualizado correctamente.` });
    } else {
      return res.json({ mensaje: `No se actualizó nada en ${tipo}, puede que no haya cambios.` });
    }

  } catch (err) {
    console.error(`Error al actualizar ${tipo}:`, err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});


app.post('/inventario/insercion', async (req, res) => {
  const { id_producto, cantidad, observaciones, id_usuario } = req.body;

  try {
    // 1. Verificamos si el producto existe
    const productoResult = await pool.query(
      'SELECT * FROM producto WHERE id_producto = $1',
      [id_producto]
    );

    if (productoResult.rows.length === 0) {
      return res.status(404).json({ error: 'El producto no existe' });
    }

    // 2. Convertimos cantidad a entero por si viene como string
    const cantidadNum = parseInt(cantidad, 10);

    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({ error: 'Cantidad inválida' });
    }

    // 3. Aumentamos el stock del producto
    await pool.query(
      'UPDATE producto SET cantidad_stock = cantidad_stock + $1 WHERE id_producto = $2',
      [cantidadNum, id_producto]
    );

    // 4. Fecha actual de Bolivia sin moment
    const fechaBolivia = new Date();
    fechaBolivia.setHours(fechaBolivia.getHours() - 4); // UTC-4

    // 5. Insertamos en control_inventario
    await pool.query(
      `INSERT INTO control_inventario (
         id_usuario, fecha_creacion, tipo, cantidad, observaciones, id_producto, id_compra_total
       )
       VALUES ($1, $2, 'insercion', $3, $4, $5, NULL)`,
      [
        id_usuario,
        fechaBolivia,
        cantidadNum,
        observaciones || 'Inserción de inventario',
        id_producto
      ]
    );

    res.status(201).json({ mensaje: 'Inventario insertado correctamente 💼🍬' });

  } catch (err) {
    console.error('Error al insertar inventario:', err);
    res.status(500).json({ error: 'Ocurrió un error al insertar el inventario' });
  }
});
 



// Endpoint GET para obtener empresas
app.get('/categorias_activas', async (req, res) => {
  try {
    const result = await pool.query("SELECT * from categoria where status='active';");  const empresas = result.rows.map((c) => ({
      id_categoria: c.id_categoria,
      nombre_categoria: c.nombre_categoria,
      descripcion: c.descripcion,
      fecha_creacion: c.fecha_creacion,
      status: c.status,
    }));
    res.json(empresas);
  } catch (err) {
    console.error('Error al obtener la categoría', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});


// Endpoint GET para obtener empresas
app.get('/categorias', async (req, res) => {
  try {
    const result = await pool.query("SELECT * from categoria");  const empresas = result.rows.map((c) => ({
      id_categoria: c.id_categoria,
      nombre_categoria: c.nombre_categoria,
      descripcion: c.descripcion,
      fecha_creacion: c.fecha_creacion,
      status: c.status,
    }));
    res.json(empresas);
  } catch (err) {
    console.error('Error al obtener la categoría', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});



// Endpoint GET para obtener productos
app.get('/productos', async (req, res) => {
  try {
    const result = await pool.query("SELECT p.*, e.nombre_empresa, c.nombre_categoria FROM producto p JOIN empresa e ON p.id_empresa = e.id_empresa JOIN categoria c ON p.id_categoria = c.id_categoria WHERE 1=1;");  const productos = result.rows.map((p) => ({
       id_empresa: p.id_empresa,
      nombre_empresa: p.nombre_empresa,
      id_categoria: p.id_categoria,
      nombre_categoria: p.nombre_categoria,
      id_producto: p.id_producto,
      nombre_producto: p.nombre_producto,
      precio: p.precio,
      descripcion: p.descripcion,
      imagen: p.imagen,
      descuento: p.descuento,
      cantidad_stock: p.cantidad_stock,
      status: p.status,
      }));
    res.json(productos);
  } catch (err) {
    console.error('Error al obtener los productos', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

 


app.get('/productos_activos', async (req, res) => {
  const { id_empresa, id_categoria } = req.query;

  try {
    // Empezamos con la consulta base, manteniendo los JOINs que ya tenías
   let query = `
  SELECT p.*, e.nombre_empresa, c.nombre_categoria 
  FROM producto p 
  JOIN empresa e ON p.id_empresa = e.id_empresa 
  JOIN categoria c ON p.id_categoria = c.id_categoria 
  WHERE 1=1
`;

query += ` AND p.status = 'active'`; // ✅ Funciona bien
    
    // Aquí se guardan los valores a pasar a la consulta
    const values = [];
    let paramIndex = 1;

    // Añadimos filtros si existen
    if (id_empresa) {
      query += ` AND p.id_empresa = $${paramIndex}`;
      values.push(id_empresa);
      paramIndex++;
    }
    if (id_categoria) {
      query += ` AND p.id_categoria = $${paramIndex}`;
      values.push(id_categoria);
      paramIndex++;
    }

    // Ejecutamos la consulta con los filtros aplicados
    const result = await pool.query(query, values);

    // Mapeamos los resultados para devolver la respuesta
    const productos = result.rows.map((p) => ({
      id_empresa: p.id_empresa,
      nombre_empresa: p.nombre_empresa,
      id_categoria: p.id_categoria,
      nombre_categoria: p.nombre_categoria,
      id_producto: p.id_producto,
      nombre_producto: p.nombre_producto,
      precio: p.precio,
      descripcion: p.descripcion,
      imagen: p.imagen,
      descuento: p.descuento,
      cantidad_stock: p.cantidad_stock,
      status: p.status,
    }));

    // Enviamos la respuesta
    res.json(productos);
  } catch (err) {
    console.error('Error al obtener productos', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});





app.post('/compra', async (req, res) => {
  const { id_usuario, total, estado, nombre_factura, nit_factura, detalles } = req.body;

  try {
    // 1. Verificamos el stock
    let stockInsuficiente = null;

    for (let detalle of detalles) {
      const resultado = await pool.query(
        'SELECT cantidad_stock FROM producto WHERE id_producto = $1',
        [detalle.id_producto]
      );

      if (resultado.rows.length === 0) {
        stockInsuficiente = `El producto con ID ${detalle.id_producto} no existe.`;
        break;
      }

      const stockDisponible = resultado.rows[0].cantidad_stock;

      if (detalle.cantidad > stockDisponible) {
        stockInsuficiente = `Stock insuficiente para el producto con ID ${detalle.id_producto}. Solicitado: ${detalle.cantidad}, Disponible: ${stockDisponible}`;
        break;
      }
    }

    if (stockInsuficiente) {
      return res.status(400).json({ error: stockInsuficiente });
    }

    // 2. Insertamos en compra_total
    const compraResult = await pool.query(
      `INSERT INTO compra_total (id_usuario, total, estado, nombre_factura, nit_factura)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_compra_total`,
      [id_usuario, total, estado, nombre_factura, nit_factura]
    );

    const id_compra_total = compraResult.rows[0].id_compra_total;

    // 3. Obtener la fecha en Bolivia (UTC-4)
    const fechaBolivia = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const fechaFormateada = fechaBolivia.toISOString(); // PostgreSQL friendly

    // 4. Insertamos detalles, actualizamos stock y registramos en control_inventario
    for (let detalle of detalles) {
      // Detalle de compra
      await pool.query(
        `INSERT INTO compra_detalle (id_producto, cantidad, precio_unitario, precio_total, id_compra_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [detalle.id_producto, detalle.cantidad, detalle.precio_unitario, detalle.precio_total, id_compra_total]
      );

      // Actualizar stock
      await pool.query(
        `UPDATE producto SET cantidad_stock = cantidad_stock - $1 WHERE id_producto = $2`,
        [detalle.cantidad, detalle.id_producto]
      );

      // Insertar en control_inventario
      await pool.query(
        `INSERT INTO control_inventario (
           id_usuario, fecha_creacion, tipo, cantidad, observaciones, id_producto, id_compra_total
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id_usuario,            // id_usuario
          fechaFormateada,       // fecha_creacion
          "compra",              // tipo
          detalle.cantidad,      // cantidad
          'Compra registrada',   // observaciones
          detalle.id_producto,   // id_producto
          id_compra_total        // id_compra_total
        ]
      );
    }

    // 5. Todo bien, respondemos
    res.status(201).json({
      message: 'Compra registrada correctamente.',
      id_compra_total
    });

  } catch (error) {
    console.error('Error al registrar la compra:', error);
    res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
  }
});





app.get('/historial', async (req, res) => {
  const { id_usuario } = req.query;

  try {
    // Primero traemos TODAS las compras del usuario
    let queryCompras = `
      SELECT * 
      FROM compra_total
      WHERE id_usuario = $1
      ORDER BY fecha_compra_total DESC
    `;

    const comprasResult = await pool.query(queryCompras, [id_usuario]);

    if (comprasResult.rows.length === 0) {
      return res.json([]);
    }

    // Para cada compra, buscamos sus detalles
    const historial = await Promise.all(
      comprasResult.rows.map(async (compra) => {
        const queryDetalles = `
          SELECT 
            d.id_producto,
            d.cantidad,
            d.precio_unitario,
            d.precio_total,
            p.nombre_producto
          FROM compra_detalle d
          JOIN producto p ON d.id_producto = p.id_producto
          WHERE d.id_compra_total = $1
        `;

        const detallesResult = await pool.query(queryDetalles, [compra.id_compra_total]);

        return {
          id_compra_total: compra.id_compra_total,
          id_usuario: compra.id_usuario,
          total: compra.total,
          estado: compra.estado,
          nombre_factura: compra.nombre_factura,
          nit_factura: compra.nit_factura,
          fecha_compra_total: compra.fecha_compra_total,
          detalles: detallesResult.rows.map((d) => ({
            id_producto: d.id_producto,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            precio_total: d.precio_total,
            nombre_producto: d.nombre_producto,
          }))
        };
      })
    );

    res.json(historial);

  } catch (err) {
    console.error('Error al obtener historial', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});



// Ruta de login
app.post('/login', async (req, res) => {
  console.log('Request body:', req.body);  // Verifica qué estás recibiendo
  console.log('Headers:', req.headers);    // Verifica los headers

  // Desestructuración de los datos del body
  const { email_usuario, password_usuario } = req.body;
  
  // Verifica si los datos fueron proporcionados
  if (!email_usuario || !password_usuario) {
    return res.status(400).json({
      status: 'error',
      message: 'Email y contraseña son requeridos'
    });
  }

  try {
    // Realiza la consulta a la base de datos usando los parámetros correctos
    const result = await pool.query(
      "SELECT * FROM usuario WHERE email_usuario = $1 AND password_usuario = $2 AND status='active'",
      [email_usuario, password_usuario]  // Cambié 'email' por 'email_usuario
    );

    // Verifica si el usuario existe
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Usuario o contraseña incorrectos' 
      });
    }

    // Obtén los datos del usuario
    const usuario = result.rows[0];

    // Responde con los datos del usuario
    res.json({
      status: 'success', 
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre1_usuario: usuario.nombre1_usuario,
        apellido1_usuario: usuario.apellido1_usuario,
        email_usuario: usuario.email_usuario,
        celular_usuario: usuario.celular_usuario,
        rol_usuario: usuario.rol_usuario
      }
    });

  } catch (err) {
    console.error('Error al iniciar sesión', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Error del servidor' 
    });
  }
});





app.post('/registro', async (req, res) => {
  const {
    id_usuario,
    nombre1_usuario,
    nombre2_usuario,
    apellido1_usuario,
    apellido2_usuario,
    ci_usuario,
    exp_ci_usuario,
    celular_usuario,
    email_usuario,
    password_usuario,
    fecha_nac_usuario,
    rol_usuario,
    usuario_creador,
    status
  } = req.body;

  // Verificar campos obligatorios
  if (!email_usuario || !password_usuario || !nombre1_usuario || !apellido1_usuario) {
    return res.status(400).json({
      status: 'error',
      message: 'Faltan campos requeridos'
    });
  }

 const fecha_creacion = new Date();

  try {
    // Insertar en la base de datos
    await pool.query(
      `INSERT INTO usuario (
        id_usuario,
        nombre1_usuario,
        nombre2_usuario,
        apellido1_usuario,
        apellido2_usuario,
        ci_usuario,
        exp_ci_usuario,
        celular_usuario,
        email_usuario,
        password_usuario,
        fecha_nac_usuario,
        rol_usuario,
        fecha_creacion,
        usuario_creador,
        status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id_usuario,
        nombre1_usuario,
        nombre2_usuario,
        apellido1_usuario,
        apellido2_usuario,
        ci_usuario,
        exp_ci_usuario,
        celular_usuario,
        email_usuario,
        password_usuario,
        fecha_nac_usuario,
        rol_usuario,
        fecha_creacion,
        usuario_creador,
        status
      ]
    );

    // Respuesta exitosa (puedes devolver el mismo formato que login si quieres que el usuario inicie sesión directamente)
    res.json({
      status: 'success',
      usuario: {
        id_usuario,
        nombre1_usuario,
        apellido1_usuario,
        email_usuario,
        celular_usuario,
        rol_usuario
      }
    });

  } catch (err) {
    console.error('Error al registrar usuario', err);
    res.status(500).json({
      status: 'error',
      message: 'Error del servidor al registrar'
    });
  }
});



//STATISTICS

app.post('/usuarios_por_fecha', async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.body;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Faltan parámetros: fecha_inicio o fecha_fin' });
  }

  try {
    const query = `
      SELECT 
        TO_CHAR(fecha_creacion::date, 'YYYY-MM-DD') AS fecha,
        COUNT(*) AS usuarios
      FROM usuario
      WHERE fecha_creacion BETWEEN $1 AND $2
      GROUP BY fecha
      ORDER BY fecha;
    `;
    
    const result = await pool.query(query, [fecha_inicio, fecha_fin]);

    const registros = result.rows.map(row => ({
      fecha: row.fecha,
      usuarios: parseInt(row.usuarios),
    }));

    res.json(registros);
  } catch (err) {
    console.error('Error al obtener usuarios por fecha:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});


app.post('/ventas_por_fecha', async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.body;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Faltan parámetros: fecha_inicio o fecha_fin' });
  }

  try {
    const result = await pool.query(
      `SELECT 
         DATE(fecha_compra_total) AS fecha, 
         SUM(total) AS total_dia 
       FROM compra_total 
       WHERE fecha_compra_total BETWEEN $1 AND $2
      AND estado <> 'cancelado'
       GROUP BY DATE(fecha_compra_total)
       ORDER BY fecha;`,
      [fecha_inicio, fecha_fin]
    );

    const respuesta = result.rows.map((row) => ({
      fecha: row.fecha,
      total: Number(row.total_dia),
    }));

    res.json(respuesta);
  } catch (err) {
    console.error('Error al obtener los totales', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});



// Suponiendo que ya tienes tu conexión pool hecha
app.post('/ventas_por_dia_detalle', async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.body;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Faltan parámetros: fecha_inicio o fecha_fin' });
  }

  try {
   
      const query = `
     SELECT 
  DATE(c.fecha_compra_total) AS fecha,
  p.nombre_producto,
  SUM(d.cantidad) AS total_vendido
FROM compra_detalle d
JOIN producto p ON d.id_producto = p.id_producto
JOIN compra_total c ON d.id_compra_total = c.id_compra_total
WHERE 
  c.fecha_compra_total BETWEEN $1 AND $2
  AND c.estado <> 'cancelado'
GROUP BY fecha, p.nombre_producto
ORDER BY fecha ASC, total_vendido DESC;
    `;


    const values = [fecha_inicio, fecha_fin];
    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener ventas por día:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});


// Endpoint GET para obtener empresas
app.get('/listado_compras', async (req, res) => {
  try {
    const result = await pool.query("SELECT * from compra_total");  const compras = result.rows.map((ct) => ({
      id_compra_total: ct.id_compra_total,
      id_usuario: ct.id_usuario,
      fecha_compra_total: ct.fecha_compra_total,
      total: ct.total,
      estado: ct.estado,
      nombre_factura: ct.nombre_factura,
      nit_factura: ct.nit_factura,
    }));
    res.json(compras);
  } catch (err) {
    console.error('Error al obtener el listado de compras', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});






app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
