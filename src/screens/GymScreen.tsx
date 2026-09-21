import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootTabParamList, TabNavigationProp } from '../types/navigation';
import { useGym } from '../context/GymContext';
import { RoutineFolder, WorkoutRoutine } from '../types/workout';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import { ToastFeedback, ToastType } from '../components/ToastFeedback';
import { ScreenBackgroundWrapper } from '../components/ScreenBackgroundWrapper';

type SubTab = 'routines' | 'history' | 'progression' | 'exercises';
type GymScreenRouteProp = RouteProp<RootTabParamList, 'Gym'>;

const MUSCLE_GROUPS = [
  'Tutti',
  'Petto',
  'Dorso',
  'Spalle',
  'Bicipiti',
  'Tricipiti',
  'Quadricipiti',
  'Femorali',
  'Polpacci',
  'Addome',
];

export const GymScreen: React.FC = () => {
  const navigation = useNavigation<TabNavigationProp<'Gym'>>();
  const route = useRoute<GymScreenRouteProp>();
  const {
    exercises,
    routines,
    workouts,
    folders,
    userRole,
    userProfile,
    selectedClient,
    setSelectedClient,
    isDelegatedMode,
    deleteRoutine,
    deleteMultipleRoutines,
    clearAllRoutines,
    addFolder,
    updateFolder,
    deleteFolder,
    deleteMultipleFolders,
    clearAllFolders,
    deleteWorkout,
    deleteMultipleWorkouts,
    clearAllWorkouts,
    archiveExercise,
    restoreDefaultExercises,
    restoreDefaultRoutines,
    getExerciseProgression,
    calculateTotalVolume,
    reloadGymData,
  } = useGym();

  const [activeTab, setActiveTab] = useState<SubTab>(
    route.params?.initialSubTab || 'routines'
  );

  useEffect(() => {
    if (route.params?.initialSubTab) {
      setActiveTab(route.params.initialSubTab);
    }
  }, [route.params?.initialSubTab]);

  // Catalog State
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Tutti');
  const [searchQuery, setSearchQuery] = useState('');

  // Folder filter state in Schede tab
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');

  // Folder Management Modal State
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Multi-Selection State for Folders
  const [folderSelectMode, setFolderSelectMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);

  // Multi-Selection State for Routines
  const [routineSelectMode, setRoutineSelectMode] = useState(false);
  const [selectedRoutineIds, setSelectedRoutineIds] = useState<number[]>([]);

  // Multi-Selection State for Workouts
  const [workoutSelectMode, setWorkoutSelectMode] = useState(false);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<number[]>([]);

  // Progression State
  const [selectedProgressionExId, setSelectedProgressionExId] = useState<number>(1);
  const [showProgressionExPicker, setShowProgressionExPicker] = useState(false);

  // History expanded state
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<number | null>(null);

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Toast Feedback State
  const [toast, setToast] = useState<{
    visible: boolean;
    type: ToastType;
    message: string;
  }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const showToast = (type: ToastType, message: string) => {
    setToast({ visible: true, type, message });
  };

  // Pull-to-Refresh State & Handler
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadGymData();
      showToast('success', 'Dati sincronizzati con successo!');
    } catch {
      showToast('error', 'Errore durante la sincronizzazione.');
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered exercises for Catalog tab
  const filteredCatalogExercises = exercises.filter((e) => {
    const matchesMuscle =
      selectedMuscle === 'Tutti' || e.muscle_group === selectedMuscle;
    const matchesSearch =
      searchQuery.trim() === '' ||
      e.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchesMuscle && matchesSearch;
  });

  const progressionData = getExerciseProgression(selectedProgressionExId);
  const currentProgressionEx = exercises.find((e) => e.id === selectedProgressionExId);

  const handleDeleteRoutineConfirm = (id: number, name: string) => {
    setConfirmModal({
      visible: true,
      title: 'Elimina Scheda',
      message: `Sei sicuro di voler eliminare definitivamente la scheda "${name}"? L'azione non può essere annullata.`,
      confirmText: 'Elimina',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteRoutine(id);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', `Scheda "${name}" eliminata con successo.`);
        } catch (e) {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante l\'eliminazione.');
        }
      },
    });
  };

  const handleDeleteWorkoutConfirm = (id: number, name: string) => {
    setConfirmModal({
      visible: true,
      title: 'Elimina Sessione',
      message: `Vuoi rimuovere dallo storico la sessione "${name}"?`,
      confirmText: 'Elimina',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteWorkout(id);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', `Sessione "${name}" rimossa dallo storico.`);
        } catch (e) {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante l\'eliminazione della sessione.');
        }
      },
    });
  };

  const handleRestoreCatalogConfirm = () => {
    setConfirmModal({
      visible: true,
      title: 'Ripristina Catalogo Predefinito',
      message: 'Vuoi ripristinare il catalogo originario dei 46 esercizi precaricati?',
      confirmText: 'Ripristina',
      isDestructive: false,
      onConfirm: async () => {
        try {
          await restoreDefaultExercises();
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', 'Catalogo esercizi ripristinato ai valori di default.');
        } catch (e) {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante il ripristino del catalogo.');
        }
      },
    });
  };

  const handleRestoreRoutinesConfirm = () => {
    setConfirmModal({
      visible: true,
      title: 'Ripristina Schede Predefinite',
      message: 'Vuoi ripristinare i template periodizzati di default e le cartelle?',
      confirmText: 'Ripristina',
      isDestructive: false,
      onConfirm: async () => {
        try {
          await restoreDefaultRoutines();
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', 'Schede e cartelle predefinite ripristinate con successo.');
        } catch (e) {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante il ripristino delle schede.');
        }
      },
    });
  };

  // Folder CRUD Handlers
  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      showToast('error', 'Inserisci il nome della cartella.');
      return;
    }
    const exists = folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showToast('error', 'Esiste già una cartella con questo nome.');
      return;
    }
    try {
      await addFolder(trimmed);
      setNewFolderName('');
      showToast('success', `Cartella "${trimmed}" creata.`);
    } catch {
      showToast('error', 'Errore nella creazione della cartella.');
    }
  };

  const handleUpdateFolder = async (folderId: string) => {
    const trimmed = editingFolderName.trim();
    if (!trimmed) {
      showToast('error', 'Il nome della cartella non può essere vuoto.');
      return;
    }
    const exists = folders.some((f) => f.id !== folderId && f.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showToast('error', 'Esiste già una cartella con questo nome.');
      return;
    }
    try {
      await updateFolder(folderId, trimmed);
      setEditingFolderId(null);
      setEditingFolderName('');
      showToast('success', `Cartella rinominata in "${trimmed}".`);
    } catch {
      showToast('error', 'Errore nella modifica della cartella.');
    }
  };

  const handleDeleteFolderConfirm = (folder: RoutineFolder) => {
    const routinesCount = routines.filter((r) => r.folder_id === folder.id).length;
    setConfirmModal({
      visible: true,
      title: 'Elimina Cartella',
      message: `Sei sicuro di voler eliminare la cartella "${folder.name}"? Le ${routinesCount} schede al suo interno non verranno eliminate, ma saranno visibili nella vista "Tutte".`,
      confirmText: 'Elimina Cartella',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteFolder(folder.id);
          if (selectedFolderFilter === folder.id) {
            setSelectedFolderFilter('all');
          }
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', `Cartella "${folder.name}" eliminata.`);
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante l\'eliminazione della cartella.');
        }
      },
    });
  };

  // Folder Multi-Select Handlers
  const handleFolderLongPress = (folderId: string) => {
    if (userRole === 'CLIENT') {
      showToast('info', 'La gestione delle cartelle è riservata al Personal Trainer.');
      return;
    }
    if (!folderSelectMode) {
      setFolderSelectMode(true);
      setSelectedFolderIds([folderId]);
    } else {
      toggleFolderSelection(folderId);
    }
  };

  const toggleFolderSelection = (folderId: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  };

  const handleSelectAllFolders = () => {
    setSelectedFolderIds(folders.map((f) => f.id));
  };

  const handleDeleteSelectedFoldersConfirm = () => {
    if (selectedFolderIds.length === 0) return;
    setConfirmModal({
      visible: true,
      title: 'Elimina Cartelle Selezionate',
      message: `Vuoi davvero eliminare ${selectedFolderIds.length} cartelle? Le schede associate non verranno cancellate ma spostate in 'Tutte'.`,
      confirmText: 'Elimina',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteMultipleFolders(selectedFolderIds);
          setFolderSelectMode(false);
          setSelectedFolderIds([]);
          setSelectedFolderFilter('all');
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', `${selectedFolderIds.length} cartelle eliminate con successo.`);
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante l\'eliminazione delle cartelle.');
        }
      },
    });
  };

  const handleClearAllFoldersConfirm = () => {
    setConfirmModal({
      visible: true,
      title: 'Svuota Tutte le Cartelle',
      message:
        "Vuoi davvero eliminare TUTTE le cartelle create? Rimarrà solo la vista fissa 'Tutte'. Le schede non verranno cancellate.",
      confirmText: 'Svuota Tutto',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await clearAllFolders();
          setFolderSelectMode(false);
          setSelectedFolderIds([]);
          setSelectedFolderFilter('all');
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', 'Tutte le cartelle sono state eliminate.');
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante lo svuotamento delle cartelle.');
        }
      },
    });
  };

  // Routine Multi-Select Handlers
  const handleRoutineLongPress = (id: number) => {
    if (userRole === 'CLIENT') {
      showToast('info', 'Come Cliente puoi avviare ed eseguire la scheda ma non eliminarla.');
      return;
    }
    if (!routineSelectMode) {
      setRoutineSelectMode(true);
      setSelectedRoutineIds([id]);
    } else {
      toggleRoutineSelection(id);
    }
  };

  const toggleRoutineSelection = (id: number) => {
    setSelectedRoutineIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedRoutinesConfirm = () => {
    if (selectedRoutineIds.length === 0) return;
    const count = selectedRoutineIds.length;
    setConfirmModal({
      visible: true,
      title: 'Elimina Schede Selezionate',
      message: `Sei sicuro di voler eliminare definitivamente le ${count} schede selezionate? L'operazione non può essere annullata.`,
      confirmText: `Elimina (${count})`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteMultipleRoutines(selectedRoutineIds);
          setSelectedRoutineIds([]);
          setRoutineSelectMode(false);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', `${count} schede eliminate con successo.`);
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante l\'eliminazione delle schede.');
        }
      },
    });
  };

  const handleClearAllRoutinesConfirm = () => {
    setConfirmModal({
      visible: true,
      title: '⚠️ Svuota Tutte le Schede',
      message: `ATTENZIONE: Vuoi davvero eliminare TUTTE le ${routines.length} schede di allenamento? Tutte le routine create verranno rimosse permanentemente.`,
      confirmText: 'Svuota Tutto',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await clearAllRoutines();
          setSelectedRoutineIds([]);
          setRoutineSelectMode(false);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', 'Tutte le schede sono state eliminate.');
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante lo svuotamento delle schede.');
        }
      },
    });
  };

  // Workout Multi-Select Handlers
  const handleWorkoutLongPress = (id: number) => {
    if (!workoutSelectMode) {
      setWorkoutSelectMode(true);
      setSelectedWorkoutIds([id]);
    } else {
      toggleWorkoutSelection(id);
    }
  };

  const toggleWorkoutSelection = (id: number) => {
    setSelectedWorkoutIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedWorkoutsConfirm = () => {
    if (selectedWorkoutIds.length === 0) return;
    const count = selectedWorkoutIds.length;
    setConfirmModal({
      visible: true,
      title: 'Elimina Sessioni Selezionate',
      message: `Sei sicuro di voler eliminare definitivamente le ${count} sessioni selezionate dallo storico?`,
      confirmText: `Elimina (${count})`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteMultipleWorkouts(selectedWorkoutIds);
          setSelectedWorkoutIds([]);
          setWorkoutSelectMode(false);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', `${count} sessioni eliminate dallo storico.`);
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante l\'eliminazione delle sessioni.');
        }
      },
    });
  };

  const handleClearAllWorkoutsConfirm = () => {
    setConfirmModal({
      visible: true,
      title: '⚠️ Svuota Tutto lo Storico',
      message: `ATTENZIONE: Vuoi davvero eliminare l'intero storico (${workouts.length} sessioni registrate)? Tutti i dati delle sessioni passate verranno persi definitivamente.`,
      confirmText: 'Svuota Tutto',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await clearAllWorkouts();
          setSelectedWorkoutIds([]);
          setWorkoutSelectMode(false);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', 'Tutto lo storico sessioni è stato svuotato.');
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante lo svuotamento dello storico.');
        }
      },
    });
  };

  const displayedRoutines =
    selectedFolderFilter === 'all'
      ? routines
      : routines.filter((r) => r.folder_id === selectedFolderFilter);

  return (
    <ScreenBackgroundWrapper style={styles.container}>
      {/* RBAC Header: Trainer Delegation Banner OR Client Status Banner */}
      {userRole === 'TRAINER' ? (
        selectedClient ? (
          <View style={styles.delegationActiveBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.delegationActiveTitle}>
                📋 SCHEDE DI: {selectedClient.name.toUpperCase()}
              </Text>
              <Text style={styles.delegationActiveDesc}>
                Stai gestendo le schede assegnate a questo allievo. Le modifiche saranno visibili nella sua app.
              </Text>
            </View>
            <View style={styles.delegationActionsRow}>
              <Pressable
                onPress={() => setSelectedClient(null)}
                style={styles.clearDelegationBtn}
                accessibilityRole="button"
                accessibilityLabel="Torna alle mie schede personali"
              >
                <Text style={styles.clearDelegationBtnText}>✕ Torna a Mie Schede</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Clients')}
                style={styles.goToClientsTabBtn}
                accessibilityRole="button"
                accessibilityLabel="Gestisci allievi nella tab Clienti"
              >
                <Text style={styles.goToClientsTabBtnText}>👥 Tab Clienti</Text>
              </Pressable>
            </View>
          </View>
        ) : null
      ) : (
        <View style={styles.clientModeBanner}>
          <View style={styles.clientModeHeader}>
            <View style={styles.clientModeBadge}>
              <Text style={styles.clientModeBadgeText}>🏃 ATLETA / CLIENTE</Text>
            </View>
            <Text style={styles.clientModeSubtext}>Sola Lettura & Esecuzione</Text>
          </View>
          <Text style={styles.clientModeDesc}>
            {userProfile.trainer_name
              ? `Schede sincronizzate dal tuo Personal Trainer: ${userProfile.trainer_name}. Seleziona una scheda e tocca "Avvia Live Logger" per registrare i tuoi allenamenti.`
              : 'Visualizza le tue schede ed esegui i tuoi allenamenti. Vai nel Profilo per collegare il tuo Personal Trainer tramite codice OTP.'}
          </Text>
        </View>
      )}

      {/* Sub-Tab Navigation Header */}
      <View style={styles.subTabHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabContent}
        >
          <Pressable
            style={[
              styles.subTabItem,
              activeTab === 'routines' && styles.subTabItemActive,
            ]}
            onPress={() => setActiveTab('routines')}
          >
            <Text
              style={[
                styles.subTabText,
                activeTab === 'routines' && styles.subTabTextActive,
              ]}
            >
              Schede ({routines.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.subTabItem,
              activeTab === 'history' && styles.subTabItemActive,
            ]}
            onPress={() => setActiveTab('history')}
          >
            <Text
              style={[
                styles.subTabText,
                activeTab === 'history' && styles.subTabTextActive,
              ]}
            >
              Storico ({workouts.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.subTabItem,
              activeTab === 'progression' && styles.subTabItemActive,
            ]}
            onPress={() => setActiveTab('progression')}
          >
            <Text
              style={[
                styles.subTabText,
                activeTab === 'progression' && styles.subTabTextActive,
              ]}
            >
              Progressione PR
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.subTabItem,
              activeTab === 'exercises' && styles.subTabItemActive,
            ]}
            onPress={() => setActiveTab('exercises')}
          >
            <Text
              style={[
                styles.subTabText,
                activeTab === 'exercises' && styles.subTabTextActive,
              ]}
            >
              Catalogo ({exercises.length})
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* ==================== SUB-TAB 1: SCHEDE ==================== */}
        {activeTab === 'routines' && (
          <View>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={typography.h2}>Gestione Schede</Text>
                <Text style={typography.caption}>
                  Struttura mesocicli (Builder separato dal Logger)
                </Text>
              </View>
              {userRole !== 'CLIENT' && (
                <Pressable
                  onPress={() => navigation.navigate('NewRoutineModal')}
                  style={styles.actionBtnPrimary}
                  accessibilityRole="button"
                  accessibilityLabel="Crea nuova scheda"
                >
                  <Text style={styles.actionBtnPrimaryText}>+ Nuova Scheda</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.subBarRow}>
              <Text style={typography.caption}>
                {displayedRoutines.length} schede visualizzate ({routines.length} totali)
              </Text>
              {userRole !== 'CLIENT' && (
                <Pressable onPress={handleRestoreRoutinesConfirm}>
                  <Text style={styles.restoreLink}>Ripristina Schede Default</Text>
                </Pressable>
              )}
            </View>

            {userRole !== 'CLIENT' && (
              <Text style={styles.longPressHint}>
                💡 Suggerimento: tieni premuta una cartella o una scheda per la selezione multipla ed eliminazione.
              </Text>
            )}

            {/* Folder Filter Scroll + Manage Folders Button */}
            <View style={styles.folderRowContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.folderFilterScroll}
                contentContainerStyle={styles.folderFilterContainer}
              >
                {/* Chip Tutte - Fisso e non eliminabile */}
                <Pressable
                  onPress={() => {
                    if (!folderSelectMode) {
                      setSelectedFolderFilter('all');
                    } else {
                      showToast('info', "La cartella 'Tutte' è fissa di sistema e non può essere eliminata.");
                    }
                  }}
                  onLongPress={() => {
                    showToast('info', "La cartella 'Tutte' è fissa di sistema e non può essere eliminata.");
                  }}
                  style={[
                    styles.folderFilterChip,
                    selectedFolderFilter === 'all' && styles.folderFilterChipActive,
                    folderSelectMode && styles.folderFilterChipLocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.folderFilterChipText,
                      selectedFolderFilter === 'all' && styles.folderFilterChipTextActive,
                      folderSelectMode && styles.folderFilterChipTextLocked,
                    ]}
                  >
                    {folderSelectMode ? '🔒 Tutte (Fissa)' : `Tutte (${routines.length})`}
                  </Text>
                </Pressable>

                {/* Cartelle create dall'utente */}
                {folders.map((f) => {
                  const count = routines.filter((r) => r.folder_id === f.id).length;
                  const isSelected = selectedFolderIds.includes(f.id);
                  const isActiveFilter = selectedFolderFilter === f.id;

                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => {
                        if (folderSelectMode) {
                          toggleFolderSelection(f.id);
                        } else {
                          setSelectedFolderFilter(f.id);
                        }
                      }}
                      onLongPress={() => handleFolderLongPress(f.id)}
                      style={[
                        styles.folderFilterChip,
                        isActiveFilter && !folderSelectMode && styles.folderFilterChipActive,
                        folderSelectMode && isSelected && styles.folderFilterChipSelectedForDelete,
                      ]}
                    >
                      <View style={styles.folderChipInnerRow}>
                        {folderSelectMode && (
                          <View
                            style={[
                              styles.folderChipCheckbox,
                              isSelected && styles.folderChipCheckboxChecked,
                            ]}
                          >
                            <Text style={styles.folderChipCheckboxText}>
                              {isSelected ? '✓' : ''}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.folderFilterChipText,
                            isActiveFilter && !folderSelectMode && styles.folderFilterChipTextActive,
                            folderSelectMode && isSelected && styles.folderFilterChipTextSelectedForDelete,
                          ]}
                        >
                          📁 {f.name} ({count})
                        </Text>
                        {!folderSelectMode && isActiveFilter && (
                          <Pressable
                            hitSlop={8}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleDeleteFolderConfirm(f);
                            }}
                            style={styles.folderChipInlineDeleteBtn}
                            accessibilityLabel={`Elimina cartella ${f.name}`}
                          >
                            <Text style={styles.folderChipInlineDeleteText}>🗑</Text>
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {userRole !== 'CLIENT' && (
                <Pressable
                  onPress={() => setShowFolderModal(true)}
                  style={styles.manageFoldersBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Gestisci cartelle di allenamento"
                >
                  <Text style={styles.manageFoldersBtnText}>📁 Gestisci</Text>
                </Pressable>
              )}
            </View>

            {/* Multi-Select Action Bar for Folders */}
            {folderSelectMode && (
              <View style={styles.folderMultiSelectBar}>
                <View style={styles.multiSelectInfo}>
                  <Text style={styles.multiSelectCount}>
                    {selectedFolderIds.length} di {folders.length} cartelle selezionate
                  </Text>
                  <Text style={styles.multiSelectHint}>
                    Tocca per selezionare / deselezionare
                  </Text>
                </View>
                <View style={styles.multiSelectActions}>
                  <Pressable
                    disabled={selectedFolderIds.length === 0}
                    onPress={handleDeleteSelectedFoldersConfirm}
                    style={[
                      styles.multiDeleteBtn,
                      selectedFolderIds.length === 0 && styles.disabledBtn,
                    ]}
                  >
                    <Text style={styles.multiDeleteBtnText}>
                      🗑 Elimina ({selectedFolderIds.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleClearAllFoldersConfirm}
                    style={styles.clearAllBtn}
                  >
                    <Text style={styles.clearAllBtnText}>⚠️ Svuota Tutte le Cartelle</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setFolderSelectMode(false);
                      setSelectedFolderIds([]);
                    }}
                    style={styles.multiCancelBtn}
                  >
                    <Text style={styles.multiCancelBtnText}>Annulla</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Multi-Select Action Bar for Routines */}
            {routineSelectMode && (
              <View style={styles.multiSelectBar}>
                <View style={styles.multiSelectInfo}>
                  <Text style={styles.multiSelectCount}>
                    {selectedRoutineIds.length} di {displayedRoutines.length} selezionate
                  </Text>
                  <Text style={styles.multiSelectHint}>
                    Tocca una scheda per selezionare/deselezionare
                  </Text>
                </View>
                <View style={styles.multiSelectActions}>
                  <Pressable
                    disabled={selectedRoutineIds.length === 0}
                    onPress={handleDeleteSelectedRoutinesConfirm}
                    style={[
                      styles.multiDeleteBtn,
                      selectedRoutineIds.length === 0 && styles.disabledBtn,
                    ]}
                  >
                    <Text style={styles.multiDeleteBtnText}>
                      🗑 Elimina ({selectedRoutineIds.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleClearAllRoutinesConfirm}
                    style={styles.clearAllBtn}
                  >
                    <Text style={styles.clearAllBtnText}>⚠️ Svuota Tutto</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setRoutineSelectMode(false);
                      setSelectedRoutineIds([]);
                    }}
                    style={styles.multiCancelBtn}
                  >
                    <Text style={styles.multiCancelBtnText}>Annulla</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {displayedRoutines.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Nessuna scheda presente in questa cartella. Tocca "+ Nuova Scheda" per crearne una.
                </Text>
              </Card>
            ) : (
              displayedRoutines.map((routine) => {
                const exCount = routine.exercises ? routine.exercises.length : 0;
                const supersets = (routine.exercises || []).filter((e) => e.superset_group);
                const borderColor = routine.border_color || colors.accent;
                const isSelected = selectedRoutineIds.includes(routine.id);

                return (
                  <Pressable
                    key={routine.id}
                    onLongPress={() => handleRoutineLongPress(routine.id)}
                    onPress={() => {
                      if (routineSelectMode) {
                        toggleRoutineSelection(routine.id);
                      }
                    }}
                  >
                    <Card
                      highlighted={isSelected}
                      style={[
                        styles.routineCard,
                        { borderLeftColor: borderColor, borderLeftWidth: 5 },
                        isSelected && styles.cardSelected,
                      ]}
                    >
                      <View style={styles.routineHeader}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={styles.routineFolderTag}>
                            <Text style={styles.routineFolderTagText}>
                              📁 {routine.folder_name || 'Generale'}
                            </Text>
                          </View>
                          <Text style={typography.h3}>{routine.name}</Text>
                          <Text style={typography.caption}>
                            {routine.workout_type || 'Allenamento'} • {routine.duration_weeks} settimane
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          {routineSelectMode ? (
                            <View style={styles.checkboxWrapper}>
                              <View
                                style={[
                                  styles.checkboxSquare,
                                  isSelected && styles.checkboxSquareChecked,
                                ]}
                              >
                                {isSelected && <Text style={styles.checkmarkIcon}>✓</Text>}
                              </View>
                            </View>
                          ) : (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>{exCount} Esercizi</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {routine.description ? (
                        <Text style={[typography.body, styles.routineDesc]} numberOfLines={2}>
                          {routine.description}
                        </Text>
                      ) : null}

                      {supersets.length > 0 && (
                        <View style={styles.supersetTag}>
                          <Text style={styles.supersetTagText}>
                            ⚡ Include {supersets.length} esercizi in superset
                          </Text>
                        </View>
                      )}

                      {/* Routine Actions - Hidden or Disabled in Multi-Select Mode */}
                      {!routineSelectMode && (
                        <View style={styles.routineActionsRow}>
                          <Pressable
                            onPress={() =>
                              navigation.navigate('WorkoutModal', {
                                routineId: routine.id,
                                routineName: routine.name,
                                weekNumber: 1,
                              })
                            }
                            style={styles.launchButton}
                            accessibilityRole="button"
                            accessibilityLabel="Avvia live logger per questa scheda"
                          >
                            <Text style={styles.launchButtonText}>▶ AVVIA LIVE LOGGER</Text>
                          </Pressable>

                          {userRole !== 'CLIENT' && (
                            <>
                              {/* Edit Routine (Builder) */}
                              <Pressable
                                onPress={() =>
                                  navigation.navigate('NewRoutineModal', {
                                    routineId: routine.id,
                                  })
                                }
                                style={styles.editRoutineBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Modifica struttura scheda"
                              >
                                <Text style={styles.editRoutineBtnText}>✎ Modifica</Text>
                              </Pressable>

                              {/* Delete Routine */}
                              <Pressable
                                onPress={() => handleDeleteRoutineConfirm(routine.id, routine.name)}
                                style={styles.deleteRoutineBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Elimina scheda"
                              >
                                <Text style={styles.deleteRoutineBtnText}>🗑</Text>
                              </Pressable>
                            </>
                          )}
                        </View>
                      )}
                    </Card>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* ==================== SUB-TAB 2: STORICO SESSIONI ==================== */}
        {activeTab === 'history' && (
          <View>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={typography.h2}>Storico Allenamenti</Text>
                <Text style={typography.caption}>
                  Sessioni svolte e registrate ({workouts.length} totali)
                </Text>
              </View>
            </View>

            <Text style={styles.longPressHint}>
              💡 Suggerimento: tieni premuta una sessione per la selezione multipla ed eliminazione.
            </Text>

            {/* Multi-Select Action Bar for Workouts */}
            {workoutSelectMode && (
              <View style={styles.multiSelectBar}>
                <View style={styles.multiSelectInfo}>
                  <Text style={styles.multiSelectCount}>
                    {selectedWorkoutIds.length} di {workouts.length} selezionate
                  </Text>
                  <Text style={styles.multiSelectHint}>
                    Tocca per selezionare/deselezionare
                  </Text>
                </View>
                <View style={styles.multiSelectActions}>
                  <Pressable
                    disabled={selectedWorkoutIds.length === 0}
                    onPress={handleDeleteSelectedWorkoutsConfirm}
                    style={[
                      styles.multiDeleteBtn,
                      selectedWorkoutIds.length === 0 && styles.disabledBtn,
                    ]}
                  >
                    <Text style={styles.multiDeleteBtnText}>
                      🗑 Elimina ({selectedWorkoutIds.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleClearAllWorkoutsConfirm}
                    style={styles.clearAllBtn}
                  >
                    <Text style={styles.clearAllBtnText}>⚠️ Svuota Tutto</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setWorkoutSelectMode(false);
                      setSelectedWorkoutIds([]);
                    }}
                    style={styles.multiCancelBtn}
                  >
                    <Text style={styles.multiCancelBtnText}>Annulla</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {workouts.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Nessuna sessione registrata. Avvia un allenamento dal Live Logger per iniziare lo storico!
                </Text>
              </Card>
            ) : (
              workouts.map((workout) => {
                const isExpanded = expandedWorkoutId === workout.id;
                const totalSets = (workout.exercises || []).flatMap((e) => e.sets);
                const volume = calculateTotalVolume(totalSets);
                const isSelected = selectedWorkoutIds.includes(workout.id);

                return (
                  <Pressable
                    key={workout.id}
                    onLongPress={() => handleWorkoutLongPress(workout.id)}
                    onPress={() => {
                      if (workoutSelectMode) {
                        toggleWorkoutSelection(workout.id);
                      } else {
                        setExpandedWorkoutId(isExpanded ? null : workout.id);
                      }
                    }}
                  >
                    <Card
                      highlighted={isSelected}
                      style={[
                        styles.historyCard,
                        isSelected && styles.cardSelected,
                      ]}
                    >
                      <View style={styles.historyCardHeader}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={styles.historyDateRow}>
                            <Text style={styles.historyDateBadge}>{workout.date}</Text>
                            {workout.duration_minutes ? (
                              <Text style={typography.caption}>
                                ⏱ {workout.duration_minutes} min
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[typography.h3, { marginTop: 4 }]}>{workout.name}</Text>
                          <Text style={[typography.caption, { color: colors.volume, fontWeight: '700', marginTop: 2 }]}>
                            Volume: {volume.toLocaleString()} kg • {totalSets.length} serie
                          </Text>
                        </View>

                        {workoutSelectMode ? (
                          <View style={styles.checkboxWrapper}>
                            <View
                              style={[
                                styles.checkboxSquare,
                                isSelected && styles.checkboxSquareChecked,
                              ]}
                            >
                              {isSelected && <Text style={styles.checkmarkIcon}>✓</Text>}
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.expandToggleText}>{isExpanded ? '▲' : '▼'}</Text>
                        )}
                      </View>

                      {/* Detailed sets when expanded (disabled in multi-select mode) */}
                      {!workoutSelectMode && isExpanded && (
                        <View style={styles.historyDetails}>
                          {workout.notes ? (
                            <View style={styles.workoutNotesBox}>
                              <Text style={styles.workoutNotesText}>📝 {workout.notes}</Text>
                            </View>
                          ) : null}

                          {(workout.exercises || []).map((ex, eIdx) => {
                            const exInfo = exercises.find((item) => item.id === ex.exercise_id);
                            const exName = exInfo ? exInfo.name : `Esercizio ${ex.exercise_id}`;
                            const exType = exInfo?.exercise_type || 'reps';

                            return (
                              <View key={`hist-ex-${eIdx}`} style={styles.histExBlock}>
                                <Text style={typography.bodyBold}>
                                  {eIdx + 1}. {exName}
                                </Text>
                                <View style={styles.histSetsList}>
                                  {ex.sets.map((s, sIdx) => {
                                    let label = '';
                                    if (exType === 'time') {
                                      label = `S${s.set_number}: ${s.time_seconds || 0}s`;
                                    } else if (exType === 'bodyweight') {
                                      const z = s.weight_kg > 0 ? ` (+${s.weight_kg}kg)` : '';
                                      label = `S${s.set_number}: ${s.reps} reps${z}`;
                                    } else {
                                      const drop = s.dropset_weight_kg ? ` (strip: ${s.dropset_weight_kg}kg)` : '';
                                      label = `S${s.set_number}: ${s.weight_kg}kg × ${s.reps}${drop}`;
                                    }

                                    return (
                                      <View key={`hist-s-${sIdx}`} style={styles.histSetChip}>
                                        <Text style={styles.histSetChipText}>
                                          {label}
                                          {s.set_type !== 'normal' ? ` [${s.set_type}]` : ''}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            );
                          })}

                          <Pressable
                            onPress={() => handleDeleteWorkoutConfirm(workout.id, workout.name)}
                            style={styles.deleteWorkoutBtn}
                          >
                            <Text style={styles.deleteWorkoutBtnText}>Elimina questa sessione</Text>
                          </Pressable>
                        </View>
                      )}
                    </Card>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* ==================== SUB-TAB 3: PROGRESSIONE PR ==================== */}
        {activeTab === 'progression' && (
          <View>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={typography.h2}>Analisi Sovraccarico</Text>
                <Text style={typography.caption}>
                  Massimali PR e tonnellaggio per singolo esercizio
                </Text>
              </View>
            </View>

            {/* Exercise Selector Card */}
            <Pressable
              onPress={() => setShowProgressionExPicker(true)}
              style={styles.exSelectorCard}
            >
              <View style={{ flex: 1 }}>
                <Text style={typography.caption}>ESERCIZIO SELEZIONATO</Text>
                <Text style={typography.h3}>
                  {currentProgressionEx ? currentProgressionEx.name : 'Seleziona...'}
                </Text>
                <Text style={typography.caption}>
                  {currentProgressionEx?.muscle_group} • Tipo: {currentProgressionEx?.exercise_type.toUpperCase()} (Tocca per cambiare)
                </Text>
              </View>
              <Text style={styles.arrowIcon}>▼</Text>
            </Pressable>

            {/* PR KPIs */}
            <View style={styles.prGrid}>
              <Card style={styles.prCard}>
                <Text style={styles.prLabel}>
                  {currentProgressionEx?.exercise_type === 'time' ? 'MAX ISOMETRIA' : 'ALL-TIME PR (CARICO)'}
                </Text>
                <Text style={styles.prValue}>
                  {currentProgressionEx?.exercise_type === 'time'
                    ? `${progressionData.maxTimeSeconds}s`
                    : `${progressionData.prWeightKg} kg`}
                </Text>
                <Text style={typography.caption}>
                  {currentProgressionEx?.exercise_type === 'time' ? 'Massima durata tenuta' : 'Carico massimo sollevato'}
                </Text>
              </Card>

              <Card style={styles.prCard}>
                <Text style={styles.prLabel}>VOLUME MAX SESSIONE</Text>
                <Text style={[styles.prValue, { color: colors.volume }]}>
                  {progressionData.maxVolumeKg.toLocaleString()} <Text style={styles.prUnit}>kg</Text>
                </Text>
                <Text style={typography.caption}>Tonnellaggio max in 1 giorno</Text>
              </Card>
            </View>

            {/* Load History Table */}
            <Text style={[typography.h3, { marginTop: 14, marginBottom: 8 }]}>
              Cronologia Prestazioni
            </Text>

            {progressionData.history.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Nessuna esecuzione registrata nello storico per questo esercizio.
                </Text>
              </Card>
            ) : (
              progressionData.history.map((pt, idx) => (
                <Card key={`prog-${idx}`} style={styles.progressionRowCard}>
                  <View style={styles.progressionRow}>
                    <View>
                      <Text style={styles.progressionDate}>{pt.date}</Text>
                      <Text style={typography.caption}>{pt.workoutName}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={typography.bodyBold}>
                        {currentProgressionEx?.exercise_type === 'time'
                          ? `Durata: ${pt.maxTimeSeconds || 0}s`
                          : `Max: ${pt.maxWeightKg} kg`}
                      </Text>
                      <Text style={[typography.caption, { color: colors.volume }]}>
                        Volume: {pt.totalVolumeKg.toLocaleString()} kg
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* ==================== SUB-TAB 4: CATALOGO ESERCIZI ==================== */}
        {activeTab === 'exercises' && (
          <View>
            <View style={styles.sectionTitleRow}>
              <View>
                <Text style={typography.h2}>Catalogo Esercizi</Text>
                <Text style={typography.caption}>
                  Dizionario completo con 46 esercizi precaricati
                </Text>
              </View>
              {userRole !== 'CLIENT' && (
                <Pressable
                  onPress={() => navigation.navigate('ExerciseModal')}
                  style={styles.actionBtnPrimary}
                  accessibilityRole="button"
                  accessibilityLabel="Aggiungi nuovo esercizio"
                >
                  <Text style={styles.actionBtnPrimaryText}>+ Nuovo Ex</Text>
                </Pressable>
              )}
            </View>

            {/* Search Input */}
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca per nome esercizio..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Muscle Filter Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.muscleFilterBar}
            >
              {MUSCLE_GROUPS.map((mg) => (
                <Pressable
                  key={mg}
                  onPress={() => setSelectedMuscle(mg)}
                  style={[
                    styles.muscleChip,
                    selectedMuscle === mg && styles.muscleChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.muscleChipText,
                      selectedMuscle === mg && styles.muscleChipTextActive,
                    ]}
                  >
                    {mg}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.catalogStatsRow}>
              <Text style={typography.caption}>
                Visualizzati {filteredCatalogExercises.length} di {exercises.length} esercizi
              </Text>
              <Pressable onPress={handleRestoreCatalogConfirm}>
                <Text style={styles.restoreLink}>Ripristina 46 Default</Text>
              </Pressable>
            </View>

            {filteredCatalogExercises.map((ex) => {
              const typeLabel =
                ex.exercise_type === 'reps'
                  ? 'CARICO + REPS'
                  : ex.exercise_type === 'time'
                  ? 'ISOMETRIA (TEMPO)'
                  : 'CORPO LIBERO / ZAVORRA';

              const typeBadgeColor =
                ex.exercise_type === 'time'
                  ? colors.emerald
                  : ex.exercise_type === 'bodyweight'
                  ? colors.warning
                  : colors.accent;

              return (
                <Card
                  key={ex.id}
                  style={[
                    styles.catalogCard,
                    ex.is_archived === 1 && styles.catalogCardArchived,
                  ]}
                >
                  <View style={styles.catalogHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={[
                          typography.bodyBold,
                          ex.is_archived === 1 && styles.archivedText,
                        ]}
                      >
                        {ex.name}
                      </Text>
                      <View style={styles.catalogTypeBadgeRow}>
                        <Text style={styles.catalogMuscleText}>{ex.muscle_group}</Text>
                        <View
                          style={[
                            styles.typeMiniBadge,
                            { borderColor: typeBadgeColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeMiniBadgeText,
                              { color: typeBadgeColor },
                            ]}
                          >
                            {typeLabel}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {userRole !== 'CLIENT' && (
                      <View style={styles.catalogActionButtons}>
                        {/* Edit Exercise Details */}
                        <Pressable
                          onPress={() =>
                            navigation.navigate('ExerciseModal', {
                              exerciseId: ex.id,
                            })
                          }
                          style={styles.editCatalogBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Modifica dettagli esercizio"
                        >
                          <Text style={styles.editCatalogBtnText}>✎ Modifica</Text>
                        </Pressable>

                        {/* Archive Toggle */}
                        <Pressable
                          onPress={() => archiveExercise(ex.id)}
                          style={[
                            styles.archiveBtn,
                            ex.is_archived === 1 && styles.archiveBtnRestoring,
                          ]}
                        >
                          <Text style={styles.archiveBtnText}>
                            {ex.is_archived === 1 ? 'Ripristina' : 'Archivia'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {ex.notes ? (
                    <Text style={styles.exNotesText}>💡 {ex.notes}</Text>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Exercise Picker Modal for Progression Sub-Tab */}
      {showProgressionExPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={typography.h3}>Scegli Esercizio per PR</Text>
              <Pressable
                onPress={() => setShowProgressionExPicker(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.pickerScroll}>
              {exercises.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    setSelectedProgressionExId(e.id);
                    setShowProgressionExPicker(false);
                  }}
                  style={[
                    styles.pickerRow,
                    selectedProgressionExId === e.id && styles.pickerRowActive,
                  ]}
                >
                  <Text
                    style={[
                      typography.bodyBold,
                      selectedProgressionExId === e.id && { color: colors.accent },
                    ]}
                  >
                    {e.name}
                  </Text>
                  <Text style={typography.caption}>
                    {e.muscle_group} • {e.exercise_type}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Folder Management Modal */}
      {showFolderModal && (
        <View style={styles.pickerOverlay}>
          <View style={styles.folderModal}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={typography.h3}>📁 Gestione Cartelle</Text>
                <Text style={typography.caption}>
                  Crea, rinomina o elimina le tue cartelle
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowFolderModal(false);
                  setEditingFolderId(null);
                  setNewFolderName('');
                }}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Create new folder box */}
            <View style={styles.createFolderRow}>
              <TextInput
                style={styles.createFolderInput}
                placeholder="Nome nuova cartella (es. Estate 2026)..."
                placeholderTextColor={colors.textMuted}
                value={newFolderName}
                onChangeText={setNewFolderName}
              />
              <Pressable
                onPress={handleCreateFolder}
                style={styles.createFolderBtn}
              >
                <Text style={styles.createFolderBtnText}>+ Crea</Text>
              </Pressable>
            </View>

            <View style={styles.foldersModalHeaderRow}>
              <Text style={[typography.caption, { marginTop: 8, marginBottom: 4 }]}>
                CARTELLE SALVATE ({folders.length})
              </Text>
              {folders.length > 0 && (
                <Pressable
                  onPress={handleClearAllFoldersConfirm}
                  style={styles.clearAllFoldersModalBtn}
                >
                  <Text style={styles.clearAllFoldersModalBtnText}>
                    🗑 Svuota Tutte le Cartelle
                  </Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.foldersModalNote}>
              Nota: l'unica cartella che non può essere eliminata è "Tutte". Tutte le altre cartelle create possono essere eliminate singolarmente o svuotate tutte insieme; le schede al loro interno rimarranno sempre salvate.
            </Text>

            <ScrollView style={styles.foldersListScroll}>
              {folders.length === 0 ? (
                <View style={styles.emptyFoldersBox}>
                  <Text style={styles.emptyFoldersText}>
                    Nessuna cartella creata. Crea una cartella per raggruppare le tue schede!
                  </Text>
                </View>
              ) : (
                folders.map((folder) => {
                  const count = routines.filter((r) => r.folder_id === folder.id).length;
                  const isEditing = editingFolderId === folder.id;

                  return (
                    <View key={folder.id} style={styles.folderRowItem}>
                      {isEditing ? (
                        <View style={styles.folderEditingRow}>
                          <TextInput
                            style={styles.folderRenameInput}
                            value={editingFolderName}
                            onChangeText={setEditingFolderName}
                            autoFocus
                          />
                          <Pressable
                            onPress={() => handleUpdateFolder(folder.id)}
                            style={styles.folderSaveBtn}
                          >
                            <Text style={styles.folderSaveBtnText}>✓</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setEditingFolderId(null)}
                            style={styles.folderCancelBtn}
                          >
                            <Text style={styles.folderCancelBtnText}>✕</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={typography.bodyBold}>📁 {folder.name}</Text>
                            <Text style={typography.caption}>{count} schede contenute</Text>
                          </View>
                          <View style={styles.folderRowActions}>
                            <Pressable
                              onPress={() => {
                                setEditingFolderId(folder.id);
                                setEditingFolderName(folder.name);
                              }}
                              style={styles.folderEditBtn}
                            >
                              <Text style={styles.folderEditBtnText}>✎ Rinomina</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleDeleteFolderConfirm(folder)}
                              style={styles.folderDeleteBtn}
                            >
                              <Text style={styles.folderDeleteBtnText}>🗑</Text>
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Custom Confirm Modal */}
      <CustomConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />

      {/* Toast Feedback */}
      <ToastFeedback
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </ScreenBackgroundWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  subTabHeader: {
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subTabContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  subTabItem: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: layout.borderRadiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  subTabItemActive: {
    backgroundColor: colors.accent,
  },
  subTabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 140,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBtnPrimary: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusSm,
  },
  actionBtnPrimaryText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  routineCard: {
    marginBottom: 14,
    padding: 16,
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  routineDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: layout.borderRadiusSm,
  },
  badgeText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
  },
  supersetTag: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    padding: 6,
    borderRadius: layout.borderRadiusSm,
    marginBottom: 10,
  },
  supersetTagText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  routineActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  launchButton: {
    flex: 1,
    backgroundColor: colors.accent,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  launchButtonText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  editRoutineBtn: {
    backgroundColor: colors.backgroundSubtle,
    height: layout.minTouchTarget,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  editRoutineBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteRoutineBtn: {
    width: 44,
    height: layout.minTouchTarget,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  deleteRoutineBtnText: {
    fontSize: 16,
  },
  historyCard: {
    marginBottom: 12,
    padding: 14,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDateBadge: {
    backgroundColor: colors.backgroundSubtle,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  expandToggleText: {
    color: colors.accent,
    fontSize: 14,
    padding: 6,
  },
  historyDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  workoutNotesBox: {
    backgroundColor: colors.backgroundSubtle,
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  workoutNotesText: {
    color: colors.text,
    fontSize: 12,
  },
  histExBlock: {
    marginVertical: 6,
  },
  histSetsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  histSetChip: {
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  histSetChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  deleteWorkoutBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteWorkoutBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  exSelectorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusMd,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 14,
  },
  arrowIcon: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  prGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  prCard: {
    width: '48%',
    padding: 12,
  },
  prLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  prValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 4,
  },
  prUnit: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  progressionRowCard: {
    padding: 12,
    marginVertical: 4,
  },
  progressionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressionDate: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  searchInput: {
    height: 42,
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusMd,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  muscleFilterBar: {
    maxHeight: 44,
    marginBottom: 10,
  },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.backgroundElevated,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muscleChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  muscleChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  muscleChipTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  catalogStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  restoreLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  catalogCard: {
    marginBottom: 8,
    padding: 12,
  },
  catalogCardArchived: {
    opacity: 0.45,
  },
  catalogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  catalogTypeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  catalogMuscleText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: 8,
  },
  typeMiniBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: layout.borderRadiusSm,
  },
  typeMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  catalogActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editCatalogBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  editCatalogBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  archivedText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  archiveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: colors.backgroundSubtle,
  },
  archiveBtnRestoring: {
    backgroundColor: colors.accent,
  },
  archiveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  exNotesText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'flex-end',
    zIndex: 99,
  },
  pickerModal: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: layout.borderRadiusLg,
    borderTopRightRadius: layout.borderRadiusLg,
    height: '70%',
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  pickerScroll: {
    flex: 1,
  },
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerRowActive: {
    backgroundColor: colors.accentMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  folderFilterScroll: {
    marginBottom: 12,
  },
  folderFilterContainer: {
    paddingVertical: 4,
  },
  folderFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusLg,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 8,
  },
  folderFilterChipActive: {
    backgroundColor: colors.accent,
  },
  folderFilterChipLocked: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  folderFilterChipSelectedForDelete: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  folderFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  folderFilterChipTextActive: {
    color: colors.white,
  },
  folderFilterChipTextLocked: {
    color: colors.textMuted,
  },
  folderFilterChipTextSelectedForDelete: {
    color: colors.danger,
    fontWeight: '800',
  },
  folderChipInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderChipCheckbox: {
    width: 15,
    height: 15,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderChipCheckboxChecked: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  folderChipCheckboxText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  folderChipInlineDeleteBtn: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  folderChipInlineDeleteText: {
    fontSize: 11,
  },
  folderMultiSelectBar: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1.5,
    borderColor: colors.danger,
    marginBottom: 12,
  },
  foldersModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  clearAllFoldersModalBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  clearAllFoldersModalBtnText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  foldersModalNote: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 15,
  },
  routineFolderTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  routineFolderTagText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  longPressHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  folderRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  manageFoldersBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginLeft: 6,
  },
  manageFoldersBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  multiSelectBar: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 12,
  },
  multiSelectInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  multiSelectCount: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  multiSelectHint: {
    color: colors.textMuted,
    fontSize: 11,
  },
  multiSelectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  multiDeleteBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: layout.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiDeleteBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  clearAllBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: layout.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAllBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  multiCancelBtn: {
    backgroundColor: colors.backgroundSubtle,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  multiCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
  checkboxWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSubtle,
  },
  checkboxSquareChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmarkIcon: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
  },
  folderModal: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: layout.borderRadiusLg,
    borderTopRightRadius: layout.borderRadiusLg,
    maxHeight: '80%',
    padding: 16,
  },
  createFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  createFolderInput: {
    flex: 1,
    height: 42,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusMd,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  createFolderBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createFolderBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },
  foldersListScroll: {
    maxHeight: 280,
  },
  emptyFoldersBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyFoldersText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  folderRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  folderEditingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderRenameInput: {
    flex: 1,
    height: 38,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  folderSaveBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.emerald,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderSaveBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 16,
  },
  folderCancelBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  folderRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  folderEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  folderEditBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  folderDeleteBtn: {
    width: 32,
    height: 28,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  folderDeleteBtnText: {
    fontSize: 13,
  },

  // RBAC & Delegation Styles
  delegationBar: {
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  delegationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  delegationCaption: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  delegationRoleBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  exitDelegationBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  exitDelegationBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  delegationChipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  delegationChip: {
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  delegationChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: colors.accent,
  },
  delegationChipActiveClient: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    borderColor: '#EC4899',
  },
  delegationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  delegationChipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  delegationChipTextActiveClient: {
    color: '#EC4899',
    fontWeight: '700',
  },
  delegationActiveBanner: {
    marginTop: 10,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EC4899',
  },
  delegationActiveTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EC4899',
    marginBottom: 2,
  },
  delegationActiveDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  clientModeBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: colors.emerald,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  clientModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clientModeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  clientModeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.emerald,
  },
  clientModeSubtext: {
    fontSize: 11,
    color: colors.textMuted,
  },
  clientModeDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  delegationActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  clearDelegationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  clearDelegationBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  goToClientsTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    borderWidth: 1,
    borderColor: '#EC4899',
  },
  goToClientsTabBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EC4899',
  },
});
