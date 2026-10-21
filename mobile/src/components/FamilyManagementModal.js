import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const FamilyManagementModal = ({
  visible,
  onClose,
  familyCoreId,
  requesterDeviceId,
  apiBase,
  theme,
  isDarkMode
}) => {
  const [devices, setDevices] = useState([]);
  const [coreStatus, setCoreStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (visible && familyCoreId && requesterDeviceId) {
      setErrorMessage(null);
      loadDevices();
      loadCoreStatus();
    }
  }, [visible, familyCoreId, requesterDeviceId]);

  const loadCoreStatus = async () => {
    try {
      const res = await fetch(`${apiBase}/family/core/${familyCoreId}/status?deviceId=${requesterDeviceId}`);
      if (res.ok) {
        const data = await res.json();
        setCoreStatus(data);
      }
    } catch (_) {}
  };

  const loadDevices = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `${apiBase}/family/devices?familyCoreId=${familyCoreId}&requesterDeviceId=${requesterDeviceId}`
      );
      
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setErrorMessage('Não foi possível carregar os participantes no momento (Serviço temporariamente indisponível).');
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setDevices(data.devices || []);
      } else {
        setErrorMessage(data.error || 'Não foi possível carregar os participantes no momento.');
      }
    } catch (err) {
      setErrorMessage('Não foi possível carregar os participantes no momento. Verifique a conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancelar Renovação do Core Familiar',
      'Ao cancelar a renovação, os benefícios do Core e a lista compartilhada continuarão ativos até o fim do período já pago. Deseja confirmar?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar Cancelamento',
          style: 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const res = await fetch(`${apiBase}/family/core/${familyCoreId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requesterDeviceId })
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert('Cancelamento Registrado', data.message);
                loadCoreStatus();
              } else {
                Alert.alert('Erro', data.error || 'Não foi possível cancelar.');
              }
            } catch (err) {
              Alert.alert('Erro', err.message);
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleReactivateSubscription = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`${apiBase}/family/core/${familyCoreId}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterDeviceId })
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Reativação Concluída', data.message || 'Core Familiar reativado!');
        loadCoreStatus();
        loadDevices();
      } else {
        Alert.alert('Erro', data.error || 'Não foi possível reativar.');
      }
    } catch (err) {
      Alert.alert('Erro', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLeaveCore = () => {
    Alert.alert(
      'Sair do Core Familiar',
      'Tem certeza de que deseja sair voluntariamente deste Core Familiar? Você perderá o acesso à lista compartilhada e aos benefícios.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair do Core',
          style: 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const res = await fetch(`${apiBase}/family/core/${familyCoreId}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requesterDeviceId })
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert('Você saiu do Core', 'Seu dispositivo foi desconectado com sucesso.');
                onClose();
              } else {
                Alert.alert('Atenção', data.error || 'Não foi possível sair.');
              }
            } catch (err) {
              Alert.alert('Erro', err.message);
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleStartRename = (device) => {
    setEditingDeviceId(device.device_id);
    setEditingDeviceName(device.device_name || '');
  };

  const handleSaveRename = async (device) => {
    const trimmed = editingDeviceName.trim();
    if (!trimmed) {
      Alert.alert('Atenção', 'O nome do dispositivo não pode ficar vazio.');
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`${apiBase}/family/devices/${device.device_id}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterDeviceId,
          familyCoreId,
          deviceName: trimmed
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDevices(prev =>
          prev.map(d => (d.device_id === device.device_id ? { ...d, device_name: trimmed } : d))
        );
        setEditingDeviceId(null);
      } else {
        Alert.alert('Erro', data.error || 'Falha ao renomear dispositivo.');
      }
    } catch (err) {
      Alert.alert('Erro', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRevokeDevice = (device) => {
    if (device.is_owner) {
      Alert.alert('Ação Não Permitida', 'O titular financeiro não pode ser removido do Core.');
      return;
    }

    Alert.alert(
      'Revogar Acesso',
      `Deseja remover "${device.device_name || 'este participante'}" do seu Core Familiar? Ele perderá imediatamente o acesso às listas e voltará a ver anúncios.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const res = await fetch(`${apiBase}/family/devices/${device.device_id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  requesterDeviceId,
                  familyCoreId
                })
              });
              const data = await res.json();
              if (res.ok) {
                setDevices(prev => prev.filter(d => d.device_id !== device.device_id));
                Alert.alert('Acesso Revogado', 'O participante foi desconectado com sucesso.');
              } else {
                Alert.alert('Erro', data.error || 'Falha ao remover dispositivo.');
              }
            } catch (err) {
              Alert.alert('Erro', err.message);
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderSubtle }]}>
          {/* Header */}
          <View style={modalStyles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people-circle" size={26} color={theme.accentLime} style={{ marginRight: 8 }} />
              <View>
                <Text style={[modalStyles.title, { color: theme.textMain }]}>Gerenciar Participantes</Text>
                <Text style={[modalStyles.subtitle, { color: theme.textDim }]}>
                  {devices.length} de 3 celulares autorizados
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={theme.textDim} />
            </TouchableOpacity>
          </View>

          {/* Lista de Dispositivos */}
          {isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.accentLime} />
              <Text style={{ marginTop: 12, color: theme.textDim, fontSize: 13 }}>Carregando celulares autorizados...</Text>
            </View>
          ) : errorMessage ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Ionicons name="alert-circle-outline" size={36} color="#ef4444" style={{ marginBottom: 10 }} />
              <Text style={{ color: theme.textMain, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
                {errorMessage}
              </Text>
              <TouchableOpacity
                style={{
                  marginTop: 10,
                  backgroundColor: theme.accentLime,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
                onPress={loadDevices}
              >
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>Tentar Novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.device_id}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => {
                const isEditing = editingDeviceId === item.device_id;
                return (
                  <View style={[modalStyles.deviceItem, { backgroundColor: theme.cardSubBg, borderColor: theme.borderSubtle }]}>
                    <View style={modalStyles.deviceItemMain}>
                      <View style={[modalStyles.deviceIconBadge, { backgroundColor: isDarkMode ? '#1e2d27' : '#e6f7ef' }]}>
                        <Ionicons
                          name={item.is_owner ? 'shield-checkmark' : 'phone-portrait'}
                          size={18}
                          color={theme.accentLime}
                        />
                      </View>

                      <View style={{ flex: 1, marginRight: 8 }}>
                        {isEditing ? (
                          <TextInput
                            style={[modalStyles.renameInput, { color: theme.textMain, borderColor: theme.accentLime, backgroundColor: theme.cardBg }]}
                            value={editingDeviceName}
                            onChangeText={setEditingDeviceName}
                            autoFocus
                            placeholder="Nome do dispositivo"
                            placeholderTextColor={theme.textDim}
                          />
                        ) : (
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                              <Text style={[modalStyles.deviceName, { color: theme.textMain }]}>
                                {item.device_name || 'Celular do Familiar'}
                              </Text>
                              {Boolean(item.is_owner) && (
                                <View style={[modalStyles.ownerBadge, { backgroundColor: theme.accentLime }]}>
                                  <Text style={modalStyles.ownerBadgeText}>TITULAR</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[modalStyles.deviceIdText, { color: theme.textDim }]} numberOfLines={1}>
                              ID: {item.device_id}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Ações */}
                    <View style={modalStyles.deviceActions}>
                      {isEditing ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={[modalStyles.actionSaveBtn, { backgroundColor: theme.accentLime }]}
                            onPress={() => handleSaveRename(item)}
                            disabled={isUpdating}
                          >
                            <Text style={modalStyles.actionSaveBtnText}>Salvar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[modalStyles.actionCancelBtn, { borderColor: theme.borderSubtle }]}
                            onPress={() => setEditingDeviceId(null)}
                          >
                            <Text style={[modalStyles.actionCancelBtnText, { color: theme.textDim }]}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => handleStartRename(item)}
                            style={modalStyles.iconActionBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="pencil" size={17} color={theme.accentLime} />
                          </TouchableOpacity>

                          {!item.is_owner && (
                            <TouchableOpacity
                              onPress={() => handleRevokeDevice(item)}
                              style={modalStyles.iconActionBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="trash-outline" size={17} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: theme.textDim, fontSize: 13 }}>Nenhum celular conectado ainda.</Text>
                </View>
              }
            />
          )}

          {/* Painel de Status da Assinatura e Ciclo de Vida (Seção 4.4, 4.5 e 4.6) */}
          {coreStatus && (
            <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: theme.cardSubBg, borderWidth: 1, borderColor: theme.borderSubtle }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textMain }}>
                  {coreStatus.status === 'canceled_pending_expiry' ? 'Assinatura Cancelada' : 'Assinatura Ativa'}
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: coreStatus.status === 'canceled_pending_expiry' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(74, 222, 128, 0.2)' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: coreStatus.status === 'canceled_pending_expiry' ? '#f59e0b' : theme.accentLime }}>
                    {coreStatus.status === 'canceled_pending_expiry' ? 'PENDENTE DE TÉRMINO' : 'RENOVAÇÃO ATIVA'}
                  </Text>
                </View>
              </View>

              {coreStatus.warningMessage && (
                <Text style={{ fontSize: 12, color: '#f59e0b', marginTop: 6, lineHeight: 16 }}>
                  {coreStatus.warningMessage}
                </Text>
              )}

              {/* Botões de Ação para o Titular */}
              {coreStatus.isOwner ? (
                <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
                  {coreStatus.status === 'canceled_pending_expiry' ? (
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.accentLime, alignItems: 'center' }}
                      onPress={handleReactivateSubscription}
                      disabled={isUpdating}
                    >
                      <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>Reativar Assinatura</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.5)', alignItems: 'center' }}
                      onPress={handleCancelSubscription}
                      disabled={isUpdating}
                    >
                      <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 12 }}>Cancelar Renovação</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                /* Botão de Saída Voluntária para Membro */
                <View style={{ marginTop: 10 }}>
                  <TouchableOpacity
                    style={{ paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.6)', alignItems: 'center' }}
                    onPress={handleLeaveCore}
                    disabled={isUpdating}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>Sair deste Core Familiar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Dica do Rodapé */}
          <View style={[modalStyles.footerNotice, { borderTopColor: theme.borderSubtle }]}>
            <Text style={[modalStyles.footerNoticeText, { color: theme.textDim }]}>
              💡 Como titular financeiro, você pode autorizar até 2 outros familiares gerando QR Codes de convite.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  deviceItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
  },
  ownerBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ownerBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },
  deviceIdText: {
    fontSize: 11,
    marginTop: 2,
  },
  deviceActions: {
    marginLeft: 8,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  actionSaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionSaveBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
  },
  actionCancelBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionCancelBtnText: {
    fontSize: 12,
  },
  iconActionBtn: {
    padding: 6,
  },
  footerNotice: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerNoticeText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
