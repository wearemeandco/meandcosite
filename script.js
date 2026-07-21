// Me&Co. — shared site behavior: scroll-reveal + mobile nav
(function () {
  function initReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  function initMobileNav() {
    var toggle = document.querySelector('.nav-toggle');
    var menu = document.querySelector('.mobile-menu');
    var close = document.querySelector('.mobile-close');
    if (!toggle || !menu) return;

    function open() {
      menu.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function shut() {
      menu.classList.remove('open');
      document.body.style.overflow = '';
    }
    toggle.addEventListener('click', open);
    if (close) close.addEventListener('click', shut);
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', shut);
    });
  }

  function initNavShadow() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var onScroll = function () {
      if (window.scrollY > 8) nav.style.boxShadow = '0 8px 24px -18px rgba(34,49,94,0.35)';
      else nav.style.boxShadow = 'none';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initProgressBar() {
    var bar = document.querySelector('.progress-bar');
    if (!bar) return;
    var update = function () {
      var el = document.documentElement;
      var max = el.scrollHeight - el.clientHeight;
      bar.style.width = max > 0 ? ((el.scrollTop / max) * 100) + '%' : '0%';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function initToolkitFilter() {
    var pills = document.querySelectorAll('.filter-pill');
    var cards = document.querySelectorAll('.toolkit-card');
    if (!pills.length || !cards.length) return;
    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        pills.forEach(function (p) { p.classList.remove('active'); });
        pill.classList.add('active');
        var filter = pill.getAttribute('data-filter');
        cards.forEach(function (card) {
          var match = filter === 'all' || card.getAttribute('data-category') === filter;
          card.style.display = match ? '' : 'none';
        });
      });
    });
  }

  function initCart() {
    var drawer = document.querySelector('.cart-drawer');
    var overlay = document.querySelector('.cart-drawer-overlay');
    var trigger = document.querySelector('.cart-trigger');
    var badge = document.querySelector('.cart-badge');
    var listEl = document.querySelector('.cart-drawer-list');
    var emptyEl = document.querySelector('.cart-drawer-empty');
    var buttons = document.querySelectorAll('.btn-buy[data-buy]');
    if (!drawer) return;

    var STORAGE_KEY = 'meco_cart';

    function readCart() {
      try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || []; }
      catch (e) { return []; }
    }
    function writeCart(items) {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
    }

    function renderCart() {
      var items = readCart();
      if (badge) {
        badge.textContent = String(items.length);
        badge.classList.toggle('show', items.length > 0);
      }
      if (!listEl) return;
      listEl.innerHTML = '';
      var hasItems = items.length > 0;
      if (emptyEl) emptyEl.style.display = hasItems ? 'none' : 'flex';
      listEl.style.display = hasItems ? 'flex' : 'none';
      if (!hasItems) return;
      items.forEach(function (item, idx) {
        var row = document.createElement('div');
        row.className = 'cart-item';
        var priceHtml = item.price ? '<span class="cart-item-price">' + item.price + '</span>' : '';
        row.innerHTML =
          '<span class="cart-item-check"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5 6.5 12 13 4" stroke="#FFFCF5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
          '<span class="cart-item-body"><span class="cart-item-name">' + item.name + '</span>' + priceHtml + '</span>' +
          '<button type="button" class="cart-item-remove" data-remove="' + idx + '" aria-label="Remove"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2 14 14M14 2 2 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>';
        listEl.appendChild(row);
      });
    }

    function addItem(name, price) {
      var items = readCart();
      items.push({ name: name, price: price });
      writeCart(items);
      renderCart();
    }
    function removeItem(idx) {
      var items = readCart();
      items.splice(idx, 1);
      writeCart(items);
      renderCart();
    }

    function openDrawer() {
      drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('is-added')) return;
        btn.classList.add('is-pressed');
        setTimeout(function () { btn.classList.remove('is-pressed'); }, 150);
        btn.classList.add('is-added');
        addItem(btn.getAttribute('data-item'), btn.getAttribute('data-price'));
        setTimeout(function () { openDrawer(); }, 380);
        setTimeout(function () { btn.classList.remove('is-added'); }, 2200);
      });
    });

    if (trigger) trigger.addEventListener('click', openDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);
    document.querySelectorAll('[data-drawer-close]').forEach(function (el) {
      el.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
    if (listEl) {
      listEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-remove]');
        if (!btn) return;
        removeItem(parseInt(btn.getAttribute('data-remove'), 10));
      });
    }

    renderCart();
  }

  function initSquiggles() {
    var squiggles = document.querySelectorAll('.squiggle');
    if (!squiggles.length) return;
    // Normalize every squiggle path to pathLength=1 so the draw-in works
    // sitewide without needing pathLength="1" remembered in the markup.
    squiggles.forEach(function (svg) {
      svg.querySelectorAll('path').forEach(function (p) {
        p.setAttribute('pathLength', '1');
      });
      svg.classList.add('ready');
    });
    if (!('IntersectionObserver' in window)) {
      squiggles.forEach(function (s) { s.classList.add('drawn'); });
      return;
    }
    // Fire as soon as the squiggle clears the bottom edge. Most squiggles sit
    // inside a [data-reveal] parent that fades in over ~0.8s, so the draw is
    // held back slightly (see .drawn animation-delay) to land while visible.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('drawn');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
    squiggles.forEach(function (s) { io.observe(s); });
  }

  function initParallax() {
    var imgs = document.querySelectorAll('[data-parallax]');
    if (!imgs.length) return;
    var update = function () {
      var vh = window.innerHeight;
      imgs.forEach(function (img) {
        var wrap = img.parentElement;
        var rect = wrap.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        var progress = (vh - rect.top) / (vh + rect.height);
        var shift = (progress - 0.5) * 70;
        img.style.transform = 'translateY(' + shift + 'px)';
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initReveal();
    initMobileNav();
    initNavShadow();
    initProgressBar();
    initToolkitFilter();
    initCart();
    initParallax();
    initSquiggles();
  });
})();
