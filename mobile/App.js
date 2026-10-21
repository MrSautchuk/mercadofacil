import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
  Image,
  Linking,
  LogBox,
  AppState,
  Share,
} from 'react-native';

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'AsyncStorageError: Native module is null',
  'Cannot connect to Expo CLI',
  'Error: undefined',
]);
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_BASE } from './src/config';
import { calculateEntitlements, TIERS, PRODUCT_IDS } from './src/domain/entitlements/EntitlementEngine';
import { defaultBillingService, BILLING_PRODUCTS } from './src/infrastructure/billing/BillingService';
import QRCode from 'react-native-qrcode-svg';
import { getTheme } from './src/theme/Theme';
import { CartItem } from './src/components/CartItem';
import { HeaderStats } from './src/components/HeaderStats';
import { FlyerCard } from './src/components/FlyerCard';
import { QrScannerModal } from './src/components/QrScannerModal';
import { FamilyCoreSalesModal } from './src/components/FamilyCoreSalesModal';
import { EditItemModal } from './src/components/EditItemModal';
import { MarketFilterModal } from './src/components/MarketFilterModal';
import { FamilyManagementModal } from './src/components/FamilyManagementModal';
import { useCameraPermissions } from 'expo-camera';
import { useFamilySync } from './src/domain/family/useFamilySync';
import { SyncQueueService } from './src/domain/family/SyncQueueService';
import { purgeOldFlyers } from './src/domain/flyers/purgeFlyers';
import { updateBestOfferSnapshot, parseOfferSnapshot } from './src/domain/flyers/dealsMirror';

// Helper Robusto e Universal de Sanitização de Nomes de Produtos Padronizados por IA
const sanitizeStandardizedProductName = (rawInput, originalTerm = '') => {
  if (!rawInput || typeof rawInput !== 'string') {
    return (originalTerm || '').trim();
  }

  let text = rawInput.trim();

  // 1. Remove blocos de código markdown (```json ... ``` ou ``` ... ```)
  text = text.replace(/```(?:json|yaml|text|markdown)?/gi, '').replace(/```/g, '');

  // 2. Remove tags HTML
  text = text.replace(/<[^>]*>/g, '');

  // 3. Tenta extrair de JSON se contiver chaves
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === 'object') {
        const candidate = parsed.standardized_name ||
                          parsed.standard_name ||
                          parsed.product_name ||
                          parsed.name ||
                          parsed.produto ||
                          parsed.nome ||
                          parsed.item;
        if (candidate && typeof candidate === 'string') {
          text = candidate;
        }
      }
    } catch (_) {}
  }

  // 4. Se houver múltiplas linhas, pega a linha relevante (ignora preâmbulos como "Aqui está o nome:")
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(aqui está|segue|resposta|olá|com certeza|claro|resultado|abaixo)/i.test(line)) {
      continue;
    }
    text = line;
    break;
  }

  // 5. Remove prefixos comuns de chaves/labels (ex: "standardized_name:", "produto:", "nome:", etc.)
  text = text.replace(/^["'{]?\s*(?:standardized[_\s]+name|standard[_\s]+name|product[_\s]+name|product|item[_\s]+name|item|produto[_\s]+padronizado|produto|nome[_\s]+padronizado|nome|termo|sugest[aã]o|resultado)\s*["']?\s*[:=-]\s*["']?/i, '');

  // 6. Remove aspas externas residuais e chaves/colchetes (preserva parênteses de unidade ex: (kg), (un), (bandeja 125g))
  text = text.replace(/^["'“”«»{}\[\]]+|["'“”«»{}\[\]]+$/g, '').trim();

  // 7. Remove ponto final residual no fim da frase (se não fizer parte de abreviação interna)
  text = text.replace(/\.+$/, '').trim();

  // 8. Normaliza espaços duplicados
  text = text.replace(/\s+/g, ' ').trim();

  return text || (originalTerm || '').trim();
};

// Ícones/Categorias visuais por tipo de produto
const getItemIcon = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('alho') || n.includes('cebola') || n.includes('batata') || n.includes('tomate') || n.includes('laranja') || n.includes('uva') || n.includes('banana')) {
    return 'nutrition';
  }
  if (n.includes('carne') || n.includes('frango') || n.includes('peixe') || n.includes('bife') || n.includes('linguica')) {
    return 'restaurant';
  }
  if (n.includes('leite') || n.includes('queijo') || n.includes('iogurte') || n.includes('manteiga')) {
    return 'water';
  }
  if (n.includes('refrigerante') || n.includes('suco') || n.includes('cerveja') || n.includes('vinho') || n.includes('cha') || n.includes('cafe')) {
    return 'wine';
  }
  if (n.includes('arroz') || n.includes('feijao') || n.includes('macarrao') || n.includes('farinha') || n.includes('acucar')) {
    return 'basket';
  }
  if (n.includes('detergente') || n.includes('sabao') || n.includes('amaciante') || n.includes('papel') || n.includes('limp')) {
    return 'sparkles';
  }
  return 'fast-food';
};

// Lista oficial dos 27 estados (UFs) do Brasil
const BRAZIL_STATES = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

export default function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'flyers' | 'settings'
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Lista de compras
  const [items, setItems] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Configurações (BYOK + Localização com Input Unificado UF + Cidade)
  const [apiConfig, setApiConfig] = useState({ configured: false, maskedKey: '', user_city: '', user_state: '' });
  const [inputApiKey, setInputApiKey] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [showUfModal, setShowUfModal] = useState(false);
  const [ufSearchQuery, setUfSearchQuery] = useState('');
  const [locationSavedToast, setLocationSavedToast] = useState(null);
  const citySearchTimeout = useRef(null);

  const [inputApiHost, setInputApiHost] = useState(DEFAULT_API_BASE);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Monetização & Planos Comerciais (Etapa 1)
  const [entitlement, setEntitlement] = useState(() => calculateEntitlements());
  const [purchasingPlan, setPurchasingPlan] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [familyCoreData, setFamilyCoreData] = useState(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [isJoiningFamily, setIsJoiningFamily] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [isSuperuserMode, setIsSuperuserMode] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [salesModalVisible, setSalesModalVisible] = useState(false);
  const [familyManagementModalVisible, setFamilyManagementModalVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Sincronização offline-first e integridade do Core Familiar (Seções 14, 16 e 17)
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [conflictModalData, setConflictModalData] = useState(null);
  const [canceledExpiryWarning, setCanceledExpiryWarning] = useState(null);

  // Estados para Edição de Item da Lista
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState('1');
  const [editItemBrand, setEditItemBrand] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filtros da Minha Lista ("Todos", "Super Ofertas", e dinâmicos por supermercado)
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [marketFilterModalVisible, setMarketFilterModalVisible] = useState(false);

  // Encartes
  const [flyers, setFlyers] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [onlyMatchesFilter, setOnlyMatchesFilter] = useState(false);

  // Encartes - Dropdown / Accordion por encarte (inicialmente fechados)
  const [expandedFlyers, setExpandedFlyers] = useState({});
  const toggleFlyerExpand = (id) => {
    setExpandedFlyers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Sempre que o usuário trocar de aba, os acordeons fecham automaticamente
  useEffect(() => {
    setExpandedFlyers({});
  }, [activeTab]);

  // Encartes - Pesquisa por Supermercado
  const [flyerSearchQuery, setFlyerSearchQuery] = useState('');

  // Encartes - Paginação << < 1 2 3 > >> (Limite de 10 encartes por página)
  const [currentFlyerPage, setCurrentFlyerPage] = useState(1);
  const FLYERS_PER_PAGE = 10;

  // Encartes - Visualizador Nativo In-App (PDF / Imagem)
  const [viewerModalVisible, setViewerModalVisible] = useState(false);
  const [viewingFlyer, setViewingFlyer] = useState(null);
  const [viewingFileDataUri, setViewingFileDataUri] = useState(null);
  const [viewingRawBase64, setViewingRawBase64] = useState(null);
  const [loadingViewerFile, setLoadingViewerFile] = useState(false);

  // Modal para adicionar item padronizado com visual "Add item"
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [isStandardizingWithAi, setIsStandardizingWithAi] = useState(false);

  // Carregar tema persistido e Modo Superuser (Dev)
  useEffect(() => {
    AsyncStorage.getItem('user_theme').then(savedTheme => {
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    }).catch(() => { });

    AsyncStorage.getItem('@mercadofacil_superuser').then(savedSuper => {
      if (savedSuper !== null) {
        setIsSuperuserMode(savedSuper === 'true');
      }
    }).catch(() => { });
  }, []);

  const toggleTheme = (val) => {
    setIsDarkMode(val);
    AsyncStorage.setItem('user_theme', val ? 'dark' : 'light').catch(() => { });
  };

  const handleToggleSuperuser = (val) => {
    setIsSuperuserMode(val);
    AsyncStorage.setItem('@mercadofacil_superuser', String(val)).catch(() => { });
  };

  useEffect(() => {
    loadAllData();
  }, [apiBase]);

  const loadAllData = () => {
    purgeOldFlyers(apiBase, deviceId);
    loadItems();
    loadSettings();
    loadFlyers();
    loadEntitlements();
  };

  const loadEntitlements = async (targetDeviceId = deviceId) => {
    try {
      const safeGet = async (key) => {
        try { return await AsyncStorage.getItem(key); } catch (_) { return null; }
      };
      const safeSet = async (key, val) => {
        try { await AsyncStorage.setItem(key, val); } catch (_) { }
      };

      let id = targetDeviceId;
      if (!id) {
        id = await safeGet('@mercadofacil_device_id');
        if (!id) {
          id = `dev_${Platform.OS}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
          await safeSet('@mercadofacil_device_id', id);
        }
        setDeviceId(id);
      }

      // Garante carregamento com o ID de dispositivo resolvido
      if (id) {
        loadFlyers(id);
        loadItems(id);
      }

      try {
        const res = await fetch(`${apiBase}/entitlements?deviceId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setEntitlement(data);
          const coreId = data.familyCoreId;
          if (coreId) {
            fetch(`${apiBase}/family/core/${coreId}/status?deviceId=${id}`)
              .then(sRes => sRes.ok ? sRes.json() : null)
              .then(sData => {
                if (sData && sData.warningMessage) {
                  setCanceledExpiryWarning(sData.warningMessage);
                } else {
                  setCanceledExpiryWarning(null);
                }
              })
              .catch(() => {});
          } else {
            setCanceledExpiryWarning(null);
          }
          return;
        }
      } catch (_) { }

      const savedPurchasesRaw = await safeGet('@mercadofacil_purchases');
      const savedPurchases = savedPurchasesRaw ? JSON.parse(savedPurchasesRaw) : [];
      const savedSubRaw = await safeGet('@mercadofacil_subscription');
      const savedSub = savedSubRaw ? JSON.parse(savedSubRaw) : null;

      const localSnapshot = calculateEntitlements({
        purchases: savedPurchases,
        subscription: savedSub,
        currentDeviceId: id
      });
      setEntitlement(localSnapshot);
    } catch (_) {
      // Fallback gracioso com tier gratuito padrão para garantir estabilidade do app
      setEntitlement(calculateEntitlements({ purchases: [], subscription: null, currentDeviceId: '' }));
    }
  };

  // Sincronização em tempo real via WebSocket (substitui polling de 2s)
  const activeFamilyCoreId = familyCoreData?.familyCoreId || entitlement?.familyCoreId || null;

  const flushOfflineQueue = async () => {
    if (!activeFamilyCoreId || !deviceId) return;
    setIsSyncing(true);
    try {
      const result = await SyncQueueService.flushQueue({
        familyCoreId: activeFamilyCoreId,
        deviceId,
        serverUrl: socketBaseUrl
      });

      if (result.conflicts && result.conflicts.length > 0) {
        setConflictModalData(result.conflicts[0]);
      }

      if (result.success) {
        loadItems();
      } else if (result.revoked) {
        handleCoreRevoked({ reason: result.code });
      }
    } catch (_) {
    } finally {
      setIsSyncing(false);
      const q = await SyncQueueService.getQueue(activeFamilyCoreId);
      setPendingSyncCount(q.length);
    }
  };

  const handleResolveConflict = async (chosenQty) => {
    if (!conflictModalData || !activeFamilyCoreId) {
      setConflictModalData(null);
      return;
    }
    const itemTarget = conflictModalData;
    setConflictModalData(null);

    // Enfileira operação com a quantidade escolhida consensualmente (Seção 17.2)
    await SyncQueueService.enqueueOperation({
      familyCoreId: activeFamilyCoreId,
      deviceId,
      type: 'UPDATE_ITEM',
      item: { id: itemTarget.itemId, quantity: chosenQty }
    });
    setItems(prev => prev.map(i => i.id === itemTarget.itemId ? { ...i, quantity: chosenQty } : i));
    flushOfflineQueue();
  };

  const handleCoreRevoked = (data) => {
    Alert.alert(
      'Core Familiar Encerrado ou Revogado',
      'Seu acesso à lista compartilhada deste Core Familiar foi encerrado. Deseja manter uma cópia dos itens no seu aparelho ou descartar a lista?',
      [
        {
          text: 'Descartar Lista',
          style: 'destructive',
          onPress: async () => {
            if (activeFamilyCoreId) await SyncQueueService.clearCoreData(activeFamilyCoreId);
            await AsyncStorage.removeItem('@mercadofacil_subscription').catch(() => {});
            setFamilyCoreData(null);
            setCanceledExpiryWarning(null);
            loadEntitlements(deviceId);
            setItems([]);
          }
        },
        {
          text: 'Manter Cópia Local',
          onPress: async () => {
            if (activeFamilyCoreId) await SyncQueueService.clearCoreData(activeFamilyCoreId);
            await AsyncStorage.removeItem('@mercadofacil_subscription').catch(() => {});
            setFamilyCoreData(null);
            setCanceledExpiryWarning(null);
            loadEntitlements(deviceId);
            setItems(prev => prev.map(i => ({ ...i, family_core_id: null })));
          }
        }
      ]
    );
  };

  const loadItems = (customDeviceId = null, customFamilyCoreId = null) => {
    const dId = customDeviceId || deviceId;
    const fCoreId = customFamilyCoreId !== undefined ? customFamilyCoreId : activeFamilyCoreId;
    
    let url = `${apiBase}/items`;
    const queryParts = [];
    if (dId) queryParts.push(`deviceId=${encodeURIComponent(dId)}`);
    if (fCoreId) queryParts.push(`familyCoreId=${encodeURIComponent(fCoreId)}`);
    if (queryParts.length > 0) {
      url += `?${queryParts.join('&')}`;
    }

    const headers = { Accept: 'application/json' };
    if (fCoreId) headers['x-family-core-id'] = String(fCoreId);
    if (dId) headers['x-device-id'] = String(dId);

    fetch(url, { headers })
      .then(res => res.json())
      .then(data => {
        const newItems = data.data || [];
        setItems(prevItems => {
          if (JSON.stringify(prevItems) === JSON.stringify(newItems)) {
            return prevItems;
          }
          return newItems;
        });
        if (fCoreId) {
          SyncQueueService.saveLocalSnapshot(fCoreId, newItems);
        }
      })
      .catch(async () => {
        // Se estiver offline e no Core Familiar, restaura do snapshot local
        if (fCoreId) {
          const cached = await SyncQueueService.getLocalSnapshot(fCoreId);
          if (cached && cached.length > 0) {
            setItems(cached);
          }
        }
      });
  };

  const socketBaseUrl = apiBase && apiBase.includes('http')
    ? apiBase.replace(/\/api\/?$/, '')
    : undefined;

  const { isConnected, emitItemOfferUpdated } = useFamilySync({
    deviceId,
    familyCoreId: activeFamilyCoreId,
    serverUrl: socketBaseUrl,
    onReconnect: () => {
      flushOfflineQueue();
      if (activeFamilyCoreId && deviceId) {
        SyncQueueService.fetchChangesSince({
          familyCoreId: activeFamilyCoreId,
          deviceId,
          serverUrl: socketBaseUrl
        }).then(changes => {
          if (changes && changes.items && changes.items.length > 0) {
            loadItems();
          }
        });
      }
    },
    onListChanged: (data) => {
      if (data.conflicts && data.conflicts.length > 0) {
        setConflictModalData(data.conflicts[0]);
      }
      loadItems();
    },
    onListUpdated: () => {
      loadItems();
    },
    onCoreAccessRevoked: (data) => {
      handleCoreRevoked(data);
    },
    onItemUpdated: ({ itemId, item, offer_snapshot }) => {
      setItems(prevItems =>
        prevItems.map(prev => {
          if (prev.id === itemId) {
            const nextSnap = offer_snapshot !== undefined ? offer_snapshot : item?.offer_snapshot;
            return {
              ...prev,
              ...(item || {}),
              offer_snapshot: typeof nextSnap === 'object' ? JSON.stringify(nextSnap) : nextSnap
            };
          }
          return prev;
        })
      );
    },
    onItemOfferUpdated: ({ itemId, offer_snapshot }) => {
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId
            ? { ...item, offer_snapshot: typeof offer_snapshot === 'object' ? JSON.stringify(offer_snapshot) : offer_snapshot }
            : item
        )
      );
    }
  });

  // Revalidar dados ao retornar ao foco do app (AppState ativo)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadItems();
        if (deviceId) loadEntitlements(deviceId);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [deviceId, activeFamilyCoreId]);

  const loadSettings = () => {
    fetch(`${apiBase}/settings`)
      .then(res => res.json())
      .then(data => {
        setApiConfig(data);
        if (data.user_city) setCityInput(data.user_city);
        if (data.user_state) setSelectedUf(data.user_state);
      })
      .catch(err => console.log('Erro ao buscar settings:', err.message));
  };

  const loadFlyers = (customDeviceId = null) => {
    const dId = customDeviceId || deviceId;
    if (!dId) return;
    fetch(`${apiBase}/flyers?deviceId=${encodeURIComponent(dId)}`, {
      headers: {
        Accept: 'application/json',
        'x-device-id': String(dId)
      }
    })
      .then(res => res.json())
      .then(data => setFlyers(data.data || []))
      .catch(err => console.log('Erro ao buscar encartes:', err.message));
  };

  // --- Sugestões Padronizadas (Autocomplete) ---
  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`${apiBase}/items/suggestions?q=${encodeURIComponent(trimmed)}`)
        .then(res => res.json())
        .then(data => {
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        })
        .catch(err => console.log('Erro de sugestões:', err.message));
    }, 120);

    return () => clearTimeout(timer);
  }, [inputValue, apiBase]);

  const handleSelectItem = async (selectedName) => {
    if (!selectedName || isSubmittingItem) return;

    setIsSubmittingItem(true);
    const effectiveFamilyCoreId = activeFamilyCoreId || familyCoreData?.familyCoreId || entitlement?.familyCoreId || null;
    const cleanName = selectedName.trim();

    // Se estiver em Core Familiar, opera via Fila Offline-First (Seção 14)
    if (effectiveFamilyCoreId) {
      const tempId = 'temp_' + Date.now();
      const newItem = {
        id: tempId,
        name: cleanName,
        quantity: 1,
        purchased: 0,
        is_active: 1,
        family_core_id: effectiveFamilyCoreId,
        device_id: deviceId,
        created_at: new Date().toISOString()
      };

      setItems(prev => [newItem, ...prev]);
      setInputValue('');
      setSuggestions([]);
      setShowSuggestions(false);
      setAddModalVisible(false);
      setIsSubmittingItem(false);

      await SyncQueueService.enqueueOperation({
        familyCoreId: effectiveFamilyCoreId,
        deviceId,
        type: 'ADD_ITEM',
        item: { name: cleanName, quantity: 1 }
      });

      flushOfflineQueue();
      return;
    }

    // Usuário avulso: requisição direta ao backend
    fetch(`${apiBase}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(deviceId ? { 'x-device-id': String(deviceId) } : {})
      },
      body: JSON.stringify({
        name: cleanName,
        deviceId,
        familyCoreId: null
      })
    })
      .then(res => res.json())
      .then(newItem => {
        setItems(prev => [newItem, ...prev]);
        setInputValue('');
        setSuggestions([]);
        setShowSuggestions(false);
        setAddModalVisible(false);
      })
      .catch(err => Alert.alert('Erro', `Não foi possível adicionar: ${err.message}`))
      .finally(() => setIsSubmittingItem(false));
  };

  const handleStandardizeWithAi = async () => {
    const raw = inputValue.trim();
    if (!raw || isStandardizingWithAi || isSubmittingItem) return;

    setIsStandardizingWithAi(true);
    try {
      const res = await fetch(`${apiBase}/items/standardize-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_name: raw })
      });
      const data = await res.json();
      const candidateName = data.standard_name || data.standardized_name || data.name || (data.data && data.data.name);
      if (data.success && candidateName) {
        const cleanName = sanitizeStandardizedProductName(candidateName, raw);
        handleSelectItem(cleanName || raw);
      } else {
        Alert.alert(
          'Padronização Gemini',
          data.message || 'Não foi possível padronizar com IA neste momento. Deseja adicionar com o nome digitado?',
          [
            { text: 'Adicionar Original', onPress: () => handleSelectItem(raw) },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
      }
    } catch (err) {
      console.log('Erro ao padronizar com IA:', err.message);
      handleSelectItem(raw);
    } finally {
      setIsStandardizingWithAi(false);
    }
  };

  const handleOpenEditItem = (item) => {
    setEditingItem(item);
    setEditItemName(item.name || '');
    setEditItemQuantity(item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '1');
    setEditItemBrand(item.brand_preference || '');
    setEditModalVisible(true);
  };

  const handleCloseEditItem = () => {
    setEditModalVisible(false);
    setEditingItem(null);
    setEditItemName('');
    setEditItemQuantity('1');
    setEditItemBrand('');
  };

  const handleSaveEditItem = async () => {
    const trimmedName = editItemName.trim();
    if (!editingItem || !trimmedName || isSavingEdit) return;

    setIsSavingEdit(true);
    const targetId = editingItem.id;
    const oldItem = { ...editingItem };
    const parsedQty = Math.max(1, parseInt(editItemQuantity, 10) || 1);
    const trimmedBrand = editItemBrand.trim();

    const payload = {
      name: trimmedName,
      quantity: parsedQty,
      brand_preference: trimmedBrand || null,
      deviceId,
      familyCoreId: activeFamilyCoreId
    };

    // Atualização otimista no estado local
    setItems(prev => prev.map(i => i.id === targetId ? { ...i, ...payload } : i));
    handleCloseEditItem();

    // Se estiver em Core Familiar, opera via Fila Offline-First (Seção 14 e 16)
    if (activeFamilyCoreId) {
      await SyncQueueService.enqueueOperation({
        familyCoreId: activeFamilyCoreId,
        deviceId,
        type: 'UPDATE_ITEM',
        item: {
          id: targetId,
          name: trimmedName,
          quantity: parsedQty,
          brand_preference: trimmedBrand || null
        }
      });
      setIsSavingEdit(false);
      flushOfflineQueue();
      return;
    }

    // Usuário avulso
    try {
      const res = await fetch(`${apiBase}/items/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao atualizar o item no servidor.');
      }
    } catch (err) {
      setItems(prev => prev.map(i => i.id === targetId ? oldItem : i));
      Alert.alert('Erro ao Salvar', err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleItem = async (item) => {
    const isNowPurchased = item.purchased === 1 || item.is_active === 0;
    const nextPurchased = isNowPurchased ? 0 : 1;
    const nextActive = isNowPurchased ? 1 : 0;

    // Atualização otimista imediata na UI (Seção 18)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, purchased: nextPurchased, is_active: nextActive } : i));

    if (activeFamilyCoreId) {
      await SyncQueueService.enqueueOperation({
        familyCoreId: activeFamilyCoreId,
        deviceId,
        type: 'TOGGLE_PURCHASE',
        item: { id: item.id, purchased: nextPurchased }
      });
      flushOfflineQueue();
      return;
    }

    fetch(`${apiBase}/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_active: nextActive,
        purchased: nextPurchased,
        deviceId,
        familyCoreId: null
      })
    }).catch(err => console.log('Erro toggle:', err.message));
  };

  const handleDeleteItem = (id) => {
    Alert.alert('Remover da Lista', 'Deseja remover este item?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setItems(prev => prev.filter(i => i.id !== id));

          if (activeFamilyCoreId) {
            await SyncQueueService.enqueueOperation({
              familyCoreId: activeFamilyCoreId,
              deviceId,
              type: 'DELETE_ITEM',
              item: { id }
            });
            flushOfflineQueue();
            return;
          }

          const params = [];
          if (deviceId) params.push(`deviceId=${encodeURIComponent(deviceId)}`);
          const qStr = params.length > 0 ? `?${params.join('&')}` : '';

          fetch(`${apiBase}/items/${id}${qStr}`, { method: 'DELETE' })
            .catch(err => console.log('Erro ao deletar:', err.message));
        }
      }
    ]);
  };

  // Localizar oferta para item (Shared Deals Mirror: prioriza o melhor preço consolidado do offer_snapshot)
  const getOfferForItem = (item) => {
    // 1. Snapshot compartilhado existente no item (recebido do backend / WebSocket do Core Familiar)
    const currentSnap = parseOfferSnapshot(item?.offer_snapshot);

    // 2. Procura se há encarte local deste aparelho com correspondência
    let localMatch = null;
    for (const flyer of flyers) {
      if (!flyer.offers) continue;
      const matched = flyer.offers.find(
        o => (o.matched_item_id === item.id) ||
          (o.matched_item_name && o.matched_item_name.toLowerCase() === item.name.toLowerCase()) ||
          (o.product_name && item.name && o.product_name.toLowerCase().includes(item.name.toLowerCase()))
      );
      if (matched) {
        localMatch = {
          supermarket: flyer.supermarket_name,
          product_name: matched.product_name,
          price: Number(matched.price),
          unit: matched.unit || 'un',
          regular_price: Number(matched.regular_price || matched.price),
          deal_verdict: matched.deal_verdict || 'super_oferta',
          discount_percent: Number(matched.discount_percent || 0)
        };
        break;
      }
    }

    // Se houver oferta local, submete ao algoritmo Lowest Price Wins
    if (localMatch) {
      const { shouldUpdate, updatedSnapshot } = updateBestOfferSnapshot(item, localMatch);
      if (shouldUpdate && updatedSnapshot) {
        // Dispara a sincronização via WebSocket e PUT para o Core Familiar se o preço local for menor
        if (typeof emitItemOfferUpdated === 'function') {
          emitItemOfferUpdated(item.id, updatedSnapshot);
        }
        return updatedSnapshot;
      }
    }

    // Se já tiver snapshot consolidado (seja local ou recebido de outro membro da família), retorna-o
    if (currentSnap) {
      return currentSnap;
    }

    return localMatch || null;
  };

  // --- Upload Resiliente em Base64 (Compatibilidade 100% com Android, iOS e Expo Go) ---

  // Leitor resiliente de Base64 com suporte a Modern File (SDK 54+), Legacy FileSystem e fallback Blob/FileReader
  const readUriAsBase64 = async (uri) => {
    // 1. Tenta API moderna do Expo SDK 54+ (File.base64)
    try {
      if (typeof File === 'function') {
        const fileObj = new File(uri);
        if (typeof fileObj.base64 === 'function') {
          const b64 = await fileObj.base64();
          if (b64) return b64;
        }
      }
    } catch (newFsErr) {
      console.log('Modern File API falhou, tentando legacy:', newFsErr.message);
    }

    // 2. Tenta API legada (FileSystem.readAsStringAsync)
    try {
      if (FileSystem && typeof FileSystem.readAsStringAsync === 'function') {
        const data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType ? FileSystem.EncodingType.Base64 : 'base64',
        });
        if (data) return data;
      }
    } catch (fsErr) {
      console.log('Legacy FileSystem error, tentando fallback fetch:', fsErr.message);
    }

    // 3. Fallback universal para fetch blob -> base64
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result;
        if (typeof res === 'string') {
          resolve(res.includes(',') ? res.split(',')[1] : res);
        } else {
          reject(new Error('Falha ao converter arquivo para base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handlePickImage = async (useCamera = false) => {
    if (!apiConfig.configured) {
      Alert.alert('Configuração Pendente', 'Configure sua chave do Gemini na aba Ajustes antes de enviar encartes.');
      return;
    }

    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'Permita o acesso à câmera para fotografar o folheto.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.75,
          allowsEditing: false,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'Permita o acesso à sua galeria de fotos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.75,
          base64: true,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64String = asset.base64;

        if (!base64String && asset.uri) {
          base64String = await readUriAsBase64(asset.uri);
        }

        if (base64String) {
          uploadFileBase64(
            base64String,
            asset.fileName || `encarte_${Date.now()}.jpg`,
            asset.mimeType || 'image/jpeg'
          );
        } else {
          Alert.alert('Erro', 'Não foi possível ler os dados da imagem.');
        }
      }
    } catch (err) {
      Alert.alert('Erro ao selecionar foto', err.message);
    }
  };

  const handlePickDocument = async () => {
    if (!apiConfig.configured) {
      Alert.alert('Configuração Pendente', 'Configure sua chave do Gemini antes de enviar encartes.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsUploading(true);

        const base64String = await readUriAsBase64(asset.uri);

        if (base64String) {
          const docName = asset.name || `encarte_${Date.now()}.pdf`;
          const isPdf = docName.toLowerCase().endsWith('.pdf') || (asset.mimeType && asset.mimeType.toLowerCase().includes('pdf'));
          const mimeType = isPdf ? 'application/pdf' : (asset.mimeType || 'image/jpeg');

          uploadFileBase64(
            base64String,
            docName,
            mimeType
          );
        } else {
          setIsUploading(false);
          Alert.alert('Erro', 'Não foi possível ler o arquivo selecionado.');
        }
      }
    } catch (err) {
      setIsUploading(false);
      Alert.alert('Erro ao selecionar arquivo', err.message);
    }
  };

  const uploadFileBase64 = async (base64Data, fileName, mimeType) => {
    setIsUploading(true);
    try {
      const uploadUrl = `${apiBase}/flyers/upload-base64`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-device-id': String(deviceId || '')
        },
        body: JSON.stringify({
          base64Data,
          fileName,
          mimeType,
          deviceId: deviceId || ''
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        Alert.alert(
          'Encarte Auditado!',
          `Supermercado: ${data.supermarket_name}\nTotal de Ofertas: ${data.total_offers || 0}\nOfertas na sua Lista: ${data.matched_offers_count || 0}`
        );
        loadFlyers(deviceId);

        // --- ALGORITMO "LOWEST PRICE WINS" (Competição de Aparelhos) ---
        // Itera sobre as ofertas extraídas pelo Gemini e compara com cada item correspondente da lista.
        // Se o item não possui snapshot ou se a nova oferta for mais barata (newOffer.price < current.price),
        // atualiza o snapshot do item e persiste via PUT /items/:id para espelhar em todos os aparelhos.
        if (Array.isArray(data.offers) && data.offers.length > 0) {
          items.forEach(async (listItem) => {
            const matchedOffer = data.offers.find(
              o => (o.matched_item_id === listItem.id) ||
                (o.matched_item_name && o.matched_item_name.toLowerCase() === listItem.name.toLowerCase()) ||
                (o.product_name && listItem.name && o.product_name.toLowerCase().includes(listItem.name.toLowerCase()))
            );

            if (matchedOffer) {
              const offerToCompare = {
                price: Number(matchedOffer.price),
                regular_price: Number(matchedOffer.estimated_regular_price || matchedOffer.regular_price || matchedOffer.price),
                supermarket: data.supermarket_name || matchedOffer.supermarket || 'Supermercado',
                deal_verdict: matchedOffer.deal_verdict || 'super_oferta',
                discount_percent: Number(matchedOffer.discount_percent || 0)
              };

              const { shouldUpdate, updatedSnapshot } = updateBestOfferSnapshot(listItem, offerToCompare);

              if (shouldUpdate && updatedSnapshot) {
                // 1. Atualização Otimista no estado local
                setItems(prevItems =>
                  prevItems.map(it =>
                    it.id === listItem.id
                      ? { ...it, offer_snapshot: JSON.stringify(updatedSnapshot) }
                      : it
                  )
                );

                // 2. Persistência na API (Backend propaga via WebSocket para todo o Core Familiar)
                try {
                  await fetch(`${apiBase}/items/${listItem.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      offer_snapshot: updatedSnapshot,
                      familyCoreId: activeFamilyCoreId,
                      deviceId
                    })
                  });
                } catch (putErr) {
                  console.log('Erro ao sincronizar menor preço do item:', putErr.message);
                }

                // 3. Emissão direta complementar via WebSocket para espelhamento em tempo real
                if (typeof emitItemOfferUpdated === 'function') {
                  emitItemOfferUpdated(listItem.id, updatedSnapshot);
                }
              }
            }
          });
        }
      } else {
        const errorMsg = data.error || 'Falha ao processar encarte.';
        if (data.is_duplicate || errorMsg.includes('já foi cadastrado') || errorMsg.includes('duplicad')) {
          Alert.alert(
            'Encarte Já Cadastrado',
            errorMsg
          );
        } else if (data.is_not_flyer || errorMsg.includes('não é um encarte') || errorMsg.includes('descartada')) {
          const cleanReason = errorMsg
            .replace('Erro no processamento com IA: ', '')
            .replace('Imagem descartada: ', '');
          Alert.alert(
            'Arquivo Não Reconhecido',
            cleanReason || 'A foto ou documento enviado não é um encarte promocional de supermercado. O sistema descartou o envio.'
          );
        } else {
          Alert.alert('Erro no Servidor', errorMsg);
        }
      }
    } catch (err) {
      Alert.alert('Erro de Conexão no Upload', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFlyer = (id) => {
    Alert.alert('Remover Encarte', 'Deseja excluir este encarte e suas ofertas auditadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          const deleteUrl = deviceId
            ? `${apiBase}/flyers/${id}?deviceId=${encodeURIComponent(deviceId)}`
            : `${apiBase}/flyers/${id}`;
          const headers = deviceId ? { 'x-device-id': String(deviceId) } : {};
          fetch(deleteUrl, { method: 'DELETE', headers })
            .then(() => loadFlyers(deviceId))
            .catch(err => console.log('Erro ao deletar encarte:', err.message));
        }
      }
    ]);
  };

  const handlePurgeAllFlyers = () => {
    Alert.alert('Limpar Todos os Encartes', 'Deseja remover todos os encartes ativos agora? (A limpeza semanal também ocorre todo domingo às 22h)', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar Todos',
        style: 'destructive',
        onPress: () => {
          const deleteUrl = deviceId
            ? `${apiBase}/flyers?deviceId=${encodeURIComponent(deviceId)}`
            : `${apiBase}/flyers`;
          const headers = deviceId ? { 'x-device-id': String(deviceId) } : {};
          fetch(deleteUrl, { method: 'DELETE', headers })
            .then(() => loadFlyers(deviceId))
            .catch(err => console.log('Erro ao limpar encartes:', err.message));
        }
      }
    ]);
  };

  const handleOpenViewer = (flyer) => {
    setViewingFlyer(flyer);
    setViewingFileDataUri(null);
    setViewingRawBase64(null);
    setLoadingViewerFile(false);
    setViewerModalVisible(true);
  };

  // --- Salvar e Testar Configurações ---

  const handleSelectUf = (uf) => {
    setSelectedUf(uf);
    setShowUfModal(false);
    setCityInput('');
    setCitySuggestions([]);
    setShowCitySuggestions(false);
  };

  const handleClearUf = () => {
    setSelectedUf('');
    setCityInput('');
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setShowUfModal(true);
  };

  const handleCityInputChange = (text) => {
    setCityInput(text);
    const trimmed = text.trim();
    if (!selectedUf) {
      setShowUfModal(true);
      return;
    }
    if (trimmed.length < 2) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }

    setIsLoadingCities(true);
    setShowCitySuggestions(true);
    if (citySearchTimeout.current) clearTimeout(citySearchTimeout.current);
    citySearchTimeout.current = setTimeout(() => {
      fetch(`${apiBase}/locations/cities?uf=${encodeURIComponent(selectedUf)}&q=${encodeURIComponent(trimmed)}`)
        .then(res => res.json())
        .then(data => {
          setCitySuggestions(data.cities || []);
        })
        .catch(err => {
          console.log('Erro ao buscar cidades:', err.message);
          setCitySuggestions([]);
        })
        .finally(() => {
          setIsLoadingCities(false);
        });
    }, 150);
  };

  // Ao escolher e selecionar a cidade, a configuração é alterada automaticamente
  const handleSelectCity = async (cityName) => {
    setCityInput(cityName);
    setShowCitySuggestions(false);
    if (!selectedUf) return;

    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_city: cityName.trim(),
          user_state: selectedUf.trim().toUpperCase()
        })
      });
      const data = await res.json();
      if (data.success) {
        setApiConfig(prev => ({
          ...prev,
          user_city: cityName.trim(),
          user_state: selectedUf.trim().toUpperCase()
        }));
        setLocationSavedToast(`Cidade configurada: ${cityName} - ${selectedUf}`);
        setTimeout(() => setLocationSavedToast(null), 3500);
      } else {
        Alert.alert('Aviso', data.error || 'Não foi possível salvar a localização.');
      }
    } catch (err) {
      console.log('Erro ao salvar cidade:', err.message);
      Alert.alert('Erro de Conexão', 'Não foi possível salvar a cidade no servidor.');
    }
  };

  const handleSaveSettings = () => {
    setSavingSettings(true);
    const payload = {
      user_city: cityInput.trim(),
      user_state: selectedUf.trim().toUpperCase()
    };
    if (inputApiKey.trim()) {
      payload.gemini_api_key = inputApiKey.trim();
    }

    fetch(`${apiBase}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          Alert.alert('Salvo!', 'Configurações e cidade de referência salvas com sucesso.');
          setInputApiKey('');
          loadSettings();
        } else {
          Alert.alert('Erro', data.error || 'Falha ao salvar.');
        }
      })
      .catch(err => Alert.alert('Erro de Conexão', err.message))
      .finally(() => setSavingSettings(false));
  };

  const handleTestApiKey = () => {
    setTestingKey(true);
    fetch(`${apiBase}/settings/test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: inputApiKey.trim() || undefined })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          Alert.alert('Conexão Validada', 'Chave Gemini ativa e pronta para auditar encartes.');
        } else {
          Alert.alert('Erro', data.error || 'Chave inválida.');
        }
      })
      .catch(err => Alert.alert('Erro', err.message))
      .finally(() => setTestingKey(false));
  };

  // --- Handlers de Monetização & Billing (Etapa 1) com Suporte a Superuser (Dev) ---
  const handlePurchaseLifetimeNoAds = async () => {
    if (!isSuperuserMode) {
      const storeUrl = Platform.select({
        ios: 'https://apps.apple.com/account/subscriptions',
        android: 'https://play.google.com/store/apps/details?id=com.gothar.mobile',
        default: 'https://play.google.com/store/apps/details?id=com.gothar.mobile'
      });
      Alert.alert(
        'Comprar Sem Anúncios (Vitalício)',
        'Compras e assinaturas no aplicativo são processadas com segurança através da loja oficial (Google Play / App Store). Deseja continuar na loja?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ir para a Loja',
            onPress: () => {
              Linking.openURL(storeUrl).catch(() => {
                Alert.alert('Aviso', 'Não foi possível abrir a loja de aplicativos automaticamente.');
              });
            }
          }
        ]
      );
      return;
    }

    // Modo Superuser (Dev) ATIVADO: bypass direto
    setPurchasingPlan(true);
    try {
      const purchases = [{ productId: BILLING_PRODUCTS.LIFETIME_NO_ADS.id, status: 'valid' }];
      await AsyncStorage.setItem('@mercadofacil_purchases', JSON.stringify(purchases));

      fetch(`${apiBase}/billing/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, receipt: 'superuser_dev_bypass_receipt' })
      }).catch(() => { });

      const updated = calculateEntitlements({ purchases, currentDeviceId: deviceId });
      setEntitlement(updated);
      Alert.alert('Modo Superuser (Dev)', 'Licença Vitalícia Sem Anúncios ativada instantaneamente com bypass de loja!');
    } catch (err) {
      Alert.alert('Erro', err.message);
    } finally {
      setPurchasingPlan(false);
    }
  };

  const handlePurchaseFamilySubscription = async () => {
    if (!isSuperuserMode) {
      const storeUrl = Platform.select({
        ios: 'https://apps.apple.com/account/subscriptions',
        android: 'https://play.google.com/store/apps/details?id=com.gothar.mobile',
        default: 'https://play.google.com/store/apps/details?id=com.gothar.mobile'
      });
      Alert.alert(
        'Assinar Core Familiar (Mensal)',
        'As assinaturas do MercadoFácil são processadas e gerenciadas pela loja de aplicativos oficial (Google Play / App Store). Deseja continuar na loja?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ir para a Loja',
            onPress: () => {
              Linking.openURL(storeUrl).catch(() => {
                Alert.alert('Aviso', 'Não foi possível abrir a loja de aplicativos automaticamente.');
              });
            }
          }
        ]
      );
      return;
    }

    // Modo Superuser (Dev) ATIVADO: bypass direto
    setPurchasingPlan(true);
    try {
      try {
        const coreRes = await fetch(`${apiBase}/family/core`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId })
        });
        if (coreRes.ok) {
          const coreData = await coreRes.json();
          setFamilyCoreData(coreData);
        }
      } catch (_) { }

      const subscription = {
        productId: BILLING_PRODUCTS.FAMILY_SUBSCRIPTION.id,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      await AsyncStorage.setItem('@mercadofacil_subscription', JSON.stringify(subscription));

      const updated = calculateEntitlements({
        subscription,
        currentDeviceId: deviceId,
        familyCore: {
          id: 'core_local',
          ownerDeviceId: deviceId,
          maxDevices: 3,
          authorizedDevices: [{ deviceId, status: 'active' }]
        }
      });
      setEntitlement(updated);
      Alert.alert('Modo Superuser (Dev)', 'Core Familiar ativado instantaneamente com bypass de loja para testes locais!');
    } catch (err) {
      Alert.alert('Erro', err.message);
    } finally {
      setPurchasingPlan(false);
    }
  };

  const handleRestorePurchases = async () => {
    setRestoringPurchases(true);
    try {
      const res = await defaultBillingService.restorePurchases();
      if (res.success && res.restoredPurchases && res.restoredPurchases.length > 0) {
        const hasLifetime = res.restoredPurchases.some(p => p.productId === BILLING_PRODUCTS.LIFETIME_NO_ADS.id);
        const purchases = hasLifetime ? [{ productId: BILLING_PRODUCTS.LIFETIME_NO_ADS.id, status: 'valid' }] : [];
        await AsyncStorage.setItem('@mercadofacil_purchases', JSON.stringify(purchases));

        const updated = calculateEntitlements({ purchases, currentDeviceId: deviceId });
        setEntitlement(updated);
        Alert.alert('Restaurado!', 'Suas compras anteriores foram recuperadas com sucesso.');
      } else {
        Alert.alert('Nenhuma Compra Encontrada', 'Não encontramos compras ativas associadas à sua conta de loja.');
      }
    } catch (err) {
      Alert.alert('Erro', 'Falha ao restaurar compras: ' + err.message);
    } finally {
      setRestoringPurchases(false);
    }
  };

  const handleGenerateFamilyInvite = async () => {
    if (!familyCoreData?.familyCoreId && !entitlement.familyCoreId) {
      const code = FamilyCoreService.generateInvitationCode('core_local', deviceId);
      setGeneratedInvite(code);
      Alert.alert('Convite Familiar Gerado!', 'Aponte a câmera do familiar para o QR Code na tela ou compartilhe o link de convite.');
      return;
    }

    try {
      const coreId = familyCoreData?.familyCoreId || entitlement.familyCoreId;
      const res = await fetch(`${apiBase}/family/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyCoreId: coreId, ownerDeviceId: deviceId })
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedInvite(data);
        Alert.alert('Convite Familiar Gerado!', 'QR Code válido por 24 horas. Compartilhe o link ou peça para o familiar escanear o QR Code.');
      } else {
        Alert.alert('Limite Atingido', data.error || 'Não foi possível gerar convite.');
      }
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  };

  const handleShareFamilyInvite = async () => {
    if (!generatedInvite) return;
    const inviteCode = generatedInvite.invitationCode || generatedInvite.code;
    const shareUrl = `https://play.google.com/store/apps/details?id=com.mercadofacil&referrer=invite_${inviteCode}`;
    const message = `Venha economizar comigo no MercadoFácil! Acesse o link para entrar no meu Core Familiar: ${shareUrl}`;

    try {
      await Share.share({
        message,
        title: 'Convite para Core Familiar - MercadoFácil',
        url: shareUrl,
      });
    } catch (err) {
      console.log('Erro ao compartilhar convite:', err.message);
    }
  };

  const handleCancelFamilySubscription = () => {
    Alert.alert(
      'Cancelar Assinatura',
      'As assinaturas do Core Familiar são gerenciadas diretamente pela loja de aplicativos (Google Play / App Store). Deseja abrir o gerenciador de assinaturas da sua conta?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Gerenciar na Loja',
          style: 'destructive',
          onPress: async () => {
            const storeUrl = Platform.select({
              ios: 'https://apps.apple.com/account/subscriptions',
              android: 'https://play.google.com/store/account/subscriptions',
              default: 'https://play.google.com/store/account/subscriptions'
            });

            try {
              // Limpeza graciosa local / sandbox
              await AsyncStorage.removeItem('@mercadofacil_subscription');
              await loadEntitlements();
            } catch (_) {}

            Linking.openURL(storeUrl).catch(() => {
              Alert.alert('Aviso', 'Não foi possível abrir a loja de aplicativos automaticamente.');
            });
          }
        }
      ]
    );
  };

  const handleOpenQrScanner = async () => {
    try {
      if (!cameraPermission || !cameraPermission.granted) {
        const res = await requestCameraPermission();
        if (!res.granted) {
          Alert.alert(
            'Permissão Necessária',
            'Para ingressar no Core Familiar de forma segura, o app precisa de acesso à câmera para ler o QR Code do titular.'
          );
          return;
        }
      }
      setQrScannerVisible(true);
    } catch (err) {
      Alert.alert('Erro na Câmera', 'Não foi possível inicializar a câmera: ' + err.message);
    }
  };

  const handleJoinFamilyWithCode = async (explicitCode = null) => {
    const codeToUse = (typeof explicitCode === 'string' ? explicitCode : inviteCodeInput).trim().toUpperCase();
    if (!codeToUse) {
      Alert.alert('Atenção', 'Aponte a câmera para o QR Code gerado no celular titular.');
      return;
    }
    setIsJoiningFamily(true);
    try {
      const res = await fetch(`${apiBase}/family/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToUse, deviceId, deviceName: `Celular ${Platform.OS}` })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteCodeInput('');
        const entRes = await fetch(`${apiBase}/entitlements?deviceId=${deviceId}`);
        if (entRes.ok) {
          const entData = await entRes.json();
          setEntitlement(entData);
        }
        Alert.alert('Bem-vindo ao Core Familiar!', 'Você ingressou com sucesso no grupo familiar! Agora você tem zero anúncios e acesso às listas compartilhadas.');
      } else {
        Alert.alert('Não foi possível entrar', data.error || 'Código inválido ou limite de 3 dispositivos já atingido.');
      }
    } catch (err) {
      Alert.alert('Erro', 'Falha ao conectar com o servidor: ' + err.message);
    } finally {
      setIsJoiningFamily(false);
    }
  };

  // Cálculos de Resumo de Economia
  const activeItems = items.filter(i => i.is_active === 1);
  let superDealsCount = 0;
  let normalPricesCount = 0;
  let badDealsCount = 0;
  let totalEstimatedSavings = 0;

  activeItems.forEach(item => {
    const offer = getOfferForItem(item);
    if (offer) {
      if (offer.deal_verdict === 'super_oferta') superDealsCount++;
      else if (offer.deal_verdict === 'falsa_promocao') badDealsCount++;
      else normalPricesCount++;

      if (offer.regular_price && offer.price && offer.regular_price > offer.price) {
        totalEstimatedSavings += (offer.regular_price - offer.price);
      }
    }
  });

  // Descoberta dinâmica de supermercados únicos extraídos de encartes e dos snapshots espelhados
  const activeOfferSupermarkets = useMemo(() => {
    const marketSet = new Set();
    // 1. Encartes locais
    flyers.forEach(f => {
      if (f.supermarket_name && f.supermarket_name.trim()) {
        marketSet.add(f.supermarket_name.trim());
      }
    });
    // 2. Snapshots espelhados de outros membros do Core Familiar
    items.forEach(it => {
      const snap = parseOfferSnapshot(it.offer_snapshot);
      if (snap && snap.supermarket && snap.supermarket.trim()) {
        marketSet.add(snap.supermarket.trim());
      }
    });
    return Array.from(marketSet).sort();
  }, [flyers, items]);

  // Itens filtrados com base na pílula ativa ('Todos', 'Super Ofertas' ou nome do Supermercado)
  const filteredListItems = useMemo(() => {
    return items.filter(item => {
      if (activeFilter === 'Todos') return true;
      const offer = getOfferForItem(item);
      if (activeFilter === 'Super Ofertas') {
        return offer && offer.deal_verdict === 'super_oferta';
      }
      return offer && offer.supermarket && offer.supermarket.trim().toLowerCase() === activeFilter.trim().toLowerCase();
    });
  }, [items, activeFilter, flyers]);

  const totalMatchesCount = useMemo(() => {
    return items.filter(it => Boolean(getOfferForItem(it))).length;
  }, [items, flyers]);

  // Filtro de pesquisa e paginação de Encartes (Corrige e mitiga 'Property filteredFlyers does not exist')
  const filteredFlyers = flyers.filter(f => {
    if (!flyerSearchQuery.trim()) return true;
    return (f.supermarket_name || '').toLowerCase().includes(flyerSearchQuery.toLowerCase().trim());
  });
  const totalFlyerPages = Math.max(1, Math.ceil(filteredFlyers.length / FLYERS_PER_PAGE));
  const activeFlyerPage = Math.min(currentFlyerPage, totalFlyerPages);
  const displayedFlyers = filteredFlyers.slice((activeFlyerPage - 1) * FLYERS_PER_PAGE, activeFlyerPage * FLYERS_PER_PAGE);

  // Filtro de estados na busca do modal
  const filteredStates = BRAZIL_STATES.filter(st => {
    if (!ufSearchQuery.trim()) return true;
    const q = ufSearchQuery.toLowerCase().trim();
    return st.uf.toLowerCase().includes(q) || st.name.toLowerCase().includes(q);
  });

  // Paleta de Cores Dinâmica (Dark vs Light via Theme tokens)
  const theme = getTheme(isDarkMode);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <StatusBar style={theme.statusBarStyle} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.container, { backgroundColor: theme.bg }]}
        >
          {/* Top Header estilo Grocery App com Switch de Tema */}
          <View style={[styles.header, { backgroundColor: theme.bg }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={[styles.locationDropdown, { backgroundColor: theme.cardSubBg }]}>
                <Ionicons name="location-sharp" size={14} color={theme.accentLime} />
                <Text style={[styles.locationText, { color: theme.accentLime }]}>
                  {apiConfig.user_city
                    ? `${apiConfig.user_city} ${apiConfig.user_state ? `| ${apiConfig.user_state}` : ''}`
                    : 'Definir Cidade'}
                </Text>
              </View>

              {/* Alternador Rápido de Tema (Dark / Light) */}
              <TouchableOpacity
                style={[styles.themeToggleBtn, { backgroundColor: theme.cardSubBg }]}
                onPress={() => toggleTheme(!isDarkMode)}
              >
                <Ionicons
                  name={isDarkMode ? "moon" : "sunny"}
                  size={16}
                  color={theme.accentLime}
                />
                <Text style={[styles.themeToggleText, { color: theme.textMuted }]}>
                  {isDarkMode ? "Escuro" : "Claro"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headerMainRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {activeTab === 'settings' && (
                  <TouchableOpacity
                    onPress={() => setActiveTab('list')}
                    style={{ padding: 4 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="arrow-back" size={22} color={theme.textMain} />
                  </TouchableOpacity>
                )}
                <Text style={[styles.screenTitle, { color: theme.textMain }]}>
                  {activeTab === 'list' ? 'Minha Lista' : activeTab === 'flyers' ? 'Encartes da Semana' : 'Configurações'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveTab(activeTab === 'settings' ? 'list' : 'settings')}
                style={{ padding: 4 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={activeTab === 'settings' ? "close" : "ellipsis-vertical"}
                  size={22}
                  color={activeTab === 'settings' ? theme.accentLime : theme.textDim}
                />
              </TouchableOpacity>
            </View>

            {/* Indicador de Ofertas Discreto */}
            {(activeTab === 'list' || activeTab === 'flyers') && (
              <HeaderStats
                superDealsCount={superDealsCount}
                theme={theme}
              />
            )}
          </View>

          {/* Barra de Navegação de Abas - 2 Abas Principais em Destaque */}
          {activeTab !== 'settings' && (
            <View style={[styles.tabsBar, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'list' && { borderBottomColor: theme.accentLime }]}
                onPress={() => setActiveTab('list')}
              >
                <Ionicons name="cart" size={18} color={activeTab === 'list' ? theme.accentLime : theme.textDim} />
                <Text style={[styles.tabItemText, { color: activeTab === 'list' ? theme.accentLime : theme.textDim }]}>
                  Minha Lista ({activeItems.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'flyers' && { borderBottomColor: theme.accentLime }]}
                onPress={() => setActiveTab('flyers')}
              >
                <Ionicons name="newspaper" size={18} color={activeTab === 'flyers' ? theme.accentLime : theme.textDim} />
                <Text style={[styles.tabItemText, { color: activeTab === 'flyers' ? theme.accentLime : theme.textDim }]}>
                  Encartes {flyers.length > 0 ? `(${flyers.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ABA 1: MINHA LISTA */}
          {activeTab === 'list' && (
            <View style={styles.content}>
              {/* Aviso Prévio de Expiração / Cancelamento do Core Familiar (Seção 4) */}
              {canceledExpiryWarning && (
                <TouchableOpacity
                  style={[
                    styles.canceledWarningBox,
                    {
                      backgroundColor: isDarkMode ? '#2d2410' : '#fff9db',
                      borderColor: '#f59f00'
                    }
                  ]}
                  onPress={() => setFamilyManagementModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="warning-outline" size={18} color="#f59f00" />
                  <Text style={[styles.canceledWarningText, { color: isDarkMode ? '#ffd43b' : '#d97706' }]}>
                    {canceledExpiryWarning}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#f59f00" />
                </TouchableOpacity>
              )}

              {/* Indicador Discreto de Sincronização (ADR-012) - Exibido apenas quando syncing ou offline */}
              {activeFamilyCoreId && (isSyncing || !isConnected || pendingSyncCount > 0) && (
                <View style={[styles.syncStatusBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  {isSyncing ? (
                    <>
                      <ActivityIndicator size="small" color={theme.accentLime} style={{ marginRight: 6 }} />
                      <Text style={[styles.syncStatusText, { color: theme.textDim }]}>Sincronizando lista...</Text>
                    </>
                  ) : !isConnected ? (
                    <>
                      <Ionicons name="cloud-offline-outline" size={14} color="#f59f00" style={{ marginRight: 6 }} />
                      <Text style={[styles.syncStatusText, { color: '#f59f00' }]}>
                        Modo offline {pendingSyncCount > 0 ? `(${pendingSyncCount} pendente${pendingSyncCount > 1 ? 's' : ''})` : ''}
                      </Text>
                    </>
                  ) : pendingSyncCount > 0 ? (
                    <>
                      <Ionicons name="sync-outline" size={14} color={theme.accentLime} style={{ marginRight: 6 }} />
                      <Text style={[styles.syncStatusText, { color: theme.textDim }]}>
                        {pendingSyncCount} alteraç{pendingSyncCount > 1 ? 'ões' : 'ão'} na fila
                      </Text>
                    </>
                  ) : null}
                </View>
              )}

              {/* Barra de Filtros com Máximo de 3 Pílulas Escaláveis */}
              <View style={styles.filterPillsWrapper}>
                <View style={styles.filterThreePillsRow}>
                  {/* Pílula 1: Todos */}
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      styles.scalablePill,
                      {
                        backgroundColor: activeFilter === 'Todos' ? theme.accentLime : theme.cardSubBg,
                        borderColor: activeFilter === 'Todos' ? theme.accentLime : theme.borderSubtle
                      }
                    ]}
                    onPress={() => setActiveFilter('Todos')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: activeFilter === 'Todos' ? '#000' : theme.textMain }
                      ]}
                      numberOfLines={1}
                    >
                      Todos ({items.length})
                    </Text>
                  </TouchableOpacity>

                  {/* Pílula 2: Super Ofertas */}
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      styles.scalablePill,
                      {
                        backgroundColor: activeFilter === 'Super Ofertas' ? theme.accentLime : theme.cardSubBg,
                        borderColor: activeFilter === 'Super Ofertas' ? theme.accentLime : theme.borderSubtle
                      }
                    ]}
                    onPress={() => setActiveFilter('Super Ofertas')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="pricetag"
                      size={12}
                      color={activeFilter === 'Super Ofertas' ? '#000' : theme.accentLime}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: activeFilter === 'Super Ofertas' ? '#000' : theme.textMain }
                      ]}
                      numberOfLines={1}
                    >
                      Ofertas {superDealsCount > 0 ? `(${superDealsCount})` : ''}
                    </Text>
                  </TouchableOpacity>

                  {/* Pílula 3: Filtrar por Mercado (Dropdown / Action Sheet Modal) */}
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      styles.scalablePill,
                      {
                        backgroundColor: (activeFilter !== 'Todos' && activeFilter !== 'Super Ofertas') ? theme.accentLime : theme.cardSubBg,
                        borderColor: (activeFilter !== 'Todos' && activeFilter !== 'Super Ofertas') ? theme.accentLime : theme.borderSubtle
                      }
                    ]}
                    onPress={() => setMarketFilterModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="business-outline"
                      size={12}
                      color={(activeFilter !== 'Todos' && activeFilter !== 'Super Ofertas') ? '#000' : theme.textDim}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: (activeFilter !== 'Todos' && activeFilter !== 'Super Ofertas') ? '#000' : theme.textMain }
                      ]}
                      numberOfLines={1}
                    >
                      {(activeFilter !== 'Todos' && activeFilter !== 'Super Ofertas') ? activeFilter : 'Por Mercado ▾'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cabeçalho da Tabela */}
              <View style={[styles.tableHeaderRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.tableColHeader, { flex: 2, color: theme.accentLime }]}>Produto</Text>
                <Text style={[styles.tableColHeader, { flex: 1, textAlign: 'center', color: theme.accentLime }]}>Status</Text>
                <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right', color: theme.accentLime }]}>Melhor Preço</Text>
              </View>

              <FlatList
                data={filteredListItems}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 120 }}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="basket-outline" size={54} color={theme.borderSubtle} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>Nenhum item na sua lista.</Text>
                    <Text style={[styles.emptySubtext, { color: theme.textDim }]}>Toque no botão abaixo para adicionar produtos padronizados!</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const offer = getOfferForItem(item);
                  const isActive = item.is_active === 1;
                  const iconName = getItemIcon(item.name);

                  return (
                    <CartItem
                      item={item}
                      offer={offer}
                      isActive={isActive}
                      iconName={iconName}
                      theme={theme}
                      onToggle={handleToggleItem}
                      onEdit={handleOpenEditItem}
                      onDelete={handleDeleteItem}
                    />
                  );
                }}
              />

              {/* Totalizador de Economia / Bottom Bar */}
              <View style={[styles.bottomBarContainer, { backgroundColor: isDarkMode ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderTopColor: theme.border }]}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: theme.textMuted }]}>Economia Estimada</Text>
                  <Text style={[styles.totalValue, { color: theme.accentLime }]}>
                    R$ {totalEstimatedSavings.toFixed(2).replace('.', ',')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.bigLimeButton, { backgroundColor: theme.accentLime }]}
                  onPress={() => setAddModalVisible(true)}
                >
                  <Text style={styles.bigLimeButtonText}>+ Adicionar produto padronizado</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ABA 2: ENCARTES & OFERTAS */}
          {activeTab === 'flyers' && (
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
              <View style={[styles.darkCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.darkCardTitle, { color: theme.textMain }]}>Encartes da Semana</Text>
                <Text style={[styles.darkCardDesc, { color: theme.textMuted }]}>
                  Audite folhetos em foto ou PDF com inteligência artificial calibrada para sua cidade:
                </Text>

                {isUploading ? (
                  <View style={styles.uploadingBox}>
                    <ActivityIndicator size="large" color={theme.accentLime} />
                    <Text style={[styles.uploadingText, { color: theme.accentLime }]}>IA auditando os preços da sua praça...</Text>
                  </View>
                ) : (
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.photoActionButton, { backgroundColor: '#16a34a' }]}
                      onPress={() => handlePickImage(true)}
                    >
                      <Ionicons name="camera" size={20} color="#fff" />
                      <Text style={styles.photoActionText}>Câmera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.photoActionButton, { backgroundColor: '#0284c7' }]}
                      onPress={() => handlePickImage(false)}
                    >
                      <Ionicons name="images" size={20} color="#fff" />
                      <Text style={styles.photoActionText}>Galeria</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.photoActionButton, { backgroundColor: '#ca8a04' }]}
                      onPress={handlePickDocument}
                    >
                      <Ionicons name="document-text" size={20} color="#fff" />
                      <Text style={styles.photoActionText}>PDF</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Barra de Pesquisa de Encartes com Label Explicativo */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginLeft: 2 }}>
                  <Ionicons name="search-outline" size={14} color={theme.textDim} />
                  <Text style={[styles.searchSupermarketLabel, { color: theme.textDim, marginBottom: 0 }]}>
                    Pesquise seus encartes
                  </Text>
                </View>
                <View style={[styles.searchSupermarketBox, { backgroundColor: theme.cardBg, borderColor: theme.border, marginBottom: 0 }]}>
                  <Ionicons name="search" size={18} color={theme.accentLime} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchSupermarketInput, { color: theme.textMain }]}
                    placeholder="ex: Carrefour, Assai"
                    placeholderTextColor={theme.textDim}
                    value={flyerSearchQuery}
                    onChangeText={(text) => {
                      setFlyerSearchQuery(text);
                      setCurrentFlyerPage(1);
                    }}
                  />
                  {flyerSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setFlyerSearchQuery(''); setCurrentFlyerPage(1); }} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={18} color={theme.textDim} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.flyerHeaderBar}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.flyerSectionTitle, { color: theme.textMain }]} numberOfLines={1}>
                    Encartes Analisados ({filteredFlyers.length}{flyerSearchQuery ? ` de ${flyers.length}` : ''})
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="time-outline" size={12} color={theme.accentLime} />
                    <Text style={[styles.sundayBadgeText, { color: theme.accentLime }]} numberOfLines={1}>
                      Limpeza automática todo domingo às 22h
                    </Text>
                  </View>
                </View>

                {flyers.length > 0 && (
                  <TouchableOpacity onPress={handlePurgeAllFlyers} style={styles.purgeBtn}>
                    <Ionicons name="trash-outline" size={14} color="#f87171" />
                    <Text style={styles.purgeBtnText}>Limpar Todos</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Lista de Encartes - Cards memoizados com visual premium e respiro */}
              {displayedFlyers.map(flyer => (
                <FlyerCard
                  key={flyer.id}
                  flyer={flyer}
                  isExpanded={!!expandedFlyers[flyer.id]}
                  onlyMatchesFilter={onlyMatchesFilter}
                  theme={theme}
                  onToggleExpand={toggleFlyerExpand}
                  onDelete={handleDeleteFlyer}
                  onOpenViewer={handleOpenViewer}
                />
              ))}

              {/* Paginação inferior para facilidade de navegação */}
              {totalFlyerPages > 1 && (
                <View style={[styles.paginationContainer, { backgroundColor: theme.cardBg, borderColor: theme.border, marginTop: 4 }]}>
                  <TouchableOpacity
                    style={[styles.pageBtn, activeFlyerPage === 1 && styles.pageBtnDisabled]}
                    disabled={activeFlyerPage === 1}
                    onPress={() => setCurrentFlyerPage(1)}
                  >
                    <Text style={[styles.pageBtnText, { color: activeFlyerPage === 1 ? theme.textDim : theme.accentLime }]}>{'<<'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pageBtn, activeFlyerPage === 1 && styles.pageBtnDisabled]}
                    disabled={activeFlyerPage === 1}
                    onPress={() => setCurrentFlyerPage(Math.max(1, activeFlyerPage - 1))}
                  >
                    <Text style={[styles.pageBtnText, { color: activeFlyerPage === 1 ? theme.textDim : theme.accentLime }]}>{'<'}</Text>
                  </TouchableOpacity>

                  {Array.from({ length: totalFlyerPages }, (_, i) => i + 1).map((pageNum) => (
                    <TouchableOpacity
                      key={pageNum}
                      style={[
                        styles.pageNumberBtn,
                        {
                          backgroundColor: pageNum === activeFlyerPage ? theme.accentLime : theme.cardSubBg,
                          borderColor: pageNum === activeFlyerPage ? theme.accentLime : theme.borderSubtle
                        }
                      ]}
                      onPress={() => setCurrentFlyerPage(pageNum)}
                    >
                      <Text style={[
                        styles.pageNumberText,
                        { color: pageNum === activeFlyerPage ? '#000' : theme.textMain }
                      ]}>
                        {pageNum}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={[styles.pageBtn, activeFlyerPage === totalFlyerPages && styles.pageBtnDisabled]}
                    disabled={activeFlyerPage === totalFlyerPages}
                    onPress={() => setCurrentFlyerPage(Math.min(totalFlyerPages, activeFlyerPage + 1))}
                  >
                    <Text style={[styles.pageBtnText, { color: activeFlyerPage === totalFlyerPages ? theme.textDim : theme.accentLime }]}>{'>'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pageBtn, activeFlyerPage === totalFlyerPages && styles.pageBtnDisabled]}
                    disabled={activeFlyerPage === totalFlyerPages}
                    onPress={() => setCurrentFlyerPage(totalFlyerPages)}
                  >
                    <Text style={[styles.pageBtnText, { color: activeFlyerPage === totalFlyerPages ? theme.textDim : theme.accentLime }]}>{'>>'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {flyers.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="newspaper-outline" size={54} color={theme.borderSubtle} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>Nenhum encarte enviado ainda.</Text>
                  <Text style={[styles.emptySubtext, { color: theme.textDim }]}>Fotografe ou envie o folheto do supermercado da sua região!</Text>
                </View>
              )}

              {flyers.length > 0 && filteredFlyers.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color={theme.borderSubtle} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>Nenhum encarte encontrado</Text>
                  <Text style={[styles.emptySubtext, { color: theme.textDim }]}>
                    Nenhum encarte com o supermercado "{flyerSearchQuery}" foi localizado.
                  </Text>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { marginTop: 12, paddingHorizontal: 16, backgroundColor: theme.cardSubBg, borderColor: theme.border }]}
                    onPress={() => { setFlyerSearchQuery(''); setCurrentFlyerPage(1); }}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.accentLime }]}>Limpar Pesquisa</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          {/* ABA 3: AJUSTES E CONFIGURAÇÕES */}
          {activeTab === 'settings' && (
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
              {/* Opções de Aparência / Tema */}
              <View style={[styles.darkCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.darkCardTitle, { color: theme.textMain }]}>Aparência do Aplicativo</Text>
                <View style={[styles.statusLine, { borderBottomColor: theme.borderSubtle }]}>
                  <View>
                    <Text style={[styles.statusLabel, { color: theme.textMain, fontWeight: '700' }]}>Tema Escuro</Text>
                    <Text style={[styles.darkCardDesc, { color: theme.textDim, marginTop: 2 }]}>
                      {isDarkMode ? "Visual Dark profundo com Verde-Limão" : "Visual Claro e limpo"}
                    </Text>
                  </View>
                  <Switch
                    value={isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#cbd5e1', true: theme.accentLime }}
                    thumbColor={isDarkMode ? '#ffffff' : '#f8fafc'}
                  />
                </View>
              </View>

              {/* Planos e Benefícios de Monetização (Etapa 1) */}
              <View style={[styles.darkCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[styles.darkCardTitle, { color: theme.textMain, margin: 0 }]}>Planos e Benefícios</Text>
                  {entitlement?.tier === TIERS.FAMILY_PREMIUM ? (
                    <View style={[styles.planBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' }]}>
                      <Text style={[styles.planBadgeText, { color: '#10b981' }]}>● Core Familiar</Text>
                    </View>
                  ) : entitlement?.tier === TIERS.LIFETIME_NO_ADS ? (
                    <View style={[styles.planBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6' }]}>
                      <Text style={[styles.planBadgeText, { color: '#3b82f6' }]}>● Sem Anúncios</Text>
                    </View>
                  ) : (
                    <View style={[styles.planBadge, { backgroundColor: theme.cardSubBg, borderColor: theme.borderSubtle }]}>
                      <Text style={[styles.planBadgeText, { color: theme.textDim }]}>○ Gratuito</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.darkCardDesc, { color: theme.textMuted }]}>
                  {entitlement?.tier === TIERS.FAMILY_PREMIUM
                    ? 'Você está no Core Familiar! Zero anúncios e sincronização com até 3 celulares autorizados.'
                    : entitlement?.tier === TIERS.LIFETIME_NO_ADS
                      ? 'Você possui remoção vitalícia de anúncios ativada neste dispositivo.'
                      : 'Economize tempo e dinheiro com nossos planos sem anúncios e compartilhamento familiar.'}
                </Text>

                {/* Detalhes do Core Familiar (Caso seja assinante) */}
                {entitlement?.tier === TIERS.FAMILY_PREMIUM && (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {/* Ações Administrativas Exclusivas do Gestor / Titular Financeiro */}
                    {entitlement?.canManageFamily ? (
                      <>
                        <TouchableOpacity
                          style={[styles.planActionButton, { backgroundColor: theme.accentLime }]}
                          onPress={handleGenerateFamilyInvite}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="qr-code-outline" size={16} color="#000" />
                          <Text style={[styles.planActionButtonText, { color: '#000' }]}>Gerar QR Code de Convite Familiar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.planActionButton,
                            {
                              backgroundColor: theme.cardSubBg,
                              borderColor: theme.accentLime,
                              borderWidth: 1
                            }
                          ]}
                          onPress={() => setFamilyManagementModalVisible(true)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="people" size={16} color={theme.accentLime} />
                          <Text style={[styles.planActionButtonText, { color: theme.textMain }]}>Gerenciar Participantes</Text>
                        </TouchableOpacity>

                        {generatedInvite && (
                          <View style={[styles.inviteCodeBox, { backgroundColor: theme.cardSubBg, borderColor: theme.accentLime, position: 'relative' }]}>
                            {/* Botão de Fechar Convite com X */}
                            <TouchableOpacity
                              style={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                zIndex: 10,
                                padding: 6,
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                borderRadius: 16
                              }}
                              onPress={() => setGeneratedInvite(null)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="close" size={18} color={theme.textMain} />
                            </TouchableOpacity>

                            <Text style={[styles.inviteCodeTitle, { color: theme.textDim, paddingRight: 28 }]}>
                              CONVITE FAMILIAR (QR CODE VÁLIDO POR 24H):
                            </Text>

                            <View style={{ alignItems: 'center', marginVertical: 14, padding: 12, backgroundColor: '#fff', borderRadius: 12 }}>
                              <QRCode
                                value={generatedInvite.invitationCode || generatedInvite.code}
                                size={180}
                                color="#000"
                                backgroundColor="#fff"
                              />
                            </View>

                            <Text style={[styles.inviteCodeSub, { color: theme.textDim, textAlign: 'center', marginBottom: 12 }]}>
                              Aponte a câmera no app do familiar ou envie o link direto por WhatsApp / Mensagem.
                            </Text>

                            {/* Botão Premium: Compartilhar Link de Convite */}
                            <TouchableOpacity
                              style={[styles.planActionButton, { backgroundColor: theme.accentLime, marginBottom: 8 }]}
                              onPress={handleShareFamilyInvite}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="share-social-outline" size={16} color="#000" />
                              <Text style={[styles.planActionButtonText, { color: '#000' }]}>Compartilhar Link de Convite</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                marginTop: 4,
                                paddingVertical: 8,
                                alignItems: 'center',
                                borderRadius: 8,
                                backgroundColor: 'rgba(255,255,255,0.06)'
                              }}
                              onPress={() => setGeneratedInvite(null)}
                            >
                              <Text style={{ color: theme.textDim, fontSize: 12, fontWeight: '600' }}>Fechar Convite</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Botão de Cancelamento de Assinatura - ESTRITAMENTE para o Gestor / Titular */}
                        <TouchableOpacity
                          style={{
                            marginTop: 10,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: 'rgba(239, 68, 68, 0.4)',
                            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                          onPress={handleCancelFamilySubscription}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                          <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>Cancelar Assinatura</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      /* Integrante Convidado: Visão simplificada sem acesso administrativo ou financeiro */
                      <View style={{ paddingVertical: 6 }}>
                        <Text style={[styles.darkCardDesc, { color: theme.textDim, fontSize: 12, lineHeight: 18 }]}>
                          Seu dispositivo faz parte de um plano gerido pelo titular financeiro da família. Você usufrui de zero anúncios e listas de compras compartilhadas em tempo real.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Opções de Compra (Caso NÃO seja Core Familiar) */}
                {entitlement?.tier !== TIERS.FAMILY_PREMIUM && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {/* Card Opção 1: Sem Anúncios Vitalício */}
                    {entitlement?.tier !== TIERS.LIFETIME_NO_ADS && (
                      <View style={[styles.planOptionCard, { backgroundColor: theme.cardSubBg, borderColor: theme.borderSubtle }]}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                            <Ionicons name="shield-checkmark" size={16} color={theme.accentLime} style={{ marginRight: 6 }} />
                            <Text style={[styles.planOptionTitle, { color: theme.textMain }]}>Sem Anúncios Vitalício</Text>
                          </View>
                          <Text style={[styles.planOptionDesc, { color: theme.textDim }]}>
                            Remova todos os banners do aplicativo para sempre. Pagamento único.
                          </Text>
                          <Text style={[styles.planOptionPrice, { color: theme.accentLime }]}>R$ 3,99 (única vez)</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.planOptionBuyBtn, { backgroundColor: theme.accentLime }]}
                          onPress={handlePurchaseLifetimeNoAds}
                          disabled={purchasingPlan}
                          activeOpacity={0.8}
                        >
                          {purchasingPlan ? (
                            <ActivityIndicator size="small" color="#000" />
                          ) : (
                            <Text style={styles.planOptionBuyBtnText}>Comprar</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Card Opção 2: Core Familiar */}
                    <View style={[styles.planOptionCard, { backgroundColor: theme.cardSubBg, borderColor: theme.accentLime }]}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                          <Ionicons name="people" size={16} color={theme.accentLime} style={{ marginRight: 6 }} />
                          <Text style={[styles.planOptionTitle, { color: theme.textMain }]}>Core Familiar (Até 3 celulares)</Text>
                        </View>
                        <Text style={[styles.planOptionDesc, { color: theme.textDim }]}>
                          1 Titular + 2 Familiares. Listas compartilhadas e todos sem anúncios.
                        </Text>
                        <Text style={[styles.planOptionPrice, { color: theme.accentLime }]}>R$ 5,99 / mês</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.planOptionBuyBtn, { backgroundColor: theme.accentLime }]}
                        onPress={() => setSalesModalVisible(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.planOptionBuyBtnText}>Saber Mais</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Entrar em Família Existente Estritamente com QR Code */}
                    <View style={{ marginTop: 6 }}>
                      <Text style={[styles.planSubLabel, { color: theme.textDim }]}>
                        Recebeu um convite de familiar?
                      </Text>

                      {/* Botão Único Obrigatório de Escanear QR Code */}
                      <TouchableOpacity
                        style={[styles.scanQrButton, { backgroundColor: theme.cardSubBg, borderColor: theme.accentLime }]}
                        onPress={handleOpenQrScanner}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="qr-code-outline" size={20} color={theme.accentLime} style={{ marginRight: 8 }} />
                        <Text style={[styles.scanQrButtonText, { color: theme.textMain }]}>Escanear QR Code do Titular</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Botão de Restaurar Compras */}
                <TouchableOpacity
                  style={{ marginTop: 14, alignItems: 'center', paddingVertical: 4 }}
                  onPress={handleRestorePurchases}
                  disabled={restoringPurchases}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: theme.textDim, fontSize: 12, textDecorationLine: 'underline' }}>
                    {restoringPurchases ? 'Consultando compras na loja...' : 'Restaurar Compras Anteriores'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Status Geral */}
              <View style={[styles.darkCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="settings-outline" size={18} color={theme.accentLime} />
                  <Text style={[styles.darkCardTitle, { color: theme.textMain, margin: 0 }]}>Status do Sistema</Text>
                </View>
                <View style={[styles.statusLine, { borderBottomColor: theme.borderSubtle }]}>
                  <Text style={[styles.statusLabel, { color: theme.textDim }]}>Chave Gemini:</Text>
                  <Text style={[styles.statusValue, { color: apiConfig.configured ? theme.accentLime : '#ef4444' }]}>
                    {apiConfig.configured ? `● Conectada (${apiConfig.maskedKey})` : '○ Não configurada'}
                  </Text>
                </View>
                <View style={[styles.statusLine, { borderBottomColor: theme.borderSubtle }]}>
                  <Text style={[styles.statusLabel, { color: theme.textDim }]}>Cidade Calibrada:</Text>
                  <Text style={[styles.statusValue, { color: apiConfig.user_city ? theme.accentLime : '#eab308' }]}>
                    {apiConfig.user_city ? `${apiConfig.user_city} - ${apiConfig.user_state}` : 'Não informada (Média Brasil)'}
                  </Text>
                </View>
              </View>

              {/* Localização da Praça - Campo Único Padronizado com Tag de UF e Dropdown */}
              <View style={[styles.darkCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="location-outline" size={18} color={theme.accentLime} />
                    <Text style={[styles.darkCardTitle, { color: theme.textMain, margin: 0 }]}>Sua Cidade & Região</Text>
                  </View>
                  {apiConfig.user_city ? (
                    <View style={[styles.savedCityPill, { backgroundColor: theme.accentLimeSub, borderColor: theme.accentLime }]}>
                      <Text style={[styles.savedCityPillText, { color: theme.accentLime }]}>
                        {apiConfig.user_city} - {apiConfig.user_state}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.darkCardDesc, { color: theme.textMuted }]}>
                  A inteligência artificial pesquisa os preços normais do seu município para auditar se a promoção do encarte é vantajosa.
                </Text>

                {/* Feedback de salvamento automático */}
                {locationSavedToast && (
                  <View style={[styles.toastBanner, { backgroundColor: theme.accentLimeSub, borderColor: theme.accentLime }]}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.accentLime} />
                    <Text style={[styles.toastBannerText, { color: theme.accentLime }]}>{locationSavedToast}</Text>
                  </View>
                )}

                {/* Campo Único de Input Padronizado */}
                <View style={{ marginTop: 12 }}>
                  {!selectedUf ? (
                    /* Fase 1: Nenhum UF selecionado - Usuário clica no campo para escolher o Estado */
                    <TouchableOpacity
                      style={[styles.unifiedInputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.borderSubtle }]}
                      onPress={() => setShowUfModal(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="map-outline" size={18} color={theme.accentLime} />
                      <Text style={[styles.unifiedInputPlaceholder, { color: theme.textDim, flex: 1 }]}>
                        1º Toque aqui para selecionar seu Estado (UF)...
                      </Text>
                      <View style={[styles.chooseUfBtn, { backgroundColor: theme.cardSubBg }]}>
                        <Text style={[styles.chooseUfBtnText, { color: theme.accentLime }]}>Escolher UF</Text>
                        <Ionicons name="chevron-down" size={14} color={theme.accentLime} />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    /* Fase 2: UF selecionado com Tag destacada e Input de Cidade com Dropdown */
                    <View style={[styles.unifiedInputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.accentLime }]}>
                      {/* Tag do UF Marcada sobre/dentro do input */}
                      <View style={[styles.ufTagBadge, { backgroundColor: theme.accentLimeSub, borderColor: theme.accentLime }]}>
                        <Ionicons name="location" size={12} color={theme.accentLime} />
                        <Text style={[styles.ufTagBadgeText, { color: theme.accentLime }]}>{selectedUf}</Text>
                        <TouchableOpacity
                          onPress={handleClearUf}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={{ marginLeft: 4 }}
                        >
                          <Ionicons name="close-circle" size={16} color={theme.accentLime} />
                        </TouchableOpacity>
                      </View>

                      {/* Input de digitação da Cidade */}
                      <TextInput
                        style={[styles.unifiedCityInputText, { color: theme.textMain }]}
                        placeholder="2º Digite sua cidade (ex: Rio Preto, Olímpia)..."
                        placeholderTextColor={theme.textDim}
                        value={cityInput}
                        onChangeText={handleCityInputChange}
                        autoFocus={!cityInput}
                      />

                      {isLoadingCities && (
                        <ActivityIndicator size="small" color={theme.accentLime} style={{ marginRight: 6 }} />
                      )}

                      {cityInput.length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setCityInput('');
                            setCitySuggestions([]);
                            setShowCitySuggestions(false);
                          }}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="close" size={16} color={theme.textDim} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Dropdown de Sugestões de Cidades do IBGE */}
                  {selectedUf && showCitySuggestions && (
                    <View style={[styles.citySuggestionsContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                      {isLoadingCities ? (
                        <View style={styles.cityDropdownLoadingRow}>
                          <ActivityIndicator size="small" color={theme.accentLime} />
                          <Text style={[styles.cityDropdownLoadingText, { color: theme.textDim }]}>
                            Filtrando cidades de {selectedUf}...
                          </Text>
                        </View>
                      ) : citySuggestions.length > 0 ? (
                        <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                          {citySuggestions.map((cityName, idx) => (
                            <TouchableOpacity
                              key={`${cityName}-${idx}`}
                              style={[styles.citySuggestionRow, { borderBottomColor: theme.borderSubtle }]}
                              onPress={() => handleSelectCity(cityName)}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Ionicons name="location-outline" size={16} color={theme.accentLime} />
                                <Text style={[styles.citySuggestionName, { color: theme.textMain }]}>
                                  {cityName}
                                </Text>
                              </View>
                              <View style={[styles.cityStateMiniTag, { backgroundColor: theme.cardSubBg }]}>
                                <Text style={[styles.cityStateMiniTagText, { color: theme.accentLime }]}>{selectedUf}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : (
                        <View style={styles.cityDropdownEmptyBox}>
                          <Ionicons name="alert-circle-outline" size={20} color={theme.textDim} />
                          <Text style={[styles.cityDropdownEmptyText, { color: theme.textDim }]}>
                            Nenhuma cidade encontrada para "{cityInput}" em {selectedUf}.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Tutorial Passo a Passo: Gerar Chave Gratuita da Inteligência Artificial (Google) */}
              <View style={[styles.darkCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="sparkles" size={20} color={theme.accentLime} />
                  <Text style={[styles.darkCardTitle, { color: theme.accentLime, margin: 0, fontSize: 15 }]}>
                    Como Obter sua Chave Gratuita do Google
                  </Text>
                </View>

                {/* Destaque de Gratuidade e Segurança */}
                <View style={[styles.freeNoticeBox, { backgroundColor: theme.cardSubBg, borderColor: theme.borderSubtle }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="shield-checkmark" size={16} color={theme.accentLime} />
                    <Text style={[styles.freeNoticeTitle, { color: theme.textMain }]}>100% Gratuito e Seguro</Text>
                  </View>
                  <Text style={[styles.freeNoticeText, { color: theme.textMuted }]}>
                    • O Google <Text style={{ fontWeight: '800', color: theme.textMain }}>não cobra nada</Text> e <Text style={{ fontWeight: '800', color: theme.textMain }}>não pede cartão</Text> de crédito.{'\n'}
                    • Demora <Text style={{ fontWeight: '800', color: theme.accentLime }}>menos de 1 minuto</Text> usando sua conta normal do Gmail.{'\n'}
                    • A chave permite que a IA compare os encartes com os preços reais do mercado.
                  </Text>
                </View>

                {/* Passo 1 */}
                <View style={styles.tutorialStepRow}>
                  <View style={[styles.tutorialStepBadge, { backgroundColor: theme.accentLime }]}>
                    <Text style={styles.tutorialStepBadgeText}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tutorialStepTitle, { color: theme.textMain }]}>Abrir a página oficial do Google</Text>
                    <Text style={[styles.tutorialStepDesc, { color: theme.textDim }]}>
                      Toque no botão verde abaixo para abrir a página oficial onde o Google disponibiliza as chaves gratuitas:
                    </Text>
                    <TouchableOpacity
                      style={[styles.externalLinkBtn, { backgroundColor: theme.accentLimeSub, borderColor: theme.accentLime }]}
                      onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}
                    >
                      <Ionicons name="open-outline" size={16} color={theme.accentLime} />
                      <Text style={[styles.externalLinkBtnText, { color: theme.accentLime }]}>
                        Abrir Página do Google (AI Studio) ↗
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Passo 2 */}
                <View style={styles.tutorialStepRow}>
                  <View style={[styles.tutorialStepBadge, { backgroundColor: theme.accentLime }]}>
                    <Text style={styles.tutorialStepBadgeText}>2</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tutorialStepTitle, { color: theme.textMain }]}>Entrar com seu Gmail</Text>
                    <Text style={[styles.tutorialStepDesc, { color: theme.textDim }]}>
                      Faça login com a mesma conta do Google (Gmail) que você já usa no seu celular. Se aparecer uma telinha pedindo para aceitar termos, marque a caixinha e toque no botão azul.
                    </Text>
                  </View>
                </View>

                {/* Passo 3 */}
                <View style={styles.tutorialStepRow}>
                  <View style={[styles.tutorialStepBadge, { backgroundColor: theme.accentLime }]}>
                    <Text style={styles.tutorialStepBadgeText}>3</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tutorialStepTitle, { color: theme.textMain }]}>Tocar no botão 'Criar chave de API'</Text>
                    <Text style={[styles.tutorialStepDesc, { color: theme.textDim }]}>
                      Na parte superior da tela, localize e toque no botão <Text style={{ fontWeight: '800', color: theme.textMain }}>"Criar chave de API"</Text> (ou "Create API key"). É um botão localizado no topo da tela. Em seguida, selecione o projeto e confirme na janelinha que abrir.
                    </Text>
                  </View>
                </View>

                {/* Passo 4 */}
                <View style={styles.tutorialStepRow}>
                  <View style={[styles.tutorialStepBadge, { backgroundColor: theme.accentLime }]}>
                    <Text style={styles.tutorialStepBadgeText}>4</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tutorialStepTitle, { color: theme.textMain }]}>Copiar o código da chave</Text>
                    <Text style={[styles.tutorialStepDesc, { color: theme.textDim }]}>
                      O Google vai exibir uma sequência de letras e números que começa com <Text style={{ fontWeight: '800', color: theme.accentLime }}>AIzaSy...</Text>. Ao lado do código, toque no botãozinho <Text style={{ fontWeight: '800', color: theme.textMain }}>"Copy"</Text> (Copiar).
                    </Text>
                  </View>
                </View>

                {/* Passo 5 */}
                <View style={[styles.tutorialStepRow, { marginBottom: 0 }]}>
                  <View style={[styles.tutorialStepBadge, { backgroundColor: theme.accentLime }]}>
                    <Text style={styles.tutorialStepBadgeText}>5</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tutorialStepTitle, { color: theme.textMain }]}>Voltar para este app e colar</Text>
                    <Text style={[styles.tutorialStepDesc, { color: theme.textDim }]}>
                      Volte para esta tela, dê um toque longo dentro da caixinha <Text style={{ fontWeight: '700', color: theme.textMain }}>"Cole sua chave..."</Text> abaixo e escolha <Text style={{ fontWeight: '800', color: theme.textMain }}>Colar</Text>. Depois, toque no botão <Text style={{ fontWeight: '800', color: theme.accentLime }}>"Salvar"</Text>. Pronto!
                    </Text>
                  </View>
                </View>
              </View>

              {/* Chave de API */}
              <View style={[styles.darkCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name="key-outline" size={18} color={theme.accentLime} />
                  <Text style={[styles.darkCardTitle, { color: theme.textMain, margin: 0 }]}>Chave Gemini (Google AI Studio)</Text>
                </View>
                <Text style={[styles.darkCardDesc, { color: theme.textMuted }]}>
                  Sua chave de API gratuita e pessoal para rodar a IA sem custo:
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <TextInput
                    style={[styles.darkInput, { flex: 1, backgroundColor: theme.inputBg, borderColor: theme.borderSubtle, color: theme.textMain }]}
                    placeholder={apiConfig.configured ? "Chave salva (ou cole uma nova)" : "Cole sua chave AIzaSy..."}
                    placeholderTextColor={theme.textDim}
                    secureTextEntry={!showKey}
                    value={inputApiKey}
                    onChangeText={setInputApiKey}
                  />
                  <TouchableOpacity onPress={() => setShowKey(!showKey)} style={{ padding: 10 }}>
                    <Ionicons name={showKey ? "eye-off" : "eye"} size={20} color={theme.textDim} />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { flex: 1, backgroundColor: theme.cardSubBg, borderColor: theme.border }]}
                    onPress={handleTestApiKey}
                    disabled={testingKey}
                  >
                    <Ionicons name="flash-outline" size={16} color={theme.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.secondaryButtonText, { color: theme.textMuted }]}>
                      {testingKey ? "Testando..." : "Testar Chave"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryLimeButton, { flex: 1, backgroundColor: theme.accentLime }]}
                    onPress={handleSaveSettings}
                    disabled={savingSettings}
                  >
                    <Ionicons name="save-outline" size={16} color="#000" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryLimeButtonText}>
                      {savingSettings ? "Salvando..." : "Salvar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Card Modo Superuser (Dev) */}
              <View style={[styles.darkCard, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={theme.accentLime} />
                      <Text style={[styles.darkCardTitle, { color: theme.textMain, margin: 0 }]}>
                        Modo Superuser (Dev)
                      </Text>
                    </View>
                    <Text style={[styles.darkCardDesc, { color: theme.textMuted, marginTop: 4 }]}>
                      {isSuperuserMode 
                        ? 'Ativado: compras e assinaturas ignoram a loja e ativam localmente para testes.' 
                        : 'Desativado: compras e assinaturas redirecionam para a Google Play / App Store oficial.'}
                    </Text>
                  </View>
                  <Switch
                    value={isSuperuserMode}
                    onValueChange={handleToggleSuperuser}
                    trackColor={{ false: theme.cardSubBg, true: theme.accentLime }}
                    thumbColor={isSuperuserMode ? '#000' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* Card IP Backend visível APENAS durante desenvolvimento com Expo Go (__DEV__) */}
              {__DEV__ && (
                <View style={[styles.darkCard, { borderColor: '#eab308', borderStyle: 'dashed', backgroundColor: theme.cardBg }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="construct-outline" size={16} color="#eab308" />
                    <Text style={[styles.darkCardTitle, { color: '#eab308', margin: 0 }]}>
                      Configuração de Dev (Expo Go)
                    </Text>
                  </View>
                  <Text style={[styles.darkCardDesc, { color: theme.textMuted }]}>
                    Este painel é exclusivo de testes em desenvolvimento e não aparece no APK final:
                  </Text>
                  <TextInput
                    style={[styles.darkInput, { marginTop: 8, backgroundColor: theme.inputBg, borderColor: theme.borderSubtle, color: theme.textMain }]}
                    value={inputApiHost}
                    onChangeText={setInputApiHost}
                    placeholder="http://192.168.x.x:3001/api"
                    placeholderTextColor={theme.textDim}
                  />
                  <TouchableOpacity
                    style={[styles.secondaryButton, { marginTop: 8, backgroundColor: theme.cardSubBg, borderColor: theme.border }]}
                    onPress={() => {
                      setApiBase(inputApiHost.trim());
                      Alert.alert('Reconectado', 'Endereço do backend atualizado com sucesso.');
                    }}
                  >
                    <Text style={[styles.secondaryButtonText, { color: theme.textMuted }]}>Reconectar Servidor</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          {/* MODAL "ADICIONAR ITEM À LISTA" */}
          <Modal
            visible={addModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setAddModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalSheet, { backgroundColor: theme.cardBg }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: theme.textMain }]}>Adicionar item à lista</Text>
                  <TouchableOpacity onPress={() => setAddModalVisible(false)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={24} color={theme.textMain} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.modalSearchBox, { backgroundColor: theme.inputBg }]}>
                  <Ionicons name="search" size={18} color={theme.textDim} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.modalInput, { color: theme.textMain }]}
                    placeholder="Digite o item (ex: acuc, arroz, leite, cebola)..."
                    placeholderTextColor={theme.textDim}
                    value={inputValue}
                    onChangeText={setInputValue}
                    autoFocus={true}
                  />
                  {inputValue.length > 0 && (
                    <TouchableOpacity onPress={() => setInputValue('')}>
                      <Ionicons name="close-circle" size={18} color={theme.textDim} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Opções de Adição Imediata e Padronização Inteligente com IA */}
                {inputValue.trim().length >= 1 && (() => {
                  const cleanInput = inputValue.trim().toLowerCase();
                  const hasExactMatch = suggestions.some(s => s.trim().toLowerCase() === cleanInput);

                  return (
                    <View style={styles.addItemQuickActions}>
                      {hasExactMatch ? (
                        <TouchableOpacity
                          style={[styles.quickAddButton, { backgroundColor: theme.accentLime }]}
                          onPress={() => handleSelectItem(inputValue.trim())}
                          disabled={isSubmittingItem || isStandardizingWithAi}
                        >
                          <Ionicons name="add-circle" size={18} color="#000" />
                          <Text style={styles.quickAddButtonText} numberOfLines={1}>
                            Adicionar "{inputValue.trim()}"
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.sanitizationWarningBox, { backgroundColor: isDarkMode ? '#1a1811' : '#fffbeb', borderColor: isDarkMode ? '#854d0e' : '#fde047' }]}>
                          <Ionicons name="alert-circle-outline" size={16} color={isDarkMode ? '#fbbf24' : '#d97706'} style={{ marginRight: 6 }} />
                          <Text style={[styles.sanitizationWarningText, { color: isDarkMode ? '#fde68a' : '#92400e' }]}>
                            Nome não padronizado. Toque em Padronizar com IA abaixo ou selecione uma opção da gôndola.
                          </Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.quickAiButton,
                          {
                            backgroundColor: isDarkMode ? '#0f291e' : '#ecfdf5',
                            borderColor: theme.accentLime,
                            flex: hasExactMatch ? 1 : undefined,
                            width: hasExactMatch ? undefined : '100%',
                          }
                        ]}
                        onPress={handleStandardizeWithAi}
                        disabled={isSubmittingItem || isStandardizingWithAi}
                      >
                        {isStandardizingWithAi ? (
                          <ActivityIndicator size="small" color={theme.accentLime} />
                        ) : (
                          <Ionicons name="sparkles" size={16} color={theme.accentLime} />
                        )}
                        <Text style={[styles.quickAiButtonText, { color: theme.accentLime }]}>
                          {isStandardizingWithAi ? 'Padronizando com IA...' : 'Padronizar com Gemini IA ✨'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                <Text style={[styles.modalSectionLabel, { color: theme.accentLime }]}>GÔNDOLA PADRONIZADA (TOQUE PARA ADICIONAR):</Text>
                <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                  {suggestions.map((sug, idx) => {
                    const icon = getItemIcon(sug);
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.suggestionRow, { borderBottomColor: theme.borderSubtle }]}
                        onPress={() => handleSelectItem(sug)}
                      >
                        <View style={[styles.suggestionIconBox, { backgroundColor: theme.cardSubBg }]}>
                          <Ionicons name={icon} size={20} color={theme.accentLime} />
                        </View>
                        <View style={{ flex: 1, paddingHorizontal: 12 }}>
                          <Text style={[styles.suggestionName, { color: theme.textMain }]}>{sug}</Text>
                          <Text style={[styles.suggestionSub, { color: theme.textDim }]}>Supermercado / Feira</Text>
                        </View>
                        <Ionicons name="add-circle" size={24} color={theme.accentLime} />
                      </TouchableOpacity>
                    );
                  })}

                  {inputValue.length >= 2 && suggestions.length === 0 && (
                    <View style={{ alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 }}>
                      <Ionicons name="basket-outline" size={32} color={theme.textDim} style={{ marginBottom: 6 }} />
                      <Text style={{ color: theme.textDim, textAlign: 'center', fontSize: 13, marginBottom: 4 }}>
                        Nenhum item pré-cadastrado na gôndola para "{inputValue}".
                      </Text>
                      <Text style={{ color: theme.textMuted, textAlign: 'center', fontSize: 11 }}>
                        Toque em Adicionar acima para incluir como digitado ou em Padronizar com Gemini IA!
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.bigLimeButton, { marginTop: 16, backgroundColor: theme.accentLime }]}
                  onPress={() => setAddModalVisible(false)}
                >
                  <Text style={styles.bigLimeButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* MODAL DE VISUALIZAÇÃO NATIVA DO ENCARTE (PDF OU IMAGEM NO PRÓPRIO APP) */}
          <Modal
            visible={viewerModalVisible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setViewerModalVisible(false)}
          >
            <SafeAreaView style={[styles.viewerSafeArea, { backgroundColor: isDarkMode ? '#0a0a0a' : '#f8fafc' }]}>
              {/* Header do Visualizador */}
              <View style={[styles.viewerHeader, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="business-outline" size={16} color={theme.accentLime} />
                    <Text style={[styles.viewerTitle, { color: theme.textMain, margin: 0, flex: 1 }]} numberOfLines={1}>
                      {viewingFlyer?.supermarket_name || 'Encarte'}
                    </Text>
                  </View>
                  <Text style={[styles.viewerSubtitle, { color: theme.textDim, marginTop: 2 }]} numberOfLines={1}>
                    Visualização Nativa • {viewingFlyer?.original_filename || 'Arquivo do Encarte'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.viewerCloseBtn, { backgroundColor: theme.cardSubBg }]}
                  onPress={() => setViewerModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color={theme.textMain} />
                  <Text style={[styles.viewerCloseBtnText, { color: theme.textMain }]}>Fechar</Text>
                </TouchableOpacity>
              </View>

              {/* Corpo do Visualizador */}
              <View style={styles.viewerBody}>
                {viewingFlyer ? (
                  // VISUALIZADOR UNIVERSAL IN-APP (PDFS MULTI-PÁGINAS E IMAGENS COM ZOOM E CONTROLES)
                  <WebView
                    key={viewingFlyer.id}
                    style={styles.viewerWebView}
                    originWhitelist={['*']}
                    scalesPageToFit={true}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowFileAccess={true}
                    allowUniversalAccessFromFileURLs={true}
                    mixedContentMode="always"
                    source={{
                      uri: `${apiBase.endsWith('/api') ? apiBase.replace('/api', '') : apiBase}/api/flyers/${viewingFlyer.id}/viewer`
                    }}
                    startInLoadingState={true}
                    renderLoading={() => (
                      <View style={styles.viewerLoadingBox}>
                        <ActivityIndicator size="large" color={theme.accentLime} />
                        <Text style={[styles.viewerLoadingText, { color: theme.accentLime }]}>
                          Carregando encarte em alta resolução...
                        </Text>
                      </View>
                    )}
                  />
                ) : (
                  <View style={styles.viewerLoadingBox}>
                    <Ionicons name="document-text-outline" size={48} color={theme.textDim} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                      Arquivo do encarte não disponível no servidor.
                    </Text>
                  </View>
                )}
              </View>
            </SafeAreaView>
          </Modal>

          {/* MODAL DE SELEÇÃO DE ESTADO (UF) */}
          <Modal
            visible={showUfModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowUfModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalSheet, { backgroundColor: theme.cardBg }]}>
                <View style={styles.modalHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="map" size={22} color={theme.accentLime} />
                    <Text style={[styles.modalTitle, { color: theme.textMain }]}>Selecione seu Estado (UF)</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowUfModal(false)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={24} color={theme.textMain} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.modalSearchBox, { backgroundColor: theme.inputBg }]}>
                  <Ionicons name="search" size={18} color={theme.textDim} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.modalInput, { color: theme.textMain }]}
                    placeholder="Pesquisar estado (ex: SP, São Paulo, PR)..."
                    placeholderTextColor={theme.textDim}
                    value={ufSearchQuery}
                    onChangeText={setUfSearchQuery}
                    autoCapitalize="words"
                  />
                  {ufSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setUfSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color={theme.textDim} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[styles.modalSectionLabel, { color: theme.accentLime }]}>
                  ESTADOS BRASILEIROS ({filteredStates.length}):
                </Text>

                <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                  <View style={styles.statesGridContainer}>
                    {filteredStates.map((st) => (
                      <TouchableOpacity
                        key={st.uf}
                        style={[
                          styles.stateCardItem,
                          {
                            backgroundColor: selectedUf === st.uf ? theme.accentLime : theme.cardSubBg,
                            borderColor: selectedUf === st.uf ? theme.accentLime : theme.borderSubtle
                          }
                        ]}
                        onPress={() => handleSelectUf(st.uf)}
                      >
                        <Text style={[
                          styles.stateUfBadge,
                          { color: selectedUf === st.uf ? '#000' : theme.accentLime }
                        ]}>
                          {st.uf}
                        </Text>
                        <Text style={[
                          styles.stateFullName,
                          { color: selectedUf === st.uf ? '#000' : theme.textMain }
                        ]} numberOfLines={1}>
                          {st.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* MODAL SCANNER NATIVO DE QR CODE (EXPO-CAMERA) */}
          <QrScannerModal
            visible={qrScannerVisible}
            onClose={() => setQrScannerVisible(false)}
            onScan={(scannedCode) => {
              setQrScannerVisible(false);
              handleJoinFamilyWithCode(scannedCode);
            }}
            theme={theme}
            isDarkMode={isDarkMode}
          />

          {/* MODAL DE VENDAS COM COPYWRITING DO CORE FAMILIAR */}
          <FamilyCoreSalesModal
            visible={salesModalVisible}
            onClose={() => setSalesModalVisible(false)}
            onSubscribe={() => {
              setSalesModalVisible(false);
              handlePurchaseFamilySubscription();
            }}
            purchasingPlan={purchasingPlan}
            theme={theme}
            isDarkMode={isDarkMode}
          />

          {/* MODAL DE EDIÇÃO DE NOME DE PRODUTO */}
          <EditItemModal
            visible={editModalVisible}
            item={editingItem}
            itemName={editItemName}
            onChangeItemName={setEditItemName}
            itemQuantity={editItemQuantity}
            onChangeItemQuantity={setEditItemQuantity}
            itemBrand={editItemBrand}
            onChangeItemBrand={setEditItemBrand}
            onSave={handleSaveEditItem}
            onClose={handleCloseEditItem}
            isSaving={isSavingEdit}
            theme={theme}
            isDarkMode={isDarkMode}
          />

          {/* MODAL DE FILTRO POR SUPERMERCADO (ACTION SHEET ESCALÁVEL) */}
          <MarketFilterModal
            visible={marketFilterModalVisible}
            markets={activeOfferSupermarkets}
            activeMarket={activeFilter}
            onSelectMarket={(market) => {
              setActiveFilter(market);
              setMarketFilterModalVisible(false);
            }}
            onClose={() => setMarketFilterModalVisible(false)}
            theme={theme}
            isDarkMode={isDarkMode}
          />

          {/* MODAL DE GERENCIAMENTO DE PARTICIPANTES DO CORE FAMILIAR */}
          <FamilyManagementModal
            visible={familyManagementModalVisible}
            onClose={() => setFamilyManagementModalVisible(false)}
            familyCoreId={familyCoreData?.familyCoreId || entitlement?.familyCoreId}
            requesterDeviceId={deviceId}
            apiBase={apiBase}
            theme={theme}
            isDarkMode={isDarkMode}
          />

          {/* MODAL DE RESOLUÇÃO CONSENSUAL DE CONFLITO DE QUANTIDADE (SEÇÃO 17.2) */}
          <Modal
            visible={!!conflictModalData}
            transparent={true}
            animationType="fade"
            onRequestClose={() => handleResolveConflict(conflictModalData?.serverQuantity || 1)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.conflictModalContainer, { backgroundColor: theme.cardBg, borderColor: theme.borderSubtle }]}>
                <View style={styles.conflictModalHeader}>
                  <Ionicons name="git-compare-outline" size={24} color="#f59f00" />
                  <Text style={[styles.conflictModalTitle, { color: theme.textMain }]}>
                    Conflito de Quantidade
                  </Text>
                </View>
                <Text style={[styles.conflictModalSubtitle, { color: theme.textDim }]}>
                  O item <Text style={{ fontWeight: '700', color: theme.textMain }}>"{conflictModalData?.itemName || 'Item'}"</Text> foi alterado simultaneamente em outro aparelho. Escolha qual quantidade deseja manter na lista compartilhada:
                </Text>

                <View style={styles.conflictOptionsRow}>
                  <TouchableOpacity
                    style={[styles.conflictOptionBtn, { borderColor: theme.borderSubtle, backgroundColor: theme.cardSubBg }]}
                    onPress={() => handleResolveConflict(conflictModalData?.serverQuantity)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.conflictOptionLabel, { color: theme.textDim }]}>Outro Aparelho / Nuvem</Text>
                    <Text style={[styles.conflictOptionQty, { color: theme.accentLime }]}>{conflictModalData?.serverQuantity} un</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.conflictOptionBtn, { borderColor: theme.accentLime, backgroundColor: isDarkMode ? '#1e3320' : '#e6fcf5' }]}
                    onPress={() => handleResolveConflict(conflictModalData?.clientQuantity)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.conflictOptionLabel, { color: theme.textDim }]}>Este Aparelho</Text>
                    <Text style={[styles.conflictOptionQty, { color: theme.accentLime }]}>{conflictModalData?.clientQuantity} un</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    paddingBottom: 16,
  },
  locationDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cartIndicatorsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cartIndicatorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  cartIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIndicatorNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  cartIndicatorLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabsBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  tableColHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  productListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
  },
  productIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeCheckDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  productTitleInactive: {
    textDecorationLine: 'line-through',
  },
  productCategory: {
    fontSize: 11,
    marginTop: 2,
  },
  dealTagSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  dealTagSmallText: {
    fontSize: 9,
    fontWeight: '900',
  },
  productPriceText: {
    fontSize: 14,
    fontWeight: '900',
  },
  discountTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bigLimeButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  bigLimeButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  darkCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  darkCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  darkCardDesc: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  photoActionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  uploadingBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  uploadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  flyerHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  flyerSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sundayBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
  },
  purgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  purgeBtnText: {
    fontSize: 11,
    color: '#f87171',
    fontWeight: '700',
  },
  flyerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 10,
  },
  supermarketHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  flyerDateText: {
    fontSize: 11,
    marginTop: 2,
  },
  offersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  offerItemCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  matchBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  matchBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  verdictBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  verdictBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#000',
  },
  offerItemName: {
    fontSize: 12,
    fontWeight: '700',
    minHeight: 32,
  },
  offerItemPrice: {
    fontSize: 15,
    fontWeight: '900',
  },
  offerItemUnit: {
    fontSize: 10,
    marginLeft: 2,
  },
  offerItemOldPrice: {
    fontSize: 9,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  statusLabel: {
    fontSize: 12,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  darkInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  primaryLimeButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLimeButtonText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
  },
  secondaryButton: {
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontWeight: '800',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  modalInput: {
    flex: 1,
    fontSize: 14,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  suggestionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  // Tutorial Chave Gemini
  tutorialStepRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 12,
  },
  tutorialStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tutorialStepBadgeText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  tutorialStepTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  tutorialStepDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  externalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  externalLinkBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Busca e Paginação de Encartes
  searchSupermarketLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
  },
  searchSupermarketBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchSupermarketInput: {
    flex: 1,
    fontSize: 13,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 12,
    gap: 6,
  },
  pageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
  pageNumberBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pageNumberText: {
    fontSize: 13,
    fontWeight: '800',
  },

  // Accordion & Ações dos Encartes
  collapseBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flyerActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  viewFlyerNativeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  viewFlyerNativeBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  toggleCollapseTextBtn: {
    paddingVertical: 4,
  },
  toggleCollapseText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Visualizador Nativo Fullscreen (Modal)
  viewerSafeArea: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  viewerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  viewerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  viewerCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewerCloseBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  viewerBody: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  viewerLoadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  viewerLoadingText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  viewerWebView: {
    flex: 1,
    backgroundColor: '#111827',
  },
  imageViewerScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenFlyerImage: {
    width: '100%',
    height: '100%',
    minHeight: 500,
  },

  // Localização Unificada UF + Cidade
  savedCityPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  savedCityPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  toastBannerText: {
    fontSize: 12,
    fontWeight: '800',
  },
  unifiedInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    minHeight: 48,
  },
  unifiedInputPlaceholder: {
    fontSize: 13,
  },
  chooseUfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chooseUfBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  ufTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  ufTagBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  unifiedCityInputText: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 2,
  },
  citySuggestionsContainer: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  cityDropdownLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  cityDropdownLoadingText: {
    fontSize: 12,
  },
  citySuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  citySuggestionName: {
    fontSize: 13,
    fontWeight: '700',
  },
  cityStateMiniTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cityStateMiniTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cityDropdownEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cityDropdownEmptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  // Modal de Estados Grid
  statesGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
  },
  stateCardItem: {
    width: '31%',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateUfBadge: {
    fontSize: 15,
    fontWeight: '900',
  },
  stateFullName: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  // Destaque de gratuidade no tutorial
  freeNoticeBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  freeNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  freeNoticeText: {
    fontSize: 11,
    lineHeight: 16,
  },
  // Ações Rápidas no Modal de Adicionar Item
  addItemQuickActions: {
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  quickAddButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  quickAiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickAiButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Estilos de Monetização e Planos (Etapa 1)
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  planOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  planOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  planOptionDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 4,
  },
  planOptionPrice: {
    fontSize: 12,
    fontWeight: '900',
  },
  planOptionBuyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  planOptionBuyBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  planActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  planActionButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  inviteCodeBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  inviteCodeTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inviteCodeText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
    marginVertical: 4,
  },
  inviteCodeSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  planSubLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  planInviteInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  planInviteJoinBtn: {
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planInviteJoinBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },

  // QR Code Scanner Trigger Button
  scanQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  scanQrButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },

  // Input Sanitization Warning Box
  sanitizationWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  sanitizationWarningText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },

  // Pílulas de Filtros da Minha Lista
  filterPillsWrapper: {
    marginBottom: 8,
  },
  filterThreePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scalablePill: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  filterPillsScroll: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Sincronização e Avisos do Core Familiar (ADR-012 e Seções 4 e 17)
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  canceledWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    gap: 8,
  },
  canceledWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  conflictModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  conflictModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  conflictModalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  conflictModalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  conflictOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  conflictOptionBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflictOptionLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  conflictOptionQty: {
    fontSize: 18,
    fontWeight: '800',
  },
});
