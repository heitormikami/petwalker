/**
 * Petwalker PWA - Camada de Armazenamento Local-First (IndexedDB)
 */

const DB_NAME = 'petwalker_db';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
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

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Operações Genéricas no IndexedDB
async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function putItem(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

async function deleteItem(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
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
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
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
