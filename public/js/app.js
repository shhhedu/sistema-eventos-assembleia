const elements = {
  eventsGrid: document.querySelector('#eventsGrid'),
  loadingState: document.querySelector('#loadingState'),
  eventCount: document.querySelector('#eventCount'),
  modal: document.querySelector('#eventModal'),
  modalBanner: document.querySelector('#modalBanner'),
  modalDateBadge: document.querySelector('#modalDateBadge'),
  modalTitle: document.querySelector('#modalTitle'),
  modalMeta: document.querySelector('#modalMeta'),
  modalDescription: document.querySelector('#modalDescription'),
  presenceForm: document.querySelector('#presenceForm'),
  presenceEventId: document.querySelector('#presenceEventId'),
  presenceName: document.querySelector('#presenceName'),
  presencePhone: document.querySelector('#presencePhone'),
  presenceMessage: document.querySelector('#presenceMessage'),
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const chars = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return chars[char];
  });
}

function imageUrl(evento) {
  if (evento && typeof evento === 'object') {
    return String(evento.banner || '').trim();
  }

  return String(evento || '').trim();
}

function showBannerFallback(image, title) {
  const wrapper = image.closest('.event-card__image, .detail-banner, .banner-preview-wrap');
  const fallback = wrapper ? wrapper.querySelector('.banner-fallback') : null;

  image.hidden = true;

  if (fallback) {
    const label = fallback.querySelector('span');
    if (label) {
      label.textContent = title || 'Evento';
    }
    fallback.hidden = false;
  }
}

function resetBannerImage(image, title) {
  const wrapper = image.closest('.event-card__image, .detail-banner, .banner-preview-wrap');
  const fallback = wrapper ? wrapper.querySelector('.banner-fallback') : null;

  image.hidden = false;
  image.onerror = () => showBannerFallback(image, title);

  if (fallback) {
    const label = fallback.querySelector('span');
    if (label) {
      label.textContent = title || 'Evento';
    }
    fallback.hidden = true;
  }
}

function setBannerImage(image, source, title) {
  if (!source) {
    image.removeAttribute('src');
    showBannerFallback(image, title);
    return;
  }

  resetBannerImage(image, title);
  image.src = source;
}

function mostrarFallbackBanner(image) {
  showBannerFallback(image, image.dataset.title || 'Evento');
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function formatBrazilianPhone(value) {
  const digits = phoneDigits(value);

  if (!digits) {
    return '';
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isCompleteBrazilianPhone(value) {
  const digits = phoneDigits(value);
  return digits.length === 0 || digits.length === 10 || digits.length === 11;
}

function formatDateParts(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { day: '--', month: '---', full: dateValue || 'Data nao informada' };
  }

  return {
    day: new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '').toUpperCase(),
    full: new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date),
  };
}

function formatTime(value) {
  return value || '--:--';
}

function summary(text) {
  const clean = String(text || '').trim();
  if (clean.length <= 120) {
    return clean;
  }
  return `${clean.slice(0, 117)}...`;
}

function metaItem(text) {
  return `<span class="meta-item"><span class="meta-dot" aria-hidden="true"></span>${escapeHtml(text)}</span>`;
}

function dateBadge(evento) {
  const date = formatDateParts(evento.data);
  return `<strong>${escapeHtml(date.day)}</strong><span>${escapeHtml(date.month)}</span>`;
}

function setFeedback(element, message, type) {
  element.textContent = message;
  element.classList.remove('success', 'error');
  if (type) {
    element.classList.add(type);
  }
}

function renderEvents(eventos) {
  elements.loadingState.hidden = true;
  elements.eventCount.textContent = `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`;

  if (eventos.length === 0) {
    elements.eventsGrid.innerHTML = '<div class="state-message">Nenhum evento cadastrado no momento.</div>';
    return;
  }

  elements.eventsGrid.innerHTML = eventos
    .map((evento) => {
      const date = formatDateParts(evento.data);
      const banner = imageUrl(evento);
      const imageHidden = banner ? '' : 'hidden';
      const imageSource = banner ? `src="${escapeHtml(banner)}"` : '';
      const fallbackHidden = banner ? 'hidden' : '';
      return `
        <article class="event-card">
          <div class="event-card__image">
            <img ${imageSource} alt="" data-title="${escapeHtml(evento.titulo)}" onerror="mostrarFallbackBanner(this)" ${imageHidden} />
            <div class="banner-fallback" ${fallbackHidden}><span>${escapeHtml(evento.titulo)}</span></div>
            <div class="date-badge">${dateBadge(evento)}</div>
          </div>
          <div class="event-card__body">
            <h3>${escapeHtml(evento.titulo)}</h3>
            <div class="meta-list">
              ${metaItem(date.full)}
              ${metaItem(formatTime(evento.horario))}
              ${metaItem(evento.local)}
            </div>
            <p class="event-summary">${escapeHtml(summary(evento.descricao))}</p>
            <button class="primary-button full" type="button" data-event-id="${evento.id}">Ver Evento</button>
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadEvents() {
  try {
    const response = await fetch('/api/eventos');
    if (!response.ok) {
      throw new Error('Nao foi possivel carregar os eventos.');
    }

    const eventos = await response.json();
    renderEvents(eventos);
  } catch (error) {
    elements.loadingState.textContent = error.message;
    elements.loadingState.hidden = false;
  }
}

async function openEvent(eventId) {
  try {
    const response = await fetch(`/api/eventos/${eventId}`);
    const evento = await response.json();

    if (!response.ok) {
      throw new Error(evento.error || 'Evento nao encontrado.');
    }

    const date = formatDateParts(evento.data);
    setBannerImage(elements.modalBanner, imageUrl(evento), evento.titulo);
    elements.modalDateBadge.innerHTML = dateBadge(evento);
    elements.modalTitle.textContent = evento.titulo;
    elements.modalMeta.innerHTML = [
      metaItem(date.full),
      metaItem(formatTime(evento.horario)),
      metaItem(evento.local),
    ].join('');
    elements.modalDescription.textContent = evento.descricao;
    elements.presenceEventId.value = evento.id;
    elements.presenceForm.reset();
    elements.presenceEventId.value = evento.id;
    setFeedback(elements.presenceMessage, '', '');

    elements.modal.classList.add('is-open');
    elements.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    elements.presenceName.focus();
  } catch (error) {
    alert(error.message);
  }
}

function closeModal() {
  elements.modal.classList.remove('is-open');
  elements.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

async function submitPresence(event) {
  event.preventDefault();
  setFeedback(elements.presenceMessage, 'Registrando presença...', '');

  const telefone = formatBrazilianPhone(elements.presencePhone.value);
  elements.presencePhone.value = telefone;

  if (!isCompleteBrazilianPhone(telefone)) {
    setFeedback(elements.presenceMessage, 'Informe um telefone brasileiro com DDD ou deixe o campo vazio.', 'error');
    return;
  }

  const payload = {
    eventoId: Number(elements.presenceEventId.value),
    nome: elements.presenceName.value,
    telefone,
  };

  try {
    const response = await fetch('/api/presencas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Nao foi possivel confirmar a presença.');
    }

    elements.presenceName.value = '';
    elements.presencePhone.value = '';
    setFeedback(
      elements.presenceMessage,
      'Presença confirmada com sucesso! Esperamos você no evento.',
      'success',
    );
  } catch (error) {
    setFeedback(elements.presenceMessage, error.message, 'error');
  }
}

function handlePhoneInput() {
  elements.presencePhone.value = formatBrazilianPhone(elements.presencePhone.value);
}

function handlePhoneKeydown(event) {
  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

  if (allowedKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
    return;
  }

  if (event.key.length === 1 && !/\d/.test(event.key)) {
    event.preventDefault();
    return;
  }

  const digits = phoneDigits(elements.presencePhone.value);
  const hasSelection = elements.presencePhone.selectionStart !== elements.presencePhone.selectionEnd;

  if (event.key.length === 1 && digits.length >= 11 && !hasSelection) {
    event.preventDefault();
  }
}

function handlePhonePaste(event) {
  event.preventDefault();
  const pasted = (event.clipboardData || window.clipboardData).getData('text');
  elements.presencePhone.value = formatBrazilianPhone(pasted);
}

elements.eventsGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-event-id]');
  if (button) {
    openEvent(button.dataset.eventId);
  }
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', closeModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && elements.modal.classList.contains('is-open')) {
    closeModal();
  }
});

elements.presenceForm.addEventListener('submit', submitPresence);
elements.presencePhone.addEventListener('input', handlePhoneInput);
elements.presencePhone.addEventListener('keydown', handlePhoneKeydown);
elements.presencePhone.addEventListener('paste', handlePhonePaste);
loadEvents();
