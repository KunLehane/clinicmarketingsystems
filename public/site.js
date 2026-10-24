// Header: Physio Rooms style mega menus on desktop, Menu pill and expandable list on phones.
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  var label = toggle.querySelector('.nav-toggle-label');
  var desktop = window.matchMedia('(min-width: 1025px)');
  var triggers = Array.prototype.slice.call(nav.querySelectorAll('.has-mm > .nav-link'));
  var closeTimer;

  function panelFor(a) { return document.getElementById(a.getAttribute('aria-controls')); }
  function closeAll(except) {
    triggers.forEach(function (a) {
      if (a === except) return;
      a.classList.remove('mm-active');
      a.setAttribute('aria-expanded', 'false');
      var p = panelFor(a); if (p) p.classList.remove('mm-open');
      a.parentNode.classList.remove('mob-open');
    });
  }
  function openPanel(a) {
    clearTimeout(closeTimer);
    closeAll(a);
    a.classList.add('mm-active');
    a.setAttribute('aria-expanded', 'true');
    var p = panelFor(a); if (p) p.classList.add('mm-open');
  }

  triggers.forEach(function (a) {
    var p = panelFor(a);
    a.addEventListener('mouseenter', function () { if (desktop.matches) openPanel(a); });
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (desktop.matches) {
        if (a.classList.contains('mm-active')) closeAll(); else openPanel(a);
      } else {
        var li = a.parentNode, open = !li.classList.contains('mob-open');
        closeAll(open ? a : null);
        li.classList.toggle('mob-open', open);
        a.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });
    [a.parentNode, p].forEach(function (el) {
      if (!el) return;
      el.addEventListener('mouseleave', function () {
        if (!desktop.matches) return;
        closeTimer = setTimeout(function () { closeAll(); }, 180);
      });
      el.addEventListener('mouseenter', function () { clearTimeout(closeTimer); });
    });
  });
  nav.querySelectorAll('.nav-top > li:not(.has-mm) > .nav-link').forEach(function (a) {
    a.addEventListener('mouseenter', function () { if (desktop.matches) closeAll(); });
  });

  function setMenu(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (label) label.textContent = open ? 'Close' : 'Menu';
  }
  toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.site-header')) { closeAll(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAll();
    if (nav.classList.contains('open')) { setMenu(false); toggle.focus(); }
  });
  desktop.addEventListener('change', function () { closeAll(); setMenu(false); });
})();
