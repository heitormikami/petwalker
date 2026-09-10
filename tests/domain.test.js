import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSessionCost,
  calculateMonthlyInvoice,
  formatWhatsAppSummary,
  formatEmailHtml,
  formatWhatsAppPhone,
  getLocalDateString,
  getLocalDateMonth
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

test('Sessões com Quilometragem Opcional (Carro) - Registro e Totalização', () => {
  const tutor = { id: 'tut-1', name: 'Maria Silva' };
  const group = { id: 'grp-1', tutorId: 'tut-1', rate30min: 40.00, rate60min: 70.00 };

  const sessionWithKm = {
    id: 's-km-1',
    groupId: 'grp-1',
    contractedDuration: 60,
    cost: 70.00,
    date: '2026-08-15T09:00:00Z',
    kmStart: 12450.0,
    kmEnd: 12465.5,
    kmTotal: 15.5
  };

  const sessionWithoutKm = {
    id: 's-walk-1',
    groupId: 'grp-1',
    contractedDuration: 30,
    cost: 40.00,
    date: '2026-08-16T09:00:00Z',
    kmStart: null,
    kmEnd: null,
    kmTotal: null
  };

  const invoice = calculateMonthlyInvoice(tutor, [group], [sessionWithKm, sessionWithoutKm], [], '2026-08');
  assert.equal(invoice.totalSessions, 2);
  assert.equal(invoice.sessionsTotalCost, 110.00);
  assert.equal(invoice.totalToPay, 110.00);
  assert.equal(sessionWithKm.kmTotal, 15.5);
  assert.equal(sessionWithoutKm.kmTotal, null);
});

import { hashPin, verifyPin } from '../src/services/security.js';

test('formatWhatsAppPhone - normaliza sem duplicar DDI 55', () => {
  // Caso 1: número simples com DDD
  assert.equal(formatWhatsAppPhone('41999998888'), '5541999998888');
  // Caso 2: número com máscara "(41) 99999-8888"
  assert.equal(formatWhatsAppPhone('(41) 99999-8888'), '5541999998888');
  // Caso 3: número já com +55 (13 dígitos) -> Não duplica
  assert.equal(formatWhatsAppPhone('+55 (41) 99999-8888'), '5541999998888');
  // Caso 4: número fixo com +55 (12 dígitos)
  assert.equal(formatWhatsAppPhone('+55 41 3333-4444'), '554133334444');
  // Caso 5: string vazia ou nula
  assert.equal(formatWhatsAppPhone(''), '');
  assert.equal(formatWhatsAppPhone(null), '');
});

test('hashPin & verifyPin - hashing SHA-256 e validação consistente em qualquer ambiente', async () => {
  const pin = '1234';
  const hash = await hashPin(pin);

  // SHA-256 de "1234" é 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
  assert.equal(hash, '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');

  const isCorrect = await verifyPin('1234', hash);
  const isWrong = await verifyPin('9999', hash);

  assert.equal(isCorrect, true);
  assert.equal(isWrong, false);
});

test('getLocalDateString & getLocalDateMonth - imune a distorções de fuso horário UTC perto da meia-noite', () => {
  // Teste 1: String YYYY-MM-DD já formatada
  assert.equal(getLocalDateString('2026-08-27'), '2026-08-27');
  assert.equal(getLocalDateMonth('2026-08-27'), '2026-08');

  // Teste 2: Instância Date local às 21:30 (em UTC seria dia 28, mas localmente é dia 27)
  const lateNightDate = new Date(2026, 7, 27, 21, 30, 0); // 27 de Agosto de 2026 às 21:30 local
  assert.equal(getLocalDateString(lateNightDate), '2026-08-27');
  assert.equal(getLocalDateMonth(lateNightDate), '2026-08');

  // Teste 3: Instância Date local às 23:59
  const almostMidnight = new Date(2026, 7, 27, 23, 59, 59);
  assert.equal(getLocalDateString(almostMidnight), '2026-08-27');
  assert.equal(getLocalDateMonth(almostMidnight), '2026-08');

  // Teste 4: Instância Date local no primeiro minuto do dia seguinte às 00:01
  const earlyMorning = new Date(2026, 7, 28, 0, 1, 0);
  assert.equal(getLocalDateString(earlyMorning), '2026-08-28');
  assert.equal(getLocalDateMonth(earlyMorning), '2026-08');
});

test('calculateMonthlyInvoice - combina passeios e banhos em ordem cronológica', () => {
  const tutor = { id: 'tut-1', name: 'Maria Silva' };
  const group = { id: 'grp-1', tutorId: 'tut-1', rate30min: 40.00, rate60min: 70.00 };

  const sessions = [
    { id: 's1', groupId: 'grp-1', contractedDuration: 30, cost: 40.00, date: '2026-08-05', startTime: '09:00' }
  ];

  const baths = [
    { id: 'b1', tutorId: 'tut-1', petName: 'Thor', date: '2026-08-02', startTime: '14:00', endTime: '15:00', cost: 65.00 },
    { id: 'b2', tutorId: 'tut-1', petName: 'Mel', date: '2026-08-10', startTime: '10:00', endTime: '10:45', cost: 55.00 }
  ];

  const invoice = calculateMonthlyInvoice(tutor, [group], sessions, [], '2026-08', 'minha-chave-pix', baths);

  assert.equal(invoice.sessionsCount, 1);
  assert.equal(invoice.sessionsTotalCost, 40.00);
  assert.equal(invoice.bathsCount, 2);
  assert.equal(invoice.bathsTotalCost, 120.00);
  assert.equal(invoice.totalToPay, 160.00);

  // Verifica ordem cronológica de detailedItems: dia 02 (banho), dia 05 (passeio), dia 10 (banho)
  assert.equal(invoice.detailedItems.length, 3);
  assert.equal(invoice.detailedItems[0].type, 'bath');
  assert.equal(invoice.detailedItems[0].date, '2026-08-02');
  assert.equal(invoice.detailedItems[1].type, 'walk');
  assert.equal(invoice.detailedItems[1].date, '2026-08-05');
  assert.equal(invoice.detailedItems[2].type, 'bath');
  assert.equal(invoice.detailedItems[2].date, '2026-08-10');

  const wa = formatWhatsAppSummary(invoice);
  assert.ok(wa.includes('Total de Passeios realizados:* 1'));
  assert.ok(wa.includes('Total de Banhos realizados:* 2'));
  assert.ok(wa.includes('Banho Thor'));
  assert.ok(wa.includes('Banho Mel'));
});

test('calculateMonthlyInvoice - tutor exclusivo de banho (sem passeios)', () => {
  const tutor = { id: 'tut-2', name: 'Carlos Mendes' };
  const baths = [
    { id: 'b3', tutorId: 'tut-2', petName: 'Bob', date: '2026-08-15', startTime: '15:00', endTime: '16:00', cost: 80.00 }
  ];

  const invoice = calculateMonthlyInvoice(tutor, [], [], [], '2026-08', 'pix@email.com', baths);

  assert.equal(invoice.sessionsCount, 0);
  assert.equal(invoice.sessionsTotalCost, 0);
  assert.equal(invoice.bathsCount, 1);
  assert.equal(invoice.bathsTotalCost, 80.00);
  assert.equal(invoice.totalToPay, 80.00);

  const wa = formatWhatsAppSummary(invoice);
  assert.ok(!wa.includes('Total de Passeios realizados'));
  assert.ok(wa.includes('Total de Banhos realizados:* 1'));
  assert.ok(wa.includes('R$ 80,00'));
});

test('calculateMonthlyInvoice - tutor exclusivo de pet sitter', () => {
  const tutor = { id: 'tut-sitter', name: 'Juliana Lima' };
  const sitters = [
    { id: 'ps-1', tutorId: 'tut-sitter', petNames: ['Pipoca', 'Luna'], date: '2026-08-12', startTime: '10:00', endTime: '12:00', cost: 120.00 }
  ];

  const invoice = calculateMonthlyInvoice(tutor, [], [], [], '2026-08', 'pix@email.com', [], sitters);

  assert.equal(invoice.sessionsCount, 0);
  assert.equal(invoice.bathsCount, 0);
  assert.equal(invoice.petSittersCount, 1);
  assert.equal(invoice.petSittersTotalCost, 120.00);
  assert.equal(invoice.totalToPay, 120.00);

  const wa = formatWhatsAppSummary(invoice);
  assert.ok(!wa.includes('Total de Passeios'));
  assert.ok(!wa.includes('Total de Banhos'));
  assert.ok(wa.includes('Total de Pet Sitter realizados:* 1'));
  assert.ok(wa.includes('Pet Sitter Pipoca, Luna (10:00 às 12:00): R$ 120,00'));
  assert.ok(wa.includes('Total a pagar:* R$ 120,00'));
});

test('calculateMonthlyInvoice - combina passeios, banhos e pet sitter em ordem cronológica', () => {
  const tutor = { id: 'tut-all', name: 'Fernanda Rocha' };
  const groups = [{ id: 'grp-all', tutorId: 'tut-all', name: 'Thor & Mel', rate60min: 50.00 }];
  const sessions = [
    { id: 's-1', groupId: 'grp-all', date: '2026-08-10', startTime: '09:00', contractedDuration: 60 }
  ];
  const baths = [
    { id: 'b-1', tutorId: 'tut-all', petName: 'Thor', date: '2026-08-05', startTime: '14:00', endTime: '15:00', cost: 70.00 }
  ];
  const sitters = [
    { id: 'ps-2', tutorId: 'tut-all', petNames: ['Mel'], date: '2026-08-20', startTime: '16:00', endTime: '18:00', cost: 100.00 }
  ];

  const invoice = calculateMonthlyInvoice(tutor, groups, sessions, [], '2026-08', 'pix@email.com', baths, sitters);

  assert.equal(invoice.sessionsCount, 1);
  assert.equal(invoice.bathsCount, 1);
  assert.equal(invoice.petSittersCount, 1);
  assert.equal(invoice.sessionsTotalCost, 50.00);
  assert.equal(invoice.bathsTotalCost, 70.00);
  assert.equal(invoice.petSittersTotalCost, 100.00);
  assert.equal(invoice.totalToPay, 220.00);

  assert.equal(invoice.detailedItems.length, 3);
  assert.equal(invoice.detailedItems[0].type, 'bath');
  assert.equal(invoice.detailedItems[0].date, '2026-08-05');
  assert.equal(invoice.detailedItems[1].type, 'walk');
  assert.equal(invoice.detailedItems[1].date, '2026-08-10');
  assert.equal(invoice.detailedItems[2].type, 'petsitter');
  assert.equal(invoice.detailedItems[2].date, '2026-08-20');

  const emailHtml = formatEmailHtml(invoice);
  assert.ok(emailHtml.includes('Passeios (1): R$ 50,00'));
  assert.ok(emailHtml.includes('Banhos (1): R$ 70,00'));
  assert.ok(emailHtml.includes('Pet Sitter (1): R$ 100,00'));
  assert.ok(emailHtml.includes('🏠 Pet Sitter (Mel)'));
});




