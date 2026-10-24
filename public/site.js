// Header: mobile menu toggle and dropdowns. Without JS the nav is shown inline (see .no-js in site.css).
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  var label = toggle.querySelector('.nav-toggle-label');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (label) label.textContent = open ? 'Close' : 'Menu';
  }
  toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });

  // Dropdowns: the chevron button opens a sub-menu (tap on phones, click or keyboard on desktop).
  var subs = nav.querySelectorAll('.has-sub');
  function closeSubs(except) {
    subs.forEach(function (li) {
      if (li === except) return;
      li.classList.remove('sub-open');
      var b = li.querySelector('.sub-toggle');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  subs.forEach(function (li) {
    var b = li.querySelector('.sub-toggle');
    if (!b) return;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !li.classList.contains('sub-open');
      closeSubs(li);
      li.classList.toggle('sub-open', open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeSubs(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeSubs();
    if (nav.classList.contains('open')) { setMenu(false); toggle.focus(); }
  });
})();
