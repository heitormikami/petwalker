import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf-8');

test('UI Integrity - Header possui botão ⚙️ Ajustes e 🔒 Bloquear', () => {
  assert.ok(htmlContent.includes('id="btn-header-settings"'), 'Header deve conter o botão btn-header-settings');
  assert.ok(htmlContent.includes('id="btn-lock-app"'), 'Header deve conter o botão btn-lock-app');
});

test('UI Integrity - Bottom Navigation possui exatamente 6 botões operacionais com Pet Sitter', () => {
  const bottomNavMatch = htmlContent.match(/<nav class="bottom-nav">([\s\S]*?)<\/nav>/);
  assert.ok(bottomNavMatch, 'Elemento .bottom-nav deve existir');
  const bottomNavHtml = bottomNavMatch[1];

  assert.ok(bottomNavHtml.includes('data-target="view-walk"'), 'Nav deve ter view-walk');
  assert.ok(bottomNavHtml.includes('data-target="view-daily"'), 'Nav deve ter view-daily');
  assert.ok(bottomNavHtml.includes('data-target="view-baths"'), 'Nav deve ter view-baths');
  assert.ok(bottomNavHtml.includes('data-target="view-tutors"'), 'Nav deve ter view-tutors');
  assert.ok(bottomNavHtml.includes('data-target="view-invoice"'), 'Nav deve ter view-invoice');
  assert.ok(bottomNavHtml.includes('data-target="view-sitter"'), 'Nav deve ter view-sitter (Pet Sitter)');
  assert.ok(!bottomNavHtml.includes('data-target="view-settings"'), 'view-settings não deve mais estar na barra inferior');
});

test('UI Integrity - View de Pet Sitter (view-sitter) está presente com controles e contadores', () => {
  assert.ok(htmlContent.includes('id="view-sitter"'), 'Deve conter view-sitter');
  assert.ok(htmlContent.includes('id="btn-open-sitter-modal"'), 'Deve conter botão de abrir modal de pet sitter');
  assert.ok(htmlContent.includes('id="filter-sitter-date"'), 'Deve conter input de data');
  assert.ok(htmlContent.includes('id="btn-sitter-date-prev"'), 'Deve conter botão dia anterior');
  assert.ok(htmlContent.includes('id="btn-sitter-date-next"'), 'Deve conter botão dia seguinte');
  assert.ok(htmlContent.includes('id="btn-sitter-date-today"'), 'Deve conter botão hoje');
  assert.ok(htmlContent.includes('id="stat-sitter-daily-count"'), 'Deve conter contador diário');
  assert.ok(htmlContent.includes('id="stat-sitter-monthly-count"'), 'Deve conter contador mensal');
  assert.ok(htmlContent.includes('id="stat-sitter-monthly-revenue"'), 'Deve conter faturamento mensal');
  assert.ok(htmlContent.includes('id="daily-sitters-list"'), 'Deve conter lista de atendimentos');
  assert.ok(htmlContent.includes('id="sitter-empty-state"'), 'Deve conter empty state');
});

test('UI Integrity - Modal de Pet Sitter (modal-pet-sitter) contém todos os campos necessários', () => {
  assert.ok(htmlContent.includes('id="modal-pet-sitter"'), 'Deve conter modal-pet-sitter');
  assert.ok(htmlContent.includes('id="form-pet-sitter"'), 'Deve conter form-pet-sitter');
  assert.ok(htmlContent.includes('id="sitter-tutor-select"'), 'Deve conter seleção de tutor');
  assert.ok(htmlContent.includes('id="sitter-pets-container"'), 'Deve conter container dinâmico de pets');
  assert.ok(htmlContent.includes('id="sitter-date"'), 'Deve conter input de data');
  assert.ok(htmlContent.includes('id="sitter-start-time"'), 'Deve conter hora início');
  assert.ok(htmlContent.includes('id="sitter-end-time"'), 'Deve conter hora fim');
  assert.ok(htmlContent.includes('id="sitter-cost"'), 'Deve conter valor cobrado');
  assert.ok(htmlContent.includes('id="sitter-notes"'), 'Deve conter observações');
  assert.ok(htmlContent.includes('id="btn-close-sitter-modal"'), 'Deve conter botão cancelar');
});

test('UI Integrity - Modal do Tutor possui campo de Valor Padrão Pet Sitter', () => {
  assert.ok(htmlContent.includes('id="tutor-sitter-rate"'), 'Modal do tutor deve conter tutor-sitter-rate');
});

test('UI Integrity - Tela de Faturas possui métricas e detalhamento de Pet Sitter', () => {
  assert.ok(htmlContent.includes('id="metric-month-sitters-revenue"'), 'Resumo mensal deve conter métrica de faturamento de Pet Sitter');
  assert.ok(htmlContent.includes('id="metric-month-sitters-sub"'), 'Resumo mensal deve conter subtítulo de visitas');
  assert.ok(htmlContent.includes('id="inv-sitters-row"'), 'Fatura individual deve conter linha inv-sitters-row');
  assert.ok(htmlContent.includes('id="inv-sitter-count"'), 'Fatura individual deve conter inv-sitter-count');
  assert.ok(htmlContent.includes('id="inv-sitter-cost"'), 'Fatura individual deve conter inv-sitter-cost');
});

test('UI Integrity - Tela de Bloqueio possui ícone oficial e indicador de versão', () => {
  const lockScreenMatch = htmlContent.match(/<div id="lock-screen"[\s\S]*?<\/div>\s*<\/div>/);
  assert.ok(lockScreenMatch, 'Elemento #lock-screen deve existir');
  assert.ok(htmlContent.includes('src="assets/favicon.svg"'), 'Tela de bloqueio deve usar ícone oficial');
  assert.ok(htmlContent.includes('id="lock-app-version"'), 'Tela de bloqueio deve conter elemento de versão');
});
