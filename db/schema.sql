-- =============================================
-- Disroga S.A. de C.V. - Schema y datos de ejemplo
-- =============================================

CREATE DATABASE IF NOT EXISTS disroga CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE disroga;

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  icono VARCHAR(50) DEFAULT '📦',
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2) NOT NULL,
  precio_caja DECIMAL(10,2),
  unidad VARCHAR(30) DEFAULT 'pieza',
  imagen_url VARCHAR(500),
  marca VARCHAR(100),
  codigo VARCHAR(50),
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- Tabla de ofertas
CREATE TABLE IF NOT EXISTS ofertas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio_oferta DECIMAL(10,2) NOT NULL,
  descuento_pct INT DEFAULT 0,
  badge VARCHAR(50) DEFAULT 'Oferta',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- =============================================
-- DATOS DE EJEMPLO (SEED)
-- =============================================

INSERT INTO categorias (nombre, icono) VALUES
  ('Lácteos', '🥛'),
  ('Bebidas', '🥤'),
  ('Abarrotes', '🛒'),
  ('Limpieza', '🧹'),
  ('Botanas', '🍿'),
  ('Dulces', '🍬'),
  ('Enlatados', '🥫'),
  ('Cereales', '🌾');

INSERT INTO productos (categoria_id, nombre, descripcion, precio, precio_caja, unidad, marca, codigo) VALUES
  (1, 'Leche Lala Entera 1L', 'Leche entera pasteurizada', 22.50, 250.00, 'litro', 'Lala', 'LALA-001'),
  (1, 'Crema Lala 200g', 'Crema ácida lista para servir', 18.00, 200.00, 'pieza', 'Lala', 'LALA-002'),
  (1, 'Queso Manchego 400g', 'Queso manchego rebanado', 85.00, 950.00, 'pieza', 'Chedritos', 'QUE-001'),
  (2, 'Coca-Cola 600ml', 'Refresco sabor cola', 18.00, 200.00, 'pieza', 'Coca-Cola', 'CC-001'),
  (2, 'Agua Bonafont 1.5L', 'Agua natural purificada', 14.00, 155.00, 'pieza', 'Bonafont', 'BON-001'),
  (2, 'Jumex Mango 335ml', 'Néctar de mango', 12.00, 130.00, 'pieza', 'Jumex', 'JMX-001'),
  (3, 'Arroz SOS 1kg', 'Arroz grano largo', 28.00, 300.00, 'kg', 'SOS', 'ARR-001'),
  (3, 'Frijol Negro 1kg', 'Frijol negro seleccionado', 30.00, 320.00, 'kg', 'La Sierra', 'FRJ-001'),
  (3, 'Aceite Nutrioli 900ml', 'Aceite de maíz', 55.00, 620.00, 'pieza', 'Nutrioli', 'ACE-001'),
  (4, 'Jabón Ariel 1kg', 'Detergente en polvo', 65.00, 720.00, 'pieza', 'Ariel', 'JAB-001'),
  (4, 'Pinol 800ml', 'Limpiador multiusos', 32.00, 350.00, 'pieza', 'Pinol', 'PIN-001'),
  (5, 'Sabritas Original 45g', 'Papas fritas sabor original', 15.00, 170.00, 'pieza', 'Sabritas', 'SAB-001'),
  (5, 'Takis Fuego 68g', 'Totopos enrollados picantes', 18.00, 200.00, 'pieza', 'Barcel', 'TAK-001'),
  (6, 'Gansito Marinela', 'Pastelito relleno de crema', 14.00, 150.00, 'pieza', 'Marinela', 'GAN-001'),
  (7, 'Atún Dolores 140g', 'Atún en agua', 22.00, 250.00, 'pieza', 'Dolores', 'ATN-001'),
  (8, 'Corn Flakes Kellogg´s 500g', 'Cereal de maíz tostado', 72.00, 800.00, 'caja', 'Kellogg´s', 'CER-001');

INSERT INTO ofertas (producto_id, titulo, descripcion, precio_oferta, descuento_pct, badge, fecha_inicio, fecha_fin) VALUES
  (4, '¡Coca-Cola al 2x1!', 'Lleva 2 Coca-Cola 600ml por el precio de 1. Oferta por tiempo limitado.', 18.00, 50, '2x1', '2026-03-01', '2026-03-31'),
  (9, 'Aceite Nutrioli de Oferta', 'Precio especial en aceite Nutrioli 900ml. Máx 3 piezas por cliente.', 45.00, 18, '18% OFF', '2026-03-10', '2026-03-20'),
  (10, 'Ariel al mejor precio', 'Detergente Ariel 1kg a precio de mayoreo.', 55.00, 15, '15% OFF', '2026-03-01', '2026-03-31'),
  (7, 'Arroz SOS Paquete', 'Compra 5kg de Arroz SOS y obtén descuento especial.', 130.00, 10, 'Pack 5kg', '2026-03-05', '2026-03-25');
