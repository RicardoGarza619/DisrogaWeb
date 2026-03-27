// lib/mailer.js — Envío de correos con nodemailer
const nodemailer = require('nodemailer');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,          // STARTTLS en puerto 587
  requireTLS: true,       // Obligatorio para Office 365
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false,
  },
});

// Verificar conexión SMTP al iniciar
transporter.verify((err) => {
  if (err) console.error('[Mailer] ❌ Error SMTP:', err.message);
  else console.log('[Mailer] ✅ SMTP listo:', process.env.SMTP_HOST);
});

// Correo al vendedor con el pedido completo
async function enviarPedidoVendedor(pedido, items, isGuest = false) {
  const rows = items.map(it =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">
        <strong style="color:#1A5C2A">${it.producto_id}</strong> - ${it.nombre_producto}
        <br><span style="font-size:0.75rem;color:#6b7280">Disponible: ${it.existencia || 0}</span>
      </td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${it.cantidad}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">$${it.precio_unitario.toFixed(2)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">$${it.subtotal.toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `
  <div style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto">
    <div style="background:#1A5C2A;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <img src="cid:disroga_logo" alt="Disroga" style="height:48px;margin-bottom:12px;" />
      <h1 style="color:#8DC63F;margin:0;font-size:1.4rem"> Nuevo Pedido Recibido</h1>
    </div>
    <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
      <table style="width:100%;margin-bottom:20px">
        <tr><td style="color:#6b7280;width:140px">Cliente</td><td><strong>${pedido.nombre_contacto}</strong></td></tr>
        ${pedido.empresa ? `<tr><td style="color:#6b7280">Empresa</td><td>${pedido.empresa}</td></tr>` : ''}
        <tr><td style="color:#6b7280">Teléfono</td><td>${pedido.telefono}</td></tr>
        <tr><td style="color:#6b7280">Correo</td><td>${pedido.email}</td></tr>
        ${pedido.notas ? `<tr><td style="color:#6b7280">Notas</td><td>${pedido.notas}</td></tr>` : ''}
      </table>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#1A5C2A;color:#fff">
            <th style="padding:8px 12px;text-align:left">Producto</th>
            <th style="padding:8px 12px">Cant.</th>
            <th style="padding:8px 12px;text-align:right">Precio</th>
            <th style="padding:8px 12px;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:10px 12px;text-align:right;font-weight:700">TOTAL</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#1A5C2A;font-size:1.1rem">$${pedido.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:20px; font-size:0.85rem; color:#6b7280; line-height:1.5;">
        <p style="margin:4px 0;">* Todos los precios incluyen el <strong>8% de IVA</strong>.</p>
        ${isGuest ? '<p style="margin:4px 0; color:#d97706;"><strong>* Nota:</strong> El cliente es un invitado. Los precios listados ya incluyen un margen del <strong>+10%</strong> sobre el precio regular del catálogo.</p>' : ''}
        <p style="color:#9ca3af;margin-top:12px">Pedido #${pedido.id} &mdash; ${new Date().toLocaleString('es-MX')}</p>
      </div>
    </div>
  </div>`;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: process.env.EMAIL_VENTAS,
    subject: `Nuevo pedido de ${pedido.nombre_contacto} — $${pedido.total.toFixed(2)}`,
    html,
    attachments: [{
      filename: 'logo.png',
      path: path.join(__dirname, '../public/img/logo.png'),
      cid: 'disroga_logo' // must align with img src inside html
    }]
  });
}

// Correo al cliente como acuse de recibo
async function enviarPedidoCliente(pedido, items, isGuest = false) {
  const rows = items.map(it =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">
        <strong style="color:#1A5C2A">${it.producto_id}</strong> - ${it.nombre_producto}
      </td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${it.cantidad}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">$${it.precio_unitario.toFixed(2)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">$${it.subtotal.toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `
  <div style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto">
    <div style="background:#1A5C2A;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <img src="cid:disroga_logo" alt="Disroga" style="height:48px;margin-bottom:12px;" />
      <h1 style="color:#8DC63F;margin:0;font-size:1.4rem">¡Gracias por tu pedido!</h1>
    </div>
    <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
      <p style="font-size:1.05rem;line-height:1.5;">Hola <strong>${pedido.nombre_contacto}</strong>,</p>
      <p style="font-size:1rem;color:#4b5563;line-height:1.5;">
        Hemos recibido tu solicitud correctamente. Nuestro equipo de ventas está revisando tu pedido y se pondrá en contacto contigo a la brevedad cuando lo tengan listo para procesar. Agradecemos profundamente tu preferencia.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-top:24px;">
        <thead>
          <tr style="background:#1A5C2A;color:#fff">
            <th style="padding:8px 12px;text-align:left">Producto</th>
            <th style="padding:8px 12px">Cant.</th>
            <th style="padding:8px 12px;text-align:right">Precio</th>
            <th style="padding:8px 12px;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:10px 12px;text-align:right;font-weight:700">TOTAL</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#1A5C2A;font-size:1.1rem">$${pedido.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:20px; font-size:0.85rem; color:#6b7280; line-height:1.5;">
        <p style="margin:4px 0;">* Todos los precios incluyen el <strong>8% de IVA</strong>.</p>
        ${isGuest ? '<p style="margin:4px 0; color:#d97706;"><strong>* Nota:</strong> Al no tener sesión iniciada, los precios listados incluyen tu margen aplicado sobre catálogo general.</p>' : ''}
        <p style="color:#9ca3af;margin-top:12px">Pedido #${pedido.id} &mdash; ${new Date().toLocaleString('es-MX')}</p>
      </div>
    </div>
  </div>`;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: pedido.email,
    subject: `Confirmación de Pedido #${pedido.id} - Disroga`,
    html,
    attachments: [{
      filename: 'logo.png',
      path: path.join(__dirname, '../public/img/logo.png'),
      cid: 'disroga_logo'
    }]
  });
}

// Correo de recuperación de contraseña
async function enviarResetPassword(destinatario, nombre, token) {
  const url = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  const html = `
  <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto">
    <div style="background:#1A5C2A;padding:24px 32px;border-radius:12px 12px 0 0">
      <h1 style="color:#8DC63F;margin:0;font-size:1.3rem">🔑 Recuperar Contraseña</h1>
    </div>
    <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para continuar:</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${url}" style="background:#1A5C2A;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:700">
          Restablecer Contraseña
        </a>
      </div>
      <p style="color:#6b7280;font-size:0.85rem">Este enlace expira en <strong>1 hora</strong>. Si no solicitaste este cambio, ignora este correo.</p>
    </div>
  </div>`;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: destinatario,
    subject: 'Disroga – Recuperar contraseña',
    html,
  });
}

module.exports = { enviarPedidoVendedor, enviarPedidoCliente, enviarResetPassword };
