/* Tema aplicado antes da pintura, para não piscar. Preferência guardada neste computador. */
(function () {
  try {
    var t = JSON.parse(localStorage.getItem('conferidor.tema') || '"auto"');
    var escuro = t === 'escuro' || (t !== 'claro' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light');
  } catch (e) { }
})();
