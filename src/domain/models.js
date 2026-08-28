/**
 * Domínio Petwalker - Modelos e Regras de Negócio Puras
 */

/**
 * Calcula o custo de uma sessão de passeio com base na duração contratada e taxas do grupo.
 * @param {Object} group 
 * @param {number} durationMinutes (30 ou 60)
 * @returns {number}
 */
export function calculateSessionCost(group, durationMinutes) {
  if (!group) return 0;
  if (durationMinutes === 30) {
    return Number(group.rate30min || 0);
  }
  if (durationMinutes === 60) {
    return Number(group.rate60min || 0);
  }
  // Se for valor personalizado por minutos
  const ratePerMinute = Number(group.rate60min || 0) / 60;
  return Number((ratePerMinute * durationMinutes).toFixed(2));
}

/**
 * Retorna a data no fuso horário local do usuário no formato "YYYY-MM-DD"
 * Evita o bug de UTC que adianta 1 dia após as 21h no Brasil (UTC-3).
 * @param {Date|string|number} [d=new Date()]
 * @returns {string} "YYYY-MM-DD"
 */
export function getLocalDateString(d = new Date()) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna o mês/ano no fuso horário local no formato "YYYY-MM"
 * @param {Date|string|number} [d=new Date()]
 * @returns {string} "YYYY-MM"
 */
export function getLocalDateMonth(d = new Date()) {
  const str = getLocalDateString(d);
  return str ? str.substring(0, 7) : '';
}

/**
 * Apura a Fatura Mensal para um Tutor específico.
 * @param {Object} tutor 
 * @param {Array<Object>} groups 
 * @param {Array<Object>} sessions 
 * @param {Array<Object>} adjustments 
 * @param {string} monthYearKey "YYYY-MM" (ex: "2026-08")
 * @param {string} [pixKey]
 * @returns {Object}
 */
export function calculateMonthlyInvoice(tutor, groups, sessions, adjustments = [], monthYearKey, pixKey = 'contato@petwalker.com.br') {
  const tutorGroupIds = new Set((groups || []).filter(g => g.tutorId === tutor.id).map(g => g.id));
  const groupMap = new Map((groups || []).map(g => [g.id, g]));

  // Filtrar sessões do período e dos grupos do tutor
  const periodSessions = (sessions || []).filter(s => {
    if (!tutorGroupIds.has(s.groupId)) return false;
    const sessionMonthKey = getLocalDateMonth(s.date || s.startTime);
    return sessionMonthKey === monthYearKey;
  });

  let sessionsTotalCost = 0;
  const detailedSessions = periodSessions.map(s => {
    const group = groupMap.get(s.groupId);
    const cost = calculateSessionCost(group, s.contractedDuration);
    sessionsTotalCost += cost;
    return {
      ...s,
      groupName: group ? group.name : 'Grupo',
      cost
    };
  });

  // Filtrar ajustes do tutor para o mês
  const tutorAdjustments = (adjustments || []).filter(a => {
    if (a.tutorId !== tutor.id) return false;
    const adjMonthKey = a.date ? a.date.substring(0, 7) : monthYearKey;
    return adjMonthKey === monthYearKey;
  });

  let adjustmentsTotalCost = 0;
  tutorAdjustments.forEach(a => {
    const amt = Number(a.amount || 0);
    if (a.type === 'credit' || a.type === 'discount') {
      adjustmentsTotalCost -= amt;
    } else if (a.type === 'debit') {
      adjustmentsTotalCost += amt;
    }
  });

  const totalToPay = Math.max(0, Number((sessionsTotalCost + adjustmentsTotalCost).toFixed(2)));

  const [year, month] = monthYearKey.split('-');
  const periodMonthYear = `${month}/${year}`;

  return {
    tutorId: tutor.id,
    tutorName: tutor.name,
    tutorEmail: tutor.email,
    tutorPhone: tutor.phone,
    periodMonthYear,
    monthYearKey,
    totalSessions: detailedSessions.length,
    sessionsCount: detailedSessions.length,
    sessionsTotalCost: Number(sessionsTotalCost.toFixed(2)),
    adjustments: tutorAdjustments,
    adjustmentsTotalCost: Number(adjustmentsTotalCost.toFixed(2)),
    totalToPay,
    detailedSessions,
    pixKey
  };
}

/**
 * Normaliza e formata o número de telefone para o padrão internacional do WhatsApp sem duplicar DDI 55
 * @param {string} rawPhone 
 * @returns {string}
 */
export function formatWhatsAppPhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';
  // Se já começa com 55 e tem tamanho de DDI + DDD + número (12 ou 13 dígitos)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // Caso contrário, adiciona o DDI 55 do Brasil
  return `55${digits}`;
}

/**
 * Formata mensagem limpa para envio via WhatsApp
 * @param {Object} invoice 
 * @returns {string}
 */
export function formatWhatsAppSummary(invoice) {
  const lines = [];
  lines.push(`🐾 *Petwalker - Resumo Mensal (${invoice.periodMonthYear})*`);
  lines.push(`Olá, ${invoice.tutorName}! Segue o fechamento dos passeios deste mês:\n`);
  lines.push(`🐕 *Total de Passeios realizados:* ${invoice.sessionsCount}`);
  lines.push(`💵 *Valor dos passeios:* R$ ${invoice.sessionsTotalCost.toFixed(2).replace('.', ',')}`);

  if (invoice.adjustments && invoice.adjustments.length > 0) {
    lines.push(`\n📝 *Ajustes / Observações:*`);
    invoice.adjustments.forEach(adj => {
      const signal = (adj.type === 'credit' || adj.type === 'discount') ? '-' : '+';
      lines.push(` • ${adj.description}: ${signal}R$ ${Number(adj.amount).toFixed(2).replace('.', ',')}`);
    });
  }

  lines.push(`\n💰 *Total a pagar:* R$ ${invoice.totalToPay.toFixed(2).replace('.', ',')}`);
  lines.push(`🔑 *Chave PIX:* ${invoice.pixKey}`);
  lines.push(`\nMuito obrigado pelo carinho e confiança nos nossos serviços! 🧡`);

  return lines.join('\n');
}

/**
 * Formata e-mail em HTML responsivo e limpo
 * @param {Object} invoice 
 * @param {string} [customNote] Recado personalizado adicional para o tutor
 * @returns {string}
 */
export function formatEmailHtml(invoice, customNote = '') {
  const sessionRowsHtml = (invoice.detailedSessions || []).map(s => {
    const formattedDate = new Date(s.date).toLocaleDateString('pt-BR');
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${formattedDate}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.groupName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.contractedDuration} min</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">R$ ${s.cost.toFixed(2).replace('.', ',')}</td>
      </tr>
    `;
  }).join('');

  const adjustmentsHtml = (invoice.adjustments || []).map(a => {
    const isCredit = a.type === 'credit' || a.type === 'discount';
    const color = isCredit ? '#16a34a' : '#d97706';
    const signal = isCredit ? '-' : '+';
    return `
      <tr>
        <td colspan="3" style="padding: 8px; border-bottom: 1px solid #eee; color: ${color};">${a.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: ${color};">${signal}R$ ${Number(a.amount).toFixed(2).replace('.', ',')}</td>
      </tr>
    `;
  }).join('');

  const customNoteBlock = customNote ? `
    <div style="margin: 16px 0; padding: 12px 16px; background-color: #FFFDF9; border-left: 4px solid #FF6633; border-radius: 4px; font-style: italic; color: #444;">
      💌 <strong>Mensagem da Passeadora:</strong><br>
      "${customNote}"
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fechamento Mensal - Petwalker</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #FAF7F2; margin: 0; padding: 20px; color: #2D2B2A;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border-top: 6px solid #FF6633; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #FF6633; margin: 0;">Petwalker Passeios</h2>
      <p style="color: #666666; font-size: 14px; margin-top: 4px;">Relatório de Fechamento - ${invoice.periodMonthYear}</p>
    </div>

    <p>Olá, <strong>${invoice.tutorName}</strong>,</p>
    <p>Aqui está o detalhamento dos passeios realizados neste mês com muito carinho e cuidado:</p>
    ${customNoteBlock}

    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
      <thead>
        <tr style="background-color: #F4EFE6; color: #444444;">
          <th style="padding: 8px; text-align: left;">Data</th>
          <th style="padding: 8px; text-align: left;">Pets</th>
          <th style="padding: 8px; text-align: left;">Duração</th>
          <th style="padding: 8px; text-align: right;">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${sessionRowsHtml || '<tr><td colspan="4" style="padding: 12px; text-align: center;">Nenhum passeio registrado neste mês.</td></tr>'}
        ${adjustmentsHtml}
      </tbody>
    </table>

    <div style="margin-top: 20px; padding: 16px; background-color: #FFF6F0; border-radius: 8px; text-align: right;">
      <div style="font-size: 14px; color: #666;">Subtotal dos Passeios: R$ ${invoice.sessionsTotalCost.toFixed(2).replace('.', ',')}</div>
      <div style="font-size: 18px; font-weight: bold; color: #FF6633; margin-top: 6px;">
        Total a Pagar: R$ ${invoice.totalToPay.toFixed(2).replace('.', ',')}
      </div>
      <div style="font-size: 12px; color: #555; margin-top: 8px;">
        Chave PIX para pagamento: <strong>${invoice.pixKey}</strong>
      </div>
    </div>

    <p style="font-size: 12px; color: #888888; text-align: center; margin-top: 24px;">
      Petwalker - Passeio e Adestramento Básico em Curitiba<br>
      Dúvidas? Entre em contato conosco!
    </p>
  </div>
</body>
</html>`;
}
