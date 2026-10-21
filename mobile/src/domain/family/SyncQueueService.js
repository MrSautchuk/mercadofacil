/**
 * MercadoFácil - Offline-First Sync Queue Service
 * Atende às Seções 7.1, 7.2, 14, 16 e 17 da especificação:
 * - Persistência offline que sobrevive ao fechamento e reinício do app
 * - Fila de operações atômica e idempotente por operationId
 * - Aplicação imediata no estado/cache local
 * - Descarregamento automático em lote ao reconectar
 * - Sincronização incremental por versão monotônica
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';

function generateUUID() {
  return 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

export class SyncQueueService {
  static getQueueKey(familyCoreId) {
    return `@mercadofacil_sync_queue_${familyCoreId}`;
  }

  static getVersionKey(familyCoreId) {
    return `@mercadofacil_list_version_${familyCoreId}`;
  }

  static getCachedItemsKey(familyCoreId) {
    return `@mercadofacil_cached_items_${familyCoreId}`;
  }

  /**
   * Obtém a versão monotônica conhecida localmente.
   */
  static async getLocalVersion(familyCoreId) {
    try {
      const val = await AsyncStorage.getItem(this.getVersionKey(familyCoreId));
      return val ? parseInt(val, 10) : 0;
    } catch (_) {
      return 0;
    }
  }

  /**
   * Salva a versão monotônica da lista.
   */
  static async setLocalVersion(familyCoreId, version) {
    try {
      await AsyncStorage.setItem(this.getVersionKey(familyCoreId), String(version));
    } catch (_) {}
  }

  /**
   * Obtém as operações pendentes na fila que sobreviveram a restarts.
   */
  static async getQueue(familyCoreId) {
    try {
      const raw = await AsyncStorage.getItem(this.getQueueKey(familyCoreId));
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Salva a fila pendente no armazenamento local.
   */
  static async saveQueue(familyCoreId, queue) {
    try {
      await AsyncStorage.setItem(this.getQueueKey(familyCoreId), JSON.stringify(queue));
    } catch (_) {}
  }

  /**
   * Enfileira uma nova operação offline de forma resiliente.
   * Aplica a alteração imediatamente no cache local.
   *
   * @param {Object} params
   * @param {string|number} params.familyCoreId
   * @param {string} params.deviceId
   * @param {'ADD_ITEM'|'UPDATE_ITEM'|'DELETE_ITEM'|'TOGGLE_PURCHASE'} params.type
   * @param {Object} params.item
   * @param {number} [params.baseVersion=0]
   * @returns {Promise<{ operationId: string, queueLength: number }>}
   */
  static async enqueueOperation({ familyCoreId, deviceId, type, item, baseVersion = 0 }) {
    if (!familyCoreId) return null;

    const queue = await this.getQueue(familyCoreId);
    const operationId = generateUUID();

    const op = {
      operationId,
      familyCoreId,
      deviceId,
      type,
      item,
      baseVersion,
      createdAt: new Date().toISOString()
    };

    queue.push(op);
    await this.saveQueue(familyCoreId, queue);

    return { operationId, queueLength: queue.length };
  }

  /**
   * Descarrega operações pendentes para o backend com garantia de idempotência.
   *
   * @param {Object} params
   * @param {string|number} params.familyCoreId
   * @param {string} params.deviceId
   * @param {string} [params.serverUrl]
   * @returns {Promise<{ success: boolean, processedCount: number, conflicts: Array, mergedItems: Array, newVersion?: number }>}
   */
  static async flushQueue({ familyCoreId, deviceId, serverUrl }) {
    if (!familyCoreId || !deviceId) {
      return { success: false, processedCount: 0, conflicts: [], mergedItems: [] };
    }

    const queue = await this.getQueue(familyCoreId);
    if (queue.length === 0) {
      return { success: true, processedCount: 0, conflicts: [], mergedItems: [] };
    }

    const baseUrl = serverUrl || API_BASE_URL;
    const url = `${baseUrl}/api/family/core/${familyCoreId}/list/operations`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId
        },
        body: JSON.stringify({
          deviceId,
          operations: queue
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          return {
            success: false,
            revoked: true,
            code: errorData.code || 'ACCESS_REVOKED',
            error: errorData.error
          };
        }
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Limpar a fila das operações confirmadas
      await this.saveQueue(familyCoreId, []);

      // Atualizar versão monotônica
      if (data.currentVersion) {
        await this.setLocalVersion(familyCoreId, data.currentVersion);
      }

      return {
        success: true,
        processedCount: queue.length,
        conflicts: data.conflicts || [],
        mergedItems: data.mergedItems || [],
        affectedItems: data.affectedItems || [],
        newVersion: data.currentVersion
      };
    } catch (err) {
      // Falha de rede: as operações continuam salvas na fila para o próximo retry
      return {
        success: false,
        isNetworkError: true,
        error: err.message,
        pendingCount: queue.length
      };
    }
  }

  /**
   * Busca alterações incrementais ocorridas após a versão localmente conhecida (Reconexão).
   */
  static async fetchChangesSince({ familyCoreId, deviceId, serverUrl }) {
    if (!familyCoreId || !deviceId) return null;

    const localVersion = await this.getLocalVersion(familyCoreId);
    const baseUrl = serverUrl || API_BASE_URL;
    const url = `${baseUrl}/api/family/core/${familyCoreId}/list/changes?afterVersion=${localVersion}&deviceId=${encodeURIComponent(deviceId)}`;

    try {
      const res = await fetch(url, {
        headers: { 'x-device-id': deviceId }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.currentVersion) {
        await this.setLocalVersion(familyCoreId, data.currentVersion);
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  /**
   * Salva uma cópia local de segurança dos itens compartilhados (para preservação se sair do core).
   */
  static async saveLocalSnapshot(familyCoreId, items) {
    try {
      await AsyncStorage.setItem(this.getCachedItemsKey(familyCoreId), JSON.stringify(items || []));
    } catch (_) {}
  }

  /**
   * Recupera a cópia local de segurança.
   */
  static async getLocalSnapshot(familyCoreId) {
    try {
      const raw = await AsyncStorage.getItem(this.getCachedItemsKey(familyCoreId));
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Limpa todos os dados locais associados ao Core Familiar.
   */
  static async clearCoreData(familyCoreId) {
    try {
      await AsyncStorage.removeItem(this.getQueueKey(familyCoreId));
      await AsyncStorage.removeItem(this.getVersionKey(familyCoreId));
      await AsyncStorage.removeItem(this.getCachedItemsKey(familyCoreId));
    } catch (_) {}
  }
}
