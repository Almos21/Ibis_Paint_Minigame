# ibis·Paint — juego de dibujo (Paint + el ibis)

Proyecto **estudiantil, sin fines de lucro**, hecho con [p5.js](https://p5js.org/).
No está afiliado, patrocinado ni respaldado por ibisPaint; el logo y la marca pertenecen a sus
respectivos dueños y aquí se usan solo como material de un ejercicio de programación creativa.
(El aviso también aparece en la página, en `index.html` y en la cabecera de `js/sketch.js`.)

El logo aparece en el centro de un lienzo blanco. Las letras de **Paint** son herramientas que se arrastran:

| Letra | Herramienta |
|-------|-------------|
| **P** | Paleta con los 12 colores del logo. Elige color con la punta de la **i** encima de un color (o con un clic sobre él). |
| **i** | Pincel. Su puntico es la punta: arrástala y dibuja. `Mayús` o clic derecho (o el botón «Pluma») la mueven sin dibujar. Rueda del ratón o `[` `]` cambian el grosor. Si la llevas enseguida a la P, no deja rastro. |
| **a** | Alterar: suéltala encima de una línea y le pone un efecto al azar (onda, temblor, arcoíris, hormigas, neón, destellos, goteo, respirar, aerosol, eco, zigzag, rizos). |
| **n** | Borrador: borra lo que la letra toca. |
| **t** | Trasladar: arrástala sobre una línea para agarrarla y moverla; al soltar, la deja. |

`Ctrl+Z` deshace · `H` o `?` abre una ayuda oculta. Funciona con ratón y con pantalla táctil.

**La página no da pistas a propósito**: no hay barra de herramientas ni instrucciones al entrar; la persona lo descubre sola.
Para invitarla a tocar, las letras de «Paint» hacen un brillo de colores (una ola P → a → i → n → t) al inicio y de nuevo
cada vez que pasan 10 s sin que se toque nada. Se ajusta en `ATTN` (`js/sketch.js`). Para ver avisos de texto mientras
desarrollas, pon `SHOW_HINTS = true` en ese mismo archivo.

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
js/bird.js        el ibis: se arma con las letras «ibis» y actúa según el color del último trazo
assets/logo.svg   logo original
tools/build_glyphs.py   regenera js/glyphs.js desde el SVG (pip install svgelements)
```

## El ibis

Se despierta de tres formas: **al dibujar el primer trazo con la i**, **al tocar la palabra «ibis»** o con `Enter`.
Las letras se arman como en el boceto: la primera **i** es la patica (el puntico es el pie), la **b** girada es el cuerpo,
la **s** es el cuello y la segunda **i** es la cabeza (el puntico es el ojo y el palito el pico).

Desde ahí es un agente propio: se mueve a saltitos y **solo cuenta el color del último trazo dibujado**.
Si cambias de color, su comportamiento se reinicia; si borras ese trazo (o con `Ctrl+Z`), pasa a contar el trazo anterior.

| Color (en el sentido del reloj desde el amarillo) | Comportamiento |
|---|---|
| amarillo `#f2f31e` | **Feliz**: sigue siempre la punta del último trazo, con saltitos altos y rápidos, cabeceando y con el ojo entrecerrado. |
| naranja medio `#f3b318` | Lo sigue, pero **mientras se mueve crece y se encoge al azar**. |
| naranja `#eb8118` | Lo sigue **muy lentamente**: saltitos cortos con pausas largas, adormilado. |
| cualquier otro | Por ahora se queda quieto (respira, parpadea y a veces mira hacia el otro lado). |

Los comportamientos están en la tabla `BEHAVIORS` de `js/bird.js`: para añadir uno nuevo basta una línea con el color
del logo y sus parámetros (largo, altura y pausa de los saltitos, a qué distancia se detiene, etc.).
