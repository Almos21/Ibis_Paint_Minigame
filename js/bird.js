/* ------------------------------------------------------------------
   bird.js — GANCHO para la fase 2 (el ibis). Por ahora no hace nada.

   Las letras de «ibis» ya existen como objetos independientes
   (S.letters.i1, b, i2, s — ver js/letters.js y js/glyphs.js), cada una con
   su pivote, posición, rotación, escala, volteo y animación (startTween).
   Cuando hagamos el pájaro, este módulo solo tiene que moverlas.
   Un borrador sin terminar quedó guardado en /futuro/bird.wip.js.

   Proyecto estudiantil sin fines de lucro · no afiliado a ibisPaint.
   ------------------------------------------------------------------ */

const Bird = {
  busy: false,                       // true cuando las letras de «ibis» ya son pájaro
  update(dt, now) {},                // se llama en cada cuadro
  carried(stroke, dx, dy) {},        // la «t» movió una línea (el pájaro podría ir encima)
  toggle() { toast('El ibis llega en la siguiente versión'); },   // tecla Enter
};
