/* HASAN oil — каталог. Данные берутся из products.json (см. README). */
(function () {
  'use strict';

  var WA_PHONE = '79288904266';
  var WA_TEXT = 'Здравствуйте! Пишу с сайта, хочу уточнить по товару';
  var ASK = 'цена по запросу';
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
    'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var state = { products: [], categories: [], tab: 'all', query: '' };
  var els = {
    products: $('#products'),
    tabs: $('#tabs'),
    search: $('#search'),
    updated: $('#updated'),
    filters: $('#filters'),
    modal: $('#modal'),
    modalBody: $('#modal-body')
  };

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function waLink(text) {
    return 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(text || WA_TEXT);
  }

  function formatPrice(p) {
    return Number(p).toLocaleString('ru-RU') + ' ₽';
  }

  // "2026-10-01" → "1 октября 2026 г." (без Date, чтобы не зависеть от часового пояса)
  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso;
    return (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] + ' г.';
  }

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"]/g, '').trim();
  }

  function smallPhoto(src) { return src.replace(/\.webp$/i, '-sm.webp'); }

  function isAvailable(p) { return p.available !== false; }

  /* ---------- разметка ---------- */

  function pricesHtml(p, compact) {
    var vols = p.volumes && p.volumes.length ? p.volumes : [{ size: null, price: null }];
    return '<ul class="prices">' + vols.map(function (v) {
      var price = v.price == null
        ? '<span class="ask">' + (compact && v.size ? ASK : 'Цена по запросу') + '</span>'
        : '<b>' + formatPrice(v.price) + '</b>';
      if (!v.size) return '<li>' + price + '</li>';
      return compact
        ? '<li>' + esc(v.size) + ' — ' + price + '</li>'
        : '<li><span>' + esc(v.size) + '</span>' + price + '</li>';
    }).join('') + '</ul>';
  }

  // Заглушка, если у товара нет фото: силуэт бутылки + название
  function placeholderHtml(p) {
    return '<div class="placeholder" aria-hidden="true">' +
      '<svg viewBox="0 0 60 140" fill="none" stroke="#a87f2f" stroke-width="1.6" stroke-linejoin="round">' +
        '<rect x="23" y="4" width="14" height="12" rx="2" fill="#3b2e25" stroke="none"/>' +
        '<path d="M24 16h12v14c0 6 14 12 14 26v74a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V56c0-14 14-20 14-26z" fill="#fbf6ea"/>' +
        '<path d="M10 74h40M10 112h40" stroke-width="1"/>' +
        '<path d="M30 84c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z" fill="#d6b161" stroke="none"/>' +
      '</svg>' +
      '<span class="placeholder__name">' + esc(p.name) + '</span>' +
    '</div>';
  }

  function cardHtml(p) {
    var media;
    if (p.photos && p.photos.length) {
      var src = p.photos[0];
      media = '<img src="' + esc(smallPhoto(src)) + '" alt="' + esc(p.name) + '"' +
        ' loading="lazy" decoding="async" width="600" height="750" data-full="' + esc(src) + '">';
    } else {
      media = placeholderHtml(p);
    }
    var soldout = !isAvailable(p);
    return '<article class="card' + (soldout ? ' is-soldout' : '') + '" data-id="' + esc(p.id) + '" role="button" tabindex="0"' +
      ' aria-label="' + esc(p.name) + ' — подробнее">' +
      '<div class="card__media">' +
        (p.featured ? '<span class="badge">Хит</span>' : '') +
        media +
        (soldout ? '<span class="soldout">Нет в наличии</span>' : '') +
      '</div>' +
      '<div class="card__body">' +
        (p.brand ? '<span class="card__brand">' + esc(p.brand) + '</span>' : '') +
        '<h3 class="card__name">' + esc(p.name) + '</h3>' +
        (p.short ? '<p class="card__desc">' + esc(p.short) + '</p>' : '') +
        pricesHtml(p, true) +
      '</div>' +
    '</article>';
  }

  function categoryName(id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i].name;
    }
    return id;
  }

  function filtered() {
    var q = normalize(state.query);
    return state.products.filter(function (p) {
      if (state.tab !== 'all' && p.category !== state.tab) return false;
      if (!q) return true;
      return normalize(p.name + ' ' + (p.brand || '')).indexOf(q) !== -1;
    }).sort(function (a, b) {
      // товары «нет в наличии» — в конец списка, остальной порядок как в products.json
      return (isAvailable(b) ? 1 : 0) - (isAvailable(a) ? 1 : 0);
    });
  }

  function renderProducts() {
    var list = filtered();
    if (!list.length) {
      els.products.innerHTML = '<div class="products__empty"><p>Ничего не нашлось.</p>' +
        '<p>Напишите нам в <a href="' + waLink() + '" target="_blank" rel="noopener">WhatsApp</a> — подскажем.</p></div>';
      return;
    }
    // Во вкладке «Все» без поиска — товары сгруппированы по категориям
    if (state.tab === 'all' && !state.query) {
      els.products.innerHTML = state.categories.map(function (c) {
        var items = list.filter(function (p) { return p.category === c.id; });
        if (!items.length) return '';
        return '<section class="group"><h3 class="group__title">' + esc(c.name) + '</h3>' +
          '<div class="grid">' + items.map(cardHtml).join('') + '</div></section>';
      }).join('');
    } else {
      els.products.innerHTML = '<div class="grid">' + list.map(cardHtml).join('') + '</div>';
    }
  }

  function renderTabs() {
    var tabs = [{ id: 'all', name: 'Все' }].concat(state.categories);
    els.tabs.innerHTML = tabs.map(function (t) {
      var count = t.id === 'all' ? state.products.length
        : state.products.filter(function (p) { return p.category === t.id; }).length;
      if (t.id !== 'all' && !count) return '';
      return '<button type="button" class="tab" role="tab" data-tab="' + esc(t.id) + '" aria-selected="' + (t.id === state.tab) + '">' +
        esc(t.name) + '<span class="tab__count">' + count + '</span></button>';
    }).join('');
  }

  function setTab(id) {
    state.tab = id;
    Array.prototype.forEach.call(els.tabs.children, function (b) {
      var on = b.getAttribute('data-tab') === id;
      b.setAttribute('aria-selected', on);
      if (on && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
    renderProducts();
    scrollToCatalogTop();
  }

  // после смены фильтра, если пользователь уже пролистал вниз, — вернуть к началу списка
  function scrollToCatalogTop() {
    var top = els.products.getBoundingClientRect().top + window.pageYOffset - els.filters.offsetHeight - 8;
    if (window.pageYOffset > top) window.scrollTo({ top: top });
  }

  /* ---------- модальное окно ---------- */

  // Разделы описания товара: поле в products.json → подзаголовок. Пустые поля не выводятся.
  var SECTIONS = [
    ['description', 'Описание'],
    ['composition', 'Чем ценно'],
    ['usage', 'Как применять'],
    ['how_to_choose', 'Как выбрать'],
    ['storage', 'Хранение'],
    ['caution', 'С осторожностью']
  ];

  // Перенос строки внутри поля = новый абзац
  function paragraphs(text) {
    return String(text).split(/\n+/).filter(Boolean).map(function (t) {
      return '<p>' + esc(t.trim()) + '</p>';
    }).join('');
  }

  function sectionsHtml(p) {
    return SECTIONS.map(function (s) {
      if (!p[s[0]]) return '';
      return '<section class="pinfo pinfo--' + s[0].replace(/_/g, '-') + '">' +
        '<h3>' + s[1] + '</h3>' + paragraphs(p[s[0]]) + '</section>';
    }).join('');
  }

  function modalHtml(p) {
    var photos = p.photos || [];
    var gallery;
    if (photos.length) {
      gallery = '<div class="gallery"><div class="gallery__track">' + photos.map(function (src, i) {
        return '<div class="gallery__slide"><img src="' + esc(src) + '" alt="' + esc(p.name) + (i ? ' — фото ' + (i + 1) : '') + '"' +
          (i ? ' loading="lazy"' : '') + ' decoding="async"></div>';
      }).join('') + '</div>' +
      (photos.length > 1 ? '<div class="gallery__dots">' + photos.map(function (_, i) {
        return '<span' + (i ? '' : ' class="is-active"') + '></span>';
      }).join('') + '</div>' : '') + '</div>';
    } else {
      gallery = '<div class="gallery"><div class="gallery__slide">' + placeholderHtml(p) + '</div></div>';
    }

    var badges = (p.featured ? '<span class="badge">Хит</span>' : '') +
      (!isAvailable(p) ? '<span class="soldout">Нет в наличии</span>' : '');

    var meta = [];
    meta.push('Категория: ' + esc(categoryName(p.category)));
    if (p.country) meta.push('Страна производства: ' + esc(p.country));

    return gallery +
      '<div class="modal__content">' +
        (p.brand ? '<p class="modal__brand">' + esc(p.brand) + '</p>' : '') +
        '<h2 class="modal__title" id="modal-title">' + esc(p.name) + '</h2>' +
        (badges ? '<div class="modal__badges">' + badges + '</div>' : '') +
        pricesHtml(p, false) +
        sectionsHtml(p) +
        (p.note ? '<p class="modal__note">' + esc(p.note) + '</p>' : '') +
        '<p class="modal__meta">' + meta.join('<br>') + '</p>' +
        '<a class="btn btn--wa" href="' + waLink(WA_TEXT + ': ' + p.name) + '" target="_blank" rel="noopener">' +
          '<svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-wa"/></svg>Уточнить в WhatsApp</a>' +
      '</div>';
  }

  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i];
    return null;
  }

  function openModal(id, push) {
    var p = findProduct(id);
    if (!p) return;
    els.modalBody.innerHTML = modalHtml(p);
    bindGallery();
    if (!els.modal.open) {
      if (els.modal.showModal) els.modal.showModal(); else els.modal.setAttribute('open', '');
    }
    els.modal.querySelector('.modal__box').scrollTop = 0;
    document.documentElement.style.overflow = 'hidden';
    // адрес вида #p-walnut — ссылкой на товар можно поделиться
    if (push) history.pushState({ modal: id }, '', '#p-' + id);
  }

  function hideModal() {
    if (els.modal.open) {
      if (els.modal.close) els.modal.close(); else els.modal.removeAttribute('open');
    }
    document.documentElement.style.overflow = '';
  }

  // закрытие по кнопке/фону/Esc: если окно открыто через pushState — шагаем назад по истории
  function requestClose() {
    if (history.state && history.state.modal) history.back();
    else {
      hideModal();
      if (/^#p-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function bindGallery() {
    var track = els.modalBody.querySelector('.gallery__track');
    var dots = els.modalBody.querySelectorAll('.gallery__dots span');
    if (!track || !dots.length) return;
    track.addEventListener('scroll', function () {
      var i = Math.round(track.scrollLeft / track.clientWidth);
      Array.prototype.forEach.call(dots, function (d, n) { d.classList.toggle('is-active', n === i); });
    }, { passive: true });
  }

  function syncWithHash() {
    var m = /^#p-(.+)$/.exec(location.hash);
    if (m && findProduct(decodeURIComponent(m[1]))) openModal(decodeURIComponent(m[1]), false);
    else hideModal();
  }

  /* ---------- события ---------- */

  els.tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) setTab(b.getAttribute('data-tab'));
  });

  var searchTimer;
  els.search.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = els.search.value;
      renderProducts();
    }, 120);
  });
  els.search.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') els.search.blur();
  });

  els.products.addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (card) openModal(card.getAttribute('data-id'), true);
  });
  els.products.addEventListener('keydown', function (e) {
    var card = e.target.closest('.card');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openModal(card.getAttribute('data-id'), true);
    }
  });

  // если уменьшенного фото (-sm.webp) нет — берём полное, если нет и его — заглушку
  els.products.addEventListener('error', function (e) {
    var img = e.target;
    if (img.tagName !== 'IMG') return;
    var full = img.getAttribute('data-full');
    if (full && img.getAttribute('src') !== full) { img.src = full; return; }
    var card = img.closest('.card');
    var p = card && findProduct(card.getAttribute('data-id'));
    if (p) img.outerHTML = placeholderHtml(p);
  }, true);

  els.modal.addEventListener('click', function (e) {
    if (e.target === els.modal || e.target.closest('[data-close]')) requestClose();
  });
  els.modal.addEventListener('cancel', function (e) { e.preventDefault(); requestClose(); });
  window.addEventListener('popstate', syncWithHash);

  // тонкая линия под липкими фильтрами, когда они «прилипли»
  if ('IntersectionObserver' in window) {
    var sentinel = document.createElement('div');
    els.filters.parentNode.insertBefore(sentinel, els.filters);
    new IntersectionObserver(function (entries) {
      els.filters.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  // все ссылки на WhatsApp — с предзаполненным текстом
  Array.prototype.forEach.call(document.querySelectorAll('.js-wa'), function (a) { a.href = waLink(); });

  /* ---------- загрузка данных ---------- */

  fetch('products.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      state.categories = data.categories || [];
      state.products = data.products || [];
      if (data.updated) {
        els.updated.textContent = 'Цены актуальны на ' + formatDate(data.updated);
        els.updated.hidden = false;
      }
      renderTabs();
      renderProducts();
      syncWithHash();
    })
    .catch(function (err) {
      console.error(err);
      els.products.innerHTML = '<p class="products__status">Не удалось загрузить каталог. ' +
        'Обновите страницу или напишите нам в <a href="' + waLink() + '">WhatsApp</a>.</p>';
    });
})();
