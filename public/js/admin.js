const adminState = {
  token: localStorage.getItem('adminToken') || '',
  eventos: [],
  bannerPreviewUrl: '',
};

const admin = {
  loginScreen: document.querySelector('#loginScreen'),
  adminShell: document.querySelector('#adminShell'),
  loginForm: document.querySelector('#loginForm'),
  loginMessage: document.querySelector('#loginMessage'),
  logoutButton: document.querySelector('#logoutButton'),
  navButtons: document.querySelectorAll('.nav-button'),
  sections: document.querySelectorAll('.admin-section'),
  adminEventsTable: document.querySelector('#adminEventsTable'),
  newEventButton: document.querySelector('#newEventButton'),
  eventFormModal: document.querySelector('#eventFormModal'),
  eventFormTitle: document.querySelector('#eventFormTitle'),
  eventForm: document.querySelector('#eventForm'),
  eventId: document.querySelector('#eventId'),
  eventTitle: document.querySelector('#eventTitle'),
  eventDate: document.querySelector('#eventDate'),
  eventTime: document.querySelector('#eventTime'),
  eventPlace: document.querySelector('#eventPlace'),
  eventBanner: document.querySelector('#eventBanner'),
  eventBannerFile: document.querySelector('#eventBannerFile'),
  bannerPreview: document.querySelector('#bannerPreview'),
  eventDescription: document.querySelector('#eventDescription'),
  eventFormMessage: document.querySelector('#eventFormMessage'),
  presenceEventSelect: document.querySelector('#presenceEventSelect'),
  presenceSubtitle: document.querySelector('#presenceSubtitle'),
  presenceTotal: document.querySelector('#presenceTotal'),
  presencesTable: document.querySelector('#presencesTable'),
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

function renderEventsTable() {
  if (adminState.eventos.length === 0) {
    admin.adminEventsTable.innerHTML = '<tr><td colspan="6">Nenhum evento cadastrado.</td></tr>';
    admin.presenceEventSelect.innerHTML = '<option value="">Nenhum evento</option>';
    return;
  }

  admin.adminEventsTable.innerHTML = adminState.eventos
    .map(
      (evento) => {
        const banner = imageUrl(evento);
        const imageHidden = banner ? '' : 'hidden';
        const imageSource = banner ? `src="${escapeHtml(banner)}"` : '';
        const fallbackHidden = banner ? 'hidden' : '';

        return `
          <tr>
            <td>
              <div class="thumb-banner">
                <img class="thumb-image" ${imageSource} alt="" data-title="${escapeHtml(evento.titulo)}" onerror="mostrarFallbackBanner(this)" ${imageHidden} />
              <div class="banner-fallback thumb-fallback" ${fallbackHidden}><span>${escapeHtml(evento.titulo)}</span></div>
            </div>
          </td>
          <td><strong>${escapeHtml(evento.titulo)}</strong></td>
          <td>${escapeHtml(formatDate(evento.data))}</td>
          <td>${escapeHtml(evento.horario)}</td>
          <td>${escapeHtml(evento.local)}</td>
          <td>
            <div class="action-row">
              <button class="small-button" type="button" data-action="edit" data-id="${evento.id}">Editar</button>
              <button class="small-button" type="button" data-action="presences" data-id="${evento.id}">Presenças</button>
              <button class="danger-button" type="button" data-action="delete" data-id="${evento.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
      },
    )
    .join('');

  admin.presenceEventSelect.innerHTML = adminState.eventos
    .map((evento) => `<option value="${evento.id}">${escapeHtml(evento.titulo)}</option>`)
    .join('');
}

async function loadEvents() {
  adminState.eventos = await api('/api/eventos');
  renderEventsTable();

  if (adminState.eventos.length > 0 && !admin.presenceEventSelect.value) {
    admin.presenceEventSelect.value = String(adminState.eventos[0].id);
  }
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
  if (admin.presenceEventSelect.value) {
    await loadPresences(admin.presenceEventSelect.value);
  } else {
    renderEmptyPresences();
  }
}

function renderEmptyPresences(message = 'Nenhuma presença confirmada para este evento.') {
  admin.presenceTotal.textContent = 'Total de Confirmados: 0';
  admin.presencesTable.innerHTML = `<tr><td colspan="3">${escapeHtml(message)}</td></tr>`;
}

async function loadPresences(eventId) {
  if (!eventId) {
    admin.presenceSubtitle.textContent = 'Selecione um evento para visualizar os participantes.';
    renderEmptyPresences('Selecione um evento.');
    return;
  }

  const data = await api(`/api/admin/eventos/${eventId}/presencas`);
  admin.presenceSubtitle.textContent = data.evento.titulo;
  admin.presenceTotal.textContent = `Total de Confirmados: ${data.total}`;

  if (data.presencas.length === 0) {
    renderEmptyPresences();
    return;
  }

  admin.presencesTable.innerHTML = data.presencas
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

async function openPresences(eventId) {
  switchSection('presencesSection');
  admin.presenceEventSelect.value = String(eventId);
  await loadPresences(eventId);
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
  } catch (error) {
    setMessage(admin.loginMessage, error.message, 'error');
  }
});

admin.logoutButton.addEventListener('click', logout);

admin.navButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    switchSection(button.dataset.section);
    if (button.dataset.section === 'presencesSection' && admin.presenceEventSelect.value) {
      await loadPresences(admin.presenceEventSelect.value);
    }
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

document.querySelectorAll('[data-close-event-form]').forEach((button) => {
  button.addEventListener('click', closeEventForm);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && admin.eventFormModal.classList.contains('is-open')) {
    closeEventForm();
  }
});

admin.adminEventsTable.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === 'edit') {
    const evento = adminState.eventos.find((item) => String(item.id) === String(id));
    if (evento) {
      openEventForm(evento);
    }
  }

  if (action === 'delete') {
    try {
      await deleteEvent(id);
    } catch (error) {
      alert(error.message);
    }
  }

  if (action === 'presences') {
    try {
      await openPresences(id);
    } catch (error) {
      alert(error.message);
    }
  }
});

admin.presenceEventSelect.addEventListener('change', () => {
  loadPresences(admin.presenceEventSelect.value).catch((error) => alert(error.message));
});

if (adminState.token) {
  showAuthenticated();
  loadEvents()
    .then(() => {
      if (admin.presenceEventSelect.value) {
        return loadPresences(admin.presenceEventSelect.value);
      }
      return null;
    })
    .catch(() => logout());
} else {
  showLogin();
}
