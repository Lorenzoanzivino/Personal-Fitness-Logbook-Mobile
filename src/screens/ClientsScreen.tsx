import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { layout, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import { ToastFeedback, ToastType } from '../components/ToastFeedback';
import { ScreenBackgroundWrapper } from '../components/ScreenBackgroundWrapper';
import { useAuth } from '../context/AuthContext';
import { useGym } from '../context/GymContext';
import { ClientAssociation } from '../types/profile';
import { ProvisionedClient } from '../types/auth';
import * as Clipboard from 'expo-clipboard';

export const ClientsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    provisionedClients,
    createClientAccount,
    archiveClient,
    unarchiveClient,
    hardDeleteClient,
    refreshProvisionedClients,
  } = useAuth();
  const { selectedClient, setSelectedClient, reloadGymData } = useGym();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [isActiveClientsExpanded, setIsActiveClientsExpanded] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // New Client Form State
  const [newClientFirstName, setNewClientFirstName] = useState('');
  const [newClientLastName, setNewClientLastName] = useState('');
  const [newClientGoals, setNewClientGoals] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState<{
    username: string;
    otp: string;
  } | null>(null);

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
      await Promise.all([refreshProvisionedClients(), reloadGymData()]);
      showToast('success', 'Lista atleti aggiornata!');
    } catch {
      showToast('error', 'Errore durante l\'aggiornamento.');
    } finally {
      setRefreshing(false);
    }
  };

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

  // Active vs Archived Clients
  const activeClients = provisionedClients.filter((c) => !c.isArchived);
  const archivedClients = provisionedClients.filter((c) => !!c.isArchived);

  // Filtered active clients by search query
  const filteredActiveClients = activeClients.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const username = c.username.toLowerCase();
    return fullName.includes(q) || username.includes(q);
  });

  // Filtered archived clients by search query
  const filteredArchivedClients = archivedClients.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const username = c.username.toLowerCase();
    return fullName.includes(q) || username.includes(q);
  });

  // Copy OTP to clipboard
  const handleCopyOtp = async (otp: string, clientName: string) => {
    await Clipboard.setStringAsync(otp);
    showToast('success', `Codice OTP di ${clientName} copiato negli appunti!`);
  };

  // Manage client routines (delegation)
  const handleManageClientRoutines = (client: ProvisionedClient) => {
    const clientAssoc: ClientAssociation = {
      id: client.id,
      name: `${client.first_name} ${client.last_name}`.trim() || client.username,
      email: client.email,
      linked_at: client.created_at,
      notes: client.notes,
      isArchived: client.isArchived,
    };
    setSelectedClient(clientAssoc);
    navigation.navigate('Gym');
  };

  // Create client account
  const handleCreateClient = async () => {
    const cleanFirstName = newClientFirstName.trim();
    const cleanLastName = newClientLastName.trim();
    if (!cleanFirstName) {
      showToast('error', 'Il Nome dell\'atleta è obbligatorio.');
      return;
    }
    if (!cleanLastName) {
      showToast('error', 'Il Cognome dell\'atleta è obbligatorio.');
      return;
    }

    setIsCreatingClient(true);
    setProvisionSuccess(null);
    try {
      const res = await createClientAccount(
        cleanFirstName,
        cleanLastName,
        newClientGoals.trim() || undefined
      );

      if (res.success && res.otp) {
        setProvisionSuccess({ username: cleanFirstName, otp: res.otp });
        setNewClientFirstName('');
        setNewClientLastName('');
        setNewClientGoals('');
        showToast('success', `Account per ${cleanFirstName} ${cleanLastName} creato con successo!`);
      } else {
        showToast('error', res.error || 'Errore durante la creazione dell\'account.');
      }
    } catch {
      showToast('error', 'Errore di connessione durante la creazione dell\'account.');
    } finally {
      setIsCreatingClient(false);
    }
  };

  // Soft delete confirmation
  const handleArchiveConfirm = (client: ProvisionedClient) => {
    const clientName = `${client.first_name} ${client.last_name}`.trim() || client.username;
    setConfirmModal({
      visible: true,
      title: 'Archivia Atleta',
      message: `Vuoi archiviare l'atleta "${clientName}"? Potrai ripristinarlo in qualsiasi momento dalla sezione "Clienti Archiviati".`,
      confirmText: 'Archivia',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        await archiveClient(client.id);
        showToast('success', `Atleta "${clientName}" archiviato.`);
      },
    });
  };

  // Unarchive confirmation
  const handleUnarchiveConfirm = (client: ProvisionedClient) => {
    const clientName = `${client.first_name} ${client.last_name}`.trim() || client.username;
    setConfirmModal({
      visible: true,
      title: 'Ripristina Atleta',
      message: `Vuoi ripristinare "${clientName}" nella lista degli atleti attivi?`,
      confirmText: 'Ripristina',
      isDestructive: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        await unarchiveClient(client.id);
        showToast('success', `Atleta "${clientName}" ripristinato con successo!`);
      },
    });
  };

  // Hard delete confirmation with cross-platform support
  const handleHardDeleteConfirm = (client: ProvisionedClient) => {
    console.log('[ClientsScreen] Click Elimina su client:', client.id);
    const clientName = `${client.first_name} ${client.last_name}`.trim() || client.username;

    const executeDelete = async () => {
      try {
        await hardDeleteClient(client.id);
        if (selectedClient?.id === client.id) {
          setSelectedClient(null);
        }
        await reloadGymData();
        showToast(
          'success',
          `Cliente "${clientName}" e tutti i dati correlati eliminati definitivamente.`
        );
      } catch (err) {
        console.error('[ClientsScreen] Errore durante hardDeleteClient:', err);
        showToast('error', 'Errore durante l\'eliminazione definitiva del cliente.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              'Azione irreversibile. Vuoi eliminare definitivamente questo cliente e tutti i suoi dati?'
            )
          : true;
      if (confirmed) {
        executeDelete();
      }
      return;
    }

    Alert.alert(
      'Elimina definitivamente cliente',
      'Azione irreversibile. Verranno eliminati anche tutti i dati, schede e progressi associati a questo cliente.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: executeDelete,
        },
      ]
    );
  };

  return (
    <ScreenBackgroundWrapper style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={typography.caption}>GESTIONE ATLETI & RBAC</Text>
          <Text style={typography.h1}>Clienti</Text>
          <Text style={styles.headerSub}>
            Crea nuovi account per i tuoi atleti, gestisci le loro schede e archivia i profili completati.
          </Text>
        </View>

        {/* Stats Summary Bar */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{activeClients.length}</Text>
            <Text style={styles.statLabel}>Atleti Attivi</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: colors.textSecondary }]}>
              {archivedClients.length}
            </Text>
            <Text style={styles.statLabel}>Archiviati</Text>
          </View>
        </View>

        {/* ========================================== */}
        {/* SECTION 1: NUOVO CLIENTE (PROVISIONING OTP) */}
        {/* ========================================== */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.caption}>REGISTRAZIONE ALLIEVO</Text>
              <Text style={typography.h3}>Crea Nuovo Account (OTP)</Text>
            </View>
          </View>

          <Text style={styles.sectionDesc}>
            Inserisci Nome e Cognome dell'atleta. Verrà generato un codice OTP che l'atleta userà per accedere.
          </Text>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOME ATLETA *</Text>
              <TextInput
                style={styles.textInput}
                value={newClientFirstName}
                onChangeText={setNewClientFirstName}
                placeholder="es. Mario"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>COGNOME ATLETA *</Text>
              <TextInput
                style={styles.textInput}
                value={newClientLastName}
                onChangeText={setNewClientLastName}
                placeholder="es. Rossi"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>OBIETTIVI / NOTE (Opzionale)</Text>
              <TextInput
                style={styles.textInput}
                value={newClientGoals}
                onChangeText={setNewClientGoals}
                placeholder="es. Ipertrofia 4x/settimana • Recupero spalla"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <Pressable
              onPress={handleCreateClient}
              disabled={isCreatingClient}
              style={({ pressed }) => [
                styles.createBtn,
                { opacity: pressed || isCreatingClient ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Crea account atleta"
            >
              {isCreatingClient ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <Text style={styles.createBtnText}>✨ Crea Account e Genera OTP</Text>
              )}
            </Pressable>
          </View>

          {/* Credential Result Box */}
          {provisionSuccess && (
            <View style={styles.credentialsResultBox}>
              <View style={styles.credentialsResultTop}>
                <Text style={styles.credentialsResultTitle}>🎉 CREDENZIALI CREATE</Text>
                <Text style={styles.credentialsResultPill}>PRONTO AL LOGIN</Text>
              </View>
              <Text style={styles.credentialsResultDesc}>
                Condividi queste credenziali con il tuo allievo:
              </Text>
              <View style={styles.credRow}>
                <View style={styles.credItem}>
                  <Text style={styles.credLabel}>IDENTIFICATIVO / NOME:</Text>
                  <Text style={styles.credValue}>{provisionSuccess.username}</Text>
                </View>
                <View style={styles.credItem}>
                  <Text style={styles.credLabel}>PASSWORD / OTP:</Text>
                  <Text style={styles.credValueOtp}>{provisionSuccess.otp}</Text>
                </View>
              </View>
              <Pressable
                onPress={() =>
                  handleCopyOtp(provisionSuccess.otp, provisionSuccess.username)
                }
                style={styles.copyOtpDirectBtn}
              >
                <Text style={styles.copyOtpDirectBtnText}>📋 Copia Codice OTP</Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* ========================================== */}
        {/* SECTION 2: LISTA CLIENTI ATTIVI           */}
        {/* ========================================== */}
        <Pressable
          style={styles.sectionHeaderRow}
          onPress={() => setIsActiveClientsExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Mostra o nascondi atleti attivi"
        >
          <View style={{ flex: 1 }}>
            <Text style={typography.h2}>Atleti Attivi ({activeClients.length})</Text>
            <Text style={typography.caption}>Seleziona un atleta per compilare le sue schede</Text>
          </View>
          <Text style={styles.activeChevron}>{isActiveClientsExpanded ? '▲' : '▼'}</Text>
        </Pressable>

        {isActiveClientsExpanded && (
          <>
            {/* Search Bar */}
            {activeClients.length > 0 && (
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cerca atleta per nome o username..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                    <Text style={styles.searchClearText}>✕</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Client Cards List */}
            {filteredActiveClients.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'Nessun atleta corrispondente' : 'Nessun atleta registrato'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {searchQuery
                    ? 'Prova a cercare con un termine differente.'
                    : 'Usa il modulo in alto per creare il primo account cliente.'}
                </Text>
              </Card>
            ) : (
              filteredActiveClients.map((client) => {
                const clientName = `${client.first_name} ${client.last_name}`.trim() || client.username;
                const initials = clientName.substring(0, 2).toUpperCase();
                const createdDate = new Date(client.created_at).toLocaleDateString('it-IT');

                return (
                  <Card key={client.id} style={styles.clientCard}>
                    <View style={styles.clientCardTop}>
                      <View style={styles.avatarPill}>
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={styles.clientNameRow}>
                          <Text style={styles.clientCardName}>{clientName}</Text>
                          <View style={styles.userHandlePill}>
                            <Text style={styles.userHandleText}>@{client.username}</Text>
                          </View>
                        </View>
                        <Text style={styles.clientDateText}>Associato il {createdDate}</Text>
                        {client.notes ? (
                          <Text style={styles.clientNotesText} numberOfLines={2}>
                            {client.notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* OTP & Access Info */}
                    <View style={styles.otpRow}>
                      <View style={styles.otpPillContainer}>
                        <Text style={styles.otpLabel}>OTP DI ACCESSO:</Text>
                        <Text style={styles.otpCode}>{client.otp}</Text>
                      </View>
                      <Pressable
                        onPress={() => handleCopyOtp(client.otp, clientName)}
                        style={styles.copyPillBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Copia OTP di ${clientName}`}
                      >
                        <Text style={styles.copyPillBtnText}>📋 Copia</Text>
                      </Pressable>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.clientActionsRow}>
                      <Pressable
                        onPress={() => handleManageClientRoutines(client)}
                        style={styles.manageRoutinesBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Gestisci schede di ${clientName}`}
                      >
                        <Text style={styles.manageRoutinesBtnText} numberOfLines={1}>
                          📋 Schede
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleArchiveConfirm(client)}
                        style={styles.archiveBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Archivia atleta ${clientName}`}
                      >
                        <Text style={styles.archiveBtnText} numberOfLines={1}>
                          📦 Archivia
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          console.log('[ClientsScreen] Click Elimina su client:', client.id);
                          handleHardDeleteConfirm(client);
                        }}
                        style={({ pressed }) => [
                          styles.activeDeleteBtn,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Elimina definitivamente ${clientName}`}
                      >
                        <Text style={styles.activeDeleteBtnText} numberOfLines={1}>
                          🗑️ Elimina
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}

        {/* ========================================== */}
        {/* SECTION 3: CLIENTI ARCHIVIATI (COLLAPSIBLE)*/}
        {/* ========================================== */}
        <View style={styles.archivedSectionWrapper}>
          <Pressable
            onPress={() => setShowArchived(!showArchived)}
            style={styles.archivedToggleBtn}
            accessibilityRole="button"
            accessibilityLabel="Mostra o nascondi atleti archiviati"
          >
            <Text style={styles.archivedToggleText}>
              📦 Clienti Archiviati ({archivedClients.length})
            </Text>
            <Text style={styles.archivedChevron}>{showArchived ? '▲' : '▼'}</Text>
          </Pressable>

          {showArchived && (
            <View style={styles.archivedContent}>
              {filteredArchivedClients.length === 0 ? (
                <Text style={styles.emptyArchivedText}>
                  Nessun cliente presente negli archivi.
                </Text>
              ) : (
                filteredArchivedClients.map((client) => {
                  const clientName = `${client.first_name} ${client.last_name}`.trim() || client.username;
                  return (
                    <View key={client.id} style={styles.archivedClientCard}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.archivedClientName}>{clientName}</Text>
                        <Text style={styles.archivedClientHandle}>@{client.username}</Text>
                      </View>
                      <View style={styles.archivedActionsRow}>
                        <Pressable
                          onPress={() => handleUnarchiveConfirm(client)}
                          style={styles.unarchiveBtn}
                          accessibilityRole="button"
                          accessibilityLabel={`Ripristina ${clientName}`}
                        >
                          <Text style={styles.unarchiveBtnText}>↩️ Ripristina</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleHardDeleteConfirm(client)}
                          style={styles.hardDeleteBtn}
                          accessibilityRole="button"
                          accessibilityLabel={`Elimina definitivamente ${clientName}`}
                        >
                          <Text style={styles.hardDeleteBtnText}>🗑️ Elimina</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
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
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    padding: layout.cardPadding,
    paddingBottom: 140,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusMd,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 2,
  },
  sectionCard: {
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  formContainer: {
    gap: 10,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusMd,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  createBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  credentialsResultBox: {
    marginTop: 14,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 12,
  },
  credentialsResultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  credentialsResultTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  credentialsResultPill: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  credentialsResultDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  credRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  credItem: {
    flex: 1,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  credLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  credValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  credValueOtp: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.accent,
    marginTop: 2,
    letterSpacing: 1,
  },
  copyOtpDirectBtn: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusSm,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyOtpDirectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 4,
  },
  activeChevron: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '700',
    paddingLeft: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    padding: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  clientCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  clientCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.accent,
  },
  clientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  clientCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  userHandlePill: {
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userHandleText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  clientDateText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  clientNotesText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 3,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  otpPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otpLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  otpCode: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 1,
  },
  copyPillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyPillBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  clientActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  manageRoutinesBtn: {
    flex: 1.4,
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusSm,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageRoutinesBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  archiveBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  activeDeleteBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDeleteBtnText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 4,
  },
  emptyDesc: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  archivedSectionWrapper: {
    marginTop: 16,
    borderRadius: layout.borderRadiusMd,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  archivedToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  archivedToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  archivedChevron: {
    fontSize: 12,
    color: colors.textMuted,
  },
  archivedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  emptyArchivedText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  archivedClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  archivedClientName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  archivedClientHandle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  archivedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unarchiveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  unarchiveBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  hardDeleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  hardDeleteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
  },
});
