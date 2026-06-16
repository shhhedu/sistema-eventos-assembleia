const state = {
  eventos: [],
  page: 1,
  pageSize: 8,
};

const elements = {
  eventsTableBody: document.querySelector('#eventsTableBody'),
  loadingState: document.querySelector('#loadingState'),
  eventCount: document.querySelector('#eventCount'),
  eventSearch: document.querySelector('#eventSearch'),
  eventsPagination: document.querySelector('#eventsPagination'),
  modal: document.querySelector('#eventModal'),
  modalBanner: document.querySelector('#modalBanner'),
  modalDateBadge: document.querySelector('#modalDateBadge'),
  modalTitle: document.querySelector('#modalTitle'),
  modalMeta: document.querySelector('#modalMeta'),
  modalInfo: document.querySelector('#modalInfo'),
  presenceForm: document.querySelector('#presenceForm'),
  presenceEventId: document.querySelector('#presenceEventId'),
  presenceName: document.querySelector('#presenceName'),
  presencePhone: document.querySelector('#presencePhone'),
  presenceSubmitButton: document.querySelector('#presenceSubmitButton'),
  presenceWindowMessage: document.querySelector('#presenceWindowMessage'),
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

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
    return { day: '--', month: '---', full: dateValue || 'Data nao informada', short: dateValue || '-' };
  }

  return {
    day: new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '').toUpperCase(),
    full: new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date),
    short: new Intl.DateTimeFormat('pt-BR').format(date),
  };
}

function formatTime(value) {
  return value || '--:--';
}

function formatEventTimeRange(evento) {
  return `${formatTime(evento.horario)} às ${formatTime(evento.horarioFim)}`;
}

function orderCode(evento) {
  return evento.codigoOrdem || `#${String(evento.id).padStart(4, '0')}`;
}

function statusClass(status) {
  return normalizeSearch(status).replace(/\s+/g, '-');
}

function statusBadge(evento) {
  return `<span class="status-badge is-${escapeHtml(statusClass(evento.status))}">${escapeHtml(evento.status)}</span>`;
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

function filteredEvents() {
  const query = normalizeSearch(elements.eventSearch.value);

  if (!query) {
    return state.eventos;
  }

  return state.eventos.filter((evento) => {
    const searchable = normalizeSearch(`${orderCode(evento)} ${evento.titulo}`);
    return searchable.includes(query);
  });
}

function renderPagination(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  if (totalPages <= 1) {
    elements.eventsPagination.innerHTML = '';
    return;
  }

  elements.eventsPagination.innerHTML = `
    <button class="small-button" type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>Anterior</button>
    <span>Página ${state.page} de ${totalPages}</span>
    <button class="small-button" type="button" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''}>Próxima</button>
  `;
}

function renderEvents() {
  const eventos = filteredEvents();
  const totalPages = Math.max(1, Math.ceil(eventos.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const pageItems = eventos.slice(start, start + state.pageSize);

  elements.loadingState.hidden = true;
  elements.eventCount.textContent = `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`;
  renderPagination(eventos.length);

  if (state.eventos.length === 0) {
    elements.eventsTableBody.innerHTML = '<tr><td colspan="3">Nenhum evento ativo no momento.</td></tr>';
    return;
  }

  if (pageItems.length === 0) {
    elements.eventsTableBody.innerHTML = '<tr><td colspan="3">Nenhum evento encontrado para a busca.</td></tr>';
    return;
  }

  elements.eventsTableBody.innerHTML = pageItems
    .map((evento) => {
      const date = formatDateParts(evento.data);

      return `
        <tr class="clickable-row" data-event-id="${evento.id}" tabindex="0">
          <td><strong class="order-code">${escapeHtml(orderCode(evento))}</strong></td>
          <td>
            <div class="event-record-title">
              <strong>${escapeHtml(evento.titulo)}</strong>
              ${statusBadge(evento)}
            </div>
          </td>
          <td>${escapeHtml(date.short)}</td>
        </tr>
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

    state.eventos = await response.json();
    renderEvents();
  } catch (error) {
    elements.loadingState.textContent = error.message;
    elements.loadingState.hidden = false;
  }
}

function setPresenceAvailability(evento) {
  const disabled = !evento.presencaDisponivel;
  elements.presenceName.disabled = disabled;
  elements.presencePhone.disabled = disabled;
  elements.presenceSubmitButton.disabled = disabled;

  if (evento.mensagemPresenca) {
    setFeedback(elements.presenceWindowMessage, evento.mensagemPresenca, 'error');
    return;
  }

  setFeedback(elements.presenceWindowMessage, '', '');
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
    elements.modalTitle.textContent = `${orderCode(evento)} - ${evento.titulo}`;
    elements.modalMeta.innerHTML = [
      metaItem(date.full),
      metaItem(formatEventTimeRange(evento)),
      metaItem(evento.local),
      statusBadge(evento),
    ].join('');
    elements.modalInfo.innerHTML = `
      <dt>Número da Ordem</dt>
      <dd>${escapeHtml(orderCode(evento))}</dd>
      <dt>Nome</dt>
      <dd>${escapeHtml(evento.titulo)}</dd>
      <dt>Data</dt>
      <dd>${escapeHtml(date.short)}</dd>
      <dt>Horário</dt>
      <dd>${escapeHtml(formatEventTimeRange(evento))}</dd>
      <dt>Local</dt>
      <dd>${escapeHtml(evento.local)}</dd>
      <dt>Descrição</dt>
      <dd>${escapeHtml(evento.descricao)}</dd>
    `;

    elements.presenceForm.reset();
    elements.presenceEventId.value = evento.id;
    setFeedback(elements.presenceMessage, '', '');
    setPresenceAvailability(evento);

    elements.modal.classList.add('is-open');
    elements.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    if (evento.presencaDisponivel) {
      elements.presenceName.focus();
    }
  } catch (error) {
    alert(error.message);
    await loadEvents();
  }
}

function closeModal() {
  elements.modal.classList.remove('is-open');
  elements.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

async function submitPresence(event) {
  event.preventDefault();

  if (elements.presenceSubmitButton.disabled) {
    return;
  }

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
    setFeedback(elements.presenceMessage, 'Presença confirmada com sucesso! Esperamos você no evento.', 'success');
  } catch (error) {
    setFeedback(elements.presenceMessage, error.message, 'error');
    if (error.message === 'Este evento já foi encerrado.') {
      elements.presenceSubmitButton.disabled = true;
      elements.presenceName.disabled = true;
      elements.presencePhone.disabled = true;
      await loadEvents();
    }
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

elements.eventsTableBody.addEventListener('click', (event) => {
  const row = event.target.closest('[data-event-id]');
  if (row) {
    openEvent(row.dataset.eventId);
  }
});

elements.eventsTableBody.addEventListener('keydown', (event) => {
  const row = event.target.closest('[data-event-id]');
  if (row && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openEvent(row.dataset.eventId);
  }
});

elements.eventsPagination.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled) {
    return;
  }

  state.page = Number(button.dataset.page);
  renderEvents();
});

elements.eventSearch.addEventListener('input', () => {
  state.page = 1;
  renderEvents();
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
setInterval(loadEvents, 60000);
