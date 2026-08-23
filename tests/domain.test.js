import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSessionCost,
  calculateMonthlyInvoice,
  formatWhatsAppSummary,
  formatEmailHtml
} from '../src/domain/models.js';

test('calculateSessionCost - 30 minutos', () => {
  const group = {
    id: 'grp-1',
    tutorId: 'tut-1',
    name: 'Lulu & Rex',
    rate30min: 40.00,
    rate60min: 70.00
  };

  const cost = calculateSessionCost(group, 30);
  assert.equal(cost, 40.00);
});

test('calculateSessionCost - 60 minutos', () => {
  const group = {
    id: 'grp-1',
    tutorId: 'tut-1',
    name: 'Lulu & Rex',
    rate30min: 40.00,
    rate60min: 70.00
  };

  const cost = calculateSessionCost(group, 60);
  assert.equal(cost, 70.00);
});

test('calculateMonthlyInvoice - calcula passeios e aplica ajustes', () => {
  const tutor = {
    id: 'tut-1',
    name: 'Maria Silva',
    email: 'maria@example.com',
    phone: '41999998888'
  };

  const group = {
    id: 'grp-1',
    tutorId: 'tut-1',
    name: 'Lulu & Rex',
    rate30min: 40.00,
    rate60min: 70.00
  };

  const sessions = [
    { id: 's1', groupId: 'grp-1', contractedDuration: 30, date: '2026-08-01T10:00:00Z' },
    { id: 's2', groupId: 'grp-1', contractedDuration: 60, date: '2026-08-03T10:00:00Z' },
    { id: 's3', groupId: 'grp-1', contractedDuration: 60, date: '2026-08-05T10:00:00Z' },
  ];

  const adjustments = [
    { id: 'a1', tutorId: 'tut-1', type: 'credit', amount: 20.00, description: 'Crédito chuva dia 28' },
    { id: 'a2', tutorId: 'tut-1', type: 'debit', amount: 50.00, description: 'Dog Shower extra' }
  ];

  // 40 + 70 + 70 = 180 (passeios)
  // -20 (crédito) + 50 (débito) = +30 (ajustes)
  // Total = 210.00
  const invoice = calculateMonthlyInvoice(tutor, [group], sessions, adjustments, '2026-08');

  assert.equal(invoice.totalSessions, 3);
  assert.equal(invoice.sessionsTotalCost, 180.00);
  assert.equal(invoice.adjustmentsTotalCost, 30.00);
  assert.equal(invoice.totalToPay, 210.00);
});

test('Edição/Lançamento Manual de Passeio - Recálculo de Fatura', () => {
  const tutor = { id: 'tut-1', name: 'Maria Silva' };
  const group = { id: 'grp-1', tutorId: 'tut-1', rate30min: 40.00, rate60min: 70.00 };

  // Passeio manual retroativo de 30 min (editado de 60 para 30 min)
  const editedSession = {
    id: 's1',
    groupId: 'grp-1',
    contractedDuration: 30,
    cost: 40.00,
    date: '2026-08-10T14:00:00Z'
  };

  const invoice = calculateMonthlyInvoice(tutor, [group], [editedSession], [], '2026-08');
  assert.equal(invoice.totalSessions, 1);
  assert.equal(invoice.sessionsTotalCost, 40.00);
  assert.equal(invoice.totalToPay, 40.00);
});

test('formatWhatsAppSummary - gera texto limpo e legível com PIX', () => {
  const invoice = {
    tutorName: 'Maria Silva',
    periodMonthYear: '08/2026',
    sessionsCount: 3,
    sessionsTotalCost: 180.00,
    adjustments: [
      { type: 'credit', amount: 20.00, description: 'Crédito chuva' },
      { type: 'debit', amount: 50.00, description: 'Dog Shower' }
    ],
    totalToPay: 210.00,
    pixKey: 'contato@petwalker.com.br'
  };

  const summary = formatWhatsAppSummary(invoice);

  assert.ok(summary.includes('Maria Silva'));
  assert.ok(summary.includes('08/2026'));
  assert.ok(summary.includes('R$ 210,00'));
  assert.ok(summary.includes('contato@petwalker.com.br'));
});

test('formatEmailHtml - gera template HTML bem formatado com mensagem personalizada', () => {
  const invoice = {
    tutorName: 'Maria Silva',
    periodMonthYear: '08/2026',
    sessionsCount: 3,
    sessionsTotalCost: 180.00,
    adjustments: [
      { type: 'credit', amount: 20.00, description: 'Crédito chuva' }
    ],
    totalToPay: 160.00,
    pixKey: 'contato@petwalker.com.br'
  };

  const html = formatEmailHtml(invoice, 'Thor se comportou muito bem este mês!');

  assert.ok(html.includes('<html>'));
  assert.ok(html.includes('Maria Silva'));
  assert.ok(html.includes('R$ 160,00'));
  assert.ok(html.includes('Thor se comportou muito bem este mês!'));
});
