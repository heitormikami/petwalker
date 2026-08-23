import { StorageService } from './services/storage.js';
import { hashPin, verifyPin, isBiometricsAvailable, registerBiometrics, authenticateBiometrics } from './services/security.js';
import { syncBackupToGoogle, sendInvoiceEmailViaGoogle, pullBackupFromGoogle, listBackupsFromGoogle } from './services/googleSync.js';
import { calculateSessionCost, calculateMonthlyInvoice, formatWhatsAppSummary, formatEmailHtml } from './domain/models.js';

// ESTADO DA APLICAÇÃO
const state = {
  tutors: [],
  groups: [],
  pets: [],
  sessions: [],
  adjustments: [],
  settings: {},
  activeSession: null,
  timerInterval: null,
  activeView: 'view-walk',
  enteredPin: ''
};

async function initApp() {
  try {
    await StorageService.initSampleDataIfEmpty();
    await loadAppData();
    setupNavigation();
    setupLockScreen();
    setupWalkController();
    setupDailyView();
    setupTutorManager();
    setupInvoiceManager();
    setupSettingsController();
    setupManualWalkModal();
    setupEmailPreviewModal();

    // Registrar Service Worker apenas em produção, desativar em localhost para dev
    if ('serviceWorker' in navigator) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
      } else {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker erro:', err));
      }
    }
  } catch (err) {
    console.error('Erro na inicialização:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// CARREGAR DADOS DO INDEXEDDB
async function loadAppData() {
  state.tutors = await StorageService.getTutors();
  state.groups = await StorageService.getGroups();
  state.pets = await StorageService.getPets();
  state.sessions = await StorageService.getSessions();
  state.adjustments = await StorageService.getAdjustments();
  
  const pinHash = await StorageService.getSetting('pinHash');
  const bioCred = await StorageService.getSetting('bioCred');
  const pixKey = await StorageService.getSetting('pixKey');
  const googleScriptUrl = await StorageService.getSetting('googleScriptUrl');
  const appTheme = await StorageService.getSetting('appTheme') || 'auto';

  state.settings = {
    pinHash,
    bioCred,
    pixKey: pixKey || 'contato@petwalker.com.br',
    googleScriptUrl: googleScriptUrl || '',
    appTheme
  };

  applyTheme(appTheme);

  // Se houver PIN configurado, exibe a tela de bloqueio
  if (state.settings.pinHash) {
    document.getElementById('lock-screen').style.display = 'flex';
  }

  // Preencher seletores e listas na UI
  updateGroupDropdown();
  renderDailyView();
  renderTutorsList();
  updateInvoiceTutorDropdown();

  // Carregar dados de configurações nos campos
  if (document.getElementById('input-setting-pix')) {
    document.getElementById('input-setting-pix').value = state.settings.pixKey;
  }
  if (document.getElementById('input-setting-google')) {
    document.getElementById('input-setting-google').value = state.settings.googleScriptUrl;
  }
  if (document.getElementById('select-app-theme')) {
    document.getElementById('select-app-theme').value = appTheme;
  }
}

function applyTheme(theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// CONTROLADOR DA TELA DE BLOQUEIO / PIN
function setupLockScreen() {
  const lockScreen = document.getElementById('lock-screen');
  const keypadBtns = document.querySelectorAll('.keypad-btn[data-key]');
  const btnDel = document.getElementById('btn-pin-del');
  const btnBio = document.getElementById('btn-biometrics');
  const btnLock = document.getElementById('btn-lock-app');

  keypadBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (state.enteredPin.length < 4) {
        state.enteredPin += btn.dataset.key;
        updatePinDots();

        if (state.enteredPin.length === 4) {
          const isValid = await verifyPin(state.enteredPin, state.settings.pinHash);
          if (isValid) {
            lockScreen.style.display = 'none';
            state.enteredPin = '';
            updatePinDots();
          } else {
            alert('PIN incorreto!');
            state.enteredPin = '';
            updatePinDots();
          }
        }
      }
    });
  });

  if (btnDel) {
    btnDel.addEventListener('click', () => {
      state.enteredPin = state.enteredPin.slice(0, -1);
      updatePinDots();
    });
  }

  if (btnBio) {
    btnBio.addEventListener('click', async () => {
      if (state.settings.bioCred) {
        const success = await authenticateBiometrics(state.settings.bioCred);
        if (success) {
          lockScreen.style.display = 'none';
        } else {
          alert('Autenticação por biometria falhou.');
        }
      } else {
        alert('Biometria não cadastrada. Acesse as Configurações após entrar.');
      }
    });
  }

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      if (!state.settings.pinHash) {
        alert('Cadastre um PIN em Ajustes para poder bloquear o app.');
        return;
      }
      state.enteredPin = '';
      updatePinDots();
      lockScreen.style.display = 'flex';
    });
  }
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) {
      if (i < state.enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    }
  }
}

// NAVEGAÇÃO DE VIEWS
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.dataset.target;
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      item.classList.add('active');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');
      state.activeView = targetId;

      if (targetId === 'view-daily') renderDailyView();
      if (targetId === 'view-tutors') renderTutorsList();
      if (targetId === 'view-invoice') renderInvoiceView();
    });
  });
}

// CONTROLADOR DE PASSEIO (TIMER / NOVO PASSEIO)
function setupWalkController() {
  const btnToggle = document.getElementById('btn-toggle-walk');
  const selectGroup = document.getElementById('select-walk-group');
  const walkOptions = document.getElementById('walk-active-options');
  const heroIdle = document.getElementById('hero-idle-state');
  const heroActive = document.getElementById('hero-active-state');
  const timerText = document.getElementById('timer-text');
  const chipsContainer = document.getElementById('active-pets-chips');

  btnToggle.addEventListener('click', async () => {
    if (!state.activeSession) {
      // INICIAR PASSEIO
      const groupId = selectGroup.value;
      if (!groupId) {
        alert('Por favor, selecione o grupo de passeio.');
        return;
      }

      const group = state.groups.find(g => g.id === groupId);
      const groupPets = state.pets.filter(p => p.groupId === groupId);

      state.activeSession = {
        id: `sess-${Date.now()}`,
        groupId,
        groupName: group ? group.name : 'Grupo',
        startTime: new Date().toISOString(),
        contractedDuration: Number(document.getElementById('select-contracted-duration').value || 60),
        pets: groupPets.map(p => p.name)
      };

      // Atualizar UI para Estado Ativo
      heroIdle.style.display = 'none';
      heroActive.style.display = 'block';
      walkOptions.style.display = 'block';
      selectGroup.disabled = true;

      btnToggle.textContent = '⏹️ Concluir Passeio';
      btnToggle.classList.remove('btn-primary');
      btnToggle.classList.add('btn-danger');

      // Chips dos Pets
      chipsContainer.innerHTML = (groupPets.length > 0 ? groupPets : [{ name: group.name }]).map(p => `<span class="chip">🐶 ${p.name}</span>`).join('');

      // Iniciar Cronômetro em Tempo Real
      startTimerDisplay(state.activeSession.startTime, timerText);
    } else {
      // CONCLUIR PASSEIO
      clearInterval(state.timerInterval);

      const endTime = new Date().toISOString();
      const notesArray = [];

      if (document.getElementById('note-pee').checked) notesArray.push('Fez xixi 💦');
      if (document.getElementById('note-poop').checked) notesArray.push('Fez cocô 💩');
      if (document.getElementById('note-water').checked) notesArray.push('Bebeu água 💧');
      if (document.getElementById('note-tired').checked) notesArray.push('Cansou/brincou 😴');

      const customNotes = document.getElementById('walk-notes-text').value.trim();
      if (customNotes) notesArray.push(customNotes);

      const group = state.groups.find(g => g.id === state.activeSession.groupId);
      const sessionCost = calculateSessionCost(group, state.activeSession.contractedDuration);

      const completedSession = {
        ...state.activeSession,
        endTime,
        date: state.activeSession.startTime,
        cost: sessionCost,
        notes: notesArray.join(' | ')
      };

      // Salvar no IndexedDB
      await StorageService.saveSession(completedSession);
      state.sessions.push(completedSession);

      // Resetar UI
      state.activeSession = null;
      heroIdle.style.display = 'block';
      heroActive.style.display = 'none';
      walkOptions.style.display = 'none';
      selectGroup.disabled = false;

      // Limpar campos
      document.getElementById('note-pee').checked = false;
      document.getElementById('note-poop').checked = false;
      document.getElementById('note-water').checked = false;
      document.getElementById('note-tired').checked = false;
      document.getElementById('walk-notes-text').value = '';

      btnToggle.textContent = '🚀 Iniciar Passeio';
      btnToggle.classList.remove('btn-danger');
      btnToggle.classList.add('btn-primary');

      alert('🎉 Passeio registrado com sucesso!');
      renderDailyView();
    }
  });
}

function startTimerDisplay(startTimeIso, element) {
  const startMs = new Date(startTimeIso).getTime();

  function update() {
    const diffMs = Math.max(0, Date.now() - startMs);
    const secs = Math.floor((diffMs / 1000) % 60);
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    const hrs = Math.floor(diffMs / (1000 * 60 * 60));

    element.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  update();
  state.timerInterval = setInterval(update, 1000);
}

function updateGroupDropdown() {
  const select = document.getElementById('select-walk-group');
  if (!select) return;
  const sortedGroups = [...state.groups].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  select.innerHTML = '<option value="">-- Selecione o Grupo --</option>' +
    sortedGroups.map(g => `<option value="${g.id}">${g.name} (R$ ${Number(g.rate30min).toFixed(2).replace('.', ',')}/30m - R$ ${Number(g.rate60min).toFixed(2).replace('.', ',')}/60m)</option>`).join('');
}

// CONTROLADOR DA VIEW DIÁRIA
function setupDailyView() {
  const dateInput = document.getElementById('filter-daily-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().substring(0, 10);
    dateInput.addEventListener('change', renderDailyView);
  }
}

function renderDailyView() {
  const dateInput = document.getElementById('filter-daily-date');
  const targetDateStr = dateInput ? dateInput.value : new Date().toISOString().substring(0, 10);
  const listEl = document.getElementById('daily-sessions-list');
  const countEl = document.getElementById('stat-daily-count');
  const timeEl = document.getElementById('stat-daily-time');

  if (!listEl) return;

  const daySessions = state.sessions.filter(s => s.date && s.date.substring(0, 10) === targetDateStr);

  let totalSeconds = 0;
  daySessions.forEach(s => {
    if (s.startTime && s.endTime) {
      totalSeconds += Math.floor((new Date(s.endTime) - new Date(s.startTime)) / 1000);
    } else {
      totalSeconds += (s.contractedDuration || 60) * 60;
    }
  });

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);

  if (countEl) countEl.textContent = daySessions.length;
  if (timeEl) timeEl.textContent = `${hrs}h ${mins}m`;

  if (daySessions.length === 0) {
    listEl.innerHTML = '<li style="text-align: center; color: var(--text-muted); padding: 20px 0;">Nenhum passeio registrado nesta data.</li>';
    return;
  }

  listEl.innerHTML = daySessions.map(s => {
    const startFormatted = s.startTime ? new Date(s.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const endFormatted = s.endTime ? new Date(s.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    return `
      <li class="item-row">
        <div>
          <div style="font-weight: 700;">🐕 ${s.groupName || 'Grupo'}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            🕒 ${startFormatted} às ${endFormatted} (${s.contractedDuration}m contratados) - <strong>R$ ${s.cost ? s.cost.toFixed(2) : '0.00'}</strong>
          </div>
          ${s.notes ? `<div style="font-size: 0.8rem; color: var(--primary); margin-top: 2px;">📝 ${s.notes}</div>` : ''}
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-outline btn-sm" onclick="window.editSessionHandler('${s.id}')">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="window.deleteSessionHandler('${s.id}')">Excluir</button>
        </div>
      </li>
    `;
  }).join('');
}

window.deleteSessionHandler = async (id) => {
  if (confirm('Deseja excluir este registro de passeio?')) {
    await StorageService.deleteSession(id);
    state.sessions = state.sessions.filter(s => s.id !== id);
    renderDailyView();
  }
};

window.editSessionHandler = (id) => {
  const session = state.sessions.find(s => s.id === id);
  if (!session) return;
  openManualWalkModal(session);
};

function openManualWalkModal(session = null) {
  const modal = document.getElementById('modal-manual-walk');
  const titleEl = document.getElementById('modal-walk-title');
  const groupSelect = document.getElementById('manual-walk-group');
  const dateInput = document.getElementById('manual-walk-date');
  const startInput = document.getElementById('manual-walk-start');
  const endInput = document.getElementById('manual-walk-end');
  const durationSelect = document.getElementById('manual-walk-duration');
  const notesInput = document.getElementById('manual-walk-notes');
  const idInput = document.getElementById('manual-walk-id');

  // Atualizar seletores de grupo
  groupSelect.innerHTML = '<option value="">-- Selecione o Grupo --</option>' +
    state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

  if (session) {
    titleEl.textContent = '✏️ Editar Passeio';
    idInput.value = session.id;
    groupSelect.value = session.groupId;
    dateInput.value = session.date ? session.date.substring(0, 10) : new Date().toISOString().substring(0, 10);
    startInput.value = session.startTime ? new Date(session.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '10:00';
    endInput.value = session.endTime ? new Date(session.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '11:00';
    durationSelect.value = session.contractedDuration || 60;
    notesInput.value = session.notes || '';
  } else {
    titleEl.textContent = '📝 Lançar Passeio Manual';
    idInput.value = '';
    groupSelect.value = state.groups.length > 0 ? state.groups[0].id : '';
    dateInput.value = document.getElementById('filter-daily-date')?.value || new Date().toISOString().substring(0, 10);
    startInput.value = '10:00';
    endInput.value = '11:00';
    durationSelect.value = 60;
    notesInput.value = '';
  }

  modal.classList.add('active');
}

// SETUP DO MODAL DE PASSEIO MANUAL/EDIÇÃO
function setupManualWalkModal() {
  const btnOpen = document.getElementById('btn-open-manual-walk');
  const btnOpenHome = document.getElementById('btn-open-manual-walk-home');
  const btnClose = document.getElementById('btn-close-walk-modal');
  const modal = document.getElementById('modal-manual-walk');
  const form = document.getElementById('form-manual-walk');

  if (btnOpen) btnOpen.addEventListener('click', () => openManualWalkModal());
  if (btnOpenHome) btnOpenHome.addEventListener('click', () => openManualWalkModal());
  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('manual-walk-id').value;
      const groupId = document.getElementById('manual-walk-group').value;
      const dateStr = document.getElementById('manual-walk-date').value;
      const startTimeStr = document.getElementById('manual-walk-start').value;
      const endTimeStr = document.getElementById('manual-walk-end').value;
      const duration = Number(document.getElementById('manual-walk-duration').value || 60);
      const notes = document.getElementById('manual-walk-notes').value.trim();

      const group = state.groups.find(g => g.id === groupId);
      const cost = calculateSessionCost(group, duration);

      const startTimeDate = new Date(`${dateStr}T${startTimeStr}`);
      const endTimeDate = new Date(`${dateStr}T${endTimeStr}`);

      const sessionData = {
        id: id || `sess-${Date.now()}`,
        groupId,
        groupName: group ? group.name : 'Grupo',
        contractedDuration: duration,
        cost,
        date: startTimeDate.toISOString(),
        startTime: startTimeDate.toISOString(),
        endTime: endTimeDate.toISOString(),
        notes
      };

      await StorageService.saveSession(sessionData);

      if (id) {
        const idx = state.sessions.findIndex(s => s.id === id);
        if (idx !== -1) state.sessions[idx] = sessionData;
      } else {
        state.sessions.push(sessionData);
      }

      modal.classList.remove('active');
      renderDailyView();
      renderInvoiceView();
      alert('Passeio salvo com sucesso!');
    });
  }
}

// CONTROLADOR DE TUTORES E GRUPOS
function setupTutorManager() {
  const btnOpen = document.getElementById('btn-open-tutor-modal');
  const btnClose = document.getElementById('btn-close-tutor-modal');
  const modal = document.getElementById('modal-tutor');
  const form = document.getElementById('form-tutor');
  const modalTitle = document.getElementById('modal-tutor-title');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      form.reset();
      document.getElementById('tutor-id').value = '';
      document.getElementById('tutor-group-id').value = '';
      if (modalTitle) modalTitle.textContent = '🐾 Cadastrar Novo Tutor';
      modal.classList.add('active');
    });
  }

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));

  window.editTutorHandler = (tutorId) => {
    const tutor = state.tutors.find(t => t.id === tutorId);
    if (!tutor) return;

    const group = state.groups.find(g => g.tutorId === tutorId);

    document.getElementById('tutor-id').value = tutor.id;
    document.getElementById('tutor-group-id').value = group ? group.id : '';
    document.getElementById('tutor-name').value = tutor.name || '';
    document.getElementById('tutor-phone').value = tutor.phone || '';
    document.getElementById('tutor-email').value = tutor.email || '';

    document.getElementById('group-name').value = group ? group.name : '';
    document.getElementById('group-rate-30').value = group ? group.rate30min : 40;
    document.getElementById('group-rate-60').value = group ? group.rate60min : 70;

    if (modalTitle) modalTitle.textContent = '✏️ Editar Tutor & Grupo';
    modal.classList.add('active');
  };

  window.deleteTutorHandler = async (tutorId) => {
    const tutor = state.tutors.find(t => t.id === tutorId);
    if (!tutor) return;

    if (!confirm(`Tem certeza que deseja excluir o tutor "${tutor.name}" e seus grupos de pets?`)) {
      return;
    }

    await StorageService.deleteTutor(tutorId);
    state.tutors = state.tutors.filter(t => t.id !== tutorId);

    const relatedGroups = state.groups.filter(g => g.tutorId === tutorId);
    for (const g of relatedGroups) {
      await StorageService.deleteGroup(g.id);
    }
    state.groups = state.groups.filter(g => g.tutorId !== tutorId);

    updateGroupDropdown();
    renderTutorsList();
    updateInvoiceTutorDropdown();
    alert(`Tutor "${tutor.name}" excluído com sucesso!`);
  };

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tutorId = document.getElementById('tutor-id').value;
      const groupId = document.getElementById('tutor-group-id').value;

      const tutorName = document.getElementById('tutor-name').value.trim();
      const tutorPhone = document.getElementById('tutor-phone').value.trim();
      const tutorEmail = document.getElementById('tutor-email').value.trim();
      const groupName = document.getElementById('group-name').value.trim();
      const rate30 = Number(document.getElementById('group-rate-30').value || 40);
      const rate60 = Number(document.getElementById('group-rate-60').value || 70);

      if (tutorId) {
        // MODO EDIÇÃO
        const existingTutor = state.tutors.find(t => t.id === tutorId);
        if (existingTutor) {
          existingTutor.name = tutorName;
          existingTutor.phone = tutorPhone;
          existingTutor.email = tutorEmail;
          await StorageService.saveTutor(existingTutor);
        }

        if (groupId) {
          const existingGroup = state.groups.find(g => g.id === groupId);
          if (existingGroup) {
            existingGroup.name = groupName;
            existingGroup.rate30min = rate30;
            existingGroup.rate60min = rate60;
            await StorageService.saveGroup(existingGroup);
          }
        } else if (groupName) {
          const newGroup = {
            id: `grp-${Date.now()}`,
            tutorId,
            name: groupName,
            rate30min: rate30,
            rate60min: rate60
          };
          await StorageService.saveGroup(newGroup);
          state.groups.push(newGroup);
        }

        modal.classList.remove('active');
        form.reset();
        updateGroupDropdown();
        renderTutorsList();
        updateInvoiceTutorDropdown();
        alert('Tutor atualizado com sucesso!');
      } else {
        // MODO NOVO
        const newTutor = {
          id: `tut-${Date.now()}`,
          name: tutorName,
          phone: tutorPhone,
          email: tutorEmail
        };

        const newGroup = {
          id: `grp-${Date.now()}`,
          tutorId: newTutor.id,
          name: groupName,
          rate30min: rate30,
          rate60min: rate60
        };

        await StorageService.saveTutor(newTutor);
        await StorageService.saveGroup(newGroup);

        state.tutors.push(newTutor);
        state.groups.push(newGroup);

        modal.classList.remove('active');
        form.reset();

        updateGroupDropdown();
        renderTutorsList();
        updateInvoiceTutorDropdown();
        alert('Tutor e Grupo cadastrados com sucesso!');
      }
    });
  }
}

function renderTutorsList() {
  const container = document.getElementById('tutors-tree-list');
  if (!container) return;

  if (state.tutors.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px 0;">Nenhum tutor cadastrado ainda.</div>';
    return;
  }

  const sortedTutors = [...state.tutors].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  container.innerHTML = sortedTutors.map(t => {
    const tGroups = state.groups.filter(g => g.tutorId === t.id);
    return `
      <div style="background: var(--bg-cream); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 14px;">
        <!-- Cabeçalho do Tutor (Largura Total sem aperto) -->
        <div>
          <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main); word-break: break-word;">👤 ${t.name}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; display: flex; flex-direction: column; gap: 2px; word-break: break-word;">
            <span>📱 ${t.phone || 'Sem telefone'}</span>
            <span>✉️ ${t.email || 'Sem e-mail'}</span>
          </div>
        </div>

        <!-- Grupos de Passeio & Pets -->
        <div style="margin-top: 12px;">
          ${tGroups.length > 0 ? tGroups.map(g => `
            <div style="background: var(--surface); padding: 10px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 6px; border: 1px solid var(--border);">
              <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                <span>🐾</span> <span>${g.name}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: var(--primary); font-weight: 700; font-size: 0.85rem;">
                <span>30 min: R$ ${Number(g.rate30min).toFixed(2).replace('.', ',')}</span>
                <span>60 min: R$ ${Number(g.rate60min).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          `).join('') : '<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 4px 0;">Nenhum grupo de passeio associado.</div>'}
        </div>

        <!-- Botões de Ação na Base do Card -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border);">
          <button class="btn btn-outline btn-sm" onclick="window.editTutorHandler('${t.id}')" style="width: 100%; padding: 8px 12px;">
            ✏️ Editar
          </button>
          <button class="btn btn-danger btn-sm" onclick="window.deleteTutorHandler('${t.id}')" style="width: 100%; padding: 8px 12px;">
            🗑️ Excluir
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// CONTROLADOR DA VIEW DE INVOICE / FATURA
function setupInvoiceManager() {
  const monthPicker = document.getElementById('invoice-month-picker');
  const tutorSelect = document.getElementById('invoice-tutor-select');
  const btnAdj = document.getElementById('btn-add-adjustment');
  const btnCloseAdj = document.getElementById('btn-close-adj-modal');
  const modalAdj = document.getElementById('modal-adjustment');
  const formAdj = document.getElementById('form-adjustment');
  const btnWa = document.getElementById('btn-share-whatsapp');
  const btnN8n = document.getElementById('btn-send-n8n-email');

  if (monthPicker) {
    monthPicker.value = new Date().toISOString().substring(0, 7);
    monthPicker.addEventListener('change', renderInvoiceView);
  }

  if (tutorSelect) {
    tutorSelect.addEventListener('change', renderInvoiceView);
  }

  if (btnAdj) btnAdj.addEventListener('click', () => modalAdj.classList.add('active'));
  if (btnCloseAdj) btnCloseAdj.addEventListener('click', () => modalAdj.classList.remove('active'));

  if (formAdj) {
    formAdj.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tutorId = tutorSelect.value;
      const monthYearKey = monthPicker.value;
      if (!tutorId) return;

      const type = document.getElementById('adj-type').value;
      const amount = Number(document.getElementById('adj-amount').value || 0);
      const description = document.getElementById('adj-desc').value.trim();

      const newAdj = {
        id: `adj-${Date.now()}`,
        tutorId,
        date: `${monthYearKey}-01T00:00:00Z`,
        type,
        amount,
        description
      };

      await StorageService.saveAdjustment(newAdj);
      state.adjustments.push(newAdj);

      modalAdj.classList.remove('active');
      formAdj.reset();
      renderInvoiceView();
    });
  }

  if (btnWa) {
    btnWa.addEventListener('click', () => {
      const invoice = getCalculatedInvoice();
      if (!invoice) return;
      const message = formatWhatsAppSummary(invoice);
      const encoded = encodeURIComponent(message);
      const phoneDigits = (invoice.tutorPhone || '').replace(/\D/g, '');
      const waUrl = phoneDigits ? `https://wa.me/55${phoneDigits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
      window.open(waUrl, '_blank');
    });
  }

  if (btnWa) {
    btnWa.addEventListener('click', () => {
      const invoice = getCalculatedInvoice();
      if (!invoice) return;
      const message = formatWhatsAppSummary(invoice);
      const encoded = encodeURIComponent(message);
      const phoneDigits = (invoice.tutorPhone || '').replace(/\D/g, '');
      const waUrl = phoneDigits ? `https://wa.me/55${phoneDigits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
      window.open(waUrl, '_blank');
    });
  }

  const btnPreview = document.getElementById('btn-preview-email');
  if (btnPreview) {
    btnPreview.addEventListener('click', () => {
      const invoice = getCalculatedInvoice();
      if (!invoice) {
        alert('Por favor, selecione um Tutor e um Mês válidos.');
        return;
      }
      openEmailPreviewModal(invoice);
    });
  }
}

function openEmailPreviewModal(invoice) {
  const modal = document.getElementById('modal-email-preview');
  const frame = document.getElementById('email-preview-frame');
  const customNoteInput = document.getElementById('preview-custom-note');

  if (!modal || !frame) return;

  function updatePreview() {
    const note = customNoteInput ? customNoteInput.value.trim() : '';
    const html = formatEmailHtml(invoice, note);
    frame.innerHTML = html;
  }

  updatePreview();

  if (customNoteInput) {
    customNoteInput.oninput = updatePreview;
  }

  modal.classList.add('active');
}

function setupEmailPreviewModal() {
  const modal = document.getElementById('modal-email-preview');
  const btnClose = document.getElementById('btn-close-email-modal');
  const btnSendGoogle = document.getElementById('btn-confirm-send-google');
  const btnGmailWeb = document.getElementById('btn-open-in-gmail-web');

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));

  if (btnSendGoogle) {
    btnSendGoogle.addEventListener('click', async () => {
      const invoice = getCalculatedInvoice();
      if (!invoice) return;
      if (!state.settings.googleScriptUrl) {
        alert('Por favor, configure a URL do Google Apps Script na aba Ajustes.');
        return;
      }

      const note = document.getElementById('preview-custom-note')?.value.trim() || '';
      const html = formatEmailHtml(invoice, note);

      try {
        const res = await sendInvoiceEmailViaGoogle(state.settings.googleScriptUrl, invoice, html);
        alert(res.message);
        modal.classList.remove('active');
      } catch (err) {
        alert(`Erro ao enviar e-mail: ${err.message}`);
      }
    });
  }

  if (btnGmailWeb) {
    btnGmailWeb.addEventListener('click', () => {
      const invoice = getCalculatedInvoice();
      if (!invoice) return;

      const note = document.getElementById('preview-custom-note')?.value.trim() || '';
      const recipient = encodeURIComponent(invoice.tutorEmail || '');
      const subject = encodeURIComponent(`Fechamento de Passeios Petwalker - ${invoice.periodMonthYear}`);
      const plainBody = encodeURIComponent(`Olá, ${invoice.tutorName}!\n\nSegue o fechamento dos passeios (${invoice.periodMonthYear}):\nTotal de Passeios: ${invoice.totalSessions}\nTotal a Pagar: R$ ${invoice.totalToPay.toFixed(2).replace('.', ',')}\nChave PIX: ${invoice.pixKey}\n\n${note ? 'Mensagem: ' + note : ''}`);

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${plainBody}`;
      window.open(gmailUrl, '_blank');
    });
  }
}

function updateInvoiceTutorDropdown() {
  const select = document.getElementById('invoice-tutor-select');
  if (!select) return;
  const sortedTutors = [...state.tutors].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  select.innerHTML = '<option value="">-- Selecione o Tutor --</option>' +
    sortedTutors.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

function getCalculatedInvoice() {
  const monthPicker = document.getElementById('invoice-month-picker');
  const tutorSelect = document.getElementById('invoice-tutor-select');
  if (!tutorSelect || !tutorSelect.value) return null;

  const tutor = state.tutors.find(t => t.id === tutorSelect.value);
  if (!tutor) return null;

  return calculateMonthlyInvoice(
    tutor,
    state.groups,
    state.sessions,
    state.adjustments,
    monthPicker.value,
    state.settings.pixKey
  );
}

function renderInvoiceView() {
  const area = document.getElementById('invoice-preview-area');
  const invoice = getCalculatedInvoice();

  if (!invoice) {
    if (area) area.style.display = 'none';
    return;
  }

  if (area) area.style.display = 'block';

  document.getElementById('inv-tutor-name').textContent = invoice.tutorName;
  document.getElementById('inv-period-text').textContent = `Referência: ${invoice.periodMonthYear}`;
  document.getElementById('inv-session-count').textContent = invoice.totalSessions;
  document.getElementById('inv-session-cost').textContent = `R$ ${invoice.sessionsTotalCost.toFixed(2).replace('.', ',')}`;
  document.getElementById('inv-adjustments-cost').textContent = `R$ ${invoice.adjustmentsTotalCost.toFixed(2).replace('.', ',')}`;
  document.getElementById('inv-total-cost').textContent = `R$ ${invoice.totalToPay.toFixed(2).replace('.', ',')}`;
}

// CONTROLADOR DE CONFIGURAÇÕES
function setupSettingsController() {
  const btnSavePin = document.getElementById('btn-save-pin');
  const btnRegisterBio = document.getElementById('btn-register-bio');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnSyncGoogle = document.getElementById('btn-sync-google-now');
  const btnPullGoogle = document.getElementById('btn-pull-google-now');
  const btnExport = document.getElementById('btn-export-json');

  if (btnSavePin) {
    btnSavePin.addEventListener('click', async () => {
      const pinVal = document.getElementById('input-setting-pin').value.trim();
      if (pinVal.length !== 4 || isNaN(pinVal)) {
        alert('O PIN deve ter exatamente 4 dígitos numéricos.');
        return;
      }
      const hashed = await hashPin(pinVal);
      await StorageService.saveSetting('pinHash', hashed);
      state.settings.pinHash = hashed;
      alert('PIN de segurança cadastrado com sucesso!');
      document.getElementById('input-setting-pin').value = '';
    });
  }

  if (btnRegisterBio) {
    btnRegisterBio.addEventListener('click', async () => {
      try {
        const bioCred = await registerBiometrics();
        await StorageService.saveSetting('bioCred', bioCred);
        state.settings.bioCred = bioCred;
        alert('Biometria nativa cadastrada com sucesso!');
      } catch (e) {
        alert(`Erro na biometria: ${e.message}`);
      }
    });
  }

  const selectTheme = document.getElementById('select-app-theme');
  if (selectTheme) {
    selectTheme.addEventListener('change', async () => {
      const newTheme = selectTheme.value;
      await StorageService.saveSetting('appTheme', newTheme);
      state.settings.appTheme = newTheme;
      applyTheme(newTheme);
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const pix = document.getElementById('input-setting-pix').value.trim();
      const googleUrl = document.getElementById('input-setting-google').value.trim();
      const theme = selectTheme ? selectTheme.value : 'auto';

      await StorageService.saveSetting('pixKey', pix);
      await StorageService.saveSetting('googleScriptUrl', googleUrl);
      await StorageService.saveSetting('appTheme', theme);

      state.settings.pixKey = pix;
      state.settings.googleScriptUrl = googleUrl;
      state.settings.appTheme = theme;
      applyTheme(theme);
      alert('Configurações salvas com sucesso!');
    });
  }

  if (btnSyncGoogle) {
    btnSyncGoogle.addEventListener('click', async () => {
      if (!state.settings.googleScriptUrl) {
        alert('Configure a URL do Google Apps Script primeiro na aba Ajustes.');
        return;
      }
      try {
        const payload = {
          tutors: state.tutors,
          groups: state.groups,
          pets: state.pets,
          sessions: state.sessions,
          adjustments: state.adjustments
        };
        const res = await syncBackupToGoogle(state.settings.googleScriptUrl, payload);
        alert(res.message);
      } catch (e) {
        alert(`Falha no backup do Google Drive: ${e.message}`);
      }
    });
  }

  if (btnPullGoogle) {
    btnPullGoogle.addEventListener('click', async () => {
      const inputUrl = document.getElementById('input-setting-google')?.value.trim();
      const scriptUrl = state.settings.googleScriptUrl || inputUrl;

      if (!scriptUrl) {
        alert('Configure a URL do Google Apps Script primeiro na aba Ajustes.');
        return;
      }

      if (inputUrl && !state.settings.googleScriptUrl) {
        await StorageService.saveSetting('googleScriptUrl', inputUrl);
        state.settings.googleScriptUrl = inputUrl;
      }

      openRestoreBackupModal();
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const payload = {
        exportDate: new Date().toISOString(),
        tutors: state.tutors,
        groups: state.groups,
        pets: state.pets,
        sessions: state.sessions,
        adjustments: state.adjustments
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-petwalker-${new Date().toISOString().substring(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

async function openRestoreBackupModal() {
  let modal = document.getElementById('modal-restore-backup');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-restore-backup';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 600px;">
        <h3 class="card-title">🔄 Selecionar Versão para Restaurar</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
          Escolha qual arquivo de backup salvo na pasta <strong>Petwalker_Backups</strong> do Google Drive deseja restaurar:
        </p>
        <div id="backup-list-container" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          <div style="text-align: center; padding: 20px; color: var(--text-muted);">Carregando histórico...</div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="btn btn-outline btn-full" id="btn-close-restore-modal">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const container = document.getElementById('backup-list-container');
  const btnCloseRestore = document.getElementById('btn-close-restore-modal');

  if (btnCloseRestore) {
    btnCloseRestore.onclick = () => modal.classList.remove('active');
  }

  const scriptUrl = state.settings.googleScriptUrl || document.getElementById('input-setting-google')?.value.trim();
  if (!scriptUrl) {
    alert('URL do Google Apps Script não configurada.');
    return;
  }

  modal.classList.add('active');
  container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">🔄 Carregando lista de backups do Google Drive...</div>';

  try {
    const res = await listBackupsFromGoogle(scriptUrl);
    const backups = res.backups || [];

    if (backups.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum backup encontrado na pasta Petwalker_Backups.</div>';
      return;
    }

    container.innerHTML = backups.map(b => {
      const isLatest = b.name === 'petwalker-latest.json';
      const formattedDate = new Date(b.updatedAt).toLocaleString('pt-BR');
      const sizeKb = (b.size / 1024).toFixed(1);

      return `
        <div style="background: var(--bg-cream); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem;">
              ${isLatest ? '⭐ Último Backup (petwalker-latest.json)' : `📄 ${b.name}`}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              Data: ${formattedDate} | Tamanho: ${sizeKb} KB
            </div>
          </div>
          <button class="btn btn-primary btn-sm btn-restore-file" data-filename="${b.name}">
            Restaurar
          </button>
        </div>
      `;
    }).join('');

    const restoreBtns = container.querySelectorAll('.btn-restore-file');
    restoreBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const fileName = btn.dataset.filename;
        if (!confirm(`Deseja restaurar o arquivo "${fileName}"? Isso atualizará o banco de dados do aplicativo.`)) return;

        try {
          btn.disabled = true;
          btn.textContent = 'Carregando...';
          const pullRes = await pullBackupFromGoogle(state.settings.googleScriptUrl, fileName);

          if (pullRes.payload) {
            const { tutors, groups, pets, sessions, adjustments } = pullRes.payload;
            if (tutors) {
              for (const item of tutors) await StorageService.saveTutor(item);
            }
            if (groups) {
              for (const item of groups) await StorageService.saveGroup(item);
            }
            if (pets) {
              for (const item of pets) await StorageService.savePet(item);
            }
            if (sessions) {
              for (const item of sessions) await StorageService.saveSession(item);
            }
            if (adjustments) {
              for (const item of adjustments) await StorageService.saveAdjustment(item);
            }
            await loadAppData();
            modal.classList.remove('active');
            alert(`✅ Sucesso! O backup "${fileName}" foi restaurado com sucesso!`);
          }
        } catch (err) {
          alert(`Erro ao restaurar arquivo: ${err.message}`);
          btn.disabled = false;
          btn.textContent = 'Restaurar';
        }
      });
    });

  } catch (err) {
    container.innerHTML = `<div style="color: var(--danger); padding: 12px; text-align: center;">Erro ao carregar lista: ${err.message}</div>`;
  }
}
