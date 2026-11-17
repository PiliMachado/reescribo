# reescribo.

Transformá tus materiales de estudio en nuevas formas de aprender: subís un PDF, un DOCX, un texto o un audio, y reescribo te arma un **resumen**, un **podcast** con dos voces, un **cuestionario**, un **juego**, una **explicación narrada** y un **mapa conceptual**. También podés hacerle preguntas a tu material.

Versión beta. Funciona 100 % gratis:

| Parte | Con qué funciona | Costo |
|---|---|---|
| IA (resúmenes, cuestionarios, etc.) | Gemini, plan gratis de Google AI Studio | Gratis, sin tarjeta |
| Transcripción de audios | Gemini (el audio se manda en partes de 1 minuto) | Gratis |
| Voz de "Escuchar" | La voz que trae el navegador | Gratis |
| Hosting | Vercel, plan Hobby | Gratis |

---

## Cómo publicarla (una sola vez, ~10 minutos)

### 1. Sacar la clave gratis de Gemini
1. Entrá a **https://aistudio.google.com** con tu cuenta de Google.
2. Tocá **Get API key** → **Create API key**.
3. Copiala. **No la pegues en ningún archivo del repo ni la compartas.**

### 2. Publicar en Vercel
1. Entrá a **https://vercel.com** y creá una cuenta con **Continue with GitHub**.
2. Tocá **Add New… → Project** y elegí el repo **reescribo** → **Import**.
3. Antes de tocar Deploy, abrí **Environment Variables** y agregá:
   - Name: `GEMINI_API_KEY`
   - Value: la clave que copiaste
4. Tocá **Deploy**. En un minuto te da un link tipo `reescribo.vercel.app`.

Listo. Cada vez que se cambie algo en GitHub, Vercel actualiza la web solo.

> Si la IA dice que el modelo no existe, en Vercel agregá otra variable `GEMINI_MODEL` con el nombre de un modelo Flash que aparezca en AI Studio (por ejemplo `gemini-2.5-flash`) y volvé a desplegar (Deployments → ⋯ → Redeploy).

---

## Cómo está hecho

```
index.html    → la interfaz (estructura y estilos)
app.js        → toda la lógica: carga de archivos, herramientas, voz, transcripción
api/ai.js     → backend chiquito que habla con Gemini y guarda la clave escondida
vercel.json   → le da hasta 60 segundos a cada pedido de IA
```

- **Los materiales se guardan en el navegador** de cada persona (localStorage). No hay cuentas ni base de datos todavía.
- **PDF** se lee con pdf.js y **DOCX** con mammoth, directo en el navegador.
- **Audios**: se pasan a 16 kHz mono, se cortan en partes de 1 minuto y cada parte se transcribe con Gemini. Hasta 45 minutos por archivo.
- **Grabar clase**: graba con el micrófono y al tocar Detener transcribe automáticamente.

## Límites del plan gratis
- Gemini gratis tiene un máximo de pedidos por minuto y por día. Si se pasa, la web avisa y en los audios espera sola 30 segundos y sigue.
- En el plan gratis, Google puede usar lo que se manda para mejorar sus productos: **no subir material privado o sensible**.
- La voz del navegador cambia según el dispositivo (en Chrome y en celulares suele haber voces en español buenas).

## Probarla en tu compu
Abrir `index.html` con doble clic no alcanza (la IA necesita el backend). Con [Node](https://nodejs.org) instalado:

```bash
npm i -g vercel
vercel dev
```

y poné la clave en un archivo `.env.local` con `GEMINI_API_KEY=tu_clave` (ese archivo está ignorado por git).
