# ibis·Paint — juego de dibujo (fase 1: Paint)

Proyecto **estudiantil, sin fines de lucro**, hecho con [p5.js](https://p5js.org/).
No está afiliado, patrocinado ni respaldado por ibisPaint; el logo y la marca pertenecen a sus
respectivos dueños y aquí se usan solo como material de un ejercicio de programación creativa..
(El aviso también aparece en la página, en `index.html` y en la cabecera de `js/sketch.js`.)

El logo aparece en el centro de un lienzo blanco. Las letras de **Paint** son herramientas que se arrastran:

| Letra | Herramienta |
|-------|-------------|
| **P** | Paleta con los 12 colores del logo. Elige color con la punta de la **i** encima de un color (o con un clic sobre él). |
| **i** | Pincel. Su puntico es la punta: arrástala y dibuja. `Mayús` o clic derecho (o el botón «Pluma») la mueven sin dibujar. Rueda del ratón o `[` `]` cambian el grosor. Si la llevas enseguida a la P, no deja rastro. |
| **a** | Alterar: suéltala encima de una línea y le pone un efecto al azar (onda, temblor, arcoíris, hormigas, neón, destellos, goteo, respirar, aerosol, eco, zigzag, rizos). |
| **n** | Borrador: borra lo que la letra toca. |
| **t** | Trasladar: arrástala sobre una línea para agarrarla y moverla; al soltar, la deja. |

`Ctrl+Z` deshace · `H` o `?` abre la ayuda. Funciona con ratón y con pantalla táctil.

## Publicar en GitHub Pages

1. Crea un repositorio y sube **el contenido de esta carpeta** (que `index.html` quede en la raíz).
2. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**, elige `main` y `/ (root)`.
3. En un minuto aparece en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

No necesita compilar nada ni conexión a servidores: p5.js va incluido en `lib/`. También puedes abrir `index.html` con doble clic.

## Estructura

```
index.html        página, barra de herramientas, ayuda y aviso estudiantil
style.css
lib/p5.min.js     p5.js (local, sin CDN)
js/glyphs.js      cada letra del logo como vector independiente (GENERADO)
js/util.js        utilidades matemáticas
js/letters.js     clase Letter: arrastre, giro, escala, volteo y animaciones (tween)
js/strokes.js     trazos vectoriales y los 12 efectos de la «a»
js/sketch.js      p5: lienzo, entrada y herramientas P/i/a/n/t
js/bird.js        GANCHO vacío para la fase 2 (el ibis)
assets/logo.svg   logo original
tools/build_glyphs.py   regenera js/glyphs.js desde el SVG (pip install svgelements)
futuro/bird.wip.js      borrador sin terminar del pájaro, guardado para la fase 2
```

## Cómo queda preparada la fase 2 (el ibis)

Las letras de **«ibis»** ya existen como objetos separados e independientes: `S.letters.i1`, `S.letters.b`,
`S.letters.i2` y `S.letters.s`. Cada una tiene su pivote, posición, rotación, escala, volteo y animación
(`startTween`). La `i` tiene el puntico (`dot`) como parte aparte —ojo— y el `b` guarda su «barriga» como pivote.
Hoy se quedan quietas (la tecla `Enter` solo avisa que llega pronto); para el pájaro solo hay que llenar
`js/bird.js` y moverlas. Los trazos del lienzo ya avisan al pájaro cuando la `t` mueve una línea
(`Bird.carried`) para que pueda ir encima.
