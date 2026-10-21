import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const LAST_PURGE_STORAGE_KEY = '@mercadofacil_last_flyers_purge';

/**
 * Utilitário da rotina de limpeza de encartes (Sunday Purge Routine).
 * Regras:
 * - Se a hora atual for posterior a Domingo às 22:00 (Local Time) em relação ao último purge executado,
 *   executa o expurgo de encartes/ofertas e limpa os arquivos/blobs em cache do dispositivo.
 * - Garante que o dispositivo móvel preserve o armazenamento livre e não acumule PDFs/imagens antigas.
 * 
 * @param {string} apiBase URL base da API para deletar no banco local/endpoint
 * @returns {Promise<{ purged: boolean, reason?: string }>}
 */
export async function purgeOldFlyers(apiBase, deviceId = null) {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const hours = now.getHours();

    const lastPurgeStr = await AsyncStorage.getItem(LAST_PURGE_STORAGE_KEY);
    const lastPurgeDate = lastPurgeStr ? new Date(lastPurgeStr) : null;

    // Calcular o timestamp do Domingo mais recente às 22:00
    const mostRecentSunday22 = new Date(now);
    mostRecentSunday22.setDate(now.getDate() - dayOfWeek);
    mostRecentSunday22.setHours(22, 0, 0, 0);

    // Se hoje é domingo, mas ainda não deu 22h, o domingo relevante é o anterior
    if (dayOfWeek === 0 && hours < 22) {
      mostRecentSunday22.setDate(mostRecentSunday22.getDate() - 7);
    }

    // Se já foi feita uma limpeza após o último domingo 22h, não precisa limpar de novo
    if (lastPurgeDate && lastPurgeDate.getTime() >= mostRecentSunday22.getTime()) {
      return { purged: false, reason: 'already_purged_for_this_cycle' };
    }

    // Limpar cache local de arquivos do sistema (blobs / PDFs / imagens em cache)
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        for (const file of files) {
          if (
            file.endsWith('.pdf') ||
            file.endsWith('.jpg') ||
            file.endsWith('.jpeg') ||
            file.endsWith('.png') ||
            file.startsWith('flyer_')
          ) {
            await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true }).catch(() => {});
          }
        }
      }
    } catch (fsErr) {
      console.log('[PURGE LOCAL] Erro ao limpar cache de arquivos:', fsErr.message);
    }

    // Limpar encartes e ofertas no armazenamento (escopo estritamente do aparelho)
    if (apiBase) {
      try {
        const deleteUrl = deviceId
          ? `${apiBase}/flyers?deviceId=${encodeURIComponent(deviceId)}`
          : `${apiBase}/flyers`;
        const headers = deviceId ? { 'x-device-id': String(deviceId) } : {};
        await fetch(deleteUrl, { method: 'DELETE', headers });
      } catch (apiErr) {
        console.log('[PURGE LOCAL] Erro ao chamar DELETE /flyers:', apiErr.message);
      }
    }

    // Gravar timestamp da limpeza realizada
    await AsyncStorage.setItem(LAST_PURGE_STORAGE_KEY, now.toISOString());
    console.log('[PURGE LOCAL] Rotina de Domingo 22h executada com sucesso.');

    return { purged: true };
  } catch (err) {
    console.log('[PURGE LOCAL] Falha geral na rotina purgeOldFlyers:', err.message);
    return { purged: false, error: err.message };
  }
}
