# Deploy en Netlify + Render

## 1) Backend en Render
1. Sube este proyecto a GitHub.
2. En Render, crea un **Web Service** desde ese repo.
3. Render detecta `render.yaml` automaticamente.
4. Configura variables:
   - `DATABASE_URL`: cadena de conexion a Postgres productivo.
   - `CORS_ORIGIN`: URL de Netlify (ej: `https://tu-frontend.netlify.app`).
   - Si usas previews, puedes agregar varias separadas por coma.
5. Deploy y prueba:
   - `https://tu-backend.onrender.com/health`

## 2) Frontend en Netlify
1. En Netlify, crea sitio desde el mismo repo.
2. Netlify usara `netlify.toml`:
   - `base = frontend`
   - `command = npm run build`
   - `publish = dist`
3. En variables de entorno del sitio agrega:
   - `VITE_API_BASE=https://tu-backend.onrender.com`
4. Deploy.

## 3) Conectar ambos
1. Copia la URL final de Netlify.
2. Vuelve a Render y actualiza `CORS_ORIGIN` con esa URL.
3. Redeploy del backend.

## 4) Checklist rapido
- Frontend abre sin 404 en rutas internas (`/dashboard/...`) gracias al redirect SPA.
- `GET /health` responde en backend.
- `GET /api/clients` responde 200 desde frontend.
- No hay error de CORS en consola del navegador.
