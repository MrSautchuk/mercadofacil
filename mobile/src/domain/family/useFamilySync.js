import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { SOCKET_SERVER_URL } from '../../config';

/**
 * Hook para gerenciar conexão WebSocket do Core Familiar em tempo real.
 * Atende às Seções 15, 16 e 18 da especificação.
 *
 * @param {Object} params
 * @param {string} params.deviceId
 * @param {string|null} params.familyCoreId
 * @param {Function} [params.onListUpdated]
 * @param {Function} [params.onListChanged]
 * @param {Function} [params.onCoreAccessRevoked]
 * @param {Function} [params.onItemUpdated]
 * @param {Function} [params.onItemOfferUpdated]
 * @param {Function} [params.onReconnect]
 */
export function useFamilySync({
  deviceId,
  familyCoreId,
  serverUrl,
  onListUpdated,
  onListChanged,
  onCoreAccessRevoked,
  onItemUpdated,
  onItemOfferUpdated,
  onReconnect
}) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!deviceId) return;

    const targetUrl = serverUrl || SOCKET_SERVER_URL;
    const socket = io(targetUrl, {
      transports: ['websocket'],
      query: {
        deviceId,
        familyCoreId: familyCoreId || ''
      },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (familyCoreId) {
        socket.emit('join_family', { familyCoreId });
        socket.emit('join_room', { room: `family_${familyCoreId}` });
      }
      socket.emit('join_room', { room: `device_${deviceId}` });

      if (onReconnect) {
        onReconnect();
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    socket.on('LIST_CHANGED', (data) => {
      if (onListChanged) {
        onListChanged(data);
      }
    });

    socket.on('list_updated', (data) => {
      if (onListUpdated) {
        onListUpdated(data);
      }
    });

    socket.on('core_access_revoked', (data) => {
      if (onCoreAccessRevoked) {
        onCoreAccessRevoked(data);
      }
    });

    socket.on('item_updated', (data) => {
      if (onItemUpdated) {
        onItemUpdated(data);
      }
    });

    socket.on('item_offer_updated', (data) => {
      if (onItemOfferUpdated) {
        onItemOfferUpdated(data);
      }
    });

    return () => {
      if (familyCoreId) {
        socket.emit('leave_family', { familyCoreId });
      }
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [deviceId, familyCoreId, serverUrl]);

  /**
   * Emite uma atualização de oferta de um item para o Core Familiar via WebSocket.
   * @param {string|number} itemId
   * @param {Object} offerSnapshot
   */
  const emitItemOfferUpdated = (itemId, offerSnapshot) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('item_offer_updated', {
        familyCoreId,
        deviceId,
        itemId,
        offerSnapshot
      });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    emitItemOfferUpdated
  };
}
