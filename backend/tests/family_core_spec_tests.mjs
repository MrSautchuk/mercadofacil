/**
 * MercadoFácil - Suíte Completa de Testes de Integração do Core Familiar
 * Conforme Requisitos da Especificação mercadofacil_core_familiar_especificacao-1.md (Seção 33)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../app.db');
const BASE_URL = 'http://localhost:3001/api';

// Helper direto para manipulação controlada do banco de testes
const db = new sqlite3.Database(DB_PATH);
const runSql = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

let testCoreId = null;
let testInviteCode = null;
const ownerDevice = `dev_owner_${Date.now()}`;
const memberDevice2 = `dev_member2_${Date.now()}`;
const memberDevice3 = `dev_member3_${Date.now()}`;
const memberDevice4 = `dev_member4_${Date.now()}`;
let testItemId = null;

test('Cenário 1: Responsável cria Core Familiar com limite máximo de 3 aparelhos', async () => {
  const res = await fetch(`${BASE_URL}/family/core`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: ownerDevice, accountId: `acc_${Date.now()}` })
  });

  assert.equal(res.status, 200, 'Criação do core deve retornar status 200');
  const data = await res.json();
  assert.ok(data.familyCoreId, 'Deve gerar um ID de Core Familiar');
  assert.equal(data.isOwner, true, 'Criador deve ser marcado como titular (isOwner)');
  testCoreId = data.familyCoreId;
});

test('Cenário 2 & 3: Membros 2 e 3 entram via código de convite / QR Code', async () => {
  // 1. Gerar convite 1 pelo titular para Membro 2
  const resInvite1 = await fetch(`${BASE_URL}/family/core/${testCoreId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: ownerDevice })
  });
  assert.equal(resInvite1.status, 200);
  const inviteData1 = await resInvite1.json();
  assert.ok(inviteData1.inviteCode, 'Deve gerar código alfanumérico de convite');

  // 2. Membro 2 entra
  const resJoin2 = await fetch(`${BASE_URL}/family/core/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode: inviteData1.inviteCode, deviceId: memberDevice2 })
  });
  assert.equal(resJoin2.status, 200);
  const dataJoin2 = await resJoin2.json();
  assert.equal(dataJoin2.success, true);
  assert.equal(dataJoin2.familyCoreId, testCoreId);

  // 3. Gerar convite 2 pelo titular para Membro 3 (convites de uso único)
  const resInvite2 = await fetch(`${BASE_URL}/family/core/${testCoreId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: ownerDevice })
  });
  assert.equal(resInvite2.status, 200);
  const inviteData2 = await resInvite2.json();

  // Membro 3 entra
  const resJoin3 = await fetch(`${BASE_URL}/family/core/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode: inviteData2.inviteCode, deviceId: memberDevice3 })
  });
  assert.equal(resJoin3.status, 200);
  const dataJoin3 = await resJoin3.json();
  assert.equal(dataJoin3.success, true);
});

test('Cenário 4: Tentativa do 4º aparelho entrar deve ser estritamente bloqueada (limite = 3)', async () => {
  // Titular gera convite para tentar convidar 4º aparelho
  const resInvite3 = await fetch(`${BASE_URL}/family/core/${testCoreId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: ownerDevice })
  });
  // Quando 3 aparelhos já estão ativos, o próprio endpoint de convite já bloqueia com 400!
  assert.equal(resInvite3.status, 400, 'Emissão de convite deve ser bloqueada quando core já tiver 3 aparelhos');
  const errData = await resInvite3.json();
  assert.match(errData.error, /limite .*3.* dispositivos/i);
});

test('Cenário 5: Sincronização offline-first idempotente e numeração monotônica de versões', async () => {
  const opId1 = `op_add_${Date.now()}_1`;
  
  // Aparelho 1 adiciona item
  const resOp1 = await fetch(`${BASE_URL}/family/core/${testCoreId}/list/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: ownerDevice,
      operations: [
        {
          operation_id: opId1,
          type: 'ADD_ITEM',
          item: { name: 'Arroz Integral 5kg', quantity: 1 }
        }
      ]
    })
  });

  assert.equal(resOp1.status, 200);
  const opData1 = await resOp1.json();
  assert.equal(opData1.success, true);
  assert.ok(opData1.serverVersion >= 1, 'Versão do servidor deve ser monotônica >= 1');
  assert.ok(opData1.results[0].item.id, 'Item deve possuir ID persistido');
  testItemId = opData1.results[0].item.id;

  // Teste de Idempotência: reenvio exato da mesma operação não duplica
  const resOp1Repeat = await fetch(`${BASE_URL}/family/core/${testCoreId}/list/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: ownerDevice,
      operations: [
        {
          operation_id: opId1,
          type: 'ADD_ITEM',
          item: { name: 'Arroz Integral 5kg', quantity: 1 }
        }
      ]
    })
  });

  assert.equal(resOp1Repeat.status, 200);
  const repeatData = await resOp1Repeat.json();
  assert.equal(repeatData.success, true);
  assert.equal(repeatData.results[0].applied, true);

  // Conferir se a lista contém apenas 1 arroz
  const resList = await fetch(`${BASE_URL}/family/core/${testCoreId}/list?deviceId=${ownerDevice}`);
  const listData = await resList.json();
  const arroses = listData.items.filter(i => i.name.toLowerCase().includes('arroz integral'));
  assert.equal(arroses.length, 1, 'Idempotência não deve criar item duplicado');
});

test('Cenário 6: Mesclagem automática de duplicatas concorrentes offline (Seção 17.3)', async () => {
  // Aparelho 2 adiciona "Feijão Preto 1kg" qty 2
  const opId2 = `op_feijao_${Date.now()}_dev2`;
  await fetch(`${BASE_URL}/family/core/${testCoreId}/list/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: memberDevice2,
      operations: [
        {
          operation_id: opId2,
          type: 'ADD_ITEM',
          item: { name: 'Feijão Preto 1kg', quantity: 2 }
        }
      ]
    })
  });

  // Aparelho 3 adiciona concorrentemente "feijao preto 1kg" qty 3
  const opId3 = `op_feijao_${Date.now()}_dev3`;
  const resMerge = await fetch(`${BASE_URL}/family/core/${testCoreId}/list/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: memberDevice3,
      operations: [
        {
          operation_id: opId3,
          type: 'ADD_ITEM',
          item: { name: 'feijao preto 1kg', quantity: 3 }
        }
      ]
    })
  });

  assert.equal(resMerge.status, 200);

  // Consulta lista para certificar mesclagem: deve haver 1 único item com quantidade 5
  const resList = await fetch(`${BASE_URL}/family/core/${testCoreId}/list?deviceId=${ownerDevice}`);
  const listData = await resList.json();
  const feijoes = listData.items.filter(i => i.name.toLowerCase().includes('feij'));
  assert.equal(feijoes.length, 1, 'Itens concorrentes com mesmo nome devem ser mesclados');
  assert.equal(feijoes[0].quantity, 5, 'Quantidades devem ser somadas (2 + 3 = 5)');
});

test('Cenário 7: Detecção de conflito concorrente de quantidade (Seção 17.1)', async () => {
  // Aparelho 2 atualiza quantidade do Arroz para 3 com base na versão 1
  const opUpdate1 = `op_up1_${Date.now()}`;
  await fetch(`${BASE_URL}/family/core/${testCoreId}/list/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: memberDevice2,
      operations: [
        {
          operation_id: opUpdate1,
          type: 'UPDATE_ITEM',
          base_version: 1,
          item: { id: testItemId, quantity: 3 }
        }
      ]
    })
  });

  // Aparelho 3 atualiza quantidade do mesmo Arroz para 4 com base na versão defasada 1
  const opUpdate2 = `op_up2_${Date.now()}`;
  const resConflict = await fetch(`${BASE_URL}/family/core/${testCoreId}/list/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: memberDevice3,
      operations: [
        {
          operation_id: opUpdate2,
          type: 'UPDATE_ITEM',
          base_version: 1,
          item: { id: testItemId, quantity: 4 }
        }
      ]
    })
  });

  assert.equal(resConflict.status, 200);
  const conflictData = await resConflict.json();
  assert.ok(conflictData.conflicts && conflictData.conflicts.length > 0, 'Deve acusar conflito de concorrência');
  const c = conflictData.conflicts[0];
  assert.equal(c.type, 'QUANTITY_CONFLICT');
  assert.equal(c.serverQuantity, 3);
  assert.equal(c.clientQuantity, 4);
});

test('Cenário 8: Cancelamento pelo titular e retenção de benefícios até expiração', async () => {
  // Titular cancela assinatura
  const resCancel = await fetch(`${BASE_URL}/family/core/${testCoreId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterDeviceId: ownerDevice })
  });
  assert.equal(resCancel.status, 200);
  const cancelData = await resCancel.json();
  assert.equal(cancelData.subscriptionStatus, 'canceled_pending_expiry');

  // Consulta de status do Core Familiar
  const resStatus = await fetch(`${BASE_URL}/family/core/${testCoreId}/status?deviceId=${ownerDevice}`);
  assert.equal(resStatus.status, 200);
  const statusData = await resStatus.json();
  assert.equal(statusData.subscription_status, 'canceled_pending_expiry');
  assert.ok(statusData.warningMessage, 'Deve retornar mensagem de aviso prévio de encerramento');

  // Entitlements continuam ativos até a data limite
  const resEnt = await fetch(`${BASE_URL}/entitlements?deviceId=${ownerDevice}`);
  const entData = await resEnt.json();
  assert.equal(entData.tier, 'family_premium');
  assert.equal(entData.familyPremiumActive, true, 'Benefícios devem continuar ativos durante período pago');
});

test('Cenário 9: Expiração, bloqueio de sincronização e reativação nos 30 dias de retenção', async () => {
  // Simula expiração imediata no SQLite
  await runSql(
    `UPDATE family_cores 
     SET subscription_status = 'expired', 
         status = 'expired',
         subscription_expires_at = datetime('now', '-1 day'),
         expired_at = datetime('now', '-1 day'),
         purge_at = datetime('now', '+29 days')
     WHERE id = ?`,
    [testCoreId]
  );

  // Tentativa de sincronizar lista compartilhada expirada deve ser bloqueada com 403
  const resSyncBlocked = await fetch(`${BASE_URL}/family/core/${testCoreId}/list/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: ownerDevice,
      operations: [
        {
          operation_id: `op_blocked_${Date.now()}`,
          type: 'ADD_ITEM',
          item: { name: 'Item Pós-Expirado', quantity: 1 }
        }
      ]
    })
  });
  assert.equal(resSyncBlocked.status, 403, 'Sync deve ser bloqueado quando expirado');
  const errData = await resSyncBlocked.json();
  assert.equal(errData.code, 'CORE_EXPIRED');

  // Titular reativa a assinatura dentro da janela de 30 dias
  const resReactivate = await fetch(`${BASE_URL}/family/core/${testCoreId}/reactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterDeviceId: ownerDevice })
  });
  assert.equal(resReactivate.status, 200);
  const reactivateData = await resReactivate.json();
  assert.equal(reactivateData.success, true);
  assert.equal(reactivateData.status, 'active');

  // Agora sync volta a ser permitido
  const resSyncRestored = await fetch(`${BASE_URL}/family/core/${testCoreId}/list/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: ownerDevice,
      operations: [
        {
          operation_id: `op_restored_${Date.now()}`,
          type: 'ADD_ITEM',
          item: { name: 'Item Reativado', quantity: 1 }
        }
      ]
    })
  });
  assert.equal(resSyncRestored.status, 200, 'Sync deve voltar a funcionar após reativação');
});

test('Cenário 10: Saída voluntária de membro vs Bloqueio de saída do responsável (Seção 4.1)', async () => {
  // Membro 2 sai voluntariamente
  const resLeave2 = await fetch(`${BASE_URL}/family/core/${testCoreId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterDeviceId: memberDevice2 })
  });
  assert.equal(resLeave2.status, 200);
  const leaveData2 = await resLeave2.json();
  assert.equal(leaveData2.success, true);

  // Vaga liberada: agora temos 2 membros ativos. Titular emite novo convite e Membro 4 entra!
  const resInvite4 = await fetch(`${BASE_URL}/family/core/${testCoreId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: ownerDevice })
  });
  assert.equal(resInvite4.status, 200);
  const inviteData4 = await resInvite4.json();

  const resJoin4Now = await fetch(`${BASE_URL}/family/core/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode: inviteData4.inviteCode, deviceId: memberDevice4 })
  });
  assert.equal(resJoin4Now.status, 200, 'Novo membro deve conseguir entrar na vaga liberada');

  // Responsável tenta sair voluntariamente sem cancelar: deve ser estritamente bloqueado
  const resOwnerLeave = await fetch(`${BASE_URL}/family/core/${testCoreId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterDeviceId: ownerDevice })
  });
  assert.equal(resOwnerLeave.status, 400, 'Titular não pode sair sem cancelar a assinatura');
  const errOwner = await resOwnerLeave.json();
  assert.match(errOwner.error, /titular financeiro não pode sair/i);
});

test('Cenário 11: Expiração definitiva após 30 dias (purge) impede reativação', async () => {
  // Simula purge no banco SQLite
  await runSql(
    `UPDATE family_cores 
     SET status = 'purged', 
         subscription_status = 'purged',
         purge_at = datetime('now', '-1 day')
     WHERE id = ?`,
    [testCoreId]
  );

  const resReactivatePurged = await fetch(`${BASE_URL}/family/core/${testCoreId}/reactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterDeviceId: ownerDevice })
  });
  assert.equal(resReactivatePurged.status, 410, 'Deve retornar 410 Gone quando expurgado definitivamente');
});
