/*
  Motor de demostraciones por pasos.

  Una demostración es un elemento con data-demo y data-duracion (en segundos).
  Dentro, cada pieza dice cuándo está encendida con data-en:

    data-en="5"            encendida desde el segundo 5 hasta el final
    data-en="1.6-5"        encendida solo entre el 1.6 y el 5
    data-en="1.6-5 7-9.4"  varios tramos

  Mientras está encendida lleva la clase "on" (u otra, con data-clase). El aspecto
  de cada estado lo pone la hoja de estilos. Como todo depende solo del segundo en
  que estamos, se puede pausar, repetir o saltar a cualquier momento.

  Una misma pieza puede cambiar más veces con data-en-2 y data-en-3
  (clases "on2" y "on3", o las que digan data-clase-2 y data-clase-3).

  Mandos, dentro del mismo elemento:
    data-accion="alternar"   pausa y reanuda (con [data-texto] para el rótulo)
    data-accion="repetir"    vuelve al principio
    data-progreso            barra cuyo primer hijo crece con el avance

  También se pueden dar los pasos desde código:
    Pasos.montar(elemento, { duracion: 20, pasos: [{ sel: '.sello', en: '12', clase: 'on' }] })

  En la dirección de la página, ?t=8 coloca todas las demostraciones en el segundo 8.
*/
(function () {
  'use strict';

  var sinMovimiento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function leerTramos(texto) {
    return String(texto).trim().split(/[\s,]+/).map(function (trozo) {
      var ab = trozo.split('-');
      return [parseFloat(ab[0]), ab.length > 1 ? parseFloat(ab[1]) : Infinity];
    });
  }

  function Demo(raiz, opciones) {
    opciones = opciones || {};
    var yo = this;
    this.raiz = raiz;
    this.duracion = opciones.duracion || parseFloat(raiz.getAttribute('data-duracion')) || 20;
    this.alCambiar = opciones.alCambiar || null;
    this.t = 0;
    this.estado = 'espera';
    this.piezas = [];
    this._ultimo = 0;
    this._cuadro = null;
    this._arrancada = false;
    this._reanudar = false;

    /* data-en enciende "on". data-en-2 y data-en-3 permiten un segundo y un tercer
       cambio sobre la misma pieza, con data-clase-2 y data-clase-3 (por defecto on2 y on3). */
    [['data-en', 'data-clase', 'on'], ['data-en-2', 'data-clase-2', 'on2'], ['data-en-3', 'data-clase-3', 'on3']].forEach(function (a) {
      Array.prototype.forEach.call(raiz.querySelectorAll('[' + a[0] + ']'), function (el) {
        yo.piezas.push({ el: el, clase: el.getAttribute(a[1]) || a[2], tramos: leerTramos(el.getAttribute(a[0])) });
      });
    });
    (opciones.pasos || []).forEach(function (p) {
      Array.prototype.forEach.call(raiz.querySelectorAll(p.sel), function (el) {
        yo.piezas.push({ el: el, clase: p.clase || 'on', tramos: leerTramos(p.en) });
      });
    });

    this.botonAlternar = raiz.querySelector('[data-accion="alternar"]');
    this.botonRepetir = raiz.querySelector('[data-accion="repetir"]');
    this.barra = raiz.querySelector('[data-progreso]');
    if (this.botonAlternar) this.botonAlternar.addEventListener('click', function () { yo.alternar(); });
    if (this.botonRepetir) this.botonRepetir.addEventListener('click', function () { yo.repetir(); });

    this._paso = function (ahora) {
      if (yo.estado !== 'marcha') return;
      var dt = Math.min((ahora - yo._ultimo) / 1000, 0.25);
      yo._ultimo = ahora;
      yo.pintar(yo.t + dt);
      if (yo.t >= yo.duracion) { yo.fijarEstado('fin'); return; }
      yo._cuadro = window.requestAnimationFrame(yo._paso);
    };

    this.pintar(0);
    this.fijarEstado('espera');
  }

  /* Deja la demostración tal como debe verse en el segundo t. */
  Demo.prototype.pintar = function (t) {
    t = Math.max(0, Math.min(t, this.duracion));
    this.t = t;
    this.piezas.forEach(function (p) {
      var encendida = p.tramos.some(function (r) { return t >= r[0] && t < r[1]; });
      p.el.classList.toggle(p.clase, encendida);
    });
    if (this.barra) {
      var parte = t / this.duracion;
      if (this.barra.firstElementChild) this.barra.firstElementChild.style.width = (parte * 100).toFixed(2) + '%';
      this.barra.setAttribute('aria-valuenow', Math.round(parte * 100));
    }
    if (this.alCambiar) this.alCambiar(t, this);
  };

  Demo.prototype.fijarEstado = function (estado) {
    this.estado = estado;
    this.raiz.setAttribute('data-estado', estado);
    this.raiz.classList.toggle('en-pausa', estado !== 'marcha');
    if (this.botonAlternar) {
      var rotulo = estado === 'marcha' ? 'Pausa' : 'Reproducir';
      var hueco = this.botonAlternar.querySelector('[data-texto]');
      if (hueco) hueco.textContent = rotulo;
      this.botonAlternar.setAttribute('aria-label', rotulo + ' la demostración');
    }
  };

  Demo.prototype.reproducir = function () {
    if (this.estado === 'marcha') return;
    if (this.t >= this.duracion) this.pintar(0);
    this._arrancada = true;
    this.raiz.classList.remove('fijo');
    this.fijarEstado('marcha');
    this._ultimo = window.performance.now();
    this._cuadro = window.requestAnimationFrame(this._paso);
  };

  Demo.prototype.pausar = function () {
    if (this.estado !== 'marcha') return;
    window.cancelAnimationFrame(this._cuadro);
    this.fijarEstado('pausa');
  };

  Demo.prototype.alternar = function () {
    this._reanudar = false;
    if (this.estado === 'marcha') this.pausar(); else this.reproducir();
  };

  Demo.prototype.repetir = function () {
    window.cancelAnimationFrame(this._cuadro);
    this.estado = 'pausa';
    this.pintar(0);
    this.reproducir();
  };

  /* Salta a un segundo concreto y se queda quieta ahí. */
  Demo.prototype.ir = function (t) {
    window.cancelAnimationFrame(this._cuadro);
    this._arrancada = true;
    this.pintar(t);
    this.fijarEstado(this.t >= this.duracion ? 'fin' : 'pausa');
  };

  function montar(raiz, opciones) {
    var demo = new Demo(raiz, opciones);
    var pedido = new URLSearchParams(window.location.search).get('t');

    if (pedido !== null && !isNaN(parseFloat(pedido))) {
      raiz.classList.add('fijo'); /* estado instantáneo, sin transiciones, hasta que se pulse reproducir */
      demo.ir(parseFloat(pedido));
    } else if (sinMovimiento) {
      demo.ir(demo.duracion);
    } else {
      /* Arranca al entrar en pantalla, se pausa al salir y sigue al volver. Se mira con
         IntersectionObserver y, por si no avisa, también al cargar y al desplazar la página. */
      var mirar = function (dentro) {
        if (dentro && !demo._arrancada) {
          demo.reproducir();
        } else if (dentro && demo._reanudar) {
          demo._reanudar = false;
          demo.reproducir();
        } else if (!dentro && demo.estado === 'marcha') {
          demo.pausar();
          demo._reanudar = true;
        }
      };
      var medir = function () {
        var r = raiz.getBoundingClientRect();
        var alto = window.innerHeight || document.documentElement.clientHeight;
        var visto = Math.min(r.bottom, alto) - Math.max(r.top, 0);
        mirar(visto > Math.min(r.height, alto) * 0.15);
      };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entradas) {
          entradas.forEach(function (e) { mirar(e.isIntersecting); });
        }, { threshold: 0.15 }).observe(raiz);
      }
      window.addEventListener('scroll', medir, { passive: true });
      window.addEventListener('resize', medir);
      window.addEventListener('load', medir);
      medir();
    }
    return demo;
  }

  /* Tapas de la portada: un gesto breve la primera vez que entran en pantalla. */
  function animarTapas() {
    var tapas = document.querySelectorAll('.tarj');
    if (!tapas.length || sinMovimiento || !('IntersectionObserver' in window)) return;
    var vistas = 0;
    var ojo = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        ojo.unobserve(el);
        window.setTimeout(function () {
          el.classList.add('entra');
          window.setTimeout(function () { el.classList.remove('entra'); }, 2000);
        }, 140 * (vistas++ % 4));
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(tapas, function (el) { ojo.observe(el); });
  }

  /* Capturas: al pulsar se amplían sobre un fondo oscuro. Sin JS, el enlace abre la imagen. */
  function ampliarCapturas() {
    var enlaces = document.querySelectorAll('a[data-ampliar]');
    if (!enlaces.length) return;
    var capa = document.createElement('button');
    capa.id = 'vis';
    capa.type = 'button';
    capa.setAttribute('aria-label', 'Cerrar la imagen ampliada');
    var img = document.createElement('img');
    img.alt = '';
    capa.appendChild(img);
    document.body.appendChild(capa);
    var origen = null;
    function cerrar() { capa.classList.remove('on'); if (origen) origen.focus(); }
    Array.prototype.forEach.call(enlaces, function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        origen = a;
        img.src = a.getAttribute('href');
        capa.classList.add('on');
        capa.focus();
      });
    });
    capa.addEventListener('click', cerrar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && capa.classList.contains('on')) cerrar(); });
  }

  window.Pasos = { montar: montar, Demo: Demo, demos: [] };

  function iniciar() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-demo]'), function (el) {
      window.Pasos.demos.push(montar(el));
    });
    animarTapas();
    ampliarCapturas();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

// Correo: además de abrir el programa de correo, copia la dirección, por si no hay ninguno configurado.
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[data-copiar]');
  if (!a) return;
  var dir = a.getAttribute('href').replace('mailto:', '');
  var antes = a.textContent;
  var avisar = function () { a.textContent = 'Dirección copiada: ' + dir; setTimeout(function () { a.textContent = antes; }, 3500); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(dir).then(avisar, avisar); else avisar();
});
