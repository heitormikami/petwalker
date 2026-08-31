/**
 * Petwalker PWA - Camada de Armazenamento Local-First (IndexedDB)
 */

const DB_NAME = 'petwalker_db';
const DB_VERSION = 1;

let dbPromise = null;

function resetDB() {
  dbPromise = null;
}

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('tutors')) {
          db.createObjectStore('tutors', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('groups')) {
          const groupStore = db.createObjectStore('groups', { keyPath: 'id' });
          groupStore.createIndex('tutorId', 'tutorId', { unique: false });
        }
        if (!db.objectStoreNames.contains('pets')) {
          const petStore = db.createObjectStore('pets', { keyPath: 'id' });
          petStore.createIndex('groupId', 'groupId', { unique: false });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('groupId', 'groupId', { unique: false });
          sessionStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('adjustments')) {
          const adjStore = db.createObjectStore('adjustments', { keyPath: 'id' });
          adjStore.createIndex('tutorId', 'tutorId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onclose = () => {
          console.warn('[IndexedDB] Conexão encerrada pelo navegador/SO.');
          resetDB();
        };

        db.onversionchange = () => {
          console.warn('[IndexedDB] Versão alterada. Encerrando conexão legada.');
          try {
            db.close();
          } catch (_) {}
          resetDB();
        };

        db.onerror = (e) => {
          console.warn('[IndexedDB] Erro na conexão do banco:', e);
          resetDB();
        };

        resolve(db);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Erro ao abrir banco:', request.error);
        resetDB();
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Abertura do banco bloqueada.');
        resetDB();
      };
    } catch (err) {
      resetDB();
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Executa uma operação no IndexedDB com recuperação e reconexão automática caso a conexão
 * tenha sido encerrada pelo SO (ex: suspensão de tela/segundo plano no iOS Safari/Android).
 */
async function withDB(operation, retries = 2) {
  try {
    const db = await openDB();
    return await operation(db);
  } catch (err) {
    const errMsg = (err && (err.message || err.name || '')) + '';
    const isConnClosingOrClosed =
      err && (
        err.name === 'InvalidStateError' ||
        errMsg.toLowerCase().includes('closing') ||
        errMsg.toLowerCase().includes('closed') ||
        errMsg.toLowerCase().includes('database connection')
      );

    if (isConnClosingOrClosed && retries > 0) {
      console.warn(`[IndexedDB] Conexão instável (${errMsg}). Reconectando e repetindo operação...`);
      resetDB();
      return withDB(operation, retries - 1);
    }
    throw err;
  }
}

// Operações Genéricas no IndexedDB
async function getAll(storeName) {
  return withDB((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transação abortada'));
    });
  });
}

async function putItem(storeName, item) {
  return withDB((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transação abortada'));
    });
  });
}

async function deleteItem(storeName, id) {
  return withDB((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transação abortada'));
    });
  });
}

export const StorageService = {
  // Tutores
  getTutors: () => getAll('tutors'),
  saveTutor: (tutor) => putItem('tutors', tutor),
  deleteTutor: (id) => deleteItem('tutors', id),

  // Grupos de Passeio
  getGroups: () => getAll('groups'),
  saveGroup: (group) => putItem('groups', group),
  deleteGroup: (id) => deleteItem('groups', id),

  // Pets
  getPets: () => getAll('pets'),
  savePet: (pet) => putItem('pets', pet),
  deletePet: (id) => deleteItem('pets', id),

  // Sessões de Passeio
  getSessions: () => getAll('sessions'),
  saveSession: (session) => putItem('sessions', session),
  deleteSession: (id) => deleteItem('sessions', id),

  // Ajustes Financeiros
  getAdjustments: () => getAll('adjustments'),
  saveAdjustment: (adj) => putItem('adjustments', adj),
  deleteAdjustment: (id) => deleteItem('adjustments', id),

  // Configurações (PIN, Webhooks, etc)
  getSetting: async (key) => {
    return withDB((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transação abortada'));
      });
    });
  },
  saveSetting: async (key, value) => {
    return putItem('settings', { key, value });
  },

  // Inicializar Dados de Exemplo (Se o banco estiver vazio)
  initSampleDataIfEmpty: async () => {
    const tutors = await getAll('tutors');
    if (tutors.length > 0) return;

    const sampleTutor = {
      id: 'tut-demo-1',
      name: 'Maria Oliveira (Exemplo)',
      phone: '41999887766',
      email: 'maria.exemplo@petwalker.com.br',
      notes: 'Entregar chave na portaria'
    };

    const sampleGroup = {
      id: 'grp-demo-1',
      tutorId: 'tut-demo-1',
      name: 'Thor e Mel',
      rate30min: 45.00,
      rate60min: 80.00
    };

    const samplePets = [
      { id: 'pet-1', groupId: 'grp-demo-1', name: 'Thor', breed: 'Golden Retriever', notes: 'Gosta de bolinha' },
      { id: 'pet-2', groupId: 'grp-demo-1', name: 'Mel', breed: 'Beagle', notes: 'Muito curiosa' }
    ];

    await putItem('tutors', sampleTutor);
    await putItem('groups', sampleGroup);
    for (const p of samplePets) {
      await putItem('pets', p);
    }
  }
};

