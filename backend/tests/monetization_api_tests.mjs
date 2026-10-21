/**
 * MercadoFácil - Testes de Integração de API de Monetização
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3001/api';

test('Backend API - 1. Entitlements inicial para novo dispositivo é Free', async () => {
  const deviceId = `test_dev_${Date.now()}`;
  const res = await fetch(`${BASE_URL}/entitlements?deviceId=${deviceId}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.tier, 'free');
  assert.equal(data.adsRemoved, false);
  assert.equal(data.familyPremiumActive, false);
});

test('Backend API - 2. Registro e verificação de compra única de remoção de anúncios', async () => {
  const deviceId = `test_dev_buyer_${Date.now()}`;
  const transactionId = `txn_${Date.now()}`;

  const resVerify = await fetch(`${BASE_URL}/billing/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      receipt: {
        productId: 'com.mercadofacil.noads.lifetime',
        transactionId,
        store: 'sandbox'
      }
    })
  });

  assert.equal(resVerify.status, 200);
  const verifyData = await resVerify.json();
  assert.equal(verifyData.verified, true);

  // Consultar entitlements novamente: agora deve ser lifetime_no_ads
  const resEnt = await fetch(`${BASE_URL}/entitlements?deviceId=${deviceId}`);
  const entData = await resEnt.json();
  assert.equal(entData.tier, 'lifetime_no_ads');
  assert.equal(entData.adsRemoved, true);
  assert.equal(entData.familyPremiumActive, false);
});

test('Backend API - 3. Criação de Family Core e restrição de no máximo 3 dispositivos', async () => {
  const ownerId = `owner_${Date.now()}`;
  
  // Criar Core
  const resCore = await fetch(`${BASE_URL}/family/core`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: ownerId })
  });
  assert.equal(resCore.status, 200);
  const coreData = await resCore.json();
  const coreId = coreData.familyCoreId;
  assert.equal(coreData.maxDevices, 3);
  assert.equal(coreData.currentDevices, 1);

  // O titular agora tem family_premium
  const resOwnerEnt = await fetch(`${BASE_URL}/entitlements?deviceId=${ownerId}`);
  const ownerEnt = await resOwnerEnt.json();
  assert.equal(ownerEnt.tier, 'family_premium');
  assert.equal(ownerEnt.canManageFamily, true);

  // Gerar convite 1
  const resInv1 = await fetch(`${BASE_URL}/family/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyCoreId: coreId, ownerDeviceId: ownerId })
  });
  assert.equal(resInv1.status, 200);
  const code1 = (await resInv1.json()).invitationCode;

  // Aceitar com dispositivo 2
  const dev2 = `member_2_${Date.now()}`;
  const resAcc1 = await fetch(`${BASE_URL}/family/invitations/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code1, deviceId: dev2 })
  });
  assert.equal(resAcc1.status, 200);
  assert.equal((await resAcc1.json()).totalActiveDevices, 2);

  // Gerar convite 2
  const resInv2 = await fetch(`${BASE_URL}/family/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyCoreId: coreId, ownerDeviceId: ownerId })
  });
  const code2 = (await resInv2.json()).invitationCode;

  // Aceitar com dispositivo 3 (atinge o limite de 3)
  const dev3 = `member_3_${Date.now()}`;
  const resAcc2 = await fetch(`${BASE_URL}/family/invitations/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code2, deviceId: dev3 })
  });
  assert.equal(resAcc2.status, 200);
  assert.equal((await resAcc2.json()).totalActiveDevices, 3);

  // Tentar gerar novo convite quando já tem 3 ativos: deve bloquear!
  const resInvBlocked = await fetch(`${BASE_URL}/family/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyCoreId: coreId, ownerDeviceId: ownerId })
  });
  assert.equal(resInvBlocked.status, 400);
  const blockedData = await resInvBlocked.json();
  assert.ok(blockedData.error.includes('Limite de 3'));
});

test('Backend API - 4. Consulta de Ofertas B2B por UF e Cidade', async () => {
  const res = await fetch(`${BASE_URL}/retail/offers?uf=SP&city=Olímpia`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.uf, 'SP');
  assert.equal(Array.isArray(data.data), true);
});
