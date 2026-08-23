/**
 * Petwalker PWA - Serviço de Segurança e Criptografia Local
 */

/**
 * Gera um Hash SHA-256 do PIN para armazenamento seguro
 * @param {string} pin 
 * @returns {Promise<string>}
 */
export async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
