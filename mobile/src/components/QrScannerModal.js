import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_SIZE = Math.min(SCREEN_WIDTH * 0.72, 260);

export const QrScannerModal = ({ visible, onClose, onScan, theme, isDarkMode }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  // Animação contínua da mira laser para indicar foco e leitura ativa
  const [scanAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    let timer;
    if (visible) {
      // Pequeno atraso seguro (180ms) para que a janela nativa do Dialog Android complete a transição
      // Isso impede que o SurfaceView do CameraX tente se vincular antes de ter dimensões válidas
      timer = setTimeout(() => {
        setIsCameraActive(true);
      }, 180);

      const animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();

      return () => {
        clearTimeout(timer);
        animLoop.stop();
      };
    } else {
      setIsCameraActive(false);
      setTorchEnabled(false);
      setScanned(false);
      scanAnim.setValue(0);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [visible]);

  const handleBarcodeScanned = ({ data }) => {
    if (scanned || !data) return;
    setScanned(true);
    onScan(data.trim());
    setTimeout(() => setScanned(false), 2000);
  };

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, SCAN_SIZE - 6],
  });

  const accentColor = theme?.accentLime || '#10B981';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent={true}
      hardwareAccelerated={true}
      onRequestClose={onClose}
      onShow={() => {
        // Callback nativo quando a janela do Modal está 100% pronta
        setIsCameraActive(true);
      }}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* FEED NATIVO DA CÂMERA (Montado apenas quando a janela está estabilizada) */}
        {permission?.granted && visible && isCameraActive && (
          <View style={styles.cameraContainer}>
            <CameraView
              key={`cameraview_active_${isCameraActive}`}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchEnabled}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />
          </View>
        )}

        {/* HEADER SUPERIOR COM BOTÃO DE LANTERNA E FECHAR */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Escanear QR Code Familiar</Text>
          <View style={styles.headerActions}>
            {permission?.granted && isCameraActive && (
              <TouchableOpacity
                onPress={() => setTorchEnabled(prev => !prev)}
                style={[
                  styles.iconBtn,
                  torchEnabled && { backgroundColor: 'rgba(255,255,255,0.25)' }
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={torchEnabled ? 'flash' : 'flash-off'}
                  size={20}
                  color={torchEnabled ? accentColor : '#fff'}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ESTADOS DE CARREGAMENTO E PERMISSÃO */}
        {!permission ? (
          <View style={styles.centerFallback}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={[styles.infoText, { color: '#aaa', marginTop: 14 }]}>
              Inicializando câmera...
            </Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centerFallback}>
            <Ionicons name="camera-outline" size={64} color="#aaa" />
            <Text style={[styles.infoText, { color: '#fff', marginVertical: 16 }]}>
              Precisamos de acesso à câmera para escanear o QR Code de convite da sua família.
            </Text>
            <TouchableOpacity
              style={[styles.permButton, { backgroundColor: accentColor }]}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.permButtonText}>Conceder Permissão</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* MÁSCARA ÓPTICA E MIRA VISUAL CENTRALIZADA */
          <View style={styles.overlayContainer} pointerEvents="box-none">
            {/* Máscara Superior escurecida */}
            <View style={styles.maskTop} />

            {/* Linha Central: Máscara Esquerda + Viewfinder Transparente + Máscara Direita */}
            <View style={styles.middleRow}>
              <View style={styles.maskSide} />

              <View style={[styles.viewfinder, { width: SCAN_SIZE, height: SCAN_SIZE }]}>
                {/* 4 Cantoneiras de Mira (Brackets de Foco) */}
                <View style={[styles.corner, styles.cornerTL, { borderColor: accentColor }]} />
                <View style={[styles.corner, styles.cornerTR, { borderColor: accentColor }]} />
                <View style={[styles.corner, styles.cornerBL, { borderColor: accentColor }]} />
                <View style={[styles.corner, styles.cornerBR, { borderColor: accentColor }]} />

                {/* Linha Laser Animada */}
                <Animated.View
                  style={[
                    styles.laserLine,
                    {
                      backgroundColor: accentColor,
                      transform: [{ translateY }],
                    },
                  ]}
                />
              </View>

              <View style={styles.maskSide} />
            </View>

            {/* Máscara Inferior escurecida com Instruções */}
            <View style={styles.maskBottom}>
              <View style={styles.hintBadge}>
                <Ionicons name="qr-code-outline" size={16} color={accentColor} style={{ marginRight: 8 }} />
                <Text style={styles.scanHint}>
                  {scanned ? 'QR Code identificado!' : 'Posicione o QR Code dentro da moldura'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  cameraContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 14 : 48,
    paddingBottom: 16,
    zIndex: 40,
    elevation: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  centerFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 20,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  middleRow: {
    flexDirection: 'row',
    height: SCAN_SIZE,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  maskBottom: {
    flex: 1.25, // Compensa a altura do header superior para centralizar geometricamente
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    paddingTop: 32,
  },
  viewfinder: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3.5,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 10,
  },
  laserLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  scanHint: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
});
