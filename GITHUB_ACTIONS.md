# Configuración de GitHub Actions

Este proyecto usa GitHub Actions para ejecutar automáticamente el script de descarga de facturas todos los días.

## 📋 Requisitos Previos

1. Tener una cuenta de GitHub
2. Tener el proyecto subido a GitHub
3. Tener configurada la API de Gmail (archivo `credentials.json`)

## 🔧 Configuración de Secrets en GitHub

Los secrets son variables secretas que GitHub Actions usa de forma segura. Necesitas configurar los siguientes:

### Paso 1: Acceder a la configuración de Secrets

1. Ve a tu repositorio en GitHub
2. Haz clic en **Settings** (Configuración)
3. En el menú lateral, haz clic en **Secrets and variables** → **Actions**
4. Haz clic en **New repository secret**

### Paso 2: Crear los Secrets necesarios

Debes crear **3 secrets**:

#### 1. `GMAIL_CREDENTIALS`

- **Nombre**: `GMAIL_CREDENTIALS`
- **Valor**: El contenido completo del archivo `credentials.json`
  
```bash
# Para copiar el contenido:
cat credentials.json
```

#### 2. `GMAIL_TOKEN`

- **Nombre**: `GMAIL_TOKEN`
- **Valor**: El contenido completo del archivo `token.json` (se genera después de la primera autenticación)

```bash
# Para copiar el contenido:
cat token.json
```

⚠️ **Importante**: Si aún no tienes `token.json`, ejecuta el script localmente una vez para generarlo:

```bash
node correos-dia-actual.js
```

#### 3. `TO_EMAIL`

- **Nombre**: `TO_EMAIL`
- **Valor**: El correo electrónico destino (por ejemplo: `josemanuel30503@hotmail.com`)

## 🚀 Ejecución del Workflow

### Ejecución Automática

El workflow se ejecuta automáticamente todos los días a las **9:00 AM UTC** (10:00/11:00 AM hora española).

### Ejecución Manual

Para ejecutar el workflow manualmente:

1. Ve a tu repositorio en GitHub
2. Haz clic en la pestaña **Actions**
3. Selecciona el workflow **"Descargar Facturas Diarias"**
4. Haz clic en **Run workflow**
5. Confirma haciendo clic en el botón verde **Run workflow**

## 📊 Monitorización

### Ver el estado de las ejecuciones

1. Ve a la pestaña **Actions** en tu repositorio
2. Verás todas las ejecuciones del workflow
3. Haz clic en cualquier ejecución para ver los detalles y logs

### Descargar archivos generados

Los archivos descargados (PDFs y ZIPs) se guardan como artifacts por 7 días:

1. Entra en la ejecución del workflow
2. Al final de la página, en la sección **Artifacts**, encontrarás los archivos
3. Haz clic para descargarlos

## 🔒 Actualizar el Token de Gmail

Si el token expira o necesitas actualizarlo:

1. Ejecuta el workflow manualmente
2. Revisa los logs del workflow
3. Si hay un nuevo token, aparecerá en los logs
4. Copia el nuevo token y actualiza el secret `GMAIL_TOKEN`

## ⏰ Cambiar el Horario de Ejecución

Para cambiar la hora de ejecución automática, edita el archivo `.github/workflows/facturas-diarias.yml`:

```yaml
schedule:
  - cron: '0 9 * * *'  # Formato: 'minuto hora * * *'
```

Ejemplos de horarios:
- `'0 8 * * *'` - 8:00 AM UTC
- `'30 10 * * *'` - 10:30 AM UTC
- `'0 14 * * 1-5'` - 2:00 PM UTC, solo lunes a viernes

**Calculadora de CRON**: https://crontab.guru/

## 📝 Notas Importantes

1. **Límite de Gmail API**: Ten en cuenta los límites de uso de la API de Gmail
2. **Zona horaria**: GitHub Actions usa UTC, ajusta el horario según tu zona
3. **Secrets sensibles**: Nunca compartas tus secrets públicamente
4. **Token de actualización**: El token puede necesitar renovarse periódicamente

## 🐛 Solución de Problemas

### Error de autenticación

Si el workflow falla con error de autenticación:
1. Verifica que los secrets estén correctamente configurados
2. Revisa que el contenido de `GMAIL_CREDENTIALS` y `GMAIL_TOKEN` sea válido
3. Regenera el token ejecutando el script localmente

### No se envían los correos

Si los ZIPs se crean pero no se envían:
1. Verifica que `TO_EMAIL` esté correctamente configurado
2. Revisa los logs del workflow para ver errores específicos
3. Comprueba que el tamaño de los ZIPs no exceda 25 MB

### No se encuentran correos

Si el workflow se ejecuta pero no encuentra correos:
1. Verifica que haya correos de `anubisgestion.com` en el día actual
2. Revisa la query de búsqueda en el código
3. Comprueba que la fecha/hora del servidor coincida con tu zona horaria

## 📞 Soporte

Para más información sobre GitHub Actions:
- [Documentación oficial](https://docs.github.com/es/actions)
- [Sintaxis de workflows](https://docs.github.com/es/actions/using-workflows/workflow-syntax-for-github-actions)
