const adminState = {
  token: localStorage.getItem('adminToken') || '',
  eventos: [],
  bannerPreviewUrl: '',
  activePage: 1,
  archivedPage: 1,
  pageSize: 8,
  currentDetailEventId: '',
  detailRefreshTimer: null,
  eventsRefreshTimer: null,
};

const admin = {
  loginScreen: document.querySelector('#loginScreen'),
  adminShell: document.querySelector('#adminShell'),
  loginForm: document.querySelector('#loginForm'),
  loginMessage: document.querySelector('#loginMessage'),
  logoutButton: document.querySelector('#logoutButton'),
  navButtons: document.querySelectorAll('.nav-button'),
  sections: document.querySelectorAll('.admin-section'),
  activeEventSearch: document.querySelector('#activeEventSearch'),
  archivedEventSearch: document.querySelector('#archivedEventSearch'),
  adminActiveEventsTable: document.querySelector('#adminActiveEventsTable'),
  adminArchivedEventsTable: document.querySelector('#adminArchivedEventsTable'),
  activeEventsPagination: document.querySelector('#activeEventsPagination'),
  archivedEventsPagination: document.querySelector('#archivedEventsPagination'),
  newEventButton: document.querySelector('#newEventButton'),
  eventFormModal: document.querySelector('#eventFormModal'),
  eventFormTitle: document.querySelector('#eventFormTitle'),
  eventForm: document.querySelector('#eventForm'),
  eventId: document.querySelector('#eventId'),
  eventTitle: document.querySelector('#eventTitle'),
  eventDate: document.querySelector('#eventDate'),
  eventTime: document.querySelector('#eventTime'),
  eventEndTime: document.querySelector('#eventEndTime'),
  eventPlace: document.querySelector('#eventPlace'),
  eventBanner: document.querySelector('#eventBanner'),
  eventBannerFile: document.querySelector('#eventBannerFile'),
  bannerPreview: document.querySelector('#bannerPreview'),
  eventDescription: document.querySelector('#eventDescription'),
  eventFormMessage: document.querySelector('#eventFormMessage'),
  adminEventDetailModal: document.querySelector('#adminEventDetailModal'),
  adminDetailTitle: document.querySelector('#adminDetailTitle'),
  adminDetailMeta: document.querySelector('#adminDetailMeta'),
  adminDetailInfo: document.querySelector('#adminDetailInfo'),
  adminPresenceTitle: document.querySelector('#adminPresenceTitle'),
  adminPresenceTotal: document.querySelector('#adminPresenceTotal'),
  adminDetailPresencesTable: document.querySelector('#adminDetailPresencesTable'),
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
  const wrapper = image.closest('.thumb-banner, .banner-preview-wrap');
  const fallback = wrapper ? wrapper.querySelector('.banner-fallback') : null;

  image.hidden = true;

  if (fallback) {
    const label = fallback.querySelector('span');
    if (label) {
      label.textContent = title || 'Banner do evento';
    }
    fallback.hidden = false;
  }
}

function resetBannerImage(image, title) {
  const wrapper = image.closest('.thumb-banner, .banner-preview-wrap');
  const fallback = wrapper ? wrapper.querySelector('.banner-fallback') : null;

  image.hidden = false;
  image.onerror = () => showBannerFallback(image, title);

  if (fallback) {
    const label = fallback.querySelector('span');
    if (label) {
      label.textContent = title || 'Banner do evento';
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
  showBannerFallback(image, image.dataset.title || 'Banner do evento');
}

function setMessage(element, message, type) {
  element.textContent = message;
  element.classList.remove('success', 'error');
  if (type) {
    element.classList.add(type);
  }
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue || '-';
  }

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatLongDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue || '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
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

async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (adminState.token) {
    headers.Authorization = `Bearer ${adminState.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && path !== '/api/admin/login') {
      logout();
    }
    throw new Error((data && data.error) || 'Erro ao processar a solicitacao.');
  }

  return data;
}

function showAuthenticated() {
  admin.loginScreen.hidden = true;
  admin.adminShell.hidden = false;
}

function showLogin() {
  admin.loginScreen.hidden = false;
  admin.adminShell.hidden = true;
}

function logout() {
  stopDetailRefresh();
  stopEventsRefresh();
  adminState.token = '';
  localStorage.removeItem('adminToken');
  showLogin();
}

function switchSection(sectionId) {
  admin.navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.section === sectionId);
  });

  admin.sections.forEach((section) => {
    section.hidden = section.id !== sectionId;
  });
}

function eventsByArchiveState(archived) {
  return adminState.eventos.filter((evento) => Boolean(evento.arquivado) === archived);
}

function filterEvents(eventos, query) {
  const normalized = normalizeSearch(query);

  if (!normalized) {
    return eventos;
  }

  return eventos.filter((evento) => normalizeSearch(`${orderCode(evento)} ${evento.titulo}`).includes(normalized));
}

function renderPagination(target, pageKey, totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / adminState.pageSize));
  adminState[pageKey] = Math.min(adminState[pageKey], totalPages);
  const currentPage = adminState[pageKey];

  if (totalPages <= 1) {
    target.innerHTML = '';
    return;
  }

  target.innerHTML = `
    <button class="small-button" type="button" data-page-key="${pageKey}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
    <span>Página ${currentPage} de ${totalPages}</span>
    <button class="small-button" type="button" data-page-key="${pageKey}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Próxima</button>
  `;
}

function renderEventsTable({ archived, table, pagination, pageKey, search, emptyMessage }) {
  const source = eventsByArchiveState(archived);
  const eventos = filterEvents(source, search.value);
  const totalPages = Math.max(1, Math.ceil(eventos.length / adminState.pageSize));
  adminState[pageKey] = Math.min(adminState[pageKey], totalPages);
  const start = (adminState[pageKey] - 1) * adminState.pageSize;
  const pageItems = eventos.slice(start, start + adminState.pageSize);

  renderPagination(pagination, pageKey, eventos.length);

  if (source.length === 0) {
    table.innerHTML = `<tr><td colspan="5">${escapeHtml(emptyMessage)}</td></tr>`;
    return;
  }

  if (pageItems.length === 0) {
    table.innerHTML = '<tr><td colspan="5">Nenhum evento encontrado para a busca.</td></tr>';
    return;
  }

  table.innerHTML = pageItems
    .map(
      (evento) => `
        <tr class="clickable-row" data-event-id="${evento.id}" tabindex="0">
          <td><strong class="order-code">${escapeHtml(orderCode(evento))}</strong></td>
          <td>
            <div class="event-record-title">
              <strong>${escapeHtml(evento.titulo)}</strong>
              <span>${escapeHtml(formatEventTimeRange(evento))} - ${escapeHtml(evento.local)}</span>
            </div>
          </td>
          <td>${escapeHtml(formatDate(evento.data))}</td>
          <td>${statusBadge(evento)}</td>
          <td>
            <div class="action-row">
              <button class="small-button" type="button" data-action="detail" data-id="${evento.id}">Detalhes</button>
              <button class="small-button" type="button" data-action="edit" data-id="${evento.id}">Editar</button>
              <button class="danger-button" type="button" data-action="delete" data-id="${evento.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');
}

function renderEventsTables() {
  renderEventsTable({
    archived: false,
    table: admin.adminActiveEventsTable,
    pagination: admin.activeEventsPagination,
    pageKey: 'activePage',
    search: admin.activeEventSearch,
    emptyMessage: 'Nenhum evento ativo cadastrado.',
  });

  renderEventsTable({
    archived: true,
    table: admin.adminArchivedEventsTable,
    pagination: admin.archivedEventsPagination,
    pageKey: 'archivedPage',
    search: admin.archivedEventSearch,
    emptyMessage: 'Nenhum evento arquivado.',
  });
}

async function loadEvents() {
  adminState.eventos = await api('/api/admin/eventos');
  renderEventsTables();
}

function stopEventsRefresh() {
  if (adminState.eventsRefreshTimer) {
    clearInterval(adminState.eventsRefreshTimer);
    adminState.eventsRefreshTimer = null;
  }
}

function startEventsRefresh() {
  stopEventsRefresh();
  adminState.eventsRefreshTimer = setInterval(() => {
    if (!adminState.token) {
      return;
    }

    loadEvents().catch(() => logout());
  }, 60000);
}

function currentFormBannerEvent() {
  return {
    id: Number(admin.eventId.value) || Date.now(),
    titulo: admin.eventTitle.value || 'Banner do evento',
    banner: admin.eventBanner.value.trim(),
  };
}

function revokeBannerPreviewUrl() {
  if (adminState.bannerPreviewUrl) {
    URL.revokeObjectURL(adminState.bannerPreviewUrl);
    adminState.bannerPreviewUrl = '';
  }
}

function updateBannerPreview() {
  revokeBannerPreviewUrl();

  const file = admin.eventBannerFile.files[0];
  if (file) {
    adminState.bannerPreviewUrl = URL.createObjectURL(file);
    setBannerImage(admin.bannerPreview, adminState.bannerPreviewUrl, admin.eventTitle.value || file.name);
    return;
  }

  const evento = currentFormBannerEvent();
  setBannerImage(admin.bannerPreview, imageUrl(evento), evento.titulo);
}

function openEventForm(evento) {
  const isEdit = Boolean(evento);
  admin.eventFormTitle.textContent = isEdit ? 'Editar Evento' : 'Novo Evento';
  admin.eventId.value = isEdit ? evento.id : '';
  admin.eventTitle.value = isEdit ? evento.titulo : '';
  admin.eventDate.value = isEdit ? evento.data : '';
  admin.eventTime.value = isEdit ? evento.horario : '';
  admin.eventEndTime.value = isEdit ? evento.horarioFim : '';
  admin.eventPlace.value = isEdit ? evento.local : '';
  admin.eventDescription.value = isEdit ? evento.descricao : '';
  admin.eventBanner.value = isEdit ? String(evento.banner || '') : '';
  admin.eventBannerFile.value = '';
  updateBannerPreview();
  setMessage(admin.eventFormMessage, '', '');

  admin.eventFormModal.classList.add('is-open');
  admin.eventFormModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  admin.eventTitle.focus();
}

function closeEventForm() {
  admin.eventFormModal.classList.remove('is-open');
  admin.eventFormModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function getEventPayload() {
  const formData = new FormData();
  const file = admin.eventBannerFile.files[0];

  formData.append('titulo', admin.eventTitle.value);
  formData.append('data', admin.eventDate.value);
  formData.append('horario', admin.eventTime.value);
  formData.append('horarioFim', admin.eventEndTime.value);
  formData.append('local', admin.eventPlace.value);
  formData.append('banner', admin.eventBanner.value.trim());
  formData.append('descricao', admin.eventDescription.value);

  if (file) {
    formData.append('bannerArquivo', file);
  }

  return formData;
}

async function saveEvent(event) {
  event.preventDefault();
  setMessage(admin.eventFormMessage, 'Salvando evento...', '');

  const id = admin.eventId.value;
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/admin/eventos/${id}` : '/api/admin/eventos';

  try {
    await api(url, {
      method,
      body: getEventPayload(),
    });

    setMessage(admin.eventFormMessage, 'Evento salvo com sucesso.', 'success');
    await loadEvents();
    setTimeout(closeEventForm, 450);
  } catch (error) {
    setMessage(admin.eventFormMessage, error.message, 'error');
  }
}

async function deleteEvent(id) {
  const evento = adminState.eventos.find((item) => String(item.id) === String(id));
  const title = evento ? evento.titulo : 'este evento';

  if (!confirm(`Excluir "${title}"? As presenças vinculadas tambem serão removidas.`)) {
    return;
  }

  await api(`/api/admin/eventos/${id}`, { method: 'DELETE' });
  await loadEvents();
}

function renderEmptyPresences(message = 'Nenhuma presença confirmada para este evento.') {
  admin.adminPresenceTotal.textContent = 'Total de Confirmados: 0';
  admin.adminDetailPresencesTable.innerHTML = `<tr><td colspan="3">${escapeHtml(message)}</td></tr>`;
}

function renderAdminDetail(data) {
  const evento = data.evento;

  admin.adminDetailTitle.textContent = `${orderCode(evento)} - ${evento.titulo}`;
  admin.adminDetailMeta.innerHTML = [
    metaItem(formatLongDate(evento.data)),
    metaItem(formatEventTimeRange(evento)),
    metaItem(evento.local),
    statusBadge(evento),
  ].join('');
  admin.adminDetailInfo.innerHTML = `
    <dt>Número da Ordem</dt>
    <dd>${escapeHtml(orderCode(evento))}</dd>
    <dt>Nome</dt>
    <dd>${escapeHtml(evento.titulo)}</dd>
    <dt>Data</dt>
    <dd>${escapeHtml(formatDate(evento.data))}</dd>
    <dt>Horário</dt>
    <dd>${escapeHtml(formatEventTimeRange(evento))}</dd>
    <dt>Local</dt>
    <dd>${escapeHtml(evento.local)}</dd>
    <dt>Descrição</dt>
    <dd>${escapeHtml(evento.descricao)}</dd>
  `;
  admin.adminPresenceTitle.textContent = `Presenças - ${evento.titulo}`;
  admin.adminPresenceTotal.textContent = `Total de Confirmados: ${data.total}`;

  if (data.presencas.length === 0) {
    renderEmptyPresences();
  } else {
    admin.adminDetailPresencesTable.innerHTML = data.presencas
      .map(
        (presenca) => `
          <tr>
            <td>${escapeHtml(presenca.nome)}</td>
            <td>${escapeHtml(presenca.telefone || '-')}</td>
            <td>${escapeHtml(formatDateTime(presenca.dataConfirmacao))}</td>
          </tr>
        `,
      )
      .join('');
  }
}

function stopDetailRefresh() {
  if (adminState.detailRefreshTimer) {
    clearInterval(adminState.detailRefreshTimer);
    adminState.detailRefreshTimer = null;
  }
}

function startDetailRefresh(eventId) {
  stopDetailRefresh();
  adminState.currentDetailEventId = String(eventId);
  adminState.detailRefreshTimer = setInterval(async () => {
    if (
      !admin.adminEventDetailModal.classList.contains('is-open') ||
      adminState.currentDetailEventId !== String(eventId)
    ) {
      return;
    }

    try {
      const data = await api(`/api/admin/eventos/${eventId}/presencas`);
      renderAdminDetail(data);
    } catch (error) {
      stopDetailRefresh();
    }
  }, 15000);
}

async function openAdminDetail(eventId) {
  const data = await api(`/api/admin/eventos/${eventId}/presencas`);
  renderAdminDetail(data);

  admin.adminEventDetailModal.classList.add('is-open');
  admin.adminEventDetailModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  startDetailRefresh(eventId);
}

function closeAdminDetail() {
  stopDetailRefresh();
  adminState.currentDetailEventId = '';
  admin.adminEventDetailModal.classList.remove('is-open');
  admin.adminEventDetailModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

admin.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(admin.loginMessage, 'Entrando...', '');

  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        usuario: document.querySelector('#usuario').value,
        senha: document.querySelector('#senha').value,
      }),
    });

    adminState.token = data.token;
    localStorage.setItem('adminToken', data.token);
    showAuthenticated();
    await loadEvents();
    startEventsRefresh();
  } catch (error) {
    setMessage(admin.loginMessage, error.message, 'error');
  }
});

admin.logoutButton.addEventListener('click', logout);

admin.navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    switchSection(button.dataset.section);
  });
});

admin.newEventButton.addEventListener('click', () => openEventForm(null));
admin.eventForm.addEventListener('submit', saveEvent);

admin.eventBanner.addEventListener('input', () => {
  if (admin.eventBanner.value.trim()) {
    admin.eventBannerFile.value = '';
  }
  updateBannerPreview();
});

admin.eventBannerFile.addEventListener('change', () => {
  if (admin.eventBannerFile.files[0]) {
    admin.eventBanner.value = '';
  }
  updateBannerPreview();
});

function handleEventTableAction(event) {
  const button = event.target.closest('[data-action]');
  const row = event.target.closest('[data-event-id]');

  if (!button && row) {
    openAdminDetail(row.dataset.eventId).catch((error) => alert(error.message));
    return;
  }

  if (!button) {
    return;
  }

  event.stopPropagation();
  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === 'detail') {
    openAdminDetail(id).catch((error) => alert(error.message));
  }

  if (action === 'edit') {
    const evento = adminState.eventos.find((item) => String(item.id) === String(id));
    if (evento) {
      openEventForm(evento);
    }
  }

  if (action === 'delete') {
    deleteEvent(id).catch((error) => alert(error.message));
  }
}

function handleEventTableKeydown(event) {
  const row = event.target.closest('[data-event-id]');
  if (row && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openAdminDetail(row.dataset.eventId).catch((error) => alert(error.message));
  }
}

admin.adminActiveEventsTable.addEventListener('click', handleEventTableAction);
admin.adminArchivedEventsTable.addEventListener('click', handleEventTableAction);
admin.adminActiveEventsTable.addEventListener('keydown', handleEventTableKeydown);
admin.adminArchivedEventsTable.addEventListener('keydown', handleEventTableKeydown);

admin.activeEventSearch.addEventListener('input', () => {
  adminState.activePage = 1;
  renderEventsTables();
});

admin.archivedEventSearch.addEventListener('input', () => {
  adminState.archivedPage = 1;
  renderEventsTables();
});

[admin.activeEventsPagination, admin.archivedEventsPagination].forEach((pagination) => {
  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page-key]');
    if (!button || button.disabled) {
      return;
    }

    adminState[button.dataset.pageKey] = Number(button.dataset.page);
    renderEventsTables();
  });
});

document.querySelectorAll('[data-close-event-form]').forEach((button) => {
  button.addEventListener('click', closeEventForm);
});

document.querySelectorAll('[data-close-admin-detail]').forEach((button) => {
  button.addEventListener('click', closeAdminDetail);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && admin.eventFormModal.classList.contains('is-open')) {
    closeEventForm();
  }

  if (event.key === 'Escape' && admin.adminEventDetailModal.classList.contains('is-open')) {
    closeAdminDetail();
  }
});

if (adminState.token) {
  showAuthenticated();
  loadEvents()
    .then(startEventsRefresh)
    .catch(() => logout());
} else {
  showLogin();
}
