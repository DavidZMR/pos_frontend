// Marca visible de la app de escritorio (ventana, pantalla de carga, diálogos). El instalador toma
// `productName` de electron-builder.yml y la UI de src/app/core/branding.ts: cambiar los tres juntos.
module.exports = Object.freeze({
  DISPLAY_NAME: 'El Atlántico',
  LEAD: 'El',
  STRONG: 'Atlántico',
  /**
   * Carpeta de datos en %APPDATA% (config.json de la PC, registro). Fija y en ASCII: no cambia
   * aunque cambie el nombre visible, así una PC no pierde su báscula/impresora configuradas.
   */
  DATA_DIR: 'PuntoVenta',
});
