# 📧 Descarga Automática de Facturas desde Gmail

Sistema automatizado para descargar, organizar y comprimir facturas recibidas por correo electrónico desde mayoristas.

## 🚀 Características

- ✅ Descarga automática de facturas diarias desde Gmail
- ✅ Organización por empresa/mayorista
- ✅ Compresión inteligente en archivos ZIP
- ✅ Envío automático por correo electrónico
- ✅ Ejecución automática con GitHub Actions
- ✅ División automática de ZIPs grandes (+18 MB)

## 📋 Requisitos

- Node.js 20 o superior
- Cuenta de Gmail con API habilitada
- Proyecto en Google Cloud Console

## 🔧 Configuración Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Gmail API

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Gmail API**
4. Crea credenciales OAuth 2.0
5. Descarga el archivo de credenciales y guárdalo como `credentials.json`

### 3. Configurar mayoristas

Edita el archivo `mayoristas.json` con tus proveedores:

```json
{
  "027": "Mayorista Ejemplo S.L.",
  "035": "Distribuciones ABC",
  "042": "Suministros XYZ"
}
```

### 4. Primera ejecución

```bash
npm start
```

La primera vez te pedirá autorizar el acceso a Gmail. Sigue las instrucciones en la terminal.

## 🤖 Automatización con GitHub Actions

Para configurar la ejecución automática diaria en GitHub, consulta la guía completa:

👉 **[GITHUB_ACTIONS.md](GITHUB_ACTIONS.md)**

### Resumen rápido:

1. Sube el proyecto a GitHub
2. Configura 3 secrets en tu repositorio:
   - `GMAIL_CREDENTIALS` - Contenido de credentials.json
   - `GMAIL_TOKEN` - Contenido de token.json
   - `TO_EMAIL` - Tu correo de destino
3. El workflow se ejecutará automáticamente cada día a las 9:00 AM UTC

## 📁 Estructura del Proyecto

```
proyecto-git/
├── .github/
│   └── workflows/
│       └── facturas-diarias.yml    # Workflow de GitHub Actions
├── ficheros/                        # PDFs descargados (ignorado en git)
│   └── YYYY-MM-DD/                 # Por fecha
│       ├── Mayorista 1/
│       └── Mayorista 2/
├── zips/                           # ZIPs generados (ignorado en git)
├── correos-dia-actual.js           # Script principal
├── credentials.json                # Credenciales Gmail (NO subir a git)
├── token.json                      # Token de acceso (NO subir a git)
├── mayoristas.json                 # Mapeo de mayoristas
├── package.json
├── .gitignore
├── README.md
└── GITHUB_ACTIONS.md              # Guía de configuración
```

## 🎯 Funcionamiento

1. **Búsqueda**: Busca correos del día actual de `anubisgestion.com` con adjuntos
2. **Descarga**: Descarga los PDFs adjuntos
3. **Organización**: Clasifica por empresa según el remitente (may027@, may035@, etc.)
4. **Compresión**: Crea ZIPs optimizados (<18 MB por archivo)
5. **Envío**: Envía los ZIPs al correo configurado

## 🔒 Seguridad

- ❌ Nunca subas `credentials.json` o `token.json` a GitHub
- ✅ Usa secrets de GitHub Actions para datos sensibles
- ✅ El `.gitignore` está configurado para proteger archivos sensibles
- ✅ Los tokens se almacenan de forma segura

## 📊 Monitorización

Puedes ver el estado de las ejecuciones en:
- **Local**: Logs en la terminal
- **GitHub Actions**: Pestaña "Actions" en tu repositorio

## ⚙️ Configuración Avanzada

### Cambiar el límite de tamaño de ZIP

Edita en `correos-dia-actual.js`:

```javascript
const MAX_ZIP_MB = 18; // Cambiar según necesites
```

### Cambiar el correo de destino (local)

```javascript
const TO_EMAIL = "tu-email@ejemplo.com";
```

### Modificar la búsqueda de correos

Edita la query de Gmail en `correos-dia-actual.js`:

```javascript
const QUERY = `from:anubisgestion.com has:attachment after:${todayDate} before:${tomorrowDate}`;
```

## 🐛 Solución de Problemas

### "Error al autorizar"
- Verifica que `credentials.json` sea válido
- Asegúrate de haber habilitado la Gmail API

### "No se encuentran correos"
- Verifica que haya correos del día actual
- Comprueba la query de búsqueda

### "Token expirado"
- Elimina `token.json` y vuelve a ejecutar
- Autoriza nuevamente el acceso

## 📝 Scripts disponibles

```bash
# Ejecutar el script
npm start

# Instalar dependencias
npm install
```

## 🤝 Contribuir

Este es un proyecto personal, pero las sugerencias son bienvenidas.

## 📄 Licencia

ISC

---

**Nota**: Este proyecto maneja datos sensibles. Asegúrate de configurar correctamente los permisos y secrets.
