/**
 * MercadoFácil - Family Core Domain Service
 * 
 * Regras do Core Familiar:
 * 1. Exatamente 1 Responsável Financeiro (administrador do Core).
 * 2. Limite estrito de até 3 dispositivos autorizados no total (incluindo o do responsável).
 * 3. Associação segura via Códigos de Convite temporários (6 caracteres alfanuméricos, uso único, expira em 24h).
 * 4. Revogação de acesso imediata para dispositivos removidos.
 * 5. Se a assinatura expirar, o acesso premium deixa de renovar, mas NUNCA apaga dados das listas existentes.
 */

export const MAX_FAMILY_DEVICES = 3;
export const INVITATION_EXPIRATION_HOURS = 24;

export class FamilyCoreService {
  /**
   * Valida se um novo dispositivo pode ser adicionado ao Core Familiar.
   * Operação atômica que checa o limite de 3 dispositivos.
   * 
   * @param {Object} familyCore
   * @param {string} newDeviceId
   * @returns {{ canAdd: boolean, reason?: string }}
   */
  static canAddDevice(familyCore, newDeviceId) {
    if (!familyCore) {
      return { canAdd: false, reason: 'family_core_not_found' };
    }

    const activeDevices = (familyCore.authorizedDevices || []).filter(d => d.status === 'active');

    // Verificar se o dispositivo já está ativo
    if (activeDevices.some(d => d.deviceId === newDeviceId)) {
      return { canAdd: false, reason: 'device_already_active' };
    }

    // Verificar limite máximo de 3 dispositivos
    if (activeDevices.length >= MAX_FAMILY_DEVICES) {
      return { 
        canAdd: false, 
        reason: 'max_devices_exceeded',
        currentCount: activeDevices.length,
        limit: MAX_FAMILY_DEVICES
      };
    }

    return { canAdd: true, currentCount: activeDevices.length };
  }

  /**
   * Gera um código de convite de curta validade e uso único.
   * @param {string} familyCoreId
   * @param {string} ownerDeviceId
   * @returns {{ code: string, expiresAt: string }}
   */
  static generateInvitationCode(familyCoreId, ownerDeviceId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem O, 0, I, 1 para evitar confusão visual
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const expiresAt = new Date(Date.now() + INVITATION_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString();

    return {
      familyCoreId,
      code,
      expiresAt,
      isUsed: false,
      createdBy: ownerDeviceId
    };
  }

  /**
   * Valida um convite antes de aceitar.
   * @param {Object} invitation
   * @param {Date} [now=new Date()]
   */
  static validateInvitation(invitation, now = new Date()) {
    if (!invitation) return { valid: false, reason: 'invalid_invitation' };
    if (invitation.isUsed) return { valid: false, reason: 'invitation_already_used' };

    const expTime = new Date(invitation.expiresAt).getTime();
    if (now.getTime() > expTime) {
      return { valid: false, reason: 'invitation_expired' };
    }

    return { valid: true };
  }
}
