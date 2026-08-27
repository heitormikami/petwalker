/**
 * Petwalker PWA - Serviço de Segurança e Criptografia Local
 */

function sha256PureJs(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';

  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [];
  let k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Gera um Hash SHA-256 do PIN para armazenamento seguro (com fallback universal)
 * @param {string} pin 
 * @returns {Promise<string>}
 */
export async function hashPin(pin) {
  const pinStr = String(pin || '');
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pinStr);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('SubtleCrypto falhou, usando Pure JS SHA-256:', e);
    }
  }
  return sha256PureJs(pinStr);
}

/**
 * Verifica se um PIN corresponde ao hash salvo
 * @param {string} inputPin 
 * @param {string} savedHash 
 * @returns {Promise<boolean>}
 */
export async function verifyPin(inputPin, savedHash) {
  if (!savedHash) return true; // Se não tem PIN configurado, permite acesso
  const inputHash = await hashPin(inputPin);
  return inputHash === savedHash;
}

/**
 * Verifica se a biometria nativa (WebAuthn / Passkey) é suportada pelo navegador/dispositivo
 * @returns {Promise<boolean>}
 */
export async function isBiometricsAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
}

/**
 * Registra Biometria Nativa usando a API WebAuthn do navegador
 * @param {string} username 
 * @returns {Promise<string>} Credential ID em base64
 */
export async function registerBiometrics(username = 'Petwalker App') {
  if (!(await isBiometricsAvailable())) {
    throw new Error('Biometria não disponível neste dispositivo.');
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const creationOptions = {
    publicKey: {
      challenge,
      rp: { name: 'Petwalker PWA', id: window.location.hostname || 'localhost' },
      user: {
        id: new Uint8Array(16),
        name: username,
        displayName: username
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required'
      },
      timeout: 60000
    }
  };

  const credential = await navigator.credentials.create(creationOptions);
  return btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
}

/**
 * Autentica o usuário utilizando a Biometria Nativa do dispositivo
 * @param {string} credentialIdBase64 
 * @returns {Promise<boolean>}
 */
export async function authenticateBiometrics(credentialIdBase64) {
  if (!(await isBiometricsAvailable())) return false;

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const rawId = Uint8Array.from(atob(credentialIdBase64), c => c.charCodeAt(0));

    const requestOptions = {
      publicKey: {
        challenge,
        allowCredentials: [{
          id: rawId,
          type: 'public-key'
        }],
        userVerification: 'required',
        timeout: 60000
      }
    };

    const assertion = await navigator.credentials.get(requestOptions);
    return !!assertion;
  } catch (e) {
    console.warn('Falha na biometria:', e);
    return false;
  }
}
