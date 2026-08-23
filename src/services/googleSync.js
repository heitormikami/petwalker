/**
 * Petwalker PWA - Integração com Google Apps Script Web App (Google Drive + Gmail)
 */

/**
 * Função auxiliar interna para realizar chamadas seguras ao Google Apps Script
 */
async function callGoogleScript(webAppUrl, payload) {
  if (!webAppUrl) {
    throw new Error('URL do Google Apps Script não configurada.');
  }

  let cleanUrl = webAppUrl.trim();
  if (cleanUrl.endsWith('/edit') || cleanUrl.endsWith('/dev')) {
    throw new Error('A URL inserida parece ser de edição (/edit ou /dev). Certifique-se de copiar a URL de Implantação que termina com "/exec".');
  }

  const response = await fetch(cleanUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });

  const textResponse = await response.text();

  let result;
  try {
    result = JSON.parse(textResponse);
  } catch (err) {
    if (textResponse.includes('<!DOCTYPE html>') || textResponse.includes('<html')) {
      throw new Error('O Google retornou uma página de login em vez do script. Verifique se na Implantação você definiu "Quem tem acesso" como "Qualquer pessoa" (Anyone).');
    }
    throw new Error(`Resposta inválida do servidor: ${textResponse.substring(0, 100)}...`);
  }

  return result;
}

/**
 * Envia backup de dados (snapshot JSON) para salvar no Google Drive via Google Apps Script
 * @param {string} webAppUrl 
 * @param {Object} dataPayload 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function syncBackupToGoogle(webAppUrl, dataPayload) {
  const result = await callGoogleScript(webAppUrl, {
    action: 'backup_sync',
    timestamp: new Date().toISOString(),
    payload: dataPayload
  });

  if (!result.success) {
    throw new Error(result.error || result.message || 'Erro na sincronização');
  }

  return { success: true, message: result.message || 'Backup salvo com sucesso no Google Drive!' };
}

/**
 * Busca a lista de versões de backups armazenadas no Google Drive
 * @param {string} webAppUrl 
 * @returns {Promise<{success: boolean, backups: Array<{name: string, size: number, updatedAt: string}>}>}
 */
export async function listBackupsFromGoogle(webAppUrl) {
  const result = await callGoogleScript(webAppUrl, {
    action: 'list_backups',
    timestamp: new Date().toISOString()
  });

  if (!result.success) {
    throw new Error(result.error || result.message || 'Erro ao listar backups');
  }

  return { success: true, backups: result.backups || [] };
}

/**
 * Busca um snapshot de backup específico ou o mais recente no Google Drive
 * @param {string} webAppUrl 
 * @param {string} [fileName] Nome do arquivo de versão (ex: backup-2026-08-23_18-30.json)
 * @returns {Promise<{success: boolean, payload: Object, fileName: string}>}
 */
export async function pullBackupFromGoogle(webAppUrl, fileName = null) {
  const result = await callGoogleScript(webAppUrl, {
    action: 'pull_sync',
    fileName,
    timestamp: new Date().toISOString()
  });

  if (!result.success) {
    throw new Error(result.error || result.message || 'Nenhum backup encontrado');
  }

  return { success: true, payload: result.payload, fileName: result.fileName };
}

/**
 * Envia e-mail de fatura revisada para o tutor via Gmail do Google Apps Script
 * @param {string} webAppUrl 
 * @param {Object} invoiceData 
 * @param {string} htmlEmail 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function sendInvoiceEmailViaGoogle(webAppUrl, invoiceData, htmlEmail) {
  const result = await callGoogleScript(webAppUrl, {
    action: 'send_invoice_email',
    recipientEmail: invoiceData.tutorEmail,
    recipientName: invoiceData.tutorName,
    periodMonthYear: invoiceData.periodMonthYear,
    totalToPay: invoiceData.totalToPay,
    htmlContent: htmlEmail,
    invoiceData
  });

  if (!result.success) {
    throw new Error(result.error || result.message || 'Erro no envio do e-mail');
  }

  return { success: true, message: result.message || `E-mail enviado com sucesso para ${invoiceData.tutorEmail}!` };
}
