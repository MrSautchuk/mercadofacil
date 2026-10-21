/**
 * MercadoFácil - Family Core Shared List Synchronization Engine
 * Implementação da Seção 14, 15, 16, 17 e 20 da especificação:
 * - Persistência no Backend (ADR-001)
 * - Versionamento monotônico (Seção 16)
 * - Idempotência estrita por operation_id (Seção 14.2)
 * - Mesclagem automática de itens duplicados offline (Seção 17.3)
 * - Detecção e relato de conflitos concorrentes (Seção 17.1)
 * - Notificações em tempo real via WebSocket (Seção 15)
 * - Validação rigorosa de autorização e ciclo de vida (Seção 20)
 */

const express = require('express');
const router = express.Router();
const db = require('./database');

// Helper para sanitizar nomes de produto para mesclagem de duplicados
function normalizeProductName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Validador de Autorização do Core Familiar (Server-Side Membership Gate)
 */
function checkCoreAuthorization(familyCoreId, deviceId, callback) {
  if (!familyCoreId || !deviceId) {
    return callback({ status: 400, error: 'familyCoreId e deviceId são obrigatórios.' });
  }

  // 1. Verificar existência e ciclo de vida do Core
  db.get('SELECT * FROM family_cores WHERE id = ?', [familyCoreId], (errCore, core) => {
    if (errCore) return callback({ status: 500, error: errCore.message });
    if (!core) return callback({ status: 404, error: 'Core Familiar não encontrado.' });

    const now = Date.now();
    const expTime = core.subscription_expires_at ? new Date(core.subscription_expires_at).getTime() : 0;
    const subStatus = core.subscription_status || core.status || 'active';

    // Se passou do prazo e ainda não estava marcado como expired
    if (expTime > 0 && expTime <= now && subStatus !== 'expired' && subStatus !== 'purged') {
      const purgeAt = new Date(expTime + 30 * 24 * 60 * 60 * 1000).toISOString();
      db.run(
        `UPDATE family_cores SET subscription_status = 'expired', status = 'expired', expired_at = ?, purge_at = ? WHERE id = ?`,
        [new Date(expTime).toISOString(), purgeAt, familyCoreId]
      );
      return callback({
        status: 403,
        code: 'CORE_EXPIRED',
        error: 'A assinatura do Core Familiar expirou. Acesso à lista compartilhada bloqueado.'
      });
    }

    if (subStatus === 'expired' || subStatus === 'purged') {
      return callback({
        status: 403,
        code: 'CORE_EXPIRED',
        error: 'Core Familiar expirado ou purgado. Acesso à lista compartilhada bloqueado.'
      });
    }

    // 2. Verificar se o dispositivo é membro ativo
    db.get(
      `SELECT * FROM family_devices WHERE family_core_id = ? AND device_id = ?`,
      [familyCoreId, deviceId],
      (errDev, member) => {
        if (errDev) return callback({ status: 500, error: errDev.message });
        if (!member) {
          return callback({
            status: 403,
            code: 'NOT_MEMBER',
            error: 'Dispositivo não pertence a este Core Familiar.'
          });
        }
        if (member.status === 'revoked') {
          return callback({
            status: 403,
            code: 'ACCESS_REVOKED',
            error: 'O acesso deste dispositivo ao Core Familiar foi revogado pelo titular.'
          });
        }
        if (member.status === 'left') {
          return callback({
            status: 403,
            code: 'MEMBER_LEFT',
            error: 'Este dispositivo saiu voluntariamente do Core Familiar.'
          });
        }
        if (member.status !== 'active') {
          return callback({
            status: 403,
            code: 'INACTIVE_MEMBER',
            error: 'Membro inativo no Core Familiar.'
          });
        }

        callback(null, { core, member });
      }
    );
  });
}

/**
 * GET /api/family/core/:coreId/list
 * Retorna os itens compartilhados do Core Familiar e a versão monotônica atual.
 */
router.get('/family/core/:coreId/list', (req, res) => {
  const familyCoreId = req.params.coreId;
  const deviceId = req.query.deviceId || req.headers['x-device-id'];

  checkCoreAuthorization(familyCoreId, deviceId, (authErr, authData) => {
    if (authErr) {
      return res.status(authErr.status).json({ error: authErr.error, code: authErr.code });
    }

    const { core } = authData;
    db.all(
      `SELECT * FROM items WHERE family_core_id = ? ORDER BY purchased ASC, created_at DESC`,
      [familyCoreId],
      (err, items) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          success: true,
          familyCoreId: Number(familyCoreId),
          currentVersion: core.list_version || 0,
          items: items || []
        });
      }
    );
  });
});

/**
 * GET /api/family/core/:coreId/list/changes
 * Sincronização incremental: retorna versão atual e alterações desde afterVersion.
 */
router.get('/family/core/:coreId/list/changes', (req, res) => {
  const familyCoreId = req.params.coreId;
  const deviceId = req.query.deviceId || req.headers['x-device-id'];
  const afterVersion = parseInt(req.query.afterVersion, 10) || 0;

  checkCoreAuthorization(familyCoreId, deviceId, (authErr, authData) => {
    if (authErr) {
      return res.status(authErr.status).json({ error: authErr.error, code: authErr.code });
    }

    const { core } = authData;
    const currentVersion = core.list_version || 0;

    // Se o cliente já está na versão atual, responde rapidamente
    if (afterVersion >= currentVersion) {
      return res.json({
        success: true,
        familyCoreId: Number(familyCoreId),
        currentVersion,
        upToDate: true,
        items: []
      });
    }

    // Itens que mudaram após a versão informada (ou todos os itens se afterVersion for 0)
    const sql = afterVersion === 0
      ? `SELECT * FROM items WHERE family_core_id = ? ORDER BY purchased ASC, created_at DESC`
      : `SELECT * FROM items WHERE family_core_id = ? AND version > ? ORDER BY purchased ASC, created_at DESC`;
    const params = afterVersion === 0 ? [familyCoreId] : [familyCoreId, afterVersion];

    db.all(sql, params, (err, items) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        success: true,
        familyCoreId: Number(familyCoreId),
        currentVersion,
        upToDate: false,
        items: items || []
      });
    });
  });
});

/**
 * POST /api/family/core/:coreId/list/operations
 * Processador central de fila offline-first e sincronização monotônica.
 * Suporta idempotência estrita, mesclagem de produtos duplicados e detecção de conflitos.
 */
router.post('/family/core/:coreId/list/operations', (req, res) => {
  const familyCoreId = Number(req.params.coreId);
  const { deviceId, operations } = req.body;

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ error: 'Nenhuma operação fornecida na requisição.' });
  }

  checkCoreAuthorization(familyCoreId, deviceId, async (authErr, authData) => {
    if (authErr) {
      return res.status(authErr.status).json({ error: authErr.error, code: authErr.code });
    }

    const { core } = authData;
    let listVersion = core.list_version || 0;

    const processedOps = [];
    const conflicts = [];
    const mergedItems = [];
    const affectedItems = [];

    // Processamento sequencial assíncrono para garantir integridade estrita
    for (const op of operations) {
      const operationId = op.operationId || op.operation_id;
      const type = op.type;
      const item = op.item || {};
      const baseVersion = op.baseVersion !== undefined ? op.baseVersion : (op.base_version !== undefined ? op.base_version : 0);
      if (!operationId || !type) continue;

      let opResultItem = null;

      // 1. Idempotência: verificar se operationId já foi processada
      const existingOp = await new Promise((resolve) => {
        db.get('SELECT id, status FROM sync_operations WHERE operation_id = ?', [operationId], (err, row) => {
          resolve(row);
        });
      });

      if (existingOp) {
        processedOps.push({
          operationId,
          operation_id: operationId,
          status: 'already_processed',
          idempotent: true,
          applied: true,
          serverVersion: listVersion
        });
        continue;
      }

      listVersion += 1;

      if (type === 'ADD_ITEM') {
        const itemName = (item.name || '').trim();
        const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
        const brandPref = item.brand_preference ? item.brand_preference.trim() : null;
        const normalized = normalizeProductName(itemName);

        // Seção 17.3: Mesclagem automática de duplicados adicionados simultaneamente
        const existingItem = await new Promise((resolve) => {
          db.all(
            `SELECT * FROM items WHERE family_core_id = ?`,
            [familyCoreId],
            (err, rows) => {
              if (err || !rows) return resolve(null);
              const found = rows.find(r => normalizeProductName(r.name) === normalized);
              resolve(found || null);
            }
          );
        });

        if (existingItem) {
          // Mescla somando as quantidades
          const newQty = (existingItem.quantity || 1) + quantity;
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE items 
               SET quantity = ?, version = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [newQty, listVersion, existingItem.id],
              function (err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          mergedItems.push({
            itemId: existingItem.id,
            name: itemName,
            previousQuantity: existingItem.quantity,
            addedQuantity: quantity,
            mergedQuantity: newQty
          });

          opResultItem = { id: existingItem.id, name: itemName, quantity: newQty, version: listVersion };
          affectedItems.push({ ...existingItem, quantity: newQty, version: listVersion });
        } else {
          // Inserção normal de novo item
          const newId = await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO items (name, quantity, brand_preference, family_core_id, device_id, purchased, is_active, version, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, 1, ?, CURRENT_TIMESTAMP)`,
              [itemName, quantity, brandPref, familyCoreId, deviceId, listVersion],
              function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });

          opResultItem = {
            id: newId,
            name: itemName,
            quantity,
            brand_preference: brandPref,
            family_core_id: familyCoreId,
            device_id: deviceId,
            purchased: 0,
            is_active: 1,
            version: listVersion
          };
          affectedItems.push(opResultItem);
        }
      } else if (type === 'UPDATE_ITEM') {
        const itemId = parseInt(item.id, 10);
        if (!itemId) continue;

        const currentDbItem = await new Promise((resolve) => {
          db.get('SELECT * FROM items WHERE id = ? AND family_core_id = ?', [itemId, familyCoreId], (err, row) => {
            resolve(row);
          });
        });

        if (currentDbItem) {
          const clientQty = item.quantity !== undefined ? parseInt(item.quantity, 10) : currentDbItem.quantity;

          // Seção 17.1: Detecção de conflito concorrente
          if (
            baseVersion < currentDbItem.version &&
            currentDbItem.quantity !== clientQty &&
            item.quantity !== undefined
          ) {
            conflicts.push({
              type: 'QUANTITY_CONFLICT',
              itemId,
              name: currentDbItem.name,
              serverQuantity: currentDbItem.quantity,
              clientQuantity: clientQty,
              message: `A quantidade de ${currentDbItem.name} foi alterada por outro integrante.`
            });
          }

          const newName = item.name !== undefined ? item.name.trim() : currentDbItem.name;
          const newQty = clientQty;
          const newBrand = item.brand_preference !== undefined ? item.brand_preference : currentDbItem.brand_preference;
          const newPurchased = item.purchased !== undefined ? (item.purchased ? 1 : 0) : currentDbItem.purchased;

          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE items 
               SET name = ?, quantity = ?, brand_preference = ?, purchased = ?, is_active = ?, version = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [newName, newQty, newBrand, newPurchased, newPurchased ? 0 : 1, listVersion, itemId],
              function (err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          opResultItem = {
            ...currentDbItem,
            name: newName,
            quantity: newQty,
            brand_preference: newBrand,
            purchased: newPurchased,
            is_active: newPurchased ? 0 : 1,
            version: listVersion
          };
          affectedItems.push(opResultItem);
        }
      } else if (type === 'TOGGLE_PURCHASE') {
        const itemId = parseInt(item.id, 10);
        if (!itemId) continue;

        const currentDbItem = await new Promise((resolve) => {
          db.get('SELECT * FROM items WHERE id = ? AND family_core_id = ?', [itemId, familyCoreId], (err, row) => resolve(row));
        });

        if (currentDbItem) {
          const newPurchased = item.purchased !== undefined ? (item.purchased ? 1 : 0) : (currentDbItem.purchased ? 0 : 1);
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE items SET purchased = ?, is_active = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [newPurchased, newPurchased ? 0 : 1, listVersion, itemId],
              function (err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          opResultItem = {
            ...currentDbItem,
            purchased: newPurchased,
            is_active: newPurchased ? 0 : 1,
            version: listVersion
          };
          affectedItems.push(opResultItem);
        }
      } else if (type === 'DELETE_ITEM') {
        const itemId = parseInt(item.id, 10);
        if (itemId) {
          await new Promise((resolve, reject) => {
            db.run('DELETE FROM items WHERE id = ? AND family_core_id = ?', [itemId, familyCoreId], function (err) {
              if (err) reject(err);
              else resolve();
            });
          });
          opResultItem = { id: itemId, deleted: true, version: listVersion };
          affectedItems.push(opResultItem);
        }
      }

      // Registrar operação no histórico de sincronização
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO sync_operations (operation_id, family_core_id, device_id, operation_type, entity_id, payload, client_version, server_version, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processed')`,
          [
            operationId,
            familyCoreId,
            deviceId,
            type,
            String(item.id || ''),
            JSON.stringify(item),
            baseVersion,
            listVersion
          ],
          () => resolve()
        );
      });

      processedOps.push({
        operationId,
        operation_id: operationId,
        status: 'processed',
        applied: true,
        serverVersion: listVersion,
        item: opResultItem || item
      });
    }

    // Atualizar a versão monotônica do Core Familiar
    await new Promise((resolve) => {
      db.run(
        `UPDATE family_cores SET list_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [listVersion, familyCoreId],
        () => resolve()
      );
    });

    // Notificar os outros integrantes em tempo real via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`family_${familyCoreId}`).emit('LIST_CHANGED', {
        familyCoreId,
        version: listVersion,
        sourceDeviceId: deviceId,
        affectedItems,
        mergedItems,
        conflicts
      });
      io.to(`family_${familyCoreId}`).emit('list_updated', {
        familyCoreId,
        version: listVersion,
        sourceDeviceId: deviceId
      });
    }

    res.json({
      success: true,
      familyCoreId,
      currentVersion: listVersion,
      serverVersion: listVersion,
      processedOperations: processedOps,
      results: processedOps,
      conflicts,
      mergedItems,
      affectedItems
    });
  });
});

module.exports = router;
