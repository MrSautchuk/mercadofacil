/**
 * MercadoFácil - Monetization & Commercial API Router
 * 
 * Endpoints e Contratos de API:
 * 1. Entitlements (/api/entitlements)
 * 2. In-App Purchases & Receipt Validation (/api/billing/verify)
 * 3. Family Core (/api/family/*)
 * 4. B2B Retail Offers (/api/retail/*)
 */

const express = require('express');
const router = express.Router();
const db = require('./database');

// --- 1. ENTITLEMENTS ---

router.get('/entitlements', (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId é obrigatório.' });
  }

  // Buscar compras ativas do dispositivo/conta
  db.all(
    `SELECT p.product_id, p.status 
     FROM purchases p
     JOIN accounts a ON p.account_id = a.id
     WHERE a.device_id = ? AND p.status = 'valid'`,
    [deviceId],
    (errPurchases, purchasesRows) => {
      if (errPurchases) return res.status(500).json({ error: errPurchases.message });

      const hasLifetimeNoAds = (purchasesRows || []).some(
        p => p.product_id === 'com.mercadofacil.noads.lifetime'
      );

      // Verificar se o dispositivo é membro de um Core Familiar ativo
      db.get(
        `SELECT fc.id as core_id, fc.subscription_status, fc.subscription_expires_at, fc.max_devices,
                fd.is_owner, fd.status as device_status
         FROM family_devices fd
         JOIN family_cores fc ON fd.family_core_id = fc.id
         WHERE fd.device_id = ? AND fd.status = 'active'`,
        [deviceId],
        (errFamily, familyRow) => {
          if (errFamily) return res.status(500).json({ error: errFamily.message });

          const now = Date.now();
          let isFamilyActive = false;
          let isOwner = false;
          let coreId = null;
          let isCanceledPendingExpiry = false;

          if (familyRow) {
            const expTime = familyRow.subscription_expires_at 
              ? new Date(familyRow.subscription_expires_at).getTime() 
              : 0;
            const subStatus = familyRow.subscription_status || 'active';
            
            // Ativo se status for 'active' ou 'canceled_pending_expiry' e ainda dentro do prazo pago
            if ((subStatus === 'active' || subStatus === 'canceled_pending_expiry') && expTime > now) {
              isFamilyActive = true;
              isOwner = Boolean(familyRow.is_owner);
              coreId = String(familyRow.core_id);
              if (subStatus === 'canceled_pending_expiry') {
                isCanceledPendingExpiry = true;
              }
            } else if (subStatus !== 'expired' && expTime <= now && expTime > 0) {
              // Transiciona sob demanda para expired
              const purgeAt = new Date(expTime + 30 * 24 * 60 * 60 * 1000).toISOString();
              db.run(
                `UPDATE family_cores SET subscription_status = 'expired', status = 'expired', expired_at = ?, purge_at = ? WHERE id = ?`,
                [new Date(expTime).toISOString(), purgeAt, familyRow.core_id]
              );
            }
          }

          if (isFamilyActive) {
            return res.json({
              adsRemoved: true,
              familyPremiumActive: true,
              familyCoreId: coreId,
              canShareLists: true,
              canSyncFiles: true,
              canManageFamily: isOwner,
              tier: 'family_premium',
              isCanceledPendingExpiry,
              subscriptionExpiresAt: familyRow.subscription_expires_at,
              calculatedAt: new Date().toISOString()
            });
          }

          if (hasLifetimeNoAds) {
            return res.json({
              adsRemoved: true,
              familyPremiumActive: false,
              familyCoreId: null,
              canShareLists: false,
              canSyncFiles: false,
              canManageFamily: false,
              tier: 'lifetime_no_ads',
              calculatedAt: new Date().toISOString()
            });
          }

          // Free tier padrão
          res.json({
            adsRemoved: false,
            familyPremiumActive: false,
            familyCoreId: null,
            canShareLists: false,
            canSyncFiles: false,
            canManageFamily: false,
            tier: 'free',
            calculatedAt: new Date().toISOString()
          });
        }
      );
    }
  );
});

// --- 2. VALIDAÇÃO DE BILLING ---

router.post('/billing/verify', (req, res) => {
  const { deviceId, receipt } = req.body;
  if (!deviceId || !receipt || !receipt.productId || !receipt.transactionId) {
    return res.status(400).json({ error: 'Dados de transação incompletos.' });
  }

  // Garantir que a conta exista
  db.run(
    'INSERT OR IGNORE INTO accounts (device_id, role) VALUES (?, ?)',
    [deviceId, 'user'],
    function (errAcc) {
      if (errAcc) return res.status(500).json({ error: errAcc.message });

      db.get('SELECT id FROM accounts WHERE device_id = ?', [deviceId], (errFind, accRow) => {
        if (errFind || !accRow) return res.status(500).json({ error: 'Erro ao identificar conta.' });

        // Salvar a compra de forma atômica
        db.run(
          `INSERT INTO purchases (account_id, product_id, transaction_id, store, status)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(transaction_id) DO UPDATE SET status = excluded.status`,
          [accRow.id, receipt.productId, receipt.transactionId, receipt.store || 'sandbox', 'valid'],
          function (errInsert) {
            if (errInsert) return res.status(500).json({ error: errInsert.message });

            res.json({
              success: true,
              verified: true,
              productId: receipt.productId,
              transactionId: receipt.transactionId
            });
          }
        );
      });
    }
  );
});

// --- 3. FAMILY CORE ---

router.post('/family/core', (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId é obrigatório.' });

  db.serialize(() => {
    db.run(
      'INSERT OR IGNORE INTO accounts (device_id, role) VALUES (?, ?)',
      [deviceId, 'family_owner']
    );

    db.get('SELECT id FROM accounts WHERE device_id = ?', [deviceId], (errAcc, accRow) => {
      if (errAcc || !accRow) return res.status(500).json({ error: 'Falha ao buscar conta.' });

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
      db.run(
        `INSERT INTO family_cores (owner_account_id, subscription_status, subscription_expires_at, max_devices)
         VALUES (?, 'active', ?, 3)`,
        [accRow.id, expiresAt],
        function (errCore) {
          if (errCore) return res.status(500).json({ error: errCore.message });
          const coreId = this.lastID;

          // Registrar o dispositivo do titular como o 1º dispositivo dos 3 permitidos
          db.run(
            `INSERT INTO family_devices (family_core_id, device_id, device_name, is_owner, status)
             VALUES (?, ?, 'Dispositivo do Titular', 1, 'active')`,
            [coreId, deviceId],
            function (errDev) {
              if (errDev) return res.status(500).json({ error: errDev.message });
              res.json({
                success: true,
                familyCoreId: coreId,
                isOwner: true,
                maxDevices: 3,
                currentDevices: 1,
                subscriptionExpiresAt: expiresAt
              });
            }
          );
        }
      );
    });
  });
});

function handleCreateInvitation(req, res) {
  const familyCoreId = req.params.coreId || req.body.familyCoreId;
  const ownerDeviceId = req.body.ownerDeviceId || req.body.deviceId;
  if (!familyCoreId || !ownerDeviceId) {
    return res.status(400).json({ error: 'familyCoreId e ownerDeviceId são obrigatórios.' });
  }

  // Verificar se o dispositivo é realmente o titular do Core
  db.get(
    `SELECT id FROM family_devices WHERE family_core_id = ? AND device_id = ? AND is_owner = 1 AND status = 'active'`,
    [familyCoreId, ownerDeviceId],
    (errOwner, ownerRow) => {
      if (errOwner) return res.status(500).json({ error: errOwner.message });
      if (!ownerRow) {
        return res.status(403).json({ error: 'Apenas o titular financeiro pode emitir convites.' });
      }

      // Checar se já atingiu o limite de 3 dispositivos
      db.get(
        `SELECT COUNT(*) as count FROM family_devices WHERE family_core_id = ? AND status = 'active'`,
        [familyCoreId],
        (errCount, countRow) => {
          if (errCount) return res.status(500).json({ error: errCount.message });
          if (countRow.count >= 3) {
            return res.status(400).json({ error: 'Limite de 3 dispositivos do Core Familiar já atingido.' });
          }

          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = '';
          for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          db.run(
            `INSERT INTO family_invitations (family_core_id, code, expires_at, is_used)
             VALUES (?, ?, ?, 0)`,
            [familyCoreId, code, expiresAt],
            function (errInv) {
              if (errInv) return res.status(500).json({ error: errInv.message });
              res.json({
                success: true,
                inviteCode: code,
                invitationCode: code,
                expiresAt,
                maxDevices: 3,
                activeDevices: countRow.count
              });
            }
          );
        }
      );
    }
  );
}

router.post('/family/invitations', handleCreateInvitation);
router.post('/family/core/:coreId/invite', handleCreateInvitation);

function handleAcceptInvitation(req, res) {
  const code = req.body.inviteCode || req.body.code;
  const { deviceId, deviceName } = req.body;
  if (!code || !deviceId) {
    return res.status(400).json({ error: 'Código e deviceId são obrigatórios.' });
  }

  db.get(
    `SELECT id, family_core_id, expires_at, is_used FROM family_invitations WHERE code = ?`,
    [code.trim().toUpperCase()],
    (errInv, inv) => {
      if (errInv) return res.status(500).json({ error: errInv.message });
      if (!inv) return res.status(404).json({ error: 'Convite não encontrado.' });
      if (inv.is_used) return res.status(400).json({ error: 'Este convite já foi utilizado.' });
      if (new Date(inv.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ error: 'Este convite expirou.' });
      }

      // Verificação atômica de limite estrito (<= 3 dispositivos)
      db.serialize(() => {
        db.get(
          `SELECT COUNT(*) as count FROM family_devices WHERE family_core_id = ? AND status = 'active'`,
          [inv.family_core_id],
          (errCount, countRow) => {
            if (errCount) return res.status(500).json({ error: errCount.message });
            if (countRow.count >= 3) {
              return res.status(400).json({ error: 'Limite de 3 dispositivos atingido para este Core Familiar.' });
            }

            db.run(
              `INSERT INTO family_devices (family_core_id, device_id, device_name, is_owner, status)
               VALUES (?, ?, ?, 0, 'active')
               ON CONFLICT(family_core_id, device_id) DO UPDATE SET status = 'active', revoked_at = NULL`,
              [inv.family_core_id, deviceId, deviceName || 'Dispositivo Familiar'],
              function (errDev) {
                if (errDev) return res.status(500).json({ error: errDev.message });

                // Marcar convite como usado
                db.run(
                  `UPDATE family_invitations SET is_used = 1, used_by_device_id = ? WHERE id = ?`,
                  [deviceId, inv.id],
                  () => {}
                );

                res.json({
                  success: true,
                  familyCoreId: inv.family_core_id,
                  totalActiveDevices: countRow.count + 1
                });
              }
            );
          }
        );
      });
    }
  );
}

router.post('/family/invitations/accept', handleAcceptInvitation);
router.post('/family/core/join', handleAcceptInvitation);



router.delete('/family/devices/:deviceId', (req, res) => {
  const targetDeviceId = req.params.deviceId;
  const { requesterDeviceId, familyCoreId } = req.body;

  if (!requesterDeviceId || !familyCoreId) {
    return res.status(400).json({ error: 'requesterDeviceId e familyCoreId são obrigatórios.' });
  }

  // Verificar se o solicitante é o titular do Core
  db.get(
    `SELECT is_owner FROM family_devices WHERE family_core_id = ? AND device_id = ? AND status = 'active'`,
    [familyCoreId, requesterDeviceId],
    (errOwner, ownerRow) => {
      if (errOwner) return res.status(500).json({ error: errOwner.message });
      if (!ownerRow || !ownerRow.is_owner) {
        return res.status(403).json({ error: 'Apenas o titular pode revogar dispositivos.' });
      }

      db.run(
        `UPDATE family_devices SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP 
         WHERE family_core_id = ? AND device_id = ?`,
        [familyCoreId, targetDeviceId],
        function (errRev) {
          if (errRev) return res.status(500).json({ error: errRev.message });
          
          const notifyCoreAccessRevoked = req.app.get('notifyCoreAccessRevoked');
          if (typeof notifyCoreAccessRevoked === 'function') {
            notifyCoreAccessRevoked(targetDeviceId, familyCoreId);
          }

          res.json({
            success: true,
            revokedDeviceId: targetDeviceId,
            changes: this.changes
          });
        }
      );
    }
  );
});

// Listar participantes do Core Familiar (apenas titular ativo)
router.get('/family/devices', (req, res) => {
  const { familyCoreId, requesterDeviceId } = req.query;
  if (!familyCoreId || !requesterDeviceId) {
    return res.status(400).json({ error: 'familyCoreId e requesterDeviceId são obrigatórios.' });
  }

  db.get(
    `SELECT is_owner FROM family_devices WHERE family_core_id = ? AND device_id = ? AND status = 'active'`,
    [familyCoreId, requesterDeviceId],
    (errOwner, ownerRow) => {
      if (errOwner) return res.status(500).json({ error: errOwner.message });
      if (!ownerRow || !ownerRow.is_owner) {
        return res.status(403).json({ error: 'Apenas o titular financeiro pode gerenciar os participantes.' });
      }

      db.all(
        `SELECT id, family_core_id, device_id, device_name, is_owner, status, authorized_at, revoked_at
         FROM family_devices
         WHERE family_core_id = ? AND status = 'active'
         ORDER BY is_owner DESC, authorized_at ASC`,
        [familyCoreId],
        (errDevices, devices) => {
          if (errDevices) return res.status(500).json({ error: errDevices.message });
          res.json({
            success: true,
            familyCoreId: Number(familyCoreId),
            devices: devices || [],
            maxDevices: 3,
            totalActive: (devices || []).length
          });
        }
      );
    }
  );
});

// Renomear participante do Core Familiar
router.put('/family/devices/:deviceId/name', (req, res) => {
  const targetDeviceId = req.params.deviceId;
  const { requesterDeviceId, familyCoreId, deviceName } = req.body;

  if (!requesterDeviceId || !familyCoreId || !deviceName || !deviceName.trim()) {
    return res.status(400).json({ error: 'requesterDeviceId, familyCoreId e deviceName são obrigatórios.' });
  }

  db.get(
    `SELECT is_owner FROM family_devices WHERE family_core_id = ? AND device_id = ? AND status = 'active'`,
    [familyCoreId, requesterDeviceId],
    (errOwner, ownerRow) => {
      if (errOwner) return res.status(500).json({ error: errOwner.message });
      if (!ownerRow || !ownerRow.is_owner) {
        return res.status(403).json({ error: 'Apenas o titular pode renomear participantes.' });
      }

      db.run(
        `UPDATE family_devices SET device_name = ? WHERE family_core_id = ? AND device_id = ? AND status = 'active'`,
        [deviceName.trim(), familyCoreId, targetDeviceId],
        function (errUp) {
          if (errUp) return res.status(500).json({ error: errUp.message });
          res.json({
            success: true,
            targetDeviceId,
            deviceName: deviceName.trim(),
            updated: this.changes
          });
        }
      );
    }
  );
});

// Cancelar renovação da assinatura do Core Familiar (Apenas titular)
// Regra: Não encerra imediatamente. Benefícios continuam até subscription_expires_at.
router.post('/family/core/:coreId/cancel', (req, res) => {
  const familyCoreId = req.params.coreId;
  const { requesterDeviceId } = req.body;

  if (!requesterDeviceId) {
    return res.status(400).json({ error: 'requesterDeviceId é obrigatório.' });
  }

  db.get(
    `SELECT is_owner FROM family_devices WHERE family_core_id = ? AND device_id = ? AND status = 'active'`,
    [familyCoreId, requesterDeviceId],
    (errOwner, ownerRow) => {
      if (errOwner) return res.status(500).json({ error: errOwner.message });
      if (!ownerRow || !ownerRow.is_owner) {
        return res.status(403).json({ error: 'Apenas o titular financeiro pode cancelar a assinatura do Core Familiar.' });
      }

      db.get('SELECT subscription_expires_at, subscription_status FROM family_cores WHERE id = ?', [familyCoreId], (errCore, core) => {
        if (errCore) return res.status(500).json({ error: errCore.message });
        if (!core) return res.status(404).json({ error: 'Core Familiar não encontrado.' });

        const now = new Date();
        const expDate = core.subscription_expires_at ? new Date(core.subscription_expires_at) : now;
        const formattedDate = expDate.toLocaleDateString('pt-BR');

        db.run(
          `UPDATE family_cores 
           SET subscription_status = 'canceled_pending_expiry', status = 'canceled_pending_expiry', canceled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [familyCoreId],
          function (errUp) {
            if (errUp) return res.status(500).json({ error: errUp.message });

            res.json({
              success: true,
              familyCoreId: Number(familyCoreId),
              status: 'canceled_pending_expiry',
              subscriptionStatus: 'canceled_pending_expiry',
              subscriptionExpiresAt: core.subscription_expires_at,
              message: `A assinatura do Core Familiar foi cancelada. Os benefícios se encerram em ${formattedDate}.`
            });
          }
        );
      });
    }
  );
});

// Reativar Core Familiar dentro da janela de retenção de 30 dias (Apenas titular)
router.post('/family/core/:coreId/reactivate', (req, res) => {
  const familyCoreId = req.params.coreId;
  const { requesterDeviceId } = req.body;

  if (!requesterDeviceId) {
    return res.status(400).json({ error: 'requesterDeviceId é obrigatório.' });
  }

  db.get(
    `SELECT is_owner FROM family_devices WHERE family_core_id = ? AND device_id = ?`,
    [familyCoreId, requesterDeviceId],
    (errOwner, ownerRow) => {
      if (errOwner) return res.status(500).json({ error: errOwner.message });
      if (!ownerRow || !ownerRow.is_owner) {
        return res.status(403).json({ error: 'Apenas o titular financeiro pode reativar o Core Familiar.' });
      }

      db.get('SELECT * FROM family_cores WHERE id = ?', [familyCoreId], (errCore, core) => {
        if (errCore) return res.status(500).json({ error: errCore.message });
        if (!core) return res.status(404).json({ error: 'Core Familiar não encontrado.' });

        const now = Date.now();
        // Verificar se expirou há mais de 30 dias (purge_at) ou já foi purgado
        if ((core.purge_at && new Date(core.purge_at).getTime() < now) || core.status === 'purged') {
          return res.status(410).json({ error: 'O Core Familiar foi permanentemente purgado após o período de retenção de 30 dias e não pode ser reativado.' });
        }

        const newExpiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

        db.run(
          `UPDATE family_cores 
           SET subscription_status = 'active', status = 'active', subscription_expires_at = ?, canceled_at = NULL, expired_at = NULL, purge_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newExpiresAt, familyCoreId],
          function (errUp) {
            if (errUp) return res.status(500).json({ error: errUp.message });

            // Reativar os dispositivos que estavam ativos antes
            db.run(
              `UPDATE family_devices SET status = 'active' WHERE family_core_id = ? AND status != 'revoked'`,
              [familyCoreId],
              () => {}
            );

            res.json({
              success: true,
              familyCoreId: Number(familyCoreId),
              status: 'active',
              subscriptionExpiresAt: newExpiresAt,
              message: 'Core Familiar reativado com sucesso!'
            });
          }
        );
      });
    }
  );
});

// Saída voluntária do membro do Core Familiar
// Regra: Titular NÃO pode sair sem cancelar a assinatura
router.post('/family/core/:coreId/leave', (req, res) => {
  const familyCoreId = req.params.coreId;
  const { requesterDeviceId } = req.body;

  if (!requesterDeviceId) {
    return res.status(400).json({ error: 'requesterDeviceId é obrigatório.' });
  }

  db.get(
    `SELECT is_owner, status FROM family_devices WHERE family_core_id = ? AND device_id = ?`,
    [familyCoreId, requesterDeviceId],
    (errDev, devRow) => {
      if (errDev) return res.status(500).json({ error: errDev.message });
      if (!devRow || devRow.status !== 'active') {
        return res.status(404).json({ error: 'Dispositivo não é membro ativo deste Core Familiar.' });
      }

      // Regra Seção 4.1: Responsável não pode sair sem cancelar
      if (devRow.is_owner) {
        return res.status(400).json({
          error: 'O titular financeiro não pode sair do Core Familiar enquanto a assinatura estiver ativa. Cancele a assinatura para encerrar o Core.'
        });
      }

      db.run(
        `UPDATE family_devices SET status = 'left', left_at = CURRENT_TIMESTAMP WHERE family_core_id = ? AND device_id = ?`,
        [familyCoreId, requesterDeviceId],
        function (errUp) {
          if (errUp) return res.status(500).json({ error: errUp.message });

          // Notifica via WebSocket revogação imediata de acesso para o aparelho que saiu
          const notifyCoreAccessRevoked = req.app.get('notifyCoreAccessRevoked');
          if (typeof notifyCoreAccessRevoked === 'function') {
            notifyCoreAccessRevoked(requesterDeviceId, familyCoreId);
          }

          res.json({
            success: true,
            message: 'Você saiu do Core Familiar com sucesso.',
            leftDeviceId: requesterDeviceId
          });
        }
      );
    }
  );
});

// Recuperação de Core pelo Responsável em Novo Aparelho (Baseado na Conta/Dispositivo)
router.post('/family/core/recover', (req, res) => {
  const { email, oldDeviceId, newDeviceId, accountId } = req.body;

  if (!newDeviceId) {
    return res.status(400).json({ error: 'newDeviceId é obrigatório para registrar o novo aparelho.' });
  }

  let accountQuery = '';
  let accountParams = [];

  if (accountId) {
    accountQuery = 'SELECT id, email, device_id FROM accounts WHERE id = ?';
    accountParams = [accountId];
  } else if (email) {
    accountQuery = 'SELECT id, email, device_id FROM accounts WHERE email = ?';
    accountParams = [email.trim().toLowerCase()];
  } else if (oldDeviceId) {
    accountQuery = 'SELECT id, email, device_id FROM accounts WHERE device_id = ?';
    accountParams = [oldDeviceId];
  } else {
    return res.status(400).json({ error: 'Informe email, accountId ou oldDeviceId para recuperar o Core.' });
  }

  db.get(accountQuery, accountParams, (errAcc, account) => {
    if (errAcc) return res.status(500).json({ error: errAcc.message });
    if (!account) {
      return res.status(404).json({ error: 'Conta do titular não encontrada.' });
    }

    // Buscar o Core ativo ou em retenção pertencente a esta conta
    db.get(
      `SELECT * FROM family_cores 
       WHERE owner_account_id = ? AND (status != 'purged' OR status IS NULL)
       ORDER BY created_at DESC LIMIT 1`,
      [account.id],
      (errCore, core) => {
        if (errCore) return res.status(500).json({ error: errCore.message });
        if (!core) {
          return res.status(404).json({ error: 'Nenhum Core Familiar associado a esta conta.' });
        }

        // Vincular o novo dispositivo como titular em family_devices
        db.run(
          `INSERT INTO family_devices (family_core_id, device_id, device_name, is_owner, status)
           VALUES (?, ?, 'Dispositivo Recuperado do Titular', 1, 'active')
           ON CONFLICT(family_core_id, device_id) DO UPDATE SET is_owner = 1, status = 'active', revoked_at = NULL`,
          [core.id, newDeviceId],
          function (errDev) {
            if (errDev) return res.status(500).json({ error: errDev.message });

            // Atualizar o device_id principal da conta se aplicável
            db.run('UPDATE accounts SET device_id = ? WHERE id = ?', [newDeviceId, account.id], () => {});

            res.json({
              success: true,
              recovered: true,
              familyCoreId: core.id,
              subscriptionStatus: core.subscription_status,
              subscriptionExpiresAt: core.subscription_expires_at,
              isOwner: true,
              message: 'Core Familiar recuperado com sucesso no novo dispositivo.'
            });
          }
        );
      }
    );
  });
});

// Consulta de Status Detalhado do Core Familiar (com contagem regressiva e aviso prévio)
router.get('/family/core/:coreId/status', (req, res) => {
  const familyCoreId = req.params.coreId;
  const deviceId = req.query.deviceId;

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId é obrigatório.' });
  }

  db.get(
    `SELECT fd.is_owner, fd.status as device_status, fc.* 
     FROM family_devices fd
     JOIN family_cores fc ON fd.family_core_id = fc.id
     WHERE fc.id = ? AND fd.device_id = ?`,
    [familyCoreId, deviceId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row || row.device_status !== 'active') {
        return res.status(403).json({ error: 'Acesso negado. Dispositivo não é membro ativo deste Core Familiar.' });
      }

      const now = Date.now();
      const expTime = row.subscription_expires_at ? new Date(row.subscription_expires_at).getTime() : 0;
      const daysRemaining = expTime > now ? Math.ceil((expTime - now) / (1000 * 60 * 60 * 24)) : 0;

      let warningMessage = null;
      if (row.subscription_status === 'canceled_pending_expiry') {
        const dateStr = new Date(row.subscription_expires_at).toLocaleDateString('pt-BR');
        if (daysRemaining <= 5 && daysRemaining > 0) {
          warningMessage = 'Os benefícios do Core Familiar se encerram em 5 dias.';
        } else {
          warningMessage = `A assinatura do Core Familiar foi cancelada. Os benefícios se encerram em ${dateStr}.`;
        }
      }

      res.json({
        success: true,
        familyCoreId: row.id,
        isOwner: Boolean(row.is_owner),
        status: row.status || row.subscription_status || 'active',
        subscriptionStatus: row.subscription_status || row.status || 'active',
        subscription_status: row.subscription_status || row.status || 'active',
        subscriptionExpiresAt: row.subscription_expires_at,
        subscription_expires_at: row.subscription_expires_at,
        canceledAt: row.canceled_at,
        canceled_at: row.canceled_at,
        daysRemaining,
        warningMessage
      });
    }
  );
});

// --- 4. B2B RETAIL OFFERS ---

router.get('/retail/offers', (req, res) => {
  const { uf, city } = req.query;
  if (!uf) {
    return res.status(400).json({ error: 'Parâmetro UF é obrigatório para consulta regional.' });
  }

  const nowIso = new Date().toISOString();
  let sql = `
    SELECT ro.*, r.trade_name as retailer_name, rs.name as store_name
    FROM retail_offers ro
    JOIN retailers r ON ro.retailer_id = r.id
    LEFT JOIN retail_stores rs ON ro.store_id = rs.id
    WHERE ro.status = 'published'
      AND ro.uf = ?
      AND datetime(ro.valid_from) <= datetime(?)
      AND datetime(ro.valid_until) >= datetime(?)
  `;
  const params = [uf.toUpperCase(), nowIso, nowIso];

  if (city && city.trim()) {
    sql += ` AND LOWER(ro.city) = LOWER(?)`;
    params.push(city.trim());
  }

  sql += ` ORDER BY ro.promo_price ASC LIMIT 50`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const formatted = (rows || []).map(r => ({
      ...r,
      is_sponsored: true,
      sponsor_badge: 'Oferta Extraordinária de Supermercado Parceiro'
    }));
    res.json({ uf, city: city || null, total: formatted.length, data: formatted });
  });
});

router.post('/retail/offers', (req, res) => {
  const {
    retailer_id,
    store_id,
    product_name,
    description,
    regular_price,
    promo_price,
    unit,
    conditions,
    valid_from,
    valid_until,
    city,
    uf,
    stock_declared
  } = req.body;

  // Validação comercial
  if (!retailer_id || !product_name || !promo_price || !valid_from || !valid_until || !uf) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  if (promo_price <= 0) {
    return res.status(400).json({ error: 'Preço promocional deve ser maior que zero.' });
  }

  if (regular_price && regular_price <= promo_price) {
    return res.status(400).json({ error: 'Preço regular deve ser maior que o preço promocional.' });
  }

  const fromTime = new Date(valid_from).getTime();
  const untilTime = new Date(valid_until).getTime();
  if (isNaN(fromTime) || isNaN(untilTime) || untilTime <= fromTime) {
    return res.status(400).json({ error: 'Datas de validade inválidas ou prazo invertido.' });
  }

  // Verificar se o varejista é aprovado
  db.get('SELECT status FROM retailers WHERE id = ?', [retailer_id], (errRet, ret) => {
    if (errRet) return res.status(500).json({ error: errRet.message });
    if (!ret || ret.status !== 'approved') {
      return res.status(403).json({ error: 'Varejista não cadastrado ou ainda não aprovado para publicação.' });
    }

    db.run(
      `INSERT INTO retail_offers 
       (retailer_id, store_id, product_name, description, regular_price, promo_price, unit, conditions, valid_from, valid_until, city, uf, stock_declared, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
      [retailer_id, store_id || null, product_name, description || null, regular_price || null, promo_price, unit || 'un', conditions || null, valid_from, valid_until, city || null, uf.toUpperCase(), stock_declared || null],
      function (errInsert) {
        if (errInsert) return res.status(500).json({ error: errInsert.message });
        res.json({
          success: true,
          offerId: this.lastID,
          status: 'published'
        });
      }
    );
  });
});

module.exports = router;
