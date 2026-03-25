# Guía de Deploy a Producción — UXR Social

## Arquitectura

```
Frontend Analytics  → Vercel (puerto 3005 en dev)
Frontend Backoffice → Vercel (puerto 3006 en dev)
Backend API         → Render / Railway (puerto 8000)
Base de Datos       → Supabase / Neon (PostgreSQL)
```

---

## Credenciales de Acceso

| Rol | Usuario | Contraseña | Acceso |
|-----|---------|------------|--------|
| Administrador | `nicolas` | `SocialSense2026!` | Backoffice + Analytics |
| Analista | `analyst` | `Analytics2026#` | Solo Analytics |

> **IMPORTANTE:** Cambia estas contraseñas en producción usando `ADMIN_PASSWORD` y `ANALYST_PASSWORD` en las variables de entorno del backend.

---

## Paso 1: Base de Datos (Supabase o Neon)

1. Crear cuenta en [Supabase](https://supabase.com) o [Neon](https://neon.tech) (plan gratuito disponible)
2. Crear un nuevo proyecto / base de datos
3. Copiar la **Connection String**:
   ```
   postgresql://user:password@host:5432/dbname
   ```
4. Guardar esta URL — la usarás en `DATABASE_URL`

---

## Paso 2: Backend en Render

1. En [render.com](https://render.com) → **New Web Service**
2. Conectar tu repositorio de GitHub
3. Configuración:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port 8000`

4. Variables de entorno requeridas:

   | Variable | Valor |
   |----------|-------|
   | `SECRET_KEY` | *(generar: `python -c "import secrets; print(secrets.token_hex(32))"`)* |
   | `DATABASE_URL` | *(Connection string de Supabase/Neon)* |
   | `FRONTEND_URL` | `https://tu-analytics.vercel.app,https://tu-backoffice.vercel.app` |
   | `ENVIRONMENT` | `production` |
   | `ADMIN_USERNAME` | `nicolas` |
   | `ADMIN_PASSWORD` | *(contraseña segura)* |
   | `ANALYST_USERNAME` | `analyst` |
   | `ANALYST_PASSWORD` | *(contraseña segura)* |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `MAIL_USERNAME` | tu correo Gmail |
   | `MAIL_PASSWORD` | app password de Gmail |
   | `MAIL_FROM` | tu correo Gmail |
   | `MAIL_PORT` | `587` |
   | `MAIL_SERVER` | `smtp.gmail.com` |
   | `MAIL_FROM_NAME` | `UXR Social Reports` |

5. Una vez desplegado, copiar la URL del servicio (ej. `https://tu-api.onrender.com`)

---

## Paso 3: Frontend Analytics en Vercel

1. En [vercel.com](https://vercel.com) → **New Project** → importar repo
2. Configuración:
   - **Root Directory:** `analytics`
   - **Framework Preset:** Next.js
3. Variable de entorno:
   ```
   NEXT_PUBLIC_API_URL=https://tu-api.onrender.com
   ```
4. Deploy

---

## Paso 4: Frontend Backoffice en Vercel

Repetir el proceso del Paso 3 pero:
- **Root Directory:** `backoffice`
- La misma variable `NEXT_PUBLIC_API_URL`

---

## Paso 5: Actualizar CORS en el Backend

Después de obtener las URLs de Vercel, actualizar `FRONTEND_URL` en Render:
```
FRONTEND_URL=https://analytics.vercel.app,https://backoffice.vercel.app
```

---

## Checklist de Seguridad Pre-Launch

- [ ] `SECRET_KEY` es una cadena aleatoria (no el valor de ejemplo)
- [ ] `DATABASE_URL` apunta a PostgreSQL (no SQLite)
- [ ] `ENVIRONMENT=production` está seteado en el backend
- [ ] `ADMIN_PASSWORD` y `ANALYST_PASSWORD` son contraseñas seguras
- [ ] `FRONTEND_URL` contiene solo los dominios de producción
- [ ] HTTPS está activo en todos los servicios (Vercel y Render lo hacen automáticamente)
- [ ] Las cookies `access_token` son `secure=True` (automático con `ENVIRONMENT=production`)
- [ ] El archivo `.env` del backend NO está commiteado al repositorio

---

## Headers de Seguridad Adicionales (Recomendado)

Agregar en `analytics/next.config.ts` y `backoffice/next.config.ts`:

```ts
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};
```

---

## Desarrollo Local

```bash
# 1. Instalar dependencias del backend (incluye slowapi nueva)
cd backend && source venv/bin/activate && pip install -r requirements.txt

# 2. Arrancar todos los servicios
bash start_project.sh
```

Servicios disponibles:
- Backend: http://localhost:8000
- Analytics: http://localhost:3005
- Backoffice: http://localhost:3006
- Docs API: http://localhost:8000/docs

---

## Renovar contraseñas

Para cambiar la contraseña de un usuario en producción, usar el backoffice (sección Usuarios) o crear un nuevo usuario desde el endpoint `/users` con un token de admin.
