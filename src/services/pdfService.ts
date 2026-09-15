import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { WorkoutRoutine, RoutineExercise, RoutineExerciseSet } from '../types/workout';

export type Routine = WorkoutRoutine;

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBandAssistance(band?: string): string {
  switch (band) {
    case 'heavy':
      return 'Elastico Tensione Alta (Rossa)';
    case 'medium':
      return 'Elastico Tensione Media (Arancione)';
    case 'light':
      return 'Elastico Tensione Bassa (Gialla)';
    case 'weighted':
      return 'Sovraccarico con Zavorra';
    case 'none':
    default:
      return 'Corpo Libero';
  }
}

function formatSetType(type: string): { label: string; bg: string; color: string } {
  switch (type) {
    case 'warmup':
      return { label: 'Warm-up', bg: '#FEF3C7', color: '#D97706' };
    case 'dropset':
      return { label: 'Stripping', bg: '#FEE2E2', color: '#DC2626' };
    case 'rest_pause':
      return { label: 'Rest-Pause', bg: '#F3E8FF', color: '#7E22CE' };
    case 'normal':
    default:
      return { label: 'Normale', bg: '#F1F5F9', color: '#475569' };
  }
}

function formatSetLoad(s: RoutineExerciseSet, exType?: string): string {
  if (exType === 'bodyweight') {
    if (s.band_assistance === 'weighted') {
      return `Zavorra +${s.target_weight_kg || 0} kg`;
    }
    return formatBandAssistance(s.band_assistance);
  }

  if (s.set_type === 'dropset' || s.set_type === 'rest_pause') {
    if (s.drops && s.drops.length > 0) {
      return s.drops.map((d, i) => `Step ${i + 1}: ${d.kg} kg`).join('<br/>');
    }
  }

  if (exType === 'time') {
    return s.target_weight_kg > 0 ? `${s.target_weight_kg} kg` : 'Corpo Libero';
  }

  return s.target_weight_kg > 0 ? `${s.target_weight_kg} kg` : '0 kg / Libero';
}

function formatSetReps(s: RoutineExerciseSet, exType?: string): string {
  if (s.set_type === 'dropset' || s.set_type === 'rest_pause') {
    if (s.drops && s.drops.length > 0) {
      return s.drops.map((d, i) => `Step ${i + 1}: ${d.reps} reps`).join('<br/>');
    }
  }

  if (exType === 'time') {
    return `${s.target_time_seconds || 60} sec`;
  }

  return `${s.target_reps} reps`;
}

function formatSetRest(s: RoutineExerciseSet): string {
  const sec = s.rest_seconds;
  if (!sec || sec === 0) return '0s';
  if (sec >= 60 && sec % 60 === 0) {
    return `${sec / 60} min`;
  }
  if (sec > 60) {
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}m ${r}s`;
  }
  return `${sec}s`;
}

export function generateRoutineHtml(routine: Routine, clientName?: string): string {
  const formattedDate = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const exercises = routine.exercises || [];

  const exercisesHtml = exercises.length === 0
    ? `<div class="empty-state">Nessun esercizio configurato in questa scheda.</div>`
    : exercises.map((re: RoutineExercise, idx: number) => {
        const ex = re.exercise;
        const exName = escapeHtml(ex?.name || `Esercizio ${idx + 1}`);
        const muscle = escapeHtml(ex?.muscle_group || 'Generale');
        const exType = ex?.exercise_type || 'reps';
        const superset = re.superset_group ? `⚡ Superset ${escapeHtml(re.superset_group)}` : '';
        const notes = re.notes || re.custom_description || ex?.description || ex?.notes || '';
        const videoUrl = re.custom_video_url || ex?.video_url || '';

        const setsHtml = (re.sets || []).map((s: RoutineExerciseSet, sIdx: number) => {
          const typeBadge = formatSetType(s.set_type);
          const loadStr = formatSetLoad(s, exType);
          const repsStr = formatSetReps(s, exType);
          const restStr = formatSetRest(s);

          return `
            <tr>
              <td class="col-num">#${s.set_number || sIdx + 1}</td>
              <td class="col-type">
                <span class="type-pill" style="background-color: ${typeBadge.bg}; color: ${typeBadge.color}">
                  ${typeBadge.label}
                </span>
              </td>
              <td class="col-load">${loadStr}</td>
              <td class="col-reps"><strong>${repsStr}</strong></td>
              <td class="col-rest">${restStr}</td>
            </tr>
          `;
        }).join('');

        return `
          <div class="exercise-card">
            <div class="exercise-header">
              <div class="exercise-title-group">
                <span class="exercise-num">${idx + 1}</span>
                <span class="exercise-name">${exName}</span>
                <span class="muscle-tag">${muscle}</span>
                ${superset ? `<span class="superset-tag">${superset}</span>` : ''}
              </div>
            </div>

            ${notes ? `<div class="exercise-notes"><strong>Note esecuzione:</strong> ${escapeHtml(notes)}</div>` : ''}
            ${videoUrl ? `<div class="exercise-video"><strong>Video Tutorial:</strong> <a href="${escapeHtml(videoUrl)}" target="_blank">${escapeHtml(videoUrl)}</a></div>` : ''}

            <table class="sets-table">
              <thead>
                <tr>
                  <th style="width: 10%;">Serie</th>
                  <th style="width: 20%;">Tipo</th>
                  <th style="width: 35%;">Carico / Dettaglio</th>
                  <th style="width: 20%;">Ripetizioni</th>
                  <th style="width: 15%;">Recupero</th>
                </tr>
              </thead>
              <tbody>
                ${setsHtml || '<tr><td colspan="5" class="no-sets">Nessuna serie configurata</td></tr>'}
              </tbody>
            </table>
          </div>
        `;
      }).join('');

  return `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(routine.name)} - MyTrainUp</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 14mm 12mm 14mm 12mm;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0F172A;
            background-color: #FFFFFF;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.4;
          }

          /* Header Section */
          .doc-header {
            border-bottom: 2.5px solid #0EA5E9;
            padding-bottom: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .brand-col h1 {
            margin: 0;
            font-size: 20pt;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.5px;
          }

          .brand-col .brand-subtitle {
            margin: 2px 0 0 0;
            font-size: 9.5pt;
            font-weight: 700;
            color: #0EA5E9;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .meta-col {
            text-align: right;
            font-size: 9pt;
            color: #64748B;
          }

          .meta-col .gen-date {
            font-weight: 600;
            color: #334155;
          }

          /* Routine Info Box */
          .routine-info-box {
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 18px;
          }

          .routine-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }

          .routine-name {
            font-size: 14pt;
            font-weight: 800;
            color: #0F172A;
          }

          .badges-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .info-badge {
            display: inline-block;
            background-color: #E2E8F0;
            color: #334155;
            font-size: 8pt;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            text-transform: uppercase;
          }

          .info-badge.client {
            background-color: #0EA5E9;
            color: #FFFFFF;
          }

          .info-badge.duration {
            background-color: #10B981;
            color: #FFFFFF;
          }

          .routine-description {
            font-size: 9.5pt;
            color: #475569;
            margin-top: 6px;
            line-height: 1.4;
          }

          /* Exercise Card */
          .exercise-card {
            border: 1px solid #CBD5E1;
            border-radius: 6px;
            margin-bottom: 14px;
            padding: 10px 12px;
            background-color: #FFFFFF;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .exercise-header {
            margin-bottom: 8px;
            border-bottom: 1px solid #E2E8F0;
            padding-bottom: 6px;
          }

          .exercise-title-group {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
          }

          .exercise-num {
            background-color: #0F172A;
            color: #FFFFFF;
            font-weight: 800;
            font-size: 8.5pt;
            width: 22px;
            height: 22px;
            border-radius: 11px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            line-height: 22px;
          }

          .exercise-name {
            font-size: 11.5pt;
            font-weight: 800;
            color: #0F172A;
          }

          .muscle-tag {
            background-color: #F1F5F9;
            color: #475569;
            font-size: 8pt;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #CBD5E1;
          }

          .superset-tag {
            background-color: #FEF3C7;
            color: #B45309;
            font-size: 8pt;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #FDE68A;
          }

          .exercise-notes, .exercise-video {
            font-size: 8.5pt;
            color: #475569;
            margin-bottom: 6px;
            line-height: 1.35;
          }

          .exercise-video a {
            color: #0284C7;
            text-decoration: none;
            word-break: break-all;
          }

          /* Sets Table */
          .sets-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: 9pt;
          }

          .sets-table th {
            background-color: #F8FAFC;
            color: #475569;
            text-align: left;
            padding: 5px 8px;
            font-weight: 700;
            font-size: 7.5pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #CBD5E1;
          }

          .sets-table td {
            padding: 5px 8px;
            border-bottom: 1px solid #F1F5F9;
            vertical-align: middle;
          }

          .sets-table tr:last-child td {
            border-bottom: none;
          }

          .sets-table tr:nth-child(even) {
            background-color: #FAFAFA;
          }

          .col-num {
            font-weight: 700;
            color: #64748B;
          }

          .type-pill {
            display: inline-block;
            font-size: 7.5pt;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 3px;
            text-transform: uppercase;
          }

          .col-load {
            color: #0F172A;
            font-weight: 600;
          }

          .col-reps {
            color: #0F172A;
          }

          .col-rest {
            color: #0EA5E9;
            font-weight: 700;
          }

          .no-sets {
            text-align: center;
            color: #94A3B8;
            font-style: italic;
            padding: 10px;
          }

          /* Footer */
          .doc-footer {
            margin-top: 24px;
            border-top: 1px solid #E2E8F0;
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8pt;
            color: #94A3B8;
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div class="brand-col">
            <h1>MY TRAIN UP</h1>
            <div class="brand-subtitle">Personal Fitness Logbook</div>
          </div>
          <div class="meta-col">
            <div>Data: <span class="gen-date">${formattedDate}</span></div>
            <div>Gestione Scheda di Allenamento</div>
          </div>
        </div>

        <div class="routine-info-box">
          <div class="routine-title-row">
            <span class="routine-name">${escapeHtml(routine.name)}</span>
            <div class="badges-row">
              ${clientName ? `<span class="info-badge client">Atleta: ${escapeHtml(clientName)}</span>` : ''}
              ${routine.folder_name ? `<span class="info-badge">📁 ${escapeHtml(routine.folder_name)}</span>` : ''}
              ${routine.workout_type ? `<span class="info-badge">${escapeHtml(routine.workout_type)}</span>` : ''}
              <span class="info-badge duration">${routine.duration_weeks} Settimane</span>
            </div>
          </div>

          ${routine.description ? `<div class="routine-description">${escapeHtml(routine.description)}</div>` : ''}
        </div>

        <div class="exercises-container">
          ${exercisesHtml}
        </div>

        <div class="doc-footer">
          <div>Documento generato dall'applicazione MyTrainUp • Logbook & Schede</div>
          <div>Pagina 1 di 1</div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Esporta una scheda di allenamento in formato PDF e attiva il foglio di condivisione di sistema
 */
export async function exportRoutineToPdf(
  routine: Routine,
  clientName?: string
): Promise<void> {
  const html = generateRoutineHtml(routine, clientName);

  const { uri } = await Print.printToFileAsync({
    html,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Condividi scheda: ${routine.name}`,
    });
  } else {
    await Print.printAsync({ html });
  }
}
