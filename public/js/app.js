const fallbackBanner = '/assets/img/banner-eventos.jpeg';

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

function imageUrl(value) {
  return String(value || '').trim() || fallbackBanner;
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
      return `
        <article class="event-card">
          <div class="event-card__image">
            <img src="${escapeHtml(imageUrl(evento.banner))}" alt="" onerror="this.onerror=null;this.src='${fallbackBanner}'" />
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
    elements.modalBanner.src = imageUrl(evento.banner);
    elements.modalBanner.onerror = () => {
      elements.modalBanner.onerror = null;
      elements.modalBanner.src = fallbackBanner;
    };
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

  const payload = {
    eventoId: Number(elements.presenceEventId.value),
    nome: elements.presenceName.value,
    telefone: elements.presencePhone.value,
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
loadEvents();
