import { StorageService } from './services/storage.js?v=39';
import { PushService } from './services/pushService.js?v=39';
import { hashPin, verifyPin, isBiometricsAvailable, registerBiometrics, authenticateBiometrics } from './services/security.js?v=39';
import { syncBackupToGoogle, sendInvoiceEmailViaGoogle, pullBackupFromGoogle, listBackupsFromGoogle } from './services/googleSync.js?v=39';
import { calculateSessionCost, calculateMonthlyInvoice, formatWhatsAppSummary, formatEmailHtml, formatWhatsAppPhone, getLocalDateString, getLocalDateMonth } from './domain/models.js?v=39';

// Fallback defensivo caso o navegador tenha mantido cópia antiga de storage.js em memória
if (typeof StorageService !== 'undefined') {
  if (!StorageService.saveBath) {
    StorageService.saveBath = (bath) => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('petwalker_db', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('baths', 'readwrite');
          const store = tx.objectStore('baths');
          store.put(bath);
          tx.oncomplete = () => resolve(bath);
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    };
  }
  if (!StorageService.getBaths) {
    StorageService.getBaths = () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('petwalker_db', 2);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('baths')) return resolve([]);
          const tx = db.transaction('baths', 'readonly');
          const store = tx.objectStore('baths');
          const getReq = store.getAll();
          getReq.onsuccess = () => resolve(getReq.result || []);
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    };
  }
  if (!StorageService.deleteBath) {
    StorageService.deleteBath = (id) => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('petwalker_db', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('baths', 'readwrite');
          const store = tx.objectStore('baths');
          store.delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    };
  }
  if (!StorageService.savePetSitter) {
    StorageService.savePetSitter = (sitter) => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('petwalker_db', 3);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('petSitters')) return resolve(sitter);
          const tx = db.transaction('petSitters', 'readwrite');
          const store = tx.objectStore('petSitters');
          store.put(sitter);
          tx.oncomplete = () => resolve(sitter);
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    };
  }
  if (!StorageService.getPetSitters) {
    StorageService.getPetSitters = () => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('petwalker_db', 3);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('petSitters')) return resolve([]);
          const tx = db.transaction('petSitters', 'readonly');
          const store = tx.objectStore('petSitters');
          const getReq = store.getAll();
          getReq.onsuccess = () => resolve(getReq.result || []);
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    };
  }
  if (!StorageService.deletePetSitter) {
    StorageService.deletePetSitter = (id) => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('petwalker_db', 3);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('petSitters')) return resolve();
          const tx = db.transaction('petSitters', 'readwrite');
          const store = tx.objectStore('petSitters');
          store.delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    };
  }
}

export const APP_CONFIG = {
  version: '2.9.5',
  build: '2026.09.10',
  cacheVersion: 'v39'
};

function renderAppVersionInfo() {
  const versionEl = document.getElementById('app-version-display');
  const buildEl = document.getElementById('app-build-display');
  const lockVersionEl = document.getElementById('lock-app-version');
  if (versionEl) versionEl.textContent = APP_CONFIG.version;
  if (buildEl) buildEl.textContent = `Local-First • Offline Ready • Build ${APP_CONFIG.build} (${APP_CONFIG.cacheVersion})`;
  if (lockVersionEl) lockVersionEl.textContent = `v${APP_CONFIG.version} • ${APP_CONFIG.cacheVersion}`;
}

// ESTADO DA APLICAÇÃO
const state = {
  tutors: [],
  groups: [],
  pets: [],
  sessions: [],
  baths: [],
  petSitters: [],
  adjustments: [],
  settings: {},
  activeSession: null,
  timerInterval: null,
  walkAlertTimers: {},
  activeView: 'view-walk',
  enteredPin: ''
};

async function initApp() {
  try {
    // 1. Configurar listeners de UI e navegação imediatamente (garante interatividade imediata)
    setupNavigation();
    setupLockScreen();
    setupWalkController();
    setupDailyView();
    setupBathsView();
    setupSittersView();
    setupTutorManager();
    setupInvoiceManager();
    setupSettingsController();
    setupManualWalkModal();
    setupBathModal();
    setupPetSitterModal();
    setupEmailPreviewModal();
    setupPhotoViewerModal();
    setupOnlineOfflineStatus();
    renderAppVersionInfo();

    // 2. Inicializar banco e carregar dados assíncronos
    try {
      await StorageService.initSampleDataIfEmpty();
    } catch (e) {
      console.warn('Aviso na inicialização de amostra:', e);
    }

    try {
      await loadAppData();
    } catch (e) {
      console.error('Aviso ao carregar dados do IndexedDB:', e);
    }

    // 3. Recuperar passeio em andamento se o app fechou durante a caminhada (Anti-crash)
    restoreActiveSessionIfAny();

    // 4. Registrar Service Worker para suporte offline completo
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => {
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('Petwalker: nova versão de cache instalada.');
                }
              };
            }
          };
        })
        .catch(err => console.warn('Service Worker erro:', err));
    }
  } catch (err) {
    console.error('Erro na inicialização do Petwalker:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// CARREGAR DADOS DO INDEXEDDB
async function loadAppData() {
  try {
    state.tutors = (await StorageService.getTutors()) || [];
    state.groups = (await StorageService.getGroups()) || [];
    state.pets = (await StorageService.getPets()) || [];
    state.sessions = (await StorageService.getSessions()) || [];
    state.baths = (await StorageService.getBaths()) || [];
    state.petSitters = (await StorageService.getPetSitters()) || [];
    state.adjustments = (await StorageService.getAdjustments()) || [];
  } catch (err) {
    console.error('Erro ao ler coleções do IndexedDB:', err);
  }

  try {
    const pinHash = await StorageService.getSetting('pinHash');
    const bioCred = await StorageService.getSetting('bioCred');
    const pixKey = await StorageService.getSetting('pixKey');
    const googleScriptUrl = await StorageService.getSetting('googleScriptUrl');
    const pushServerUrl = await StorageService.getSetting('pushServerUrl');
    const appTheme = (await StorageService.getSetting('appTheme')) || 'auto';
    const pendingSync = await StorageService.getSetting('pendingSync');
    const lastSyncTime = await StorageService.getSetting('lastSyncTime');
    const autoBackupEnabled = await StorageService.getSetting('autoBackupEnabled');
    const keepScreenAwake = await StorageService.getSetting('keepScreenAwake');

    state.settings = {
      pinHash,
      bioCred,
      pixKey: pixKey || 'contato@petwalker.com.br',
      googleScriptUrl: googleScriptUrl || '',
      pushServerUrl: pushServerUrl || '',
      appTheme,
      pendingSync: pendingSync === true,
      lastSyncTime: lastSyncTime || null,
      autoBackupEnabled: autoBackupEnabled !== false,
      keepScreenAwake: keepScreenAwake === true
    };

    applyTheme(appTheme);

    // Se houver PIN ou Biometria configurada, exibe a tela de bloqueio
    if (state.settings.pinHash || state.settings.bioCred) {
      showLockScreen();
    }
  } catch (err) {
    console.error('Erro ao carregar configurações:', err);
  }

  // Preencher seletores e listas na UI de forma segura
  try { updateGroupDropdown(); } catch (e) { console.warn('Erro ao atualizar dropdown de grupos:', e); }
  try { renderDailyView(); } catch (e) { console.warn('Erro ao renderizar diário de passeios:', e); }
  try { renderDailyBaths(); } catch (e) { console.warn('Erro ao renderizar diário de banhos:', e); }
  try { renderDailySitters(); } catch (e) { console.warn('Erro ao renderizar diário de pet sitter:', e); }
  try { renderTutorsList(); } catch (e) { console.warn('Erro ao renderizar lista de tutores:', e); }
  try { updateInvoiceTutorDropdown(); } catch (e) { console.warn('Erro ao atualizar dropdown de faturas:', e); }
  try { updateSyncStatusBadge(); } catch (e) { console.warn('Erro ao atualizar status de sync:', e); }
  try { updatePinSettingsBadge(); } catch (e) { console.warn('Erro ao atualizar status de PIN:', e); }
  try { renderSettingsView(); } catch (e) { console.warn('Erro ao renderizar view de configurações:', e); }
}

function renderSettingsView() {
  if (!state.settings) return;
  if (document.getElementById('input-setting-pix')) {
    document.getElementById('input-setting-pix').value = state.settings.pixKey || '';
  }
  if (document.getElementById('input-setting-google')) {
    document.getElementById('input-setting-google').value = state.settings.googleScriptUrl || '';
  }
  if (document.getElementById('input-setting-push-server')) {
    document.getElementById('input-setting-push-server').value = state.settings.pushServerUrl || '';
  }
  if (document.getElementById('select-app-theme')) {
    document.getElementById('select-app-theme').value = state.settings.appTheme || 'auto';
  }
  if (document.getElementById('toggle-auto-backup')) {
    document.getElementById('toggle-auto-backup').checked = state.settings.autoBackupEnabled !== false;
  }
  if (document.getElementById('toggle-screen-wake-lock')) {
    document.getElementById('toggle-screen-wake-lock').checked = state.settings.keepScreenAwake === true;
  }
  updatePinSettingsBadge();
}

function applyTheme(theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// -------------------------------------------------------------
// CONTROLADOR DA TELA DE BLOQUEIO / PIN E BIOMETRIA
// -------------------------------------------------------------
let lockPinVisible = false;

function showLockScreen() {
  const lockScreen = document.getElementById('lock-screen');
  const lockSubtitle = document.getElementById('lock-subtitle');
  if (!lockScreen) return;

  state.enteredPin = '';
  updatePinDots();

  if (lockSubtitle) {
    if (state.settings.pinHash && state.settings.bioCred) {
      lockSubtitle.textContent = 'Insira o PIN de 4 dígitos ou use Biometria';
    } else if (state.settings.bioCred && !state.settings.pinHash) {
      lockSubtitle.textContent = 'Toque no botão 👆 para autenticar com Biometria';
    } else {
      lockSubtitle.textContent = 'Insira o PIN de 4 dígitos';
    }
  }

  lockScreen.style.display = 'flex';

  // Se houver biometria cadastrada e sem PIN, dispara tentativa automática
  if (state.settings.bioCred && !state.settings.pinHash) {
    setTimeout(async () => {
      try {
        const success = await authenticateBiometrics(state.settings.bioCred);
        if (success) {
          lockScreen.style.display = 'none';
        }
      } catch (e) {
        console.warn('Tentativa inicial de biometria:', e);
      }
    }, 400);
  }
}

function setupLockScreen() {
  const lockScreen = document.getElementById('lock-screen');
  const keypadBtns = document.querySelectorAll('.keypad-btn[data-key]');
  const btnDel = document.getElementById('btn-pin-del');
  const btnBio = document.getElementById('btn-biometrics');
  const btnLock = document.getElementById('btn-lock-app');
  const btnTogglePin = document.getElementById('btn-toggle-lock-pin-visibility');

  if (btnTogglePin) {
    btnTogglePin.addEventListener('click', () => {
      lockPinVisible = !lockPinVisible;
      btnTogglePin.textContent = lockPinVisible ? '🙈' : '👁️';
      const pinContainer = document.querySelector('.pin-dots');
      if (pinContainer) {
        pinContainer.classList.toggle('revealed', lockPinVisible);
      }
      updatePinDots();
    });
  }

  keypadBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      // Feedback tátil (vibração de toque em celulares)
      if (navigator.vibrate) {
        try { navigator.vibrate(10); } catch (e) {}
      }

      if (!state.settings.pinHash) {
        alert('Nenhum PIN cadastrado. Use o botão de Biometria 👆 ou redefina o acesso abaixo.');
        return;
      }

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
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
      state.enteredPin = state.enteredPin.slice(0, -1);
      updatePinDots();
    });
  }

  if (btnBio) {
    btnBio.addEventListener('click', async () => {
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
      if (state.settings.bioCred) {
        try {
          const success = await authenticateBiometrics(state.settings.bioCred);
          if (success) {
            lockScreen.style.display = 'none';
            state.enteredPin = '';
            updatePinDots();
          } else {
            alert('Autenticação por biometria falhou.');
          }
        } catch (err) {
          alert(`Erro na biometria: ${err.message}`);
        }
      } else {
        alert('Biometria não cadastrada. Acesse as Configurações após entrar.');
      }
    });
  }

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      if (!state.settings.pinHash && !state.settings.bioCred) {
        alert('Cadastre um PIN ou Biometria em Ajustes para poder bloquear o app.');
        return;
      }
      showLockScreen();
    });
  }

  const btnForgot = document.getElementById('btn-forgot-pin');
  const modalReset = document.getElementById('modal-reset-pin');
  const inputResetConfirm = document.getElementById('input-confirm-reset-pin');
  const btnCancelReset = document.getElementById('btn-cancel-reset-pin');
  const btnConfirmReset = document.getElementById('btn-confirm-reset-pin');

  if (btnForgot && modalReset) {
    btnForgot.addEventListener('click', () => {
      if (inputResetConfirm) inputResetConfirm.value = '';
      modalReset.classList.add('active');
      if (inputResetConfirm) inputResetConfirm.focus();
    });

    if (btnCancelReset) {
      btnCancelReset.addEventListener('click', () => {
        modalReset.classList.remove('active');
      });
    }

    if (btnConfirmReset) {
      btnConfirmReset.addEventListener('click', async () => {
        const val = inputResetConfirm ? inputResetConfirm.value.trim().toUpperCase() : '';
        if (val === 'REDEFINIR') {
          await StorageService.saveSetting('pinHash', null);
          await StorageService.saveSetting('bioCred', null);
          state.settings.pinHash = null;
          state.settings.bioCred = null;
          state.enteredPin = '';
          updatePinDots();
          updatePinSettingsBadge();
          modalReset.classList.remove('active');
          lockScreen.style.display = 'none';
          alert('✅ PIN de segurança removido com sucesso! O acesso aos seus passeios e tutores foi liberado.');
        } else {
          alert('Por favor, digite exatamente a palavra REDEFINIR para confirmar.');
        }
      });
    }
  }
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) {
      if (i < state.enteredPin.length) {
        dot.classList.add('filled');
        dot.textContent = lockPinVisible ? state.enteredPin[i] : '';
      } else {
        dot.classList.remove('filled');
        dot.textContent = '';
      }
    }
  }
}

// -------------------------------------------------------------
// NAVEGAÇÃO DE VIEWS
// -------------------------------------------------------------
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.dataset.target;
      if (!targetId) return;

      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      item.classList.add('active');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');
      state.activeView = targetId;

      try {
        if (targetId === 'view-daily') renderDailyView();
        else if (targetId === 'view-baths') renderDailyBaths();
        else if (targetId === 'view-sitter') renderDailySitters();
        else if (targetId === 'view-tutors') renderTutorsList();
        else if (targetId === 'view-invoice') renderInvoiceView();
        else if (targetId === 'view-settings') renderSettingsView();
      } catch (err) {
        console.error(`Erro ao alternar para view ${targetId}:`, err);
      }
    });
  });

  const btnHeaderSettings = document.getElementById('btn-header-settings');
  if (btnHeaderSettings) {
    btnHeaderSettings.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      const settingsView = document.getElementById('view-settings');
      if (settingsView) settingsView.classList.add('active');
      state.activeView = 'view-settings';
      try {
        renderSettingsView();
      } catch (err) {
        console.error('Erro ao alternar para ajustes:', err);
      }
    });
  }
}

// -------------------------------------------------------------
// COMPRESSÃO DE FOTOS (CANVAS)
// -------------------------------------------------------------
async function compressImageFile(file, maxWidth = 800, maxHeight = 800, quality = 0.75) {
  if (!file) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > maxWidth || h > maxHeight) {
          if (w > h) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          } else {
            w = Math.round((w * maxHeight) / h);
            h = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function dataUrlToJpegBlob(dataUrl) {
  try {
    const parts = dataUrl.split(',');
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: 'image/jpeg' });
  } catch (e) {
    console.warn('Erro ao converter imagem:', e);
    return null;
  }
}

function setupPhotoViewerModal() {
  const modal = document.getElementById('modal-photo-viewer');
  const imgEl = document.getElementById('viewer-photo-img');
  const btnClose = document.getElementById('btn-close-photo-viewer');
  const btnCloseTop = document.getElementById('btn-close-photo-viewer-top');
  const btnShare = document.getElementById('btn-share-photo');
  const btnDelete = document.getElementById('btn-delete-photo');

  let currentPhotoDataUrl = null;
  let currentSessionId = null;

  const hideModal = () => {
    if (modal) modal.classList.remove('active');
    currentPhotoDataUrl = null;
    currentSessionId = null;
  };

  if (btnClose) btnClose.onclick = hideModal;
  if (btnCloseTop) btnCloseTop.onclick = hideModal;
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) hideModal();
    };
  }

  if (btnShare) {
    btnShare.onclick = async () => {
      if (!currentPhotoDataUrl) {
        alert('Nenhuma foto selecionada para compartilhar.');
        return;
      }
      try {
        const blob = dataUrlToJpegBlob(currentPhotoDataUrl);
        if (blob) {
          const file = new File([blob], 'passeio-petwalker.jpg', { type: 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Foto do Passeio 🐾',
              text: 'Confira a foto do passeio!'
            });
            return;
          }
        }

        if (navigator.share) {
          await navigator.share({
            title: 'Foto do Passeio 🐾',
            text: 'Confira a foto do passeio no Petwalker!'
          });
          return;
        }

        // Fallback: abrir em nova aba para salvar/compartilhar
        const a = document.createElement('a');
        a.href = currentPhotoDataUrl;
        a.download = 'passeio-petwalker.jpg';
        a.target = '_blank';
        a.click();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Erro ao compartilhar:', err);
          const a = document.createElement('a');
          a.href = currentPhotoDataUrl;
          a.download = 'passeio-petwalker.jpg';
          a.click();
        }
      }
    };
  }

  if (btnDelete) {
    btnDelete.onclick = async () => {
      if (!currentSessionId) return;
      if (!confirm('Deseja realmente remover esta foto do passeio?')) return;

      const session = state.sessions.find(s => s.id === currentSessionId);
      if (session) {
        session.photo = null;
        await StorageService.saveSession(session);
        hideModal();
        renderDailyView();
        await markPendingChanges();
        alert('Foto removida com sucesso!');
      }
    };
  }

  window.openPhotoViewer = (photoDataUrl, sessionId = null) => {
    if (!modal || !imgEl || !photoDataUrl) return;
    currentPhotoDataUrl = photoDataUrl;
    currentSessionId = sessionId;
    imgEl.src = photoDataUrl;
    modal.classList.add('active');
  };
}

// -------------------------------------------------------------
// ANTI-CRASH DO PASSEIO ATIVO (LOCALSTORAGE RECOVERY)
// -------------------------------------------------------------
function restoreActiveSessionIfAny() {
  try {
    const savedJson = localStorage.getItem('petwalker_active_walk');
    if (!savedJson) return;
    const savedSession = JSON.parse(savedJson);
    if (!savedSession || !savedSession.startTime || !savedSession.groupId) return;

    if (savedSession.warningSent === undefined) savedSession.warningSent = false;
    if (savedSession.finishSent === undefined) savedSession.finishSent = false;

    state.activeSession = savedSession;

    const selectGroup = document.getElementById('select-walk-group');
    const walkOptions = document.getElementById('walk-active-options');
    const heroIdle = document.getElementById('hero-idle-state');
    const heroActive = document.getElementById('hero-active-state');
    const timerText = document.getElementById('timer-text');
    const chipsContainer = document.getElementById('active-pets-chips');
    const btnToggle = document.getElementById('btn-toggle-walk');

    if (selectGroup) {
      selectGroup.value = savedSession.groupId;
      selectGroup.disabled = true;
    }
    if (heroIdle) heroIdle.style.display = 'none';
    if (heroActive) heroActive.style.display = 'block';
    if (walkOptions) walkOptions.style.display = 'block';

    if (btnToggle) {
      btnToggle.textContent = '⏹️ Concluir Passeio';
      btnToggle.classList.remove('btn-primary');
      btnToggle.classList.add('btn-danger');
    }

    const btnCancel = document.getElementById('btn-cancel-active-walk');
    if (btnCancel) {
      btnCancel.style.display = 'block';
    }
    const btnManualHome = document.getElementById('btn-open-manual-walk-home');
    if (btnManualHome) {
      btnManualHome.style.display = 'none';
    }

    if (chipsContainer) {
      chipsContainer.innerHTML = (savedSession.pets || [savedSession.groupName || 'Pets'])
        .map(name => `<span class="chip">🐶 ${name}</span>`).join('');
    }

    if (timerText) {
      startTimerDisplay(savedSession.startTime, timerText);
    }

    if (state.settings.keepScreenAwake) {
      requestScreenWakeLock();
    }
    startBackgroundKeepAlive();

    // Reagendar e checar alertas de 5 minutos e término retroativamente
    scheduleWalkAlerts(savedSession);

    console.log('Petwalker: Passeio ativo recuperado com sucesso após recarregamento!');
  } catch (e) {
    console.warn('Erro ao restaurar passeio ativo:', e);
  }
}

// -------------------------------------------------------------
// GESTÃO DE TELA ACESA (SCREEN WAKE LOCK API)
// -------------------------------------------------------------
let wakeLockSentinel = null;

async function requestScreenWakeLock() {
  if ('wakeLock' in navigator && state.settings.keepScreenAwake) {
    try {
      if (!wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
    } catch (e) {
      console.warn('Wake Lock não pôde ser ativado:', e);
    }
  }
}

function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch (e) {}
    wakeLockSentinel = null;
  }
}

// -------------------------------------------------------------
// ALERTAS SONOROS E NOTIFICAÇÕES DE PASSEIO (5 MIN & TÉRMINO)
// -------------------------------------------------------------
let audioCtx = null;
let keepAliveAudio = null;
let keepAliveOsc = null;
let keepAliveGain = null;
let backgroundWorker = null;
let keepAliveWatchdog = null;

function getKeepAliveAudio() {
  if (!keepAliveAudio) {
    keepAliveAudio = new Audio();
    // 1-segundo de áudio silencioso WAV para manter o ciclo de eventos do iOS ativo com tela bloqueada
    keepAliveAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    keepAliveAudio.loop = true;
    keepAliveAudio.setAttribute('playsinline', '');
    keepAliveAudio.setAttribute('webkit-playsinline', '');
    keepAliveAudio.volume = 0.05;

    // Watchdog no elemento de áudio: se pausar sozinho no iOS, relança
    keepAliveAudio.addEventListener('ended', () => {
      if (state.activeSession) {
        keepAliveAudio.play().catch(() => {});
      }
    });
    keepAliveAudio.addEventListener('pause', () => {
      if (state.activeSession) {
        keepAliveAudio.play().catch(() => {});
      }
    });
  }
  return keepAliveAudio;
}

function startBackgroundWorker() {
  if (backgroundWorker) return;
  try {
    const workerBlob = new Blob([
      `let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('tick');
          }, 4000);
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };`
    ], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    backgroundWorker = new Worker(workerUrl);
    backgroundWorker.onmessage = function() {
      if (state.activeSession) {
        checkWalkMilestones(state.activeSession);
      }
    };
    backgroundWorker.postMessage('start');
  } catch (e) {
    console.warn('Web Worker não suportado para keepalive:', e);
  }
}

function stopBackgroundWorker() {
  try {
    if (backgroundWorker) {
      backgroundWorker.postMessage('stop');
      backgroundWorker.terminate();
      backgroundWorker = null;
    }
  } catch (e) {}
}

function startWebAudioKeepAlive() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    if (!keepAliveOsc) {
      keepAliveOsc = ctx.createOscillator();
      keepAliveGain = ctx.createGain();
      keepAliveOsc.type = 'sine';
      keepAliveOsc.frequency.setValueAtTime(20, ctx.currentTime); // 20Hz (inaudível)
      keepAliveGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      keepAliveOsc.connect(keepAliveGain);
      keepAliveGain.connect(ctx.destination);
      keepAliveOsc.start();
    }
  } catch (e) {
    console.warn('Erro WebAudio keepalive:', e);
  }
}

function stopWebAudioKeepAlive() {
  try {
    if (keepAliveOsc) {
      keepAliveOsc.stop();
      keepAliveOsc.disconnect();
      keepAliveOsc = null;
    }
    if (keepAliveGain) {
      keepAliveGain.disconnect();
      keepAliveGain = null;
    }
  } catch (e) {}
}

function setupMediaSession() {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Passeio em Andamento 🐾',
        artist: 'Petwalker',
        album: 'Monitoramento em Tempo Real'
      });
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setActionHandler('play', () => {
        startBackgroundKeepAlive();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        // Ignora pausa da tela de bloqueio para não perder o timer
      });
    } catch (e) {}
  }
}

function clearMediaSession() {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }
}

function startBackgroundKeepAlive() {
  try {
    const audio = getKeepAliveAudio();
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.warn('Silent keepalive play ignorado:', e);
      });
    }

    startWebAudioKeepAlive();
    startBackgroundWorker();
    setupMediaSession();

    if (!keepAliveWatchdog) {
      keepAliveWatchdog = setInterval(() => {
        if (state.activeSession) {
          if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
          if (keepAliveAudio && keepAliveAudio.paused) {
            keepAliveAudio.play().catch(() => {});
          }
          checkWalkMilestones(state.activeSession);
        }
      }, 5000);
    }
  } catch (e) {
    console.warn('Erro ao iniciar keepalive de áudio:', e);
  }
}

function stopBackgroundKeepAlive() {
  try {
    if (keepAliveAudio) {
      keepAliveAudio.pause();
      keepAliveAudio.currentTime = 0;
    }
    stopWebAudioKeepAlive();
    stopBackgroundWorker();
    clearMediaSession();

    if (keepAliveWatchdog) {
      clearInterval(keepAliveWatchdog);
      keepAliveWatchdog = null;
    }
  } catch (e) {}
}

function getAudioContext() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    startBackgroundKeepAlive();
  } catch (e) {}
}

function playChimeSound(type = 'warning') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (type === 'halfway') {
      // 2 beeps amigáveis indicando meia-volta (E5 -> G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0.24, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain2.gain.setValueAtTime(0.26, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.55);
    } else if (type === 'warning') {
      // 2 beeps suaves ascendentes de alerta (D5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.25); // A5
      gain2.gain.setValueAtTime(0.25, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.65);
    } else {
      // 3 beeps comemorativos de término (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const startTime = now + (idx * 0.2);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.28, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    }
  } catch (err) {
    console.warn('Erro ao reproduzir áudio:', err);
  }
}

function dismissMilestoneBadge(session = null) {
  const banner = document.getElementById('walk-milestone-banner');
  if (banner) {
    banner.style.display = 'none';
  }
  const currentSession = session || state.activeSession;
  if (currentSession && banner && banner.dataset.milestoneType) {
    currentSession.dismissedMilestone = banner.dataset.milestoneType;
    localStorage.setItem('petwalker_active_walk', JSON.stringify(currentSession));
  }
}

function updateMilestoneBadge(type, message, session = null) {
  const currentSession = session || state.activeSession;
  if (currentSession && currentSession.dismissedMilestone === type) {
    return;
  }

  const banner = document.getElementById('walk-milestone-banner');
  const textEl = document.getElementById('walk-milestone-text');
  if (!banner) return;

  banner.dataset.milestoneType = type;
  banner.className = `walk-milestone-banner ${type}`;
  if (textEl) {
    textEl.textContent = message;
  } else {
    banner.textContent = message;
  }
  banner.style.display = 'flex';
}

function checkWalkMilestones(session) {
  if (!session || !session.startTime) return;

  const startMs = new Date(session.startTime).getTime();
  const durationMin = Number(session.contractedDuration || 60);
  const totalMs = durationMin * 60 * 1000;
  const halfwayMs = Math.round(durationMin / 2) * 60 * 1000;
  const warningMs = Math.max(halfwayMs + 60000, (durationMin - 5) * 60 * 1000);
  const now = Date.now();
  const elapsedMs = now - startMs;
  const groupLabel = session.groupName || 'Pets';

  // 1. Alerta de Metade do Passeio (Meia-volta / 50%)
  if (elapsedMs >= halfwayMs && elapsedMs < warningMs && !session.halfwaySent) {
    session.halfwaySent = true;
    session.dismissedMilestone = null; // Reabre banner para o novo marco
    localStorage.setItem('petwalker_active_walk', JSON.stringify(session));
    sendWalkNotification(
      '🧭 Metade do Passeio!',
      `Você atingiu ${Math.round(durationMin / 2)} minutos com ${groupLabel}. Hora de iniciar a rota de retorno! 🐾`,
      'halfway'
    );
    updateMilestoneBadge('halfway', `🧭 Metade do Passeio (${Math.round(durationMin / 2)} min)! Hora da meia-volta com ${groupLabel}.`, session);
  } else if (session.halfwaySent && !session.warningSent && !session.finishSent) {
    updateMilestoneBadge('halfway', `🧭 Metade do Passeio (${Math.round(durationMin / 2)} min)! Hora da meia-volta com ${groupLabel}.`, session);
  }

  // 2. Alerta de 5 minutos (Reta final)
  if (elapsedMs >= warningMs && elapsedMs < totalMs && !session.warningSent) {
    session.warningSent = true;
    session.dismissedMilestone = null; // Reabre banner para o novo marco
    if (!session.halfwaySent) session.halfwaySent = true;
    localStorage.setItem('petwalker_active_walk', JSON.stringify(session));
    sendWalkNotification(
      '⏰ Faltam 5 minutos!',
      `O passeio com ${groupLabel} encerra em 5 minutos. Prepare o retorno!`,
      'warning'
    );
    updateMilestoneBadge('warning', `⏰ Faltam 5 minutos! Prepare o retorno com ${groupLabel}.`, session);
  } else if (session.warningSent && !session.finishSent) {
    updateMilestoneBadge('warning', `⏰ Faltam 5 minutos! Prepare o retorno com ${groupLabel}.`, session);
  }

  // 3. Alerta de Término
  if (elapsedMs >= totalMs && !session.finishSent) {
    session.finishSent = true;
    session.dismissedMilestone = null; // Reabre banner para o novo marco
    if (!session.halfwaySent) session.halfwaySent = true;
    if (!session.warningSent) session.warningSent = true;
    localStorage.setItem('petwalker_active_walk', JSON.stringify(session));
    sendWalkNotification(
      '🏁 Tempo Concluído!',
      `A duração contratada de ${durationMin} minutos com ${groupLabel} foi atingida. Hora de concluir!`,
      'finish'
    );
    updateMilestoneBadge('finish', `🏁 Tempo Concluído (${durationMin} min com ${groupLabel})!`, session);
  } else if (session.finishSent) {
    updateMilestoneBadge('finish', `🏁 Tempo Concluído (${durationMin} min com ${groupLabel})!`, session);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return Notification.permission;
  }
}

async function sendWalkNotification(title, body, type = 'warning') {
  playChimeSound(type);

  if (navigator.vibrate) {
    try {
      const vibPattern = type === 'halfway'
        ? [250, 150, 250]
        : (type === 'warning' ? [300, 150, 300] : [500, 200, 500]);
      navigator.vibrate(vibPattern);
    } catch (e) {}
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        const tag = type === 'halfway' ? 'walk-halfway' : (type === 'warning' ? 'walk-warning' : 'walk-finish');

        // Se já existe notificação com essa tag (ex: entregue pelo Push do Servidor), não duplica o banner!
        if (reg.getNotifications) {
          try {
            const activeNotifs = await reg.getNotifications({ tag });
            if (activeNotifs && activeNotifs.length > 0) return;
          } catch (e) {}
        }

        const vibPattern = type === 'halfway'
          ? [250, 150, 250]
          : (type === 'warning' ? [300, 150, 300] : [500, 200, 500]);

        await reg.showNotification(title, {
          body,
          icon: 'assets/icon-192.png',
          badge: 'assets/favicon-32x32.png',
          vibrate: vibPattern,
          tag,
          renotify: false,
          requireInteraction: true,
          data: { url: './' }
        });
        return;
      }
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'assets/icon-192.png',
        tag: type === 'halfway' ? 'walk-halfway' : (type === 'warning' ? 'walk-warning' : 'walk-finish')
      });
    }
  } catch (err) {
    console.warn('Alerta Petwalker: falha no push do sistema:', err);
  }
}

// Sincroniza estado de marcos quando o Service Worker recebe Push em background
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PUSH_DELIVERED' && state.activeSession) {
      const tag = event.data.tag;
      if (tag === 'walk-halfway') state.activeSession.halfwaySent = true;
      if (tag === 'walk-warning') state.activeSession.warningSent = true;
      if (tag === 'walk-finish') state.activeSession.finishSent = true;
      localStorage.setItem('petwalker_active_walk', JSON.stringify(state.activeSession));
      checkWalkMilestones(state.activeSession);
    }
  });
}

function clearWalkAlerts() {
  if (state.walkAlertTimers) {
    if (state.walkAlertTimers.halfway) clearTimeout(state.walkAlertTimers.halfway);
    if (state.walkAlertTimers.warning) clearTimeout(state.walkAlertTimers.warning);
    if (state.walkAlertTimers.finish) clearTimeout(state.walkAlertTimers.finish);
  }
  state.walkAlertTimers = {};
}

function scheduleWalkAlerts(session) {
  clearWalkAlerts();
  if (!session || !session.startTime) return;

  const startMs = new Date(session.startTime).getTime();
  const durationMin = Number(session.contractedDuration || 60);
  const totalMs = durationMin * 60 * 1000;
  const halfwayMs = Math.round(durationMin / 2) * 60 * 1000;
  const warningMs = Math.max(halfwayMs + 60000, (durationMin - 5) * 60 * 1000);
  const now = Date.now();

  const halfwayDelay = (startMs + halfwayMs) - now;
  const warningDelay = (startMs + warningMs) - now;
  const finishDelay = (startMs + totalMs) - now;

  // Checagem imediata retroativa para quando a tela acorda ou app reabre
  checkWalkMilestones(session);

  state.walkAlertTimers = {};

  if (halfwayDelay > 0 && !session.halfwaySent) {
    state.walkAlertTimers.halfway = setTimeout(() => {
      checkWalkMilestones(session);
    }, halfwayDelay);
  }

  if (warningDelay > 0 && !session.warningSent) {
    state.walkAlertTimers.warning = setTimeout(() => {
      checkWalkMilestones(session);
    }, warningDelay);
  }

  if (finishDelay > 0 && !session.finishSent) {
    state.walkAlertTimers.finish = setTimeout(() => {
      checkWalkMilestones(session);
    }, finishDelay);
  }
}

// -------------------------------------------------------------
// CONTROLADOR DE PASSEIO (TIMER / NOVO PASSEIO)
// -------------------------------------------------------------
function setupWalkController() {
  const btnToggle = document.getElementById('btn-toggle-walk');
  const selectGroup = document.getElementById('select-walk-group');
  const walkOptions = document.getElementById('walk-active-options');
  const heroIdle = document.getElementById('hero-idle-state');
  const heroActive = document.getElementById('hero-active-state');
  const timerText = document.getElementById('timer-text');
  const chipsContainer = document.getElementById('active-pets-chips');

  if (!btnToggle) return;

  const walkPhotoInput = document.getElementById('walk-photo-input');
  const walkPhotoPreviewCont = document.getElementById('walk-photo-preview-container');
  const walkPhotoPreviewImg = document.getElementById('walk-photo-preview-img');
  const walkPhotoTitle = document.getElementById('walk-photo-title');
  const walkPhotoSubtitle = document.getElementById('walk-photo-subtitle');
  const btnRemoveWalkPhoto = document.getElementById('btn-remove-walk-active-photo');

  let activeWalkCompressedPhoto = null;

  if (walkPhotoInput) {
    walkPhotoInput.addEventListener('change', async () => {
      const file = walkPhotoInput.files?.[0];
      if (file) {
        activeWalkCompressedPhoto = await compressImageFile(file);
        if (activeWalkCompressedPhoto && walkPhotoPreviewImg && walkPhotoPreviewCont) {
          walkPhotoPreviewImg.src = activeWalkCompressedPhoto;
          walkPhotoPreviewCont.style.display = 'block';
          if (walkPhotoTitle) walkPhotoTitle.textContent = '✅ Foto Anexada';
          if (walkPhotoSubtitle) walkPhotoSubtitle.textContent = 'Toque para trocar a foto';
        }
      }
    });
  }

  if (btnRemoveWalkPhoto) {
    btnRemoveWalkPhoto.addEventListener('click', (e) => {
      e.preventDefault();
      activeWalkCompressedPhoto = null;
      if (walkPhotoInput) walkPhotoInput.value = '';
      if (walkPhotoPreviewCont) walkPhotoPreviewCont.style.display = 'none';
      if (walkPhotoPreviewImg) walkPhotoPreviewImg.src = '';
      if (walkPhotoTitle) walkPhotoTitle.textContent = 'Tirar / Anexar Foto';
      if (walkPhotoSubtitle) walkPhotoSubtitle.textContent = 'Toque para abrir a câmera ou galeria';
    });
  }

  if (selectGroup) {
    selectGroup.addEventListener('change', () => {
      updateDurationSelectorForGroup(selectGroup.value, 'select-contracted-duration');
    });
  }

  const btnCloseMilestone = document.getElementById('btn-close-milestone-banner');
  if (btnCloseMilestone) {
    btnCloseMilestone.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissMilestoneBadge();
    });
  }

  const milestoneBanner = document.getElementById('walk-milestone-banner');
  if (milestoneBanner) {
    milestoneBanner.addEventListener('click', (e) => {
      if (e.target === milestoneBanner || e.target.id === 'walk-milestone-text') {
        dismissMilestoneBadge();
      }
    });
  }

  const btnCancelActive = document.getElementById('btn-cancel-active-walk');

  if (btnCancelActive) {
    btnCancelActive.addEventListener('click', () => {
      if (!state.activeSession) return;
      if (!confirm('Deseja realmente cancelar o passeio em andamento? O tempo e dados não salvos serão descartados.')) {
        return;
      }

      if (state.timerInterval) clearInterval(state.timerInterval);
      clearWalkAlerts();
      releaseScreenWakeLock();
      stopBackgroundKeepAlive();

      if (state.settings.pushServerUrl && PushService.isSupported() && state.activeSession?.id) {
        PushService.cancelWalkAlertsOnServer(state.settings.pushServerUrl, state.activeSession.id).catch(() => {});
      }

      const milestoneBanner = document.getElementById('walk-milestone-banner');
      if (milestoneBanner) {
        milestoneBanner.style.display = 'none';
        milestoneBanner.textContent = '';
      }

      localStorage.removeItem('petwalker_active_walk');
      state.activeSession = null;

      heroIdle.style.display = 'block';
      heroActive.style.display = 'none';
      walkOptions.style.display = 'none';
      selectGroup.disabled = false;

      // Limpar campos
      const pee = document.getElementById('note-pee'); if (pee) pee.checked = false;
      const poop = document.getElementById('note-poop'); if (poop) poop.checked = false;
      const water = document.getElementById('note-water'); if (water) water.checked = false;
      const tired = document.getElementById('note-tired'); if (tired) tired.checked = false;
      const notesEl = document.getElementById('walk-notes-text'); if (notesEl) notesEl.value = '';
      const kmStartEl = document.getElementById('walk-km-start'); if (kmStartEl) kmStartEl.value = '';
      const kmEndEl = document.getElementById('walk-km-end'); if (kmEndEl) kmEndEl.value = '';
      if (walkPhotoInput) walkPhotoInput.value = '';
      if (walkPhotoPreviewCont) walkPhotoPreviewCont.style.display = 'none';
      if (walkPhotoPreviewImg) walkPhotoPreviewImg.src = '';
      if (walkPhotoTitle) walkPhotoTitle.textContent = 'Tirar / Anexar Foto';
      if (walkPhotoSubtitle) walkPhotoSubtitle.textContent = 'Toque para abrir a câmera ou galeria';
      activeWalkCompressedPhoto = null;

      btnToggle.textContent = '🚀 Iniciar Passeio';
      btnToggle.classList.remove('btn-danger');
      btnToggle.classList.add('btn-primary');
      btnCancelActive.style.display = 'none';
      const btnManualHome = document.getElementById('btn-open-manual-walk-home');
      if (btnManualHome) btnManualHome.style.display = 'block';
    });
  }

  btnToggle.addEventListener('click', async () => {
    try {
      if (!state.activeSession) {
        // INICIAR PASSEIO
        const groupId = selectGroup.value;
        if (!groupId) {
          alert('Por favor, selecione o grupo de passeio.');
          return;
        }

        const group = state.groups.find(g => g.id === groupId);
        const groupPets = state.pets.filter(p => p.groupId === groupId);

        unlockAudio();
        requestNotificationPermission();
        startBackgroundKeepAlive();

        if (state.settings.keepScreenAwake) {
          requestScreenWakeLock();
        }

        const milestoneBanner = document.getElementById('walk-milestone-banner');
        if (milestoneBanner) {
          milestoneBanner.style.display = 'none';
          milestoneBanner.textContent = '';
        }

        state.activeSession = {
          id: `sess-${Date.now()}`,
          groupId,
          groupName: group ? group.name : 'Grupo',
          startTime: new Date().toISOString(),
          contractedDuration: Number(document.getElementById('select-contracted-duration')?.value || 60),
          pets: groupPets.map(p => p.name),
          halfwaySent: false,
          warningSent: false,
          finishSent: false
        };

        // Salvar cópia local anti-crash
        localStorage.setItem('petwalker_active_walk', JSON.stringify(state.activeSession));

        // Agendar e checar alertas locais
        scheduleWalkAlerts(state.activeSession);

        // Se houver servidor Web Push configurado, agenda pushes remotos via APNs
        if (state.settings.pushServerUrl && PushService.isSupported()) {
          PushService.getOrSubscribe(state.settings.pushServerUrl).then(sub => {
            if (sub) {
              PushService.scheduleWalkAlertsOnServer(state.settings.pushServerUrl, state.activeSession, sub)
                .catch(err => console.warn('[WebPush] Falha ao agendar no servidor:', err));
            }
          }).catch(err => console.warn('[WebPush] Inscrição não concluída:', err));
        }

        // Atualizar UI para Estado Ativo
        heroIdle.style.display = 'none';
        heroActive.style.display = 'block';
        walkOptions.style.display = 'block';
        selectGroup.disabled = true;

        btnToggle.textContent = '⏹️ Concluir Passeio';
        btnToggle.classList.remove('btn-primary');
        btnToggle.classList.add('btn-danger');

        if (btnCancelActive) {
          btnCancelActive.style.display = 'block';
        }
        const btnManualHome = document.getElementById('btn-open-manual-walk-home');
        if (btnManualHome) {
          btnManualHome.style.display = 'none';
        }

        // Chips dos Pets
        chipsContainer.innerHTML = (groupPets.length > 0 ? groupPets : [{ name: group ? group.name : 'Pets' }])
          .map(p => `<span class="chip">🐶 ${p.name}</span>`).join('');

        // Iniciar Cronômetro em Tempo Real
        startTimerDisplay(state.activeSession.startTime, timerText);
      } else {
        // CONCLUIR PASSEIO
        if (state.timerInterval) clearInterval(state.timerInterval);
        clearWalkAlerts();
        releaseScreenWakeLock();
        stopBackgroundKeepAlive();

        // Cancela push agendado no servidor
        if (state.settings.pushServerUrl && PushService.isSupported() && state.activeSession?.id) {
          PushService.cancelWalkAlertsOnServer(state.settings.pushServerUrl, state.activeSession.id);
        }

        const milestoneBanner = document.getElementById('walk-milestone-banner');
        if (milestoneBanner) {
          milestoneBanner.style.display = 'none';
          milestoneBanner.textContent = '';
        }

        const endTime = new Date().toISOString();
        const notesArray = [];

        if (document.getElementById('note-pee')?.checked) notesArray.push('Fez xixi 💦');
        if (document.getElementById('note-poop')?.checked) notesArray.push('Fez cocô 💩');
        if (document.getElementById('note-water')?.checked) notesArray.push('Bebeu água 💧');
        if (document.getElementById('note-tired')?.checked) notesArray.push('Cansou/brincou 😴');

        const customNotes = document.getElementById('walk-notes-text')?.value.trim() || '';
        if (customNotes) notesArray.push(customNotes);

        const group = state.groups.find(g => g.id === state.activeSession.groupId);
        let sessionCost = 0;
        try {
          sessionCost = calculateSessionCost(group, state.activeSession.contractedDuration);
        } catch (e) {
          sessionCost = (group && (state.activeSession.contractedDuration === 30 ? group.rate30min : group.rate60min)) || 60;
        }

        // Quilometragem opcional
        const kmStartVal = document.getElementById('walk-km-start')?.value.trim();
        const kmEndVal = document.getElementById('walk-km-end')?.value.trim();
        const kmStart = kmStartVal !== '' && !isNaN(kmStartVal) ? Number(kmStartVal) : null;
        const kmEnd = kmEndVal !== '' && !isNaN(kmEndVal) ? Number(kmEndVal) : null;
        const kmTotal = kmStart !== null && kmEnd !== null && kmEnd >= kmStart ? Number((kmEnd - kmStart).toFixed(1)) : null;

        const photoBase64 = activeWalkCompressedPhoto;

        const completedSession = {
          ...state.activeSession,
          endTime,
          date: getLocalDateString(state.activeSession.startTime),
          cost: Number(sessionCost) || 0,
          notes: notesArray.join(' | '),
          kmStart,
          kmEnd,
          kmTotal,
          photo: photoBase64
        };

        // Salvar no IndexedDB
        await StorageService.saveSession(completedSession);
        state.sessions.push(completedSession);

        // Remover do localStorage
        localStorage.removeItem('petwalker_active_walk');

        // Resetar UI
        state.activeSession = null;
        heroIdle.style.display = 'block';
        heroActive.style.display = 'none';
        walkOptions.style.display = 'none';
        selectGroup.disabled = false;

        // Limpar campos
        const pee = document.getElementById('note-pee'); if (pee) pee.checked = false;
        const poop = document.getElementById('note-poop'); if (poop) poop.checked = false;
        const water = document.getElementById('note-water'); if (water) water.checked = false;
        const tired = document.getElementById('note-tired'); if (tired) tired.checked = false;
        const notesEl = document.getElementById('walk-notes-text'); if (notesEl) notesEl.value = '';
        const kmStartEl = document.getElementById('walk-km-start'); if (kmStartEl) kmStartEl.value = '';
        const kmEndEl = document.getElementById('walk-km-end'); if (kmEndEl) kmEndEl.value = '';
        if (walkPhotoInput) walkPhotoInput.value = '';
        if (walkPhotoPreviewCont) walkPhotoPreviewCont.style.display = 'none';
        if (walkPhotoPreviewImg) walkPhotoPreviewImg.src = '';
        if (walkPhotoTitle) walkPhotoTitle.textContent = 'Tirar / Anexar Foto';
        if (walkPhotoSubtitle) walkPhotoSubtitle.textContent = 'Toque para abrir a câmera ou galeria';
        activeWalkCompressedPhoto = null;

        btnToggle.textContent = '🚀 Iniciar Passeio';
        btnToggle.classList.remove('btn-danger');
        btnToggle.classList.add('btn-primary');

        if (btnCancelActive) {
          btnCancelActive.style.display = 'none';
        }
        const btnManualHome = document.getElementById('btn-open-manual-walk-home');
        if (btnManualHome) {
          btnManualHome.style.display = 'block';
        }

        renderDailyView();
        renderInvoiceView();
        await markPendingChanges();
        alert('🎉 Passeio concluído e salvo com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao processar passeio:', err);
      alert(`Ocorreu um erro ao salvar o passeio: ${err.message}`);
    }
  });
}

function startTimerDisplay(startTimeIso, element) {
  const startMs = new Date(startTimeIso).getTime();

  function update() {
    const now = Date.now();
    const diffMs = Math.max(0, now - startMs);
    const secs = Math.floor((diffMs / 1000) % 60);
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    const hrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (element) {
      element.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    if (state.activeSession) {
      checkWalkMilestones(state.activeSession);
    }
  }

  update();
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(update, 1000);
}

function updateDurationSelectorForGroup(groupId, selectElementId) {
  const select = document.getElementById(selectElementId);
  if (!select) return;

  const group = state.groups.find(g => g.id === groupId);
  if (!group) {
    select.innerHTML = '<option value="30">30 Minutos</option><option value="60" selected>60 Minutos</option>';
    select.disabled = false;
    return;
  }

  const rate30 = Number(group.rate30min || 0);
  const rate60 = Number(group.rate60min || 0);

  if (rate30 > 0 && rate60 <= 0) {
    // Apenas 30 minutos disponível
    select.innerHTML = `<option value="30" selected>30 Minutos (Fixo: R$ ${rate30.toFixed(2).replace('.', ',')})</option>`;
    select.disabled = true;
  } else if (rate60 > 0 && rate30 <= 0) {
    // Apenas 60 minutos disponível
    select.innerHTML = `<option value="60" selected>60 Minutos (Fixo: R$ ${rate60.toFixed(2).replace('.', ',')})</option>`;
    select.disabled = true;
  } else {
    // Ambos disponíveis
    const label30 = rate30 > 0 ? `30 Minutos (R$ ${rate30.toFixed(2).replace('.', ',')})` : '30 Minutos';
    const label60 = rate60 > 0 ? `60 Minutos (R$ ${rate60.toFixed(2).replace('.', ',')})` : '60 Minutos';
    select.innerHTML = `<option value="30">${label30}</option><option value="60" selected>${label60}</option>`;
    select.disabled = false;
  }
}

function updateGroupDropdown() {
  const select = document.getElementById('select-walk-group');
  if (!select) return;
  const sortedGroups = [...state.groups].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  
  select.innerHTML = '<option value="">-- Selecione o Grupo --</option>' +
    sortedGroups.map(g => {
      const r30 = Number(g.rate30min || 0);
      const r60 = Number(g.rate60min || 0);
      let priceInfo = '';
      if (r30 > 0 && r60 > 0) {
        priceInfo = ` (30m: R$ ${r30.toFixed(2).replace('.', ',')} / 60m: R$ ${r60.toFixed(2).replace('.', ',')})`;
      } else if (r30 > 0) {
        priceInfo = ` (30m: R$ ${r30.toFixed(2).replace('.', ',')})`;
      } else if (r60 > 0) {
        priceInfo = ` (60m: R$ ${r60.toFixed(2).replace('.', ',')})`;
      }
      return `<option value="${g.id}">${g.name}${priceInfo}</option>`;
    }).join('');

  if (select.value) {
    updateDurationSelectorForGroup(select.value, 'select-contracted-duration');
  }
}

// -------------------------------------------------------------
// CONTROLADOR DA VIEW DIÁRIA
// -------------------------------------------------------------
function setupDailyView() {
  const dateInput = document.getElementById('filter-daily-date');
  if (dateInput) {
    dateInput.value = getLocalDateString();
    dateInput.addEventListener('change', renderDailyView);
  }

  // Botões de navegação rápida de data
  const btnPrev = document.getElementById('btn-date-prev');
  const btnToday = document.getElementById('btn-date-today');
  const btnNext = document.getElementById('btn-date-next');

  function changeDateOffset(days) {
    if (!dateInput) return;
    const baseStr = dateInput.value || getLocalDateString();
    const [y, m, d] = baseStr.split('-').map(Number);
    const current = new Date(y, m - 1, d);
    current.setDate(current.getDate() + days);
    dateInput.value = getLocalDateString(current);
    renderDailyView();
  }

  if (btnPrev) btnPrev.addEventListener('click', () => changeDateOffset(-1));
  if (btnNext) btnNext.addEventListener('click', () => changeDateOffset(1));
  if (btnToday) btnToday.addEventListener('click', () => {
    if (dateInput) {
      dateInput.value = getLocalDateString();
      renderDailyView();
    }
  });

  const listEl = document.getElementById('daily-sessions-list');
  if (listEl) {
    listEl.addEventListener('click', async (e) => {
      const btnEdit = e.target.closest('[data-action="edit-session"]');
      const btnDel = e.target.closest('[data-action="delete-session"]');
      const photoThumb = e.target.closest('[data-action="view-photo"]');

      if (photoThumb) {
        const photoSrc = photoThumb.src || decodeURIComponent(photoThumb.dataset.photo || '');
        const sessionId = photoThumb.dataset.id || null;
        if (window.openPhotoViewer && photoSrc) window.openPhotoViewer(photoSrc, sessionId);
      }

      if (btnEdit) {
        const id = btnEdit.dataset.id;
        const session = state.sessions.find(s => s.id === id);
        if (session) openManualWalkModal(session);
      }

      if (btnDel) {
        const id = btnDel.dataset.id;
        if (confirm('Deseja realmente excluir este registro de passeio?')) {
          await StorageService.deleteSession(id);
          state.sessions = state.sessions.filter(s => s.id !== id);
          renderDailyView();
          renderInvoiceView();
          await markPendingChanges();
        }
      }
    });
  }
}

function renderDailyView() {
  const dateInput = document.getElementById('filter-daily-date');
  const targetDateStr = dateInput && dateInput.value ? dateInput.value : getLocalDateString();
  const targetMonthStr = targetDateStr.substring(0, 7); // YYYY-MM
  const listEl = document.getElementById('daily-sessions-list');
  const countEl = document.getElementById('stat-daily-count');
  const monthCountEl = document.getElementById('stat-monthly-count');
  const monthTitleEl = document.getElementById('stat-month-title');
  const timeEl = document.getElementById('stat-daily-time');

  if (!listEl) return;

  // Filtrar sessões do dia e do mês utilizando fuso horário local
  const daySessions = state.sessions.filter(s => getLocalDateString(s.date || s.startTime) === targetDateStr);
  const monthSessions = state.sessions.filter(s => getLocalDateMonth(s.date || s.startTime) === targetMonthStr);

  // Nome do Mês Formatado
  const [year, month] = targetMonthStr.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthLabel = monthNames[parseInt(month, 10) - 1] || month;

  if (monthTitleEl) monthTitleEl.textContent = `No Mês (${monthLabel})`;
  if (countEl) countEl.textContent = daySessions.length;
  if (monthCountEl) monthCountEl.textContent = monthSessions.length;

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
  if (timeEl) timeEl.textContent = `${hrs}h ${mins}m`;

  if (daySessions.length === 0) {
    listEl.innerHTML = '';
    const emptyState = document.getElementById('daily-empty-state');
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  const emptyState = document.getElementById('daily-empty-state');
  if (emptyState) emptyState.style.display = 'none';


  listEl.innerHTML = daySessions.map(s => {
    const startFormatted = s.startTime ? new Date(s.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const endFormatted = s.endTime ? new Date(s.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

    const hasKm = (s.kmStart !== null && s.kmStart !== undefined) || (s.kmEnd !== null && s.kmEnd !== undefined);
    const kmHtml = hasKm
      ? `<div style="margin-top: 4px;"><span class="km-badge">🚗 Km: ${s.kmStart ?? '-'} → ${s.kmEnd ?? '-'} ${s.kmTotal ? `(${s.kmTotal} km)` : ''}</span></div>`
      : '';

    const photoHtml = s.photo
      ? `<img src="${s.photo}" class="photo-thumb" data-action="view-photo" data-id="${s.id}" title="Toque para ampliar foto" style="cursor: pointer;">`
      : '';

    return `
      <li class="item-row" style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div style="display: flex; gap: 10px; align-items: center; flex: 1;">
          ${photoHtml}
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem;">🐕 ${s.groupName || 'Grupo'}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
              🕒 ${startFormatted} às ${endFormatted} (${s.contractedDuration || 60}m) • <strong style="color: var(--primary);">R$ ${s.cost ? Number(s.cost).toFixed(2).replace('.', ',') : '0,00'}</strong>
            </div>
            ${kmHtml}
            ${s.notes ? `<div style="font-size: 0.8rem; color: var(--text-main); margin-top: 4px; background: rgba(0,0,0,0.03); padding: 4px 8px; border-radius: 4px;">📝 ${s.notes}</div>` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="btn btn-outline btn-sm" data-action="edit-session" data-id="${s.id}" title="Editar Passeio">✏️</button>
          <button class="btn btn-danger btn-sm" data-action="delete-session" data-id="${s.id}" title="Excluir Passeio">🗑️</button>
        </div>
      </li>
    `;
  }).join('');
}

function openManualWalkModal(session = null) {
  const modal = document.getElementById('modal-manual-walk');
  const titleEl = document.getElementById('modal-walk-title');
  const groupSelect = document.getElementById('manual-walk-group');
  const dateInput = document.getElementById('manual-walk-date');
  const startInput = document.getElementById('manual-walk-start');
  const endInput = document.getElementById('manual-walk-end');
  const durationSelect = document.getElementById('manual-walk-duration');
  const kmStartInput = document.getElementById('manual-walk-km-start');
  const kmEndInput = document.getElementById('manual-walk-km-end');
  const notesInput = document.getElementById('manual-walk-notes');
  const idInput = document.getElementById('manual-walk-id');

  const photoInput = document.getElementById('manual-walk-photo-input');
  const photoPreview = document.getElementById('manual-walk-photo-preview');
  const previewImg = document.getElementById('manual-walk-preview-img');
  const photoTitle = document.getElementById('manual-walk-photo-title');
  const photoSubtitle = document.getElementById('manual-walk-photo-subtitle');
  const btnRemoveManualPhoto = document.getElementById('btn-remove-manual-photo');

  let currentManualPhoto = session ? session.photo : null;

  if (photoInput) photoInput.value = '';

  if (btnRemoveManualPhoto) {
    btnRemoveManualPhoto.onclick = (e) => {
      e.preventDefault();
      currentManualPhoto = null;
      if (photoInput) photoInput.value = '';
      if (photoPreview) photoPreview.style.display = 'none';
      if (previewImg) previewImg.src = '';
      if (photoTitle) photoTitle.textContent = 'Tirar / Anexar Foto';
      if (photoSubtitle) photoSubtitle.textContent = 'Toque para abrir a câmera ou galeria';
    };
  }

  // Atualizar seletores de grupo
  groupSelect.innerHTML = '<option value="">-- Selecione o Grupo --</option>' +
    state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

  groupSelect.onchange = () => {
    updateDurationSelectorForGroup(groupSelect.value, 'manual-walk-duration');
  };

  if (photoInput && photoPreview && previewImg) {
    photoInput.onchange = async () => {
      const file = photoInput.files?.[0];
      if (file) {
        currentManualPhoto = await compressImageFile(file);
        if (currentManualPhoto) {
          previewImg.src = currentManualPhoto;
          photoPreview.style.display = 'block';
          if (photoTitle) photoTitle.textContent = '✅ Foto Anexada';
          if (photoSubtitle) photoSubtitle.textContent = 'Toque para trocar a foto';
        }
      }
    };
  }

  if (session) {
    titleEl.textContent = '✏️ Editar Passeio';
    idInput.value = session.id;
    groupSelect.value = session.groupId;
    updateDurationSelectorForGroup(session.groupId, 'manual-walk-duration');
    dateInput.value = session.date ? getLocalDateString(session.date) : getLocalDateString();
    startInput.value = session.startTime ? new Date(session.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '10:00';
    endInput.value = session.endTime ? new Date(session.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '11:00';
    durationSelect.value = session.contractedDuration || 60;
    if (kmStartInput) kmStartInput.value = (session.kmStart !== null && session.kmStart !== undefined) ? session.kmStart : '';
    if (kmEndInput) kmEndInput.value = (session.kmEnd !== null && session.kmEnd !== undefined) ? session.kmEnd : '';
    notesInput.value = session.notes || '';

    if (session.photo && photoPreview && previewImg) {
      currentManualPhoto = session.photo;
      previewImg.src = session.photo;
      photoPreview.style.display = 'block';
      if (photoTitle) photoTitle.textContent = '✅ Foto Anexada';
      if (photoSubtitle) photoSubtitle.textContent = 'Toque para trocar a foto';
    } else {
      if (photoPreview) photoPreview.style.display = 'none';
      if (photoTitle) photoTitle.textContent = 'Tirar / Anexar Foto';
      if (photoSubtitle) photoSubtitle.textContent = 'Toque para abrir a câmera ou galeria';
    }
  } else {
    titleEl.textContent = '📝 Lançar Passeio Manual';
    idInput.value = '';
    currentManualPhoto = null;
    const initialGroupId = state.groups.length > 0 ? state.groups[0].id : '';
    groupSelect.value = initialGroupId;
    updateDurationSelectorForGroup(initialGroupId, 'manual-walk-duration');
    dateInput.value = document.getElementById('filter-daily-date')?.value || getLocalDateString();
    startInput.value = '10:00';
    endInput.value = '11:00';
    if (kmStartInput) kmStartInput.value = '';
    if (kmEndInput) kmEndInput.value = '';
    notesInput.value = '';
    if (photoPreview) photoPreview.style.display = 'none';
    if (photoTitle) photoTitle.textContent = 'Tirar / Anexar Foto';
    if (photoSubtitle) photoSubtitle.textContent = 'Toque para abrir a câmera ou galeria';
  }

  modal.classList.add('active');
}

// -------------------------------------------------------------
// SETUP DO MODAL DE PASSEIO MANUAL/EDIÇÃO
// -------------------------------------------------------------
function setupManualWalkModal() {
  const btnOpen = document.getElementById('btn-open-manual-walk');
  const btnOpenHome = document.getElementById('btn-open-manual-walk-home');
  const btnClose = document.getElementById('btn-close-walk-modal');
  const modal = document.getElementById('modal-manual-walk');
  const form = document.getElementById('form-manual-walk');

  if (btnOpen) btnOpen.addEventListener('click', () => openManualWalkModal());
  if (btnOpenHome) btnOpenHome.addEventListener('click', () => openManualWalkModal());
  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));

  // Botão ✕ no header do modal (auditoria UI)
  const btnCloseX = document.getElementById('btn-close-walk-modal-x');
  if (btnCloseX) btnCloseX.addEventListener('click', () => modal.classList.remove('active'));

  // Empty state CTA no Diário → abre modal de lançamento manual
  const btnEmptyCta = document.getElementById('btn-daily-empty-cta');
  if (btnEmptyCta) btnEmptyCta.addEventListener('click', () => openManualWalkModal());


  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('manual-walk-id')?.value;
        const groupId = document.getElementById('manual-walk-group')?.value;
        const dateStr = document.getElementById('manual-walk-date')?.value || getLocalDateString();
        const startTimeStr = document.getElementById('manual-walk-start')?.value || '10:00';
        const endTimeStr = document.getElementById('manual-walk-end')?.value || '11:00';
        const duration = Number(document.getElementById('manual-walk-duration')?.value || 60);
        const notes = document.getElementById('manual-walk-notes')?.value.trim() || '';

        const kmStartVal = document.getElementById('manual-walk-km-start')?.value.trim();
        const kmEndVal = document.getElementById('manual-walk-km-end')?.value.trim();
        const kmStart = kmStartVal !== '' && !isNaN(kmStartVal) ? Number(kmStartVal) : null;
        const kmEnd = kmEndVal !== '' && !isNaN(kmEndVal) ? Number(kmEndVal) : null;
        const kmTotal = kmStart !== null && kmEnd !== null && kmEnd >= kmStart ? Number((kmEnd - kmStart).toFixed(1)) : null;

        const group = state.groups.find(g => g.id === groupId);
        let cost = 0;
        try {
          cost = calculateSessionCost(group, duration);
        } catch (e) {
          cost = (group && (duration === 30 ? group.rate30min : group.rate60min)) || 60;
        }

        let startTimeIso = new Date().toISOString();
        let endTimeIso = new Date().toISOString();
        try {
          const sDate = new Date(`${dateStr}T${startTimeStr}`);
          if (!isNaN(sDate.getTime())) startTimeIso = sDate.toISOString();
          const eDate = new Date(`${dateStr}T${endTimeStr}`);
          if (!isNaN(eDate.getTime())) endTimeIso = eDate.toISOString();
        } catch (errDate) {
          console.warn('Erro ao formatar data do passeio:', errDate);
        }

        const existingSession = id ? state.sessions.find(s => s.id === id) : null;
        const previewImg = document.getElementById('manual-walk-preview-img');
        const photoPreview = document.getElementById('manual-walk-photo-preview');
        
        let photoBase64 = (photoPreview && photoPreview.style.display !== 'none' && previewImg && previewImg.src) ? previewImg.src : null;

        const sessionData = {
          id: id || `sess-${Date.now()}`,
          groupId,
          groupName: group ? group.name : 'Grupo',
          contractedDuration: duration,
          cost: Number(cost) || 0,
          date: startTimeIso,
          startTime: startTimeIso,
          endTime: endTimeIso,
          notes,
          kmStart,
          kmEnd,
          kmTotal,
          photo: photoBase64
        };

        await StorageService.saveSession(sessionData);

        if (id) {
          const idx = state.sessions.findIndex(s => s.id === id);
          if (idx !== -1) state.sessions[idx] = sessionData;
          else state.sessions.push(sessionData);
        } else {
          state.sessions.push(sessionData);
        }

        modal.classList.remove('active');
        renderDailyView();
        renderInvoiceView();
        await markPendingChanges();
        alert('✅ Passeio salvo com sucesso!');
      } catch (err) {
        console.error('Erro ao salvar passeio manual:', err);
        alert(`Erro ao salvar passeio: ${err.message}`);
      }
    });
  }
}

// -------------------------------------------------------------
// CONTROLADOR DA VIEW DE BANHOS (DIÁRIO DE BANHOS)
// -------------------------------------------------------------
function setupBathsView() {
  const dateInput = document.getElementById('filter-bath-date');
  if (dateInput) {
    dateInput.value = getLocalDateString();
    dateInput.addEventListener('change', renderDailyBaths);
  }

  const btnPrev = document.getElementById('btn-bath-date-prev');
  const btnToday = document.getElementById('btn-bath-date-today');
  const btnNext = document.getElementById('btn-bath-date-next');
  const btnOpenModal = document.getElementById('btn-open-bath-modal');
  const btnEmptyCta = document.getElementById('btn-bath-empty-cta');

  function changeBathDateOffset(days) {
    if (!dateInput) return;
    const baseStr = dateInput.value || getLocalDateString();
    const [y, m, d] = baseStr.split('-').map(Number);
    const current = new Date(y, m - 1, d);
    current.setDate(current.getDate() + days);
    dateInput.value = getLocalDateString(current);
    renderDailyBaths();
  }

  if (btnPrev) btnPrev.addEventListener('click', () => changeBathDateOffset(-1));
  if (btnNext) btnNext.addEventListener('click', () => changeBathDateOffset(1));
  if (btnToday) btnToday.addEventListener('click', () => {
    if (dateInput) {
      dateInput.value = getLocalDateString();
      renderDailyBaths();
    }
  });

  if (btnOpenModal) btnOpenModal.addEventListener('click', () => openBathModal());
  if (btnEmptyCta) btnEmptyCta.addEventListener('click', () => openBathModal());

  const listEl = document.getElementById('daily-baths-list');
  if (listEl) {
    listEl.addEventListener('click', async (e) => {
      const btnEdit = e.target.closest('[data-action="edit-bath"]');
      const btnDel = e.target.closest('[data-action="delete-bath"]');

      if (btnEdit) {
        const id = btnEdit.dataset.id;
        const bath = (state.baths || []).find(b => b.id === id);
        if (bath) openBathModal(bath);
      }

      if (btnDel) {
        const id = btnDel.dataset.id;
        if (confirm('Deseja realmente excluir este registro de banho?')) {
          await StorageService.deleteBath(id);
          state.baths = (state.baths || []).filter(b => b.id !== id);
          renderDailyBaths();
          renderInvoiceView();
          await markPendingChanges();
        }
      }
    });
  }
}

function renderDailyBaths() {
  const dateInput = document.getElementById('filter-bath-date');
  const targetDateStr = dateInput && dateInput.value ? dateInput.value : getLocalDateString();
  const targetMonthStr = targetDateStr.substring(0, 7);
  const listEl = document.getElementById('daily-baths-list');
  const countEl = document.getElementById('stat-bath-daily-count');
  const monthCountEl = document.getElementById('stat-bath-monthly-count');
  const monthTitleEl = document.getElementById('stat-month-title') || document.getElementById('stat-bath-month-title');
  const emptyState = document.getElementById('bath-empty-state');

  if (!listEl) return;

  const allBaths = state.baths || [];
  const dayBaths = allBaths.filter(b => getLocalDateString(b.date || b.startTime || b.createdAt) === targetDateStr);
  const monthBaths = allBaths.filter(b => getLocalDateMonth(b.date || b.startTime || b.createdAt) === targetMonthStr);

  const [year, month] = targetMonthStr.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthLabel = monthNames[parseInt(month, 10) - 1] || month;

  const bathMonthTitle = document.getElementById('stat-bath-month-title');
  if (bathMonthTitle) bathMonthTitle.textContent = `No Mês (${monthLabel})`;
  if (countEl) countEl.textContent = dayBaths.length;
  if (monthCountEl) monthCountEl.textContent = monthBaths.length;

  if (dayBaths.length === 0) {
    listEl.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  listEl.innerHTML = dayBaths.map(b => {
    const tutor = state.tutors.find(t => t.id === b.tutorId);
    const tutorName = tutor ? tutor.name : 'Tutor';
    const timeStr = b.startTime ? (b.endTime ? `${b.startTime} às ${b.endTime}` : `${b.startTime}`) : '--:--';

    return `
      <li class="item-row" style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
            🛁 ${b.petName || 'Pet'} <span style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted);">(${tutorName})</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
            🕒 ${timeStr} • <strong style="color: var(--primary);">R$ ${Number(b.cost || 0).toFixed(2).replace('.', ',')}</strong>
          </div>
          ${b.notes ? `<div style="font-size: 0.8rem; color: var(--text-main); margin-top: 4px; background: rgba(0,0,0,0.03); padding: 4px 8px; border-radius: 4px;">📝 ${b.notes}</div>` : ''}
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="btn btn-outline btn-sm" data-action="edit-bath" data-id="${b.id}" title="Editar Banho">✏️</button>
          <button class="btn btn-danger btn-sm" data-action="delete-bath" data-id="${b.id}" title="Excluir Banho">🗑️</button>
        </div>
      </li>
    `;
  }).join('');
}

function openBathModal(bath = null) {
  const modal = document.getElementById('modal-bath');
  const titleEl = document.getElementById('modal-bath-title');
  const idInput = document.getElementById('bath-id');
  const tutorSelect = document.getElementById('bath-tutor-select');
  const petSelect = document.getElementById('bath-pet-select');
  const dateInput = document.getElementById('bath-date');
  const startInput = document.getElementById('bath-start-time');
  const endInput = document.getElementById('bath-end-time');
  const costInput = document.getElementById('bath-cost');
  const notesInput = document.getElementById('bath-notes');

  if (!modal) return;

  if (titleEl) titleEl.textContent = bath ? '✏️ Editar Banho' : '🛁 Registrar Banho';
  if (idInput) idInput.value = bath ? bath.id : '';

  // Popula tutores
  const sortedTutors = [...state.tutors].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  tutorSelect.innerHTML = '<option value="">-- Selecione o Tutor --</option>' +
    sortedTutors.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  function updatePetOptions(selectedTutorId, selectedPetId = null) {
    if (!selectedTutorId) {
      petSelect.innerHTML = '<option value="">-- Selecione o Tutor primeiro --</option>';
      petSelect.disabled = true;
      return;
    }

    const tGroups = state.groups.filter(g => g.tutorId === selectedTutorId);
    const tPets = state.pets.filter(p => p.tutorId === selectedTutorId || tGroups.some(g => g.id === p.groupId));

    if (tPets.length === 0) {
      petSelect.innerHTML = '<option value="">-- Nenhum pet cadastrado para este tutor --</option>';
      petSelect.disabled = true;
      return;
    }

    petSelect.disabled = false;
    petSelect.innerHTML = '<option value="">-- Selecione o Pet --</option>' +
      tPets.map(p => `<option value="${p.id}" data-rate="${p.bathRate || ''}" data-name="${p.name}">${p.name}${p.bathRate ? ` (R$ ${Number(p.bathRate).toFixed(2).replace('.', ',')})` : ''}</option>`).join('');

    if (selectedPetId) {
      petSelect.value = selectedPetId;
    } else if (tPets.length === 1) {
      petSelect.value = tPets[0].id;
      if (costInput && (!costInput.value || costInput.value === '0' || costInput.value === '0.00')) {
        costInput.value = tPets[0].bathRate || '';
      }
    }
  }

  tutorSelect.onchange = () => {
    updatePetOptions(tutorSelect.value);
  };

  petSelect.onchange = () => {
    const selectedOpt = petSelect.selectedOptions[0];
    if (selectedOpt && selectedOpt.dataset.rate) {
      costInput.value = selectedOpt.dataset.rate;
    }
  };

  const now = new Date();
  const defaultStartTime = now.toTimeString().substring(0, 5);
  const laterDate = new Date(now.getTime() + 45 * 60000);
  const defaultEndTime = laterDate.toTimeString().substring(0, 5);

  if (bath) {
    tutorSelect.value = bath.tutorId || '';
    updatePetOptions(bath.tutorId, bath.petId);
    dateInput.value = bath.date || getLocalDateString();
    startInput.value = bath.startTime || defaultStartTime;
    endInput.value = bath.endTime || defaultEndTime;
    costInput.value = bath.cost !== undefined ? bath.cost : '';
    notesInput.value = bath.notes || '';
  } else {
    tutorSelect.value = '';
    petSelect.innerHTML = '<option value="">-- Selecione o Tutor primeiro --</option>';
    petSelect.disabled = true;
    dateInput.value = document.getElementById('filter-bath-date')?.value || getLocalDateString();
    startInput.value = defaultStartTime;
    endInput.value = defaultEndTime;
    costInput.value = '';
    notesInput.value = '';
  }

  modal.classList.add('active');
}

function setupBathModal() {
  const modal = document.getElementById('modal-bath');
  const btnClose = document.getElementById('btn-close-bath-modal');
  const btnCloseX = document.getElementById('btn-close-bath-modal-x');
  const form = document.getElementById('form-bath');

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
  if (btnCloseX) btnCloseX.addEventListener('click', () => modal.classList.remove('active'));

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('bath-id').value;
        const tutorId = document.getElementById('bath-tutor-select').value;
        const petSelect = document.getElementById('bath-pet-select');
        const petId = petSelect.value;
        const selectedPetOpt = petSelect.selectedOptions[0];
        const petName = selectedPetOpt ? (selectedPetOpt.dataset.name || selectedPetOpt.textContent.split(' (')[0].trim()) : 'Pet';
        const date = document.getElementById('bath-date').value;
        const startTime = document.getElementById('bath-start-time').value;
        const endTime = document.getElementById('bath-end-time').value;
        const cost = Number(document.getElementById('bath-cost').value || 0);
        const notes = document.getElementById('bath-notes').value.trim();

        const bathData = {
          id: id || `bath-${Date.now()}`,
          tutorId,
          petId,
          petName,
          date,
          startTime,
          endTime,
          cost,
          notes,
          updatedAt: new Date().toISOString()
        };

        if (!id) {
          bathData.createdAt = new Date().toISOString();
        }

        await StorageService.saveBath(bathData);

        if (!state.baths) state.baths = [];
        if (id) {
          const idx = state.baths.findIndex(b => b.id === id);
          if (idx !== -1) state.baths[idx] = bathData;
          else state.baths.push(bathData);
        } else {
          state.baths.push(bathData);
        }

        modal.classList.remove('active');
        renderDailyBaths();
        renderInvoiceView();
        await markPendingChanges();
        alert('✅ Banho registrado com sucesso!');
      } catch (err) {
        console.error('Erro ao salvar banho:', err);
        alert(`Erro ao salvar banho: ${err.message}`);
      }
    });
  }
}

// -------------------------------------------------------------
// CONTROLADOR DA VIEW DE PET SITTER (DIÁRIO DE PET SITTER)
// -------------------------------------------------------------
function setupSittersView() {
  const dateInput = document.getElementById('filter-sitter-date');
  if (dateInput) {
    dateInput.value = getLocalDateString();
    dateInput.addEventListener('change', renderDailySitters);
  }

  const btnPrev = document.getElementById('btn-sitter-date-prev');
  const btnToday = document.getElementById('btn-sitter-date-today');
  const btnNext = document.getElementById('btn-sitter-date-next');
  const btnOpenModal = document.getElementById('btn-open-sitter-modal');
  const btnEmptyCta = document.getElementById('btn-sitter-empty-cta');

  function changeSitterDateOffset(days) {
    if (!dateInput) return;
    const baseStr = dateInput.value || getLocalDateString();
    const [y, m, d] = baseStr.split('-').map(Number);
    const current = new Date(y, m - 1, d);
    current.setDate(current.getDate() + days);
    dateInput.value = getLocalDateString(current);
    renderDailySitters();
  }

  if (btnPrev) btnPrev.addEventListener('click', () => changeSitterDateOffset(-1));
  if (btnNext) btnNext.addEventListener('click', () => changeSitterDateOffset(1));
  if (btnToday) btnToday.addEventListener('click', () => {
    if (dateInput) {
      dateInput.value = getLocalDateString();
      renderDailySitters();
    }
  });

  if (btnOpenModal) btnOpenModal.addEventListener('click', () => openPetSitterModal());
  if (btnEmptyCta) btnEmptyCta.addEventListener('click', () => openPetSitterModal());

  const listEl = document.getElementById('daily-sitters-list');
  if (listEl) {
    listEl.addEventListener('click', async (e) => {
      const btnEdit = e.target.closest('[data-action="edit-sitter"]');
      const btnDel = e.target.closest('[data-action="delete-sitter"]');

      if (btnEdit) {
        const id = btnEdit.dataset.id;
        const sitter = (state.petSitters || []).find(s => s.id === id);
        if (sitter) openPetSitterModal(sitter);
      }

      if (btnDel) {
        const id = btnDel.dataset.id;
        if (confirm('Deseja realmente excluir este atendimento de Pet Sitter?')) {
          await StorageService.deletePetSitter(id);
          state.petSitters = (state.petSitters || []).filter(s => s.id !== id);
          renderDailySitters();
          renderInvoiceView();
          await markPendingChanges();
        }
      }
    });
  }
}

function renderDailySitters() {
  const dateInput = document.getElementById('filter-sitter-date');
  const targetDateStr = dateInput && dateInput.value ? dateInput.value : getLocalDateString();
  const targetMonthStr = targetDateStr.substring(0, 7);
  const listEl = document.getElementById('daily-sitters-list');
  const countEl = document.getElementById('stat-sitter-daily-count');
  const monthCountEl = document.getElementById('stat-sitter-monthly-count');
  const monthRevEl = document.getElementById('stat-sitter-monthly-revenue');
  const emptyState = document.getElementById('sitter-empty-state');

  if (!listEl) return;

  const allSitters = state.petSitters || [];
  const daySitters = allSitters.filter(s => getLocalDateString(s.date || s.startTime || s.createdAt) === targetDateStr);
  const monthSitters = allSitters.filter(s => getLocalDateMonth(s.date || s.startTime || s.createdAt) === targetMonthStr);
  const monthRevenue = monthSitters.reduce((acc, s) => acc + (Number(s.cost) || 0), 0);

  const [year, month] = targetMonthStr.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthLabel = monthNames[parseInt(month, 10) - 1] || month;

  const sitterMonthTitle = document.getElementById('stat-sitter-month-title');
  if (sitterMonthTitle) sitterMonthTitle.textContent = `No Mês (${monthLabel})`;
  if (countEl) countEl.textContent = daySitters.length;
  if (monthCountEl) monthCountEl.textContent = monthSitters.length;
  if (monthRevEl) monthRevEl.textContent = `R$ ${monthRevenue.toFixed(0)}`;

  if (daySitters.length === 0) {
    listEl.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  listEl.innerHTML = daySitters.map(s => {
    const tutor = state.tutors.find(t => t.id === s.tutorId);
    const tutorName = tutor ? tutor.name : (s.tutorName || 'Tutor');
    const timeStr = s.startTime ? (s.endTime ? `${s.startTime} às ${s.endTime}` : `${s.startTime}`) : '--:--';
    const petLabel = Array.isArray(s.petNames) ? s.petNames.join(', ') : (s.petNames || s.petName || 'Pets');

    return `
      <li class="item-row" style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
            🏠 ${petLabel} <span style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted);">(${tutorName})</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
            🕒 ${timeStr} • <strong style="color: #10B981;">R$ ${Number(s.cost || 0).toFixed(2).replace('.', ',')}</strong>
          </div>
          ${s.notes ? `<div style="font-size: 0.8rem; color: var(--text-main); margin-top: 4px; background: rgba(0,0,0,0.03); padding: 4px 8px; border-radius: 4px;">📝 ${s.notes}</div>` : ''}
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="btn btn-outline btn-sm" data-action="edit-sitter" data-id="${s.id}" title="Editar Atendimento">✏️</button>
          <button class="btn btn-danger btn-sm" data-action="delete-sitter" data-id="${s.id}" title="Excluir Atendimento">🗑️</button>
        </div>
      </li>
    `;
  }).join('');
}

function openPetSitterModal(sitter = null) {
  const modal = document.getElementById('modal-pet-sitter');
  const titleEl = document.getElementById('modal-sitter-title');
  const idInput = document.getElementById('sitter-id');
  const tutorSelect = document.getElementById('sitter-tutor-select');
  const petsContainer = document.getElementById('sitter-pets-container');
  const dateInput = document.getElementById('sitter-date');
  const startInput = document.getElementById('sitter-start-time');
  const endInput = document.getElementById('sitter-end-time');
  const costInput = document.getElementById('sitter-cost');
  const notesInput = document.getElementById('sitter-notes');

  if (!modal) return;

  if (titleEl) titleEl.textContent = sitter ? '✏️ Editar Pet Sitter' : '🏠 Registrar Pet Sitter';
  if (idInput) idInput.value = sitter ? sitter.id : '';

  // Popula tutores
  const sortedTutors = [...state.tutors].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  tutorSelect.innerHTML = '<option value="">-- Selecione o Tutor --</option>' +
    sortedTutors.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  function updateSitterPetOptions(selectedTutorId, preselectedPets = []) {
    if (!selectedTutorId) {
      petsContainer.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Selecione o tutor primeiro</span>';
      return;
    }

    const tGroups = state.groups.filter(g => g.tutorId === selectedTutorId);
    const tPets = state.pets.filter(p => p.tutorId === selectedTutorId || tGroups.some(g => g.id === p.groupId));

    if (tPets.length === 0) {
      petsContainer.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Nenhum pet cadastrado para este tutor</span>';
      return;
    }

    const selSet = new Set(Array.isArray(preselectedPets) ? preselectedPets : [preselectedPets]);

    petsContainer.innerHTML = tPets.map(p => {
      const isChecked = preselectedPets.length === 0 || selSet.has(p.name);
      return `
        <label class="pet-select-chip ${isChecked ? 'selected' : ''}">
          <input type="checkbox" name="sitter-pets" value="${p.name}" ${isChecked ? 'checked' : ''}>
          <span>🐾 ${p.name}</span>
        </label>
      `;
    }).join('');

    // Toggle selected class on chip change
    petsContainer.querySelectorAll('input[name="sitter-pets"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const chip = e.target.closest('.pet-select-chip');
        if (chip) {
          if (e.target.checked) chip.classList.add('selected');
          else chip.classList.remove('selected');
        }
      });
    });
  }

  tutorSelect.onchange = () => {
    const selectedTutor = state.tutors.find(t => t.id === tutorSelect.value);
    updateSitterPetOptions(tutorSelect.value);
    if (selectedTutor && selectedTutor.sitterRate && (!costInput.value || costInput.value === '0' || costInput.value === '0.00')) {
      costInput.value = Number(selectedTutor.sitterRate).toFixed(2);
    }
  };

  const now = new Date();
  const defaultStartTime = now.toTimeString().substring(0, 5);
  const laterDate = new Date(now.getTime() + 60 * 60000);
  const defaultEndTime = laterDate.toTimeString().substring(0, 5);

  if (sitter) {
    tutorSelect.value = sitter.tutorId || '';
    const petsArray = Array.isArray(sitter.petNames) ? sitter.petNames : (sitter.petNames ? sitter.petNames.split(',').map(s => s.trim()) : []);
    updateSitterPetOptions(sitter.tutorId, petsArray);
    dateInput.value = sitter.date || getLocalDateString();
    startInput.value = sitter.startTime || defaultStartTime;
    endInput.value = sitter.endTime || defaultEndTime;
    costInput.value = sitter.cost !== undefined ? sitter.cost : '';
    notesInput.value = sitter.notes || '';
  } else {
    tutorSelect.value = '';
    petsContainer.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Selecione o tutor primeiro</span>';
    dateInput.value = document.getElementById('filter-sitter-date')?.value || getLocalDateString();
    startInput.value = defaultStartTime;
    endInput.value = defaultEndTime;
    costInput.value = '';
    notesInput.value = '';
  }

  modal.classList.add('active');
}

function setupPetSitterModal() {
  const modal = document.getElementById('modal-pet-sitter');
  const btnClose = document.getElementById('btn-close-sitter-modal');
  const btnCloseX = document.getElementById('btn-close-sitter-modal-x');
  const form = document.getElementById('form-pet-sitter');

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
  if (btnCloseX) btnCloseX.addEventListener('click', () => modal.classList.remove('active'));

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('sitter-id').value;
        const tutorId = document.getElementById('sitter-tutor-select').value;
        const tutor = state.tutors.find(t => t.id === tutorId);
        
        // Pega pets selecionados
        const checkedPets = Array.from(document.querySelectorAll('#sitter-pets-container input[name="sitter-pets"]:checked')).map(cb => cb.value);
        const petNames = checkedPets.length > 0 ? checkedPets : ['Pet'];

        const date = document.getElementById('sitter-date').value;
        const startTime = document.getElementById('sitter-start-time').value;
        const endTime = document.getElementById('sitter-end-time').value;
        const cost = Number(document.getElementById('sitter-cost').value || 0);
        const notes = document.getElementById('sitter-notes').value.trim();

        const sitterData = {
          id: id || `sitter-${Date.now()}`,
          tutorId,
          tutorName: tutor ? tutor.name : 'Tutor',
          petNames,
          date,
          startTime,
          endTime,
          cost,
          notes,
          updatedAt: new Date().toISOString()
        };

        if (!id) {
          sitterData.createdAt = new Date().toISOString();
        }

        await StorageService.savePetSitter(sitterData);

        if (!state.petSitters) state.petSitters = [];
        if (id) {
          const idx = state.petSitters.findIndex(s => s.id === id);
          if (idx !== -1) state.petSitters[idx] = sitterData;
          else state.petSitters.push(sitterData);
        } else {
          state.petSitters.push(sitterData);
        }

        modal.classList.remove('active');
        renderDailySitters();
        renderInvoiceView();
        await markPendingChanges();
        alert('✅ Atendimento de Pet Sitter salvo com sucesso!');
      } catch (err) {
        console.error('Erro ao salvar pet sitter:', err);
        alert(`Erro ao salvar pet sitter: ${err.message}`);
      }
    });
  }
}

function renderTutorPetRows(pets = []) {
  const container = document.getElementById('tutor-pets-container');
  if (!container) return;
  if (!pets || pets.length === 0) {
    pets = [{ id: '', name: '', bathRate: '' }];
  }

  container.innerHTML = pets.map(p => `
    <div class="pet-form-row" data-pet-id="${p.id || ''}">
      <input type="text" class="form-input pet-name-input" placeholder="Nome do Pet" value="${p.name || ''}" required>
      <input type="number" step="0.01" inputmode="decimal" class="form-input pet-bath-rate-input" placeholder="Banho R$" value="${p.bathRate !== undefined && p.bathRate !== null ? p.bathRate : ''}" style="text-align: right;">
      <button type="button" class="btn-remove-pet" title="Remover Pet">✕</button>
    </div>
  `).join('');
}

// -------------------------------------------------------------
// CONTROLADOR DE TUTORES E GRUPOS
// -------------------------------------------------------------
function setupTutorManager() {
  const btnOpen = document.getElementById('btn-open-tutor-modal');
  const btnClose = document.getElementById('btn-close-tutor-modal');
  const modal = document.getElementById('modal-tutor');
  const form = document.getElementById('form-tutor');
  const modalTitle = document.getElementById('modal-tutor-title');
  const container = document.getElementById('tutors-tree-list');
  const btnAddPet = document.getElementById('btn-add-pet-row');
  const petsContainer = document.getElementById('tutor-pets-container');

  if (btnAddPet) {
    btnAddPet.onclick = () => {
      if (!petsContainer) return;
      const row = document.createElement('div');
      row.className = 'pet-form-row';
      row.dataset.petId = '';
      row.innerHTML = `
        <input type="text" class="form-input pet-name-input" placeholder="Nome do Pet" required>
        <input type="number" step="0.01" inputmode="decimal" class="form-input pet-bath-rate-input" placeholder="Banho R$" style="text-align: right;">
        <button type="button" class="btn-remove-pet" title="Remover Pet">✕</button>
      `;
      petsContainer.appendChild(row);
      const input = row.querySelector('.pet-name-input');
      if (input) input.focus();
    };
  }

  if (petsContainer) {
    petsContainer.onclick = (e) => {
      const btnRem = e.target.closest('.btn-remove-pet');
      if (btnRem) {
        const row = btnRem.closest('.pet-form-row');
        if (row) {
          const allRows = petsContainer.querySelectorAll('.pet-form-row');
          if (allRows.length > 1) {
            row.remove();
          } else {
            const nameInput = row.querySelector('.pet-name-input');
            const rateInput = row.querySelector('.pet-bath-rate-input');
            if (nameInput) nameInput.value = '';
            if (rateInput) rateInput.value = '';
          }
        }
      }
    };
  }

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      form.reset();
      document.getElementById('tutor-id').value = '';
      document.getElementById('tutor-group-id').value = '';
      const sitterRateEl = document.getElementById('tutor-sitter-rate');
      if (sitterRateEl) sitterRateEl.value = '';
      renderTutorPetRows([{ id: '', name: '', bathRate: '' }]);
      if (modalTitle) modalTitle.textContent = '🐾 Cadastrar Novo Tutor';
      modal.classList.add('active');
    });
  }

  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));

  const btnCloseX = document.getElementById('btn-close-tutor-modal-x');
  if (btnCloseX) btnCloseX.addEventListener('click', () => modal.classList.remove('active'));

  const btnPickContact = document.getElementById('btn-pick-contact');
  if (btnPickContact) {
    btnPickContact.addEventListener('click', async () => {
      if ('contacts' in navigator && 'ContactsManager' in window) {
        try {
          const props = ['name', 'tel', 'email'];
          const contacts = await navigator.contacts.select(props, { multiple: false });
          if (contacts && contacts.length > 0) {
            const c = contacts[0];
            const name = (c.name && c.name[0]) || '';
            const tel = (c.tel && c.tel[0]) || '';
            const email = (c.email && c.email[0]) || '';

            if (name) document.getElementById('tutor-name').value = name;
            if (tel) document.getElementById('tutor-phone').value = tel;
            if (email) document.getElementById('tutor-email').value = email;
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('Erro ao acessar contatos:', err);
          }
        }
      } else {
        alert('ℹ️ A seleção direta de contatos não é suportada neste navegador (restrição de segurança nativa do iOS/Safari). Preencha o nome e telefone nos campos abaixo.');
      }
    });
  }

  // Delegação de eventos para Editar e Excluir Tutor
  if (container) {
    container.addEventListener('click', async (e) => {
      const btnEdit = e.target.closest('[data-action="edit-tutor"]');
      const btnDel = e.target.closest('[data-action="delete-tutor"]');

      if (btnEdit) {
        const tutorId = btnEdit.dataset.id;
        const tutor = state.tutors.find(t => t.id === tutorId);
        if (!tutor) return;

        const group = state.groups.find(g => g.tutorId === tutorId);
        const tPets = state.pets.filter(p => p.tutorId === tutorId || (group && p.groupId === group.id));

        document.getElementById('tutor-id').value = tutor.id;
        document.getElementById('tutor-group-id').value = group ? group.id : '';
        document.getElementById('tutor-name').value = tutor.name || '';
        document.getElementById('tutor-phone').value = tutor.phone || '';
        document.getElementById('tutor-email').value = tutor.email || '';
        const sitterRateEl = document.getElementById('tutor-sitter-rate');
        if (sitterRateEl) {
          sitterRateEl.value = tutor.sitterRate !== undefined && tutor.sitterRate !== null ? tutor.sitterRate : '';
        }

        document.getElementById('group-name').value = group ? group.name : '';
        document.getElementById('group-rate-30').value = group && group.rate30min ? group.rate30min : '';
        document.getElementById('group-rate-60').value = group && group.rate60min ? group.rate60min : '';

        renderTutorPetRows(tPets.length > 0 ? tPets : [{ id: '', name: group ? group.name : '', bathRate: '' }]);

        if (modalTitle) modalTitle.textContent = '✏️ Editar Tutor & Pets';
        modal.classList.add('active');
      }

      if (btnDel) {
        const tutorId = btnDel.dataset.id;
        const tutor = state.tutors.find(t => t.id === tutorId);
        if (!tutor) return;

        if (!confirm(`Tem certeza que deseja excluir o tutor "${tutor.name}" e todos os seus pets e registros?`)) {
          return;
        }

        try {
          await StorageService.deleteTutor(tutorId);
          state.tutors = state.tutors.filter(t => t.id !== tutorId);

          const relatedGroups = state.groups.filter(g => g.tutorId === tutorId);
          for (const g of relatedGroups) {
            await StorageService.deleteGroup(g.id);
          }
          state.groups = state.groups.filter(g => g.tutorId !== tutorId);

          const relatedPets = state.pets.filter(p => p.tutorId === tutorId || relatedGroups.some(g => g.id === p.groupId));
          for (const p of relatedPets) {
            await StorageService.deletePet(p.id);
          }
          state.pets = state.pets.filter(p => !relatedPets.some(rp => rp.id === p.id));

          updateGroupDropdown();
          renderTutorsList();
          updateInvoiceTutorDropdown();
          await markPendingChanges();
          alert(`✅ Tutor "${tutor.name}" e seus dados foram excluídos com sucesso!`);
        } catch (err) {
          alert(`Erro ao excluir tutor: ${err.message}`);
        }
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const tutorId = document.getElementById('tutor-id').value;
        const groupId = document.getElementById('tutor-group-id').value;

        const tutorName = document.getElementById('tutor-name').value.trim();
        const tutorPhone = document.getElementById('tutor-phone').value.trim();
        const tutorEmail = document.getElementById('tutor-email').value.trim();
        const groupName = document.getElementById('group-name').value.trim();
        const rate30Input = document.getElementById('group-rate-30').value;
        const rate60Input = document.getElementById('group-rate-60').value;
        const rate30 = rate30Input !== '' && !isNaN(rate30Input) ? Number(rate30Input) : 0;
        const rate60 = rate60Input !== '' && !isNaN(rate60Input) ? Number(rate60Input) : 0;
        const sitterRateInput = document.getElementById('tutor-sitter-rate')?.value;
        const sitterRate = sitterRateInput !== '' && !isNaN(sitterRateInput) ? Number(sitterRateInput) : null;

        let activeTutorId = tutorId;
        let activeGroupId = groupId;

        if (tutorId) {
          // MODO EDIÇÃO
          const existingTutor = state.tutors.find(t => t.id === tutorId);
          if (existingTutor) {
            existingTutor.name = tutorName;
            existingTutor.phone = tutorPhone;
            existingTutor.email = tutorEmail;
            existingTutor.sitterRate = sitterRate;
            await StorageService.saveTutor(existingTutor);
          }

          if (groupId) {
            const existingGroup = state.groups.find(g => g.id === groupId);
            if (existingGroup) {
              existingGroup.name = groupName || tutorName;
              existingGroup.rate30min = rate30;
              existingGroup.rate60min = rate60;
              await StorageService.saveGroup(existingGroup);
            }
          } else if (groupName || rate30 > 0 || rate60 > 0) {
            const newGroup = {
              id: `grp-${Date.now()}`,
              tutorId,
              name: groupName || tutorName,
              rate30min: rate30,
              rate60min: rate60
            };
            await StorageService.saveGroup(newGroup);
            state.groups.push(newGroup);
            activeGroupId = newGroup.id;
          }
        } else {
          // MODO NOVO
          const newTutor = {
            id: `tut-${Date.now()}`,
            name: tutorName,
            phone: tutorPhone,
            email: tutorEmail,
            sitterRate
          };
          activeTutorId = newTutor.id;

          let newGroup = null;
          if (groupName || rate30 > 0 || rate60 > 0) {
            newGroup = {
              id: `grp-${Date.now()}`,
              tutorId: newTutor.id,
              name: groupName || tutorName,
              rate30min: rate30,
              rate60min: rate60
            };
            activeGroupId = newGroup.id;
            await StorageService.saveGroup(newGroup);
            state.groups.push(newGroup);
          }

          await StorageService.saveTutor(newTutor);
          state.tutors.push(newTutor);
        }

        // Salvar pets dinâmicos
        const petRows = document.querySelectorAll('#tutor-pets-container .pet-form-row');
        const currentPetIds = new Set();
        for (const row of petRows) {
          const petName = row.querySelector('.pet-name-input')?.value.trim();
          if (!petName) continue;
          const petRateVal = row.querySelector('.pet-bath-rate-input')?.value;
          const bathRate = petRateVal !== '' && !isNaN(petRateVal) ? Number(petRateVal) : 0;
          const petId = row.dataset.petId || `pet-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          currentPetIds.add(petId);

          const petData = {
            id: petId,
            tutorId: activeTutorId,
            groupId: activeGroupId || null,
            name: petName,
            bathRate
          };

          await StorageService.savePet(petData);
          const existingIdx = state.pets.findIndex(p => p.id === petId);
          if (existingIdx !== -1) state.pets[existingIdx] = petData;
          else state.pets.push(petData);
        }

        // Deleta pets removidos daquele tutor
        if (tutorId) {
          const oldPets = state.pets.filter(p => p.tutorId === tutorId || (groupId && p.groupId === groupId));
          for (const oldP of oldPets) {
            if (!currentPetIds.has(oldP.id)) {
              await StorageService.deletePet(oldP.id);
              state.pets = state.pets.filter(p => p.id !== oldP.id);
            }
          }
        }

        modal.classList.remove('active');
        form.reset();
        updateGroupDropdown();
        renderTutorsList();
        updateInvoiceTutorDropdown();
        await markPendingChanges();
        alert('✅ Tutor e Pets salvos com sucesso!');
      } catch (err) {
        console.error('Erro ao salvar tutor:', err);
        alert(`Erro ao salvar tutor: ${err.message}`);
      }
    });
  }
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '🐾';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderTutorsList() {
  const container = document.getElementById('tutors-tree-list');
  if (!container) return;

  if (state.tutors.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 24px 0;">Nenhum tutor cadastrado ainda.</div>';
    return;
  }

  const sortedTutors = [...state.tutors].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  container.innerHTML = sortedTutors.map(t => {
    const tGroups = state.groups.filter(g => g.tutorId === t.id);
    const tPets = state.pets.filter(p => p.tutorId === t.id || tGroups.some(g => g.id === p.groupId));
    const initials = getInitials(t.name);
    const cleanPhone = formatWhatsAppPhone(t.phone || '');

    return `
      <div class="tutor-card">
        <!-- Cabeçalho do Tutor (Largura Total para Dados de Contato) -->
        <div class="tutor-card-header">
          <div class="tutor-avatar">
            ${initials}
          </div>
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); word-break: break-word; line-height: 1.25;">
              ${t.name}
            </div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
              ${t.phone ? `
                <a href="tel:${t.phone}" style="color: var(--text-muted); text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                  <span>📱</span> <span style="text-decoration: underline;">${t.phone}</span>
                </a>
              ` : '<span style="color: var(--text-light); display: inline-flex; align-items: center; gap: 6px;"><span>📱</span> Sem telefone</span>'}
              ${t.email ? `
                <a href="mailto:${t.email}" style="color: var(--text-muted); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; word-break: break-all;">
                  <span>✉️</span> <span>${t.email}</span>
                </a>
              ` : '<span style="color: var(--text-light); display: inline-flex; align-items: center; gap: 6px;"><span>✉️</span> Sem e-mail</span>'}
            </div>
          </div>
        </div>

        <!-- Grade de Serviços (Pets & Banhos | Passeios) -->
        <div class="tutor-service-grid">
          
          <!-- Painel 1: Pets & Banhos -->
          <div class="tutor-service-box">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>🐾 Pets &amp; Banhos</span>
              ${tPets.length > 0 ? `<span style="font-size: 0.68rem; font-weight: 600; color: var(--text-muted);">${tPets.length}</span>` : ''}
            </div>
            ${tPets.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${tPets.map(p => `
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; padding: 3px 0; border-bottom: 1px dashed var(--border);">
                    <span style="font-weight: 600; color: var(--text-main);">🐶 ${p.name}</span>
                    ${p.bathRate ? `<span style="font-weight: 700; color: var(--primary); font-size: 0.76rem;">🛁 R$ ${Number(p.bathRate).toFixed(2).replace('.', ',')}</span>` : '<span style="font-size: 0.72rem; color: var(--text-light);">sem banho</span>'}
                  </div>
                `).join('')}
              </div>
            ` : '<div style="font-size: 0.76rem; color: var(--text-muted); font-style: italic;">Nenhum pet cadastrado.</div>'}
          </div>

          <!-- Painel 2: Passeios & Tarifas -->
          <div class="tutor-service-box">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>🐕 Passeios</span>
              ${tGroups.length > 0 ? `<span style="font-size: 0.68rem; font-weight: 600; color: var(--text-muted);">${tGroups.length} grupo</span>` : ''}
            </div>
            ${tGroups.length > 0 ? tGroups.map(g => `
              <div>
                <div style="font-weight: 600; font-size: 0.8rem; color: var(--text-main); margin-bottom: 4px;">
                  ${g.name}
                </div>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                  ${g.rate30min ? `
                    <span class="badge" style="background: var(--surface); border: 1px solid var(--border); font-size: 0.72rem; font-weight: 700; color: var(--primary); padding: 2px 6px; border-radius: var(--radius-sm);">
                      30m: R$ ${Number(g.rate30min).toFixed(2).replace('.', ',')}
                    </span>
                  ` : ''}
                  ${g.rate60min ? `
                    <span class="badge" style="background: var(--surface); border: 1px solid var(--border); font-size: 0.72rem; font-weight: 700; color: var(--primary); padding: 2px 6px; border-radius: var(--radius-sm);">
                      60m: R$ ${Number(g.rate60min).toFixed(2).replace('.', ',')}
                    </span>
                  ` : ''}
                  ${!g.rate30min && !g.rate60min ? '<span style="font-size: 0.72rem; color: var(--text-light);">Apenas banhos</span>' : ''}
                </div>
              </div>
            `).join('') : '<div style="font-size: 0.76rem; color: var(--text-muted); font-style: italic;">Sem grupo cadastrado.</div>'}
          </div>

        </div>

        ${t.sitterRate ? `
          <div style="margin-bottom: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-sm); padding: 6px 12px; font-size: 0.78rem; color: #047857; font-weight: 600; display: flex; align-items: center; justify-content: space-between;">
            <span>🏠 Tarifa Pet Sitter:</span>
            <strong>R$ ${Number(t.sitterRate).toFixed(2).replace('.', ',')} / visita</strong>
          </div>
        ` : ''}

        <!-- Ações do Tutor na Base -->
        <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; padding-top: 10px; border-top: 1px solid var(--border);">
          <button class="btn btn-outline btn-sm" data-action="edit-tutor" data-id="${t.id}" style="flex: 1; padding: 6px 12px; font-weight: 600;">
            ✏️ Editar Tutor
          </button>
          <button class="btn btn-danger btn-sm" data-action="delete-tutor" data-id="${t.id}" style="padding: 6px 12px; font-weight: 600;" title="Excluir Tutor">
            🗑️ Excluir
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// CONTROLADOR DA VIEW DE INVOICE / FATURA
// -------------------------------------------------------------
function setupInvoiceManager() {
  const monthPicker = document.getElementById('invoice-month-picker');
  const tutorSelect = document.getElementById('invoice-tutor-select');
  const btnAdj = document.getElementById('btn-add-adjustment');
  const btnCloseAdj = document.getElementById('btn-close-adj-modal');
  const modalAdj = document.getElementById('modal-adjustment');
  const formAdj = document.getElementById('form-adjustment');
  const btnWa = document.getElementById('btn-share-whatsapp');

  if (monthPicker) {
    monthPicker.value = getLocalDateMonth();
    monthPicker.addEventListener('change', renderInvoiceView);
  }

  if (tutorSelect) {
    tutorSelect.addEventListener('change', renderInvoiceView);
  }

  if (btnAdj) {
    btnAdj.addEventListener('click', () => {
      if (!tutorSelect.value) {
        alert('Selecione um tutor primeiro para lançar ajuste.');
        return;
      }
      formAdj.reset();
      modalAdj.classList.add('active');
    });
  }

  if (btnCloseAdj) btnCloseAdj.addEventListener('click', () => modalAdj.classList.remove('active'));

  if (formAdj) {
    formAdj.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tutorId = tutorSelect.value;
      const type = document.getElementById('adj-type').value;
      const amount = Number(document.getElementById('adj-amount').value || 0);
      const desc = document.getElementById('adj-desc').value.trim();

      const newAdj = {
        id: `adj-${Date.now()}`,
        tutorId,
        type,
        amount,
        description: desc,
        date: new Date().toISOString()
      };

      await StorageService.saveAdjustment(newAdj);
      state.adjustments.push(newAdj);

      modalAdj.classList.remove('active');
      formAdj.reset();
      renderInvoiceView();
      await markPendingChanges();
    });
  }

  if (btnWa) {
    btnWa.addEventListener('click', () => {
      const invoice = getCalculatedInvoice();
      if (!invoice) return;
      const message = formatWhatsAppSummary(invoice);
      const encoded = encodeURIComponent(message);
      const formattedPhone = formatWhatsAppPhone(invoice.tutorPhone || '');
      const waUrl = formattedPhone ? `https://wa.me/${formattedPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
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

  // Botão ✕ no header do modal (auditoria UI)
  const btnCloseX = document.getElementById('btn-close-email-modal-x');
  if (btnCloseX) btnCloseX.addEventListener('click', () => modal.classList.remove('active'));


  if (btnSendGoogle) {
    btnSendGoogle.addEventListener('click', async () => {
      const invoice = getCalculatedInvoice();
      if (!invoice) return;

      if (!navigator.onLine) {
        alert('Você está offline no momento. Conecte-se à internet para enviar o e-mail via Google Apps Script ou use a opção de WhatsApp.');
        return;
      }

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
    state.settings.pixKey,
    state.baths || [],
    state.petSitters || []
  );
}

function renderMonthSummaryCards() {
  const monthPicker = document.getElementById('invoice-month-picker');
  const monthStr = monthPicker?.value || getLocalDateMonth();

  // 1. Filtrar passeios do mês selecionado
  const monthSessions = state.sessions.filter(s => {
    if (!s.startTime) return false;
    return getLocalDateMonth(s.startTime) === monthStr;
  });

  // 2. Filtrar banhos do mês selecionado
  const monthBaths = (state.baths || []).filter(b => {
    return getLocalDateMonth(b.date || b.startTime || b.createdAt) === monthStr;
  });

  // 3. Filtrar pet sitters do mês selecionado
  const monthSitters = (state.petSitters || []).filter(s => {
    return getLocalDateMonth(s.date || s.startTime || s.createdAt) === monthStr;
  });

  // 4. Filtrar ajustes do mês selecionado
  const monthAdjustments = state.adjustments.filter(a => {
    if (!a.date) return false;
    return getLocalDateMonth(a.date) === monthStr;
  });

  // Cálculo de faturamento total do mês (passeios + banhos + pet sitter + ajustes)
  const sessionsTotal = monthSessions.reduce((acc, s) => acc + (Number(s.cost) || 0), 0);
  const bathsTotal = monthBaths.reduce((acc, b) => acc + (Number(b.cost) || 0), 0);
  const sittersTotal = monthSitters.reduce((acc, s) => acc + (Number(s.cost) || 0), 0);
  const adjustmentsTotal = monthAdjustments.reduce((acc, a) => {
    const amt = Number(a.amount) || 0;
    return a.type === 'credit' ? acc - amt : acc + amt;
  }, 0);
  const totalRevenue = Math.max(0, sessionsTotal + bathsTotal + sittersTotal + adjustmentsTotal);

  // Cálculo de tempo total
  const totalMinutes = monthSessions.reduce((acc, s) => {
    if (s.contractedDuration) return acc + Number(s.contractedDuration);
    if (s.startTime && s.endTime) {
      const diffMs = new Date(s.endTime) - new Date(s.startTime);
      return acc + Math.max(1, Math.round(diffMs / 60000));
    }
    return acc + 60;
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeFormatted = hours > 0 ? `${hours}h${mins > 0 ? ' ' + mins + 'm' : ''}` : `${mins} min`;
  const avgDuration = monthSessions.length > 0 ? Math.round(totalMinutes / monthSessions.length) : 0;

  // Cálculo de KM e tutores/pets atendidos
  let totalKm = 0;
  let kmSessionCount = 0;
  const uniqueTutors = new Set();
  const uniqueWalkPets = new Set();
  const uniqueBathPets = new Set();

  monthSessions.forEach(s => {
    if (s.kmTotal && !isNaN(s.kmTotal) && Number(s.kmTotal) > 0) {
      totalKm += Number(s.kmTotal);
      kmSessionCount++;
    }
    const group = state.groups.find(g => g.id === s.groupId);
    if (group && group.tutorId) uniqueTutors.add(group.tutorId);
    if (s.pets && Array.isArray(s.pets)) {
      s.pets.forEach(p => uniqueWalkPets.add(p));
    }
  });

  monthBaths.forEach(b => {
    if (b.tutorId) uniqueTutors.add(b.tutorId);
    if (b.petName) uniqueBathPets.add(b.petName);
  });

  monthSitters.forEach(s => {
    if (s.tutorId) uniqueTutors.add(s.tutorId);
  });

  // Atualizar elementos DOM dos cards
  const revEl = document.getElementById('metric-month-revenue');
  const revSub = document.getElementById('metric-month-revenue-sub');
  const walksRevEl = document.getElementById('metric-month-walks-revenue');
  const walksSub = document.getElementById('metric-month-walks-sub');
  const bathsRevEl = document.getElementById('metric-month-baths-revenue');
  const bathsSub = document.getElementById('metric-month-baths-sub');
  const sittersRevEl = document.getElementById('metric-month-sitters-revenue');
  const sittersSub = document.getElementById('metric-month-sitters-sub');
  const timeEl = document.getElementById('metric-month-time');
  const kmSub = document.getElementById('metric-month-km-sub');

  if (revEl) revEl.textContent = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
  if (revSub) {
    const adjText = adjustmentsTotal !== 0 ? ` (Ajustes: ${adjustmentsTotal > 0 ? '+' : ''}R$ ${adjustmentsTotal.toFixed(2).replace('.', ',')})` : '';
    revSub.textContent = `${uniqueTutors.size} ${uniqueTutors.size === 1 ? 'tutor atendido' : 'tutores atendidos'}${adjText}`;
  }

  if (walksRevEl) walksRevEl.textContent = `R$ ${sessionsTotal.toFixed(2).replace('.', ',')}`;
  if (walksSub) {
    const walkPetCount = uniqueWalkPets.size;
    walksSub.textContent = `${monthSessions.length} ${monthSessions.length === 1 ? 'passeio' : 'passeios'}${walkPetCount > 0 ? ` • ${walkPetCount} ${walkPetCount === 1 ? 'pet' : 'pets'}` : ''}`;
  }

  if (bathsRevEl) bathsRevEl.textContent = `R$ ${bathsTotal.toFixed(2).replace('.', ',')}`;
  if (bathsSub) {
    const bathPetCount = uniqueBathPets.size;
    bathsSub.textContent = `${monthBaths.length} ${monthBaths.length === 1 ? 'banho' : 'banhos'}${bathPetCount > 0 ? ` • ${bathPetCount} ${bathPetCount === 1 ? 'pet' : 'pets'}` : ''}`;
  }

  if (sittersRevEl) sittersRevEl.textContent = `R$ ${sittersTotal.toFixed(2).replace('.', ',')}`;
  if (sittersSub) {
    sittersSub.textContent = `${monthSitters.length} ${monthSitters.length === 1 ? 'visita realizada' : 'visitas realizadas'}`;
  }

  if (timeEl) timeEl.textContent = timeFormatted;
  if (kmSub) {
    if (kmSessionCount > 0) {
      kmSub.textContent = `${totalKm.toFixed(1).replace('.', ',')} km rodados (GPS)`;
    } else {
      kmSub.textContent = monthSessions.length > 0 ? `Média ${avgDuration} min/passeio` : '0 km rodados';
    }
  }
}

function renderInvoiceView() {
  renderMonthSummaryCards();

  const area = document.getElementById('invoice-preview-area');
  const invoice = getCalculatedInvoice();

  if (!invoice) {
    if (area) area.style.display = 'none';
    return;
  }

  if (area) area.style.display = 'block';

  document.getElementById('inv-tutor-name').textContent = invoice.tutorName;
  document.getElementById('inv-period-text').textContent = `Referência: ${invoice.periodMonthYear}`;
  
  const walksRow = document.getElementById('inv-walks-row');
  const sessionCountEl = document.getElementById('inv-session-count');
  const sessionCostEl = document.getElementById('inv-session-cost');
  if (sessionCountEl) sessionCountEl.textContent = invoice.sessionsCount;
  if (sessionCostEl) sessionCostEl.textContent = `R$ ${invoice.sessionsTotalCost.toFixed(2).replace('.', ',')}`;
  if (walksRow) walksRow.style.display = invoice.sessionsCount > 0 ? 'flex' : 'none';

  const bathsRow = document.getElementById('inv-baths-row');
  const bathCountEl = document.getElementById('inv-bath-count');
  const bathCostEl = document.getElementById('inv-bath-cost');
  if (bathCountEl) bathCountEl.textContent = invoice.bathsCount;
  if (bathCostEl) bathCostEl.textContent = `R$ ${invoice.bathsTotalCost.toFixed(2).replace('.', ',')}`;
  if (bathsRow) bathsRow.style.display = invoice.bathsCount > 0 ? 'flex' : 'none';

  const sittersRow = document.getElementById('inv-sitters-row');
  const sitterCountEl = document.getElementById('inv-sitter-count');
  const sitterCostEl = document.getElementById('inv-sitter-cost');
  if (sitterCountEl) sitterCountEl.textContent = invoice.petSittersCount || 0;
  if (sitterCostEl) sitterCostEl.textContent = `R$ ${(invoice.petSittersTotalCost || 0).toFixed(2).replace('.', ',')}`;
  if (sittersRow) sittersRow.style.display = (invoice.petSittersCount > 0) ? 'flex' : 'none';

  const adjCostEl = document.getElementById('inv-adjustments-cost');
  if (adjCostEl) adjCostEl.textContent = `R$ ${invoice.adjustmentsTotalCost.toFixed(2).replace('.', ',')}`;
  
  const totalCostEl = document.getElementById('inv-total-cost');
  if (totalCostEl) totalCostEl.textContent = `R$ ${invoice.totalToPay.toFixed(2).replace('.', ',')}`;
}

// -------------------------------------------------------------
// CONTROLADOR DE CONFIGURAÇÕES & AUTO-BACKUP
// -------------------------------------------------------------
async function markPendingChanges() {
  state.settings.pendingSync = true;
  await StorageService.saveSetting('pendingSync', true);
  updateSyncStatusBadge();
  triggerAutoSyncIfEligible('data_mutation');
}

async function clearPendingChanges(timestamp) {
  state.settings.pendingSync = false;
  state.settings.lastSyncTime = timestamp;
  await StorageService.saveSetting('pendingSync', false);
  await StorageService.saveSetting('lastSyncTime', timestamp);
  updateSyncStatusBadge();
}

function updateSyncStatusBadge() {
  const badgeText = document.getElementById('sync-status-text');
  if (!badgeText) return;

  if (!state.settings.googleScriptUrl) {
    badgeText.textContent = 'Google Apps Script não configurado';
    badgeText.style.color = 'var(--text-muted)';
    return;
  }

  if (state.settings.pendingSync) {
    badgeText.textContent = '⚠️ Alterações pendentes de backup (aguardando Wi-Fi)';
    badgeText.style.color = 'var(--warning)';
  } else if (state.settings.lastSyncTime) {
    const d = new Date(state.settings.lastSyncTime);
    const timeFormatted = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    badgeText.textContent = `✅ Sincronizado no Drive (${dateFormatted} às ${timeFormatted})`;
    badgeText.style.color = 'var(--success)';
  } else {
    badgeText.textContent = 'Pronto para sincronização';
    badgeText.style.color = 'var(--text-muted)';
  }
}

function isWifiConnection() {
  if (!navigator.onLine) return false;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    if (conn.type) {
      return conn.type === 'wifi' || conn.type === 'ethernet';
    }
    if (conn.saveData) return false;
  }
  // No iOS / Safari onde navigator.connection não expõe o tipo
  return true;
}

let isAutoSyncRunning = false;
async function triggerAutoSyncIfEligible(reason = 'auto') {
  if (isAutoSyncRunning) return;
  if (state.settings.autoBackupEnabled === false) return;
  if (!state.settings.googleScriptUrl) return;
  if (!state.settings.pendingSync) return;
  if (!isWifiConnection()) return;

  try {
    isAutoSyncRunning = true;
    const badgeText = document.getElementById('sync-status-text');
    if (badgeText) badgeText.textContent = '☁️ Sincronizando com Google Drive...';

    const payload = {
      tutors: state.tutors,
      groups: state.groups,
      pets: state.pets,
      sessions: state.sessions,
      baths: state.baths || [],
      adjustments: state.adjustments
    };

    const res = await syncBackupToGoogle(state.settings.googleScriptUrl, payload);
    if (res && res.success) {
      await clearPendingChanges(new Date().toISOString());
      console.log(`[AutoSync] Backup realizado com sucesso (${reason})`);
    }
  } catch (err) {
    console.warn(`[AutoSync] Falha na sincronização automática (${reason}):`, err);
    updateSyncStatusBadge();
  } finally {
    isAutoSyncRunning = false;
  }
}

function updatePinSettingsBadge() {
  const badge = document.getElementById('badge-pin-status');
  const info = document.getElementById('pin-status-info');
  const btnRemove = document.getElementById('btn-remove-pin');
  const inputPin = document.getElementById('input-setting-pin');

  if (!badge) return;

  if (state.settings.pinHash) {
    badge.textContent = '🔒 PIN Ativo';
    badge.style.background = 'var(--primary-light)';
    badge.style.color = 'var(--primary)';
    if (btnRemove) btnRemove.style.display = 'inline-block';
    if (inputPin) inputPin.placeholder = '•••• (PIN ativo - digite novo para alterar)';
    if (info) {
      info.innerHTML = '✅ <strong>PIN de 4 dígitos cadastrado e ativo.</strong> Para alterar, digite 4 novos números acima e clique em Salvar.';
    }
  } else {
    badge.textContent = '⚠️ Sem PIN';
    badge.style.background = 'rgba(234, 179, 8, 0.15)';
    badge.style.color = '#ca8a04';
    if (btnRemove) btnRemove.style.display = 'none';
    if (inputPin) inputPin.placeholder = 'Ex: 1234';
    if (info) {
      info.innerHTML = 'Nenhum PIN cadastrado no momento. Digite 4 números para ativar a trava de segurança.';
    }
  }
}

function setupSettingsController() {
  const btnSavePin = document.getElementById('btn-save-pin');
  const btnRemovePin = document.getElementById('btn-remove-pin');
  const btnRegisterBio = document.getElementById('btn-register-bio');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnSyncGoogle = document.getElementById('btn-sync-google-now');
  const btnPullGoogle = document.getElementById('btn-pull-google-now');
  const btnExport = document.getElementById('btn-export-json');
  const toggleAutoBackup = document.getElementById('toggle-auto-backup');

  const btnToggleSettingPin = document.getElementById('btn-toggle-setting-pin-visibility');
  const inputSettingPin = document.getElementById('input-setting-pin');
  if (btnToggleSettingPin && inputSettingPin) {
    btnToggleSettingPin.addEventListener('click', () => {
      const isPass = inputSettingPin.type === 'password';
      inputSettingPin.type = isPass ? 'text' : 'password';
      btnToggleSettingPin.textContent = isPass ? '🙈' : '👁️';
    });
  }

  if (toggleAutoBackup) {
    toggleAutoBackup.addEventListener('change', async () => {
      const enabled = toggleAutoBackup.checked;
      await StorageService.saveSetting('autoBackupEnabled', enabled);
      state.settings.autoBackupEnabled = enabled;
      if (enabled) triggerAutoSyncIfEligible('toggle_enabled');
    });
  }

  if (btnSavePin) {
    btnSavePin.addEventListener('click', async () => {
      try {
        const pinInput = document.getElementById('input-setting-pin');
        const pinVal = pinInput ? pinInput.value.trim() : '';
        if (pinVal.length !== 4 || isNaN(pinVal)) {
          alert('O PIN deve ter exatamente 4 dígitos numéricos.');
          return;
        }
        const hashed = await hashPin(pinVal);
        await StorageService.saveSetting('pinHash', hashed);
        state.settings.pinHash = hashed;
        updatePinSettingsBadge();
        if (pinInput) pinInput.value = '';
        alert('✅ PIN de segurança cadastrado com sucesso!');
      } catch (err) {
        console.error('Erro ao salvar PIN:', err);
        alert(`Erro ao salvar PIN: ${err.message}`);
      }
    });
  }

  if (btnRemovePin) {
    btnRemovePin.addEventListener('click', async () => {
      try {
        if (!confirm('Deseja realmente remover o PIN de segurança?')) return;
        await StorageService.saveSetting('pinHash', null);
        state.settings.pinHash = null;
        updatePinSettingsBadge();
        alert('PIN de segurança removido com sucesso!');
      } catch (err) {
        alert(`Erro ao remover PIN: ${err.message}`);
      }
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

  const btnReqNotif = document.getElementById('btn-request-notifications');
  const notifTestStatus = document.getElementById('notif-test-status');

  let notifTestTimer = null;
  let notifCountdownInterval = null;

  if (btnReqNotif) {
    btnReqNotif.addEventListener('click', async () => {
      // Se já houver um teste em contagem regressiva, permite cancelar
      if (notifTestTimer) {
        clearTimeout(notifTestTimer);
        clearInterval(notifCountdownInterval);
        notifTestTimer = null;
        notifCountdownInterval = null;
        if (!state.activeSession) stopBackgroundKeepAlive();
        btnReqNotif.textContent = '🔔 Testar & Ativar Alertas (Espera 15s)';
        btnReqNotif.classList.remove('btn-danger');
        if (notifTestStatus) {
          notifTestStatus.style.display = 'block';
          notifTestStatus.style.color = 'var(--text-muted)';
          notifTestStatus.textContent = '⏹️ Teste de 15 segundos cancelado.';
        }
        return;
      }

      unlockAudio();
      const perm = await requestNotificationPermission();

      if (perm === 'denied') {
        alert('⚠️ As notificações estão bloqueadas no iPhone.\n\nPara ativar:\n1. Acesse Ajustes > Notificações > Petwalker (ou Ajustes > Safari)\n2. Permita as Notificações\n3. Adicione o Petwalker à Tela de Início.');
        return;
      }

      if (perm === 'unsupported') {
        alert('⚠️ Notificações locais não suportadas neste modo.\n\nNo iPhone, abra o Safari, toque em Compartilhar 📤 e selecione "Adicionar à Tela de Início" para receber alertas com a tela bloqueada.');
        return;
      }

      // Inicia keepalive de áudio para evitar congelamento do timer pelo iOS com tela bloqueada
      startBackgroundKeepAlive();

      // Se houver servidor de Web Push configurado, dispara também teste remoto via APNs
      if (state.settings.pushServerUrl && PushService.isSupported()) {
        PushService.getOrSubscribe(state.settings.pushServerUrl).then(sub => {
          if (sub) {
            PushService.sendTestPush(state.settings.pushServerUrl, sub, 15).catch(e => {
              console.warn('[WebPush Test] Erro ao enviar teste:', e);
            });
          }
        }).catch(() => {});
      }

      let secondsLeft = 15;
      btnReqNotif.classList.add('btn-danger');
      btnReqNotif.textContent = `⏳ Alerta em ${secondsLeft}s... (Clique p/ cancelar)`;

      if (notifTestStatus) {
        notifTestStatus.style.display = 'block';
        notifTestStatus.style.color = 'var(--primary)';
        notifTestStatus.innerHTML = `<strong>🔒 Bloqueie a tela do iPhone agora!</strong><br>O alarme tocará e a notificação será disparada em <span id="countdown-sec">${secondsLeft}</span> segundos.`;
      }

      notifCountdownInterval = setInterval(() => {
        secondsLeft--;
        const spanSec = document.getElementById('countdown-sec');
        if (spanSec) spanSec.textContent = secondsLeft;

        if (secondsLeft > 0) {
          btnReqNotif.textContent = `⏳ Alerta em ${secondsLeft}s... (Clique p/ cancelar)`;
        }
      }, 1000);

      notifTestTimer = setTimeout(async () => {
        clearInterval(notifCountdownInterval);
        notifTestTimer = null;
        notifCountdownInterval = null;

        await sendWalkNotification(
          '🔔 Teste Petwalker (15s)!',
          'Alerta recebido com sucesso com a tela bloqueada! Meio de passeio, 5 min e término funcionarão normalmente. 🐾',
          'halfway'
        );

        if (!state.activeSession) {
          stopBackgroundKeepAlive();
        }

        btnReqNotif.classList.remove('btn-danger');
        btnReqNotif.textContent = '🔔 Testar & Ativar Alertas (Espera 15s)';

        if (notifTestStatus) {
          notifTestStatus.style.color = 'var(--success)';
          notifTestStatus.innerHTML = '✅ <strong>Notificação enviada!</strong> Se você ouviu o som e viu o banner na tela bloqueada, seu iPhone está configurado corretamente.';
        }
      }, 15000);
    });
  }

  const toggleWakeLock = document.getElementById('toggle-screen-wake-lock');
  if (toggleWakeLock) {
    toggleWakeLock.addEventListener('change', async () => {
      const isEnabled = toggleWakeLock.checked;
      await StorageService.saveSetting('keepScreenAwake', isEnabled);
      state.settings.keepScreenAwake = isEnabled;
      if (state.activeSession) {
        if (isEnabled) {
          requestScreenWakeLock();
        } else {
          releaseScreenWakeLock();
        }
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
      const pushServer = document.getElementById('input-setting-push-server')?.value.trim() || '';
      const theme = selectTheme ? selectTheme.value : 'auto';
      const autoBackup = toggleAutoBackup ? toggleAutoBackup.checked : true;
      const keepAwake = toggleWakeLock ? toggleWakeLock.checked : false;

      await StorageService.saveSetting('pixKey', pix);
      await StorageService.saveSetting('googleScriptUrl', googleUrl);
      await StorageService.saveSetting('pushServerUrl', pushServer);
      await StorageService.saveSetting('appTheme', theme);
      await StorageService.saveSetting('autoBackupEnabled', autoBackup);
      await StorageService.saveSetting('keepScreenAwake', keepAwake);

      state.settings.pixKey = pix;
      state.settings.googleScriptUrl = googleUrl;
      state.settings.pushServerUrl = pushServer;
      state.settings.appTheme = theme;
      state.settings.autoBackupEnabled = autoBackup;
      state.settings.keepScreenAwake = keepAwake;
      applyTheme(theme);
      updateSyncStatusBadge();
      alert('Configurações salvas com sucesso!');

      if (autoBackup) triggerAutoSyncIfEligible('save_settings');
    });
  }

  if (btnSyncGoogle) {
    btnSyncGoogle.addEventListener('click', async () => {
      if (!navigator.onLine) {
        alert('Você está offline no momento. Seus dados estão 100% seguros no aparelho! Conecte-se à internet para enviar o snapshot para o Google Drive.');
        return;
      }

      if (!state.settings.googleScriptUrl) {
        alert('Configure a URL do Google Apps Script primeiro na aba Ajustes.');
        return;
      }
      try {
        btnSyncGoogle.disabled = true;
        btnSyncGoogle.textContent = 'Enviando...';

        const payload = {
          tutors: state.tutors,
          groups: state.groups,
          pets: state.pets,
          sessions: state.sessions,
          baths: state.baths || [],
          petSitters: state.petSitters || [],
          adjustments: state.adjustments
        };
        const res = await syncBackupToGoogle(state.settings.googleScriptUrl, payload);
        await clearPendingChanges(new Date().toISOString());
        alert(res.message);
      } catch (e) {
        alert(`Falha no backup do Google Drive: ${e.message}`);
      } finally {
        btnSyncGoogle.disabled = false;
        btnSyncGoogle.textContent = '☁️ Fazer Backup no Google Drive';
      }
    });
  }

  if (btnPullGoogle) {
    btnPullGoogle.addEventListener('click', async () => {
      if (!navigator.onLine) {
        alert('Você está offline no momento. Conecte-se à internet para listar e restaurar versões salvas no Google Drive.');
        return;
      }

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
        baths: state.baths || [],
        petSitters: state.petSitters || [],
        adjustments: state.adjustments
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-petwalker-${getLocalDateString()}.json`;
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
            const { tutors, groups, pets, sessions, baths, petSitters, adjustments } = pullRes.payload;
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
            if (baths) {
              for (const item of baths) await StorageService.saveBath(item);
            }
            if (petSitters) {
              for (const item of petSitters) await StorageService.savePetSitter(item);
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

// -------------------------------------------------------------
// CONTROLE DE STATUS ONLINE / OFFLINE & AUTO-SYNC TRIGGERS (PWA)
// -------------------------------------------------------------
function setupOnlineOfflineStatus() {
  const offlineIndicator = document.getElementById('offline-indicator');

  function updateStatus() {
    if (!navigator.onLine) {
      if (offlineIndicator) offlineIndicator.style.display = 'flex';
    } else {
      if (offlineIndicator) offlineIndicator.style.display = 'none';
    }
  }

  window.addEventListener('online', () => {
    updateStatus();
    console.log('Petwalker: Conexão restabelecida. Checando sincronização automática...');
    triggerAutoSyncIfEligible('online_event');
  });

  window.addEventListener('offline', () => {
    updateStatus();
    console.warn('Petwalker: Modo offline ativado.');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerAutoSyncIfEligible('app_focus');
      if (state.activeSession) {
        checkWalkMilestones(state.activeSession);
        if (state.settings.keepScreenAwake) {
          requestScreenWakeLock();
        }
      }
    }
  });

  window.addEventListener('pageshow', () => {
    if (state.activeSession) {
      checkWalkMilestones(state.activeSession);
    }
  });

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && conn.addEventListener) {
    conn.addEventListener('change', () => {
      console.log('Petwalker: Mudança de rede detectada.');
      triggerAutoSyncIfEligible('network_change');
    });
  }

  updateStatus();
}
