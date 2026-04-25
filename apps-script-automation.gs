/**
 * ══════════════════════════════════════════════════════════════════════
 * TIJUANA RIVER CRISIS — AUTOMATED NOTIFICATION ENGINE
 * Google Apps Script — paste into script.google.com
 * ══════════════════════════════════════════════════════════════════════
 */

const CONFIG = {
  SHEET_ID: '1UbiTP-SThV-fbVv28LW8zjvWMUH7rURkz0VViMAzOiI',
  SHEET_NAME: 'Form Responses 1',
  SENDER_NAME: 'Tijuana River Crisis Alert System',
  // All alerts are scheduled — no real-time threshold firing.
  // Set ONE time-based trigger: morningRun() → daily at 7am Pacific.
  // Triggers → Add Trigger → morningRun → Time-driven → Day timer → 7am–8am
  officials: {
    epa_admin:           'https://www.epa.gov/aboutepa/forms/contact-epa',  // no direct email
    epa_region9:         'giarmoleo.julia@epa.gov',      // Press officer, Southern CA/Arizona (Region 9)
    ibwc:                'pao@ibwc.gov',
    rep_vargas:          'erin.chapman@mail.house.gov',       // Deputy Chief of Staff, Rep. Vargas (CA-52)
    rep_peters:          'lena.jacobson@mail.house.gov',      // Communications Director, Rep. Peters (CA-50)
    sen_padilla:         'casework@padilla.senate.gov',
    sen_schiff:          'press@schiff.senate.gov',               // Press inbox — Schiff_California@ is unmonitored transitional address
    gov_newsom:          'Omar.Rodriguez@GOV.CA.GOV',         // Press Office, Governor Newsom
    ca_water_board:      'swrcb.webmaster@waterboards.ca.gov',
    sd_water_board:      'rb9_questions@waterboards.ca.gov',
    supervisor_d1:       'District1community@sdcounty.ca.gov',
    county_env:          'dehinbox@sdcounty.ca.gov',
    ib_mayor:            'cityclerk@imperialbeachca.gov',
    sd_mayor:            'MayorToddGloria@SanDiego.gov',
    tijuana_mayor_email: 'presidencia@tijuana.gob.mx',
    baja_governor:       'gobernadora@bajacalifornia.gob.mx',
    cespt:               'atencion.ciudadana@cespt.gob.mx',
    conagua_bc:          'https://app.conagua.gob.mx/sistemasdeagua/Contacto',
    semarnat:            'info@semarnat.gob.mx',
    kpbs:                'investigations@kpbs.org',
    voice_sd:            'tips@voiceofsandiego.org',
    inewsource:          'tips@inewsource.org',
    coastkeeper:         'communications@sdcoastkeeper.org',
    env_health_coalition:'frontdesk@environmentalhealth.org',
    earthjustice:        'info@earthjustice.org',
    sdapcd:              'airinfo@sdapcd.org',
    guardian_env:        'environment.desk@theguardian.com',
    sd_union_tribune:    'lora.cicalo@sandiegouniontribune.com',
    atsdr:               'atsdrinfo@cdc.gov',
    coronado_times:      'news@coronadotimes.com',
    coronado_eagle:      'editor.eaglenews@gmail.com',          // Coronado Eagle & Journal + IB Eagle & Times
    // Additional media outlets
    nbc_sd:              'newstips@nbcsandiego.com',
    abc10:               'newstips@10news.com',
    cbs8:                'newstips@cbs8.com',
    fox5:                'newstips@fox5sandiego.com',
    la_times:            'tips@latimes.com',
    calmatters:          'tips@calmatters.org',
    zeta_tijuana:        'redaccion@zetatijuana.com',
    la_jornada_bc:       'redaccion@jornadabc.mx',
    // Advocacy organizations
    surfrider_sd:        'sdcoastal@surfrider.org',
    wildcoast:           'info@wildcoast.net',
    sierra_club_sd:      'sierraclubsd@sierraclub.org',
  },
  lists: {
    // LOCAL: trimmed to county-level only — city contacts moved to FULL/DIGEST to avoid blocking
    // Fires at 15+ reports/hour with 3-hour cooldown
    LOCAL:   ['supervisor_d1', 'county_env'],
    COUNTY:  ['supervisor_d1', 'county_env', 'sd_water_board'],
    FEDERAL: ['rep_vargas', 'rep_peters', 'sen_padilla', 'sen_schiff', 'epa_region9', 'ibwc', 'sd_water_board', 'supervisor_d1'],
    FULL:    ['rep_vargas', 'rep_peters', 'sen_padilla', 'sen_schiff', 'epa_admin', 'epa_region9', 'ibwc',
              'gov_newsom', 'ca_water_board', 'sd_water_board', 'supervisor_d1', 'county_env',
              'ib_mayor', 'sd_mayor',
              'tijuana_mayor_email', 'baja_governor', 'cespt', 'semarnat',
              'kpbs', 'voice_sd', 'inewsource', 'coastkeeper',
              'env_health_coalition', 'earthjustice', 'sdapcd', 'guardian_env', 'sd_union_tribune', 'atsdr',
              'coronado_times', 'coronado_eagle'],
    // Weekly digest: regulators + advocacy orgs — no media
    DIGEST:  ['epa_region9', 'ibwc', 'rep_vargas', 'rep_peters', 'sen_padilla', 'sen_schiff',
              'ca_water_board', 'sd_water_board', 'supervisor_d1', 'county_env',
              'ib_mayor', 'sd_mayor',
              'tijuana_mayor_email', 'baja_governor', 'cespt', 'semarnat',
              'sdapcd', 'env_health_coalition', 'atsdr'],
    // Media — weekly digest (Monday) + spike alerts (100+ complaints/24h). Subscribers added dynamically.
    MEDIA_STATIC:    ['kpbs', 'voice_sd', 'inewsource', 'sd_union_tribune', 'nbc_sd', 'abc10', 'cbs8',
                      'fox5', 'la_times', 'calmatters', 'coronado_times', 'coronado_eagle',
                      'guardian_env', 'zeta_tijuana', 'la_jornada_bc'],
    // Advocacy orgs — twice-weekly (Mon + Thu), 25+ new complaints threshold. Subscribers added dynamically.
    ADVOCACY_STATIC: ['surfrider_sd', 'coastkeeper', 'env_health_coalition', 'earthjustice',
                      'wildcoast', 'sierra_club_sd'],
  },
};

const COL = {
  TIMESTAMP:  0,
  LOCATION:   1,
  SEVERITY:   2,
  DURATION:   3,
  SYMPTOMS:   4,
  WINDOWS:    5,
  VULNERABLE: 6,
  COMMENTS:   7,
  NAME:       8,
  EMAIL:      9,
};

// ── Per-submission forward: subject line pool ─────────────────────────────
// Rotates on every send to reduce pattern-matching by spam filters.
const FORWARD_SUBJECTS = [
  'Tijuana River Sewage Complaint — {loc} — {date}',
  'Formal Complaint: Active H2S Event — {loc} — {date}',
  'Resident Complaint — Tijuana River Contamination in {loc}',
  'Health Impact Report: Sewage Odor Affecting {loc} Residents',
  'Constituent Filing — Tijuana River Sewage Event, {loc}',
  'Public Health Complaint — Ongoing Sewage Contamination: {loc}',
  'Air Quality & Sewage Concern Reported in {loc} — {date}',
  'Tijuana River Valley Contamination Report — {loc} — {date}',
  'Sewage Event Filed by {loc} Resident — {date}',
  'Resident Health Complaint: H2S / Sewage Odor — {loc}',
];

const FORWARD_INTROS = [
  'A resident of {loc} has filed a formal complaint through TijuanaRiverWatch.com.',
  'This notification is being sent on behalf of a {loc} resident who submitted a sewage odor complaint via TijuanaRiverWatch.com.',
  'A {loc} constituent has formally reported a Tijuana River sewage contamination event through TijuanaRiverWatch.com.',
];

function doPost(e) {
  try {
    // Handle contact form submissions
    const params = e.parameters || {};
    if ((params['contact_form'] || [''])[0] === 'true') {
      const name    = (params['contact_name']    || [''])[0];
      const email   = (params['contact_email']   || [''])[0];
      const subject = (params['contact_subject'] || ['General Question'])[0];
      const message = (params['contact_message'] || [''])[0];
      MailApp.sendEmail({
        to: 'tijuanariverwatch@gmail.com',
        subject: `[TRW Contact] ${subject} — from ${name}`,
        body: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
        htmlBody: `<p><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${email}<br><strong>Subject:</strong> ${subject}</p><hr><p>${message.replace(/\n/g,'<br>')}</p>`,
        replyTo: email,
        name: 'Tijuana River Watch Contact Form'
      });
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle subscribe requests from media/advocacy signup form
    if ((params['action'] || [''])[0] === 'subscribe') {
      const subName  = (params['sub_name']  || [''])[0].trim();
      const subOrg   = (params['sub_org']   || [''])[0].trim();
      const subEmail = (params['sub_email'] || [''])[0].trim().toLowerCase();
      const subType  = (params['sub_type']  || ['media'])[0].trim().toUpperCase(); // MEDIA or ADVOCACY
      if (!subEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subEmail)) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Valid email required' })).setMimeType(ContentService.MimeType.JSON);
      }
      addSubscriber(subName, subOrg, subEmail, subType);
      sendSubscribeConfirmation(subName, subOrg, subEmail, subType);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Subscribed' })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Location', 'Severity', 'Duration',
                       'Symptoms', 'Windows Closed', 'Vulnerable Household',
                       'Comments', 'Name', 'Email']);
    }
    const p = e.parameters || {};
    const symptoms = (p['entry.1956466788'] || []).join(', ');
    const row = [
      new Date(),
      (p['entry.1490422776'] || [''])[0],
      (p['entry.907203543']  || [''])[0],
      (p['entry.247287864']  || [''])[0],
      symptoms,
      (p['entry.824451267']  || [''])[0],
      (p['entry.871476581']  || [''])[0],
      (p['entry.717805650']  || [''])[0],
      (p['entry.1693083561'] || [''])[0],
      (p['entry.30396298']   || [''])[0],
    ];
    sheet.appendRow(row);
    const allData = sheet.getDataRange().getValues();
    const stats = analyzeReports(allData);
    logSubmission(e, stats);

    // Send confirmation copy if user requested it
    const sendCopy = (p['send_copy'] || [''])[0];
    const userEmail = (p['entry.30396298'] || [''])[0];
    if (sendCopy === 'yes' && userEmail) {
      sendUserConfirmation(p);
    }

    // Per-submission forward to direct officials when resident left a comment
    const comment = (p['entry.717805650'] || [''])[0] || '';
    if (comment.trim()) {
      sendPerSubmissionForward(p, 'comment');
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', total: stats.total }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    Logger.log('doPost error: ' + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // Per-submission forward triggered when resident clicks an email provider button
  if (e && e.parameter && e.parameter.action === 'email_sent') {
    try {
      // Merge e.parameter and e.parameters so sendPerSubmissionForward can normalize either format
      const merged = Object.assign({}, e.parameter);
      if (e.parameters) {
        Object.keys(e.parameters).forEach(k => { if (!merged[k]) merged[k] = e.parameters[k]; });
      }
      sendPerSubmissionForward(merged, 'email_sent');
    } catch(err) {
      Logger.log('email_sent forward error: ' + err.toString());
    }
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e && e.parameter && e.parameter['entry.1490422776']) {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
      let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
      if (!sheet) {
        sheet = ss.insertSheet(CONFIG.SHEET_NAME);
        sheet.appendRow(['Timestamp', 'Location', 'Severity', 'Duration',
                         'Symptoms', 'Windows Closed', 'Vulnerable Household',
                         'Comments', 'Name', 'Email']);
      }
      const p = e.parameter || {};
      const symptoms = e.parameters['entry.1956466788']
        ? e.parameters['entry.1956466788'].join(', ')
        : (p['entry.1956466788'] || '');
      const row = [
        new Date(),
        p['entry.1490422776'] || '',
        p['entry.907203543']  || '',
        p['entry.247287864']  || '',
        symptoms,
        p['entry.824451267']  || '',
        p['entry.871476581']  || '',
        p['entry.717805650']  || '',
        p['entry.1693083561'] || '',
        p['entry.30396298']   || '',
      ];
      sheet.appendRow(row);
      const allData = sheet.getDataRange().getValues();
      const stats = analyzeReports(allData);

      // Send confirmation copy to user if requested
      if (p['send_copy'] === 'yes' && p['entry.30396298']) {
        sendUserConfirmation(p);
      }

      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      Logger.log('doGet submission error: ' + err.toString());
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  // Unsubscribe endpoint — ?action=unsubscribe&email=...
  if (e && e.parameter && e.parameter.action === 'unsubscribe') {
    const email = (e.parameter.email || '').trim().toLowerCase();
    if (email) removeSubscriber(email);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unsubscribed</title></head>
<body style="font-family:Arial,sans-serif;text-align:center;padding:60px 20px;background:#f0f4f8;">
<div style="max-width:500px;margin:0 auto;background:#fff;padding:40px;border-radius:8px;">
<h1 style="color:#0b1d35;">Unsubscribed</h1>
<p style="color:#555;">${email || 'Your email'} has been removed from the Tijuana River Watch alert list.</p>
<p style="color:#555;">You will no longer receive media or advocacy digests. Complaint filing on the site is unaffected.</p>
<a href="https://tijuanariverwatch.com" style="color:#0b1d35;">Return to site</a>
</div></body></html>`;
    return HtmlService.createHtmlOutput(html);
  }

  // Stats endpoint — called by the website to display live counts
  if (e && e.parameter && e.parameter.action === 'stats') {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
      const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
      const allData = sheet ? sheet.getDataRange().getValues() : [[]];
      const stats = analyzeReports(allData);
      const output = JSON.stringify({
        status: 'ok',
        total:   stats.total,
        last12h: stats.last12h,
        last24h: stats.last24h,
        last7d:  stats.last7d,
      });
      return ContentService
        .createTextOutput(output)
        .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Tijuana River Crisis Alert System' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function onFormSubmit(e) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
    const allData = sheet.getDataRange().getValues();
    const stats = analyzeReports(allData);
    logSubmission(e, stats);
  } catch(err) {
    Logger.log('onFormSubmit error: ' + err.toString());
  }
}

function analyzeReports(rows) {
  const now = new Date();
  const oneHourAgo       = new Date(now - 1 * 60 * 60 * 1000);
  const twoHoursAgo      = new Date(now - 2 * 60 * 60 * 1000);
  const twelveHoursAgo   = new Date(now - 12 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
  const sevenDaysAgo     = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const dataRows = rows.slice(1);
  let last1h = 0, last2h = 0, last12h = 0, last24h = 0, last7d = 0;
  let severitySum = 0, severityCount = 0;
  let symptoms = {
    'Headache / Migraine': 0, 'Nausea / Vomiting': 0, 'Eye irritation': 0,
    'Throat / breathing issues': 0, 'Dizziness / brain fog': 0,
    'Skin rash / irritation': 0, "Can't sleep": 0, 'Asthma / inhaler needed': 0
  };
  let locations = {};
  let childrenCount = 0;
  dataRows.forEach(row => {
    const ts = new Date(row[COL.TIMESTAMP]);
    if (isNaN(ts)) return;
    if (ts > sevenDaysAgo) last7d++;
    if (ts > twentyFourHoursAgo) {
      last24h++;
      const loc = row[COL.LOCATION] || 'Unknown';
      locations[loc] = (locations[loc] || 0) + 1;
      const sev = parseInt(row[COL.SEVERITY]);
      if (sev >= 1 && sev <= 5) { severitySum += sev; severityCount++; }
      const symptomStr = row[COL.SYMPTOMS] || '';
      symptomStr.split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
        if (symptoms.hasOwnProperty(s)) symptoms[s]++;
      });
      const vuln = (row[COL.VULNERABLE] || '').toLowerCase();
      if (vuln.includes('child') || vuln.includes('both')) childrenCount++;
    }
    if (ts > twelveHoursAgo) last12h++;
    if (ts > twoHoursAgo)    last2h++;
    if (ts > oneHourAgo)     last1h++;
  });
  const avgSeverity = severityCount > 0 ? (severitySum / severityCount).toFixed(1) : 'N/A';
  const totalReports = dataRows.length;
  const topLocations = Object.entries(locations)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([loc, count]) => `${loc}: ${count}`).join(', ');
  const symptomList = Object.entries(symptoms)
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} (${v})`).join(', ');
  return {
    total: totalReports, last1h, last2h, last12h, last24h, last7d,
    avgSeverity, topLocations, symptomList, childrenCount,
    date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

const MEXICAN_OFFICIALS = new Set(['tijuana_mayor_email', 'baja_governor', 'cespt', 'conagua_bc', 'semarnat']);

function sendBulkAlert(level, stats, allData) {
  const recipientKeys = CONFIG.lists[level];
  // Cooldown config: minimum hours between alerts + minimum new complaints since last alert
  const COOLDOWN = {
    LOCAL:   { hours: 6,  minNewComplaints: 15 },
    COUNTY:  { hours: 8,  minNewComplaints: 15 },
    FEDERAL: { hours: 12, minNewComplaints: 20 },
    FULL:    { hours: 24, minNewComplaints: 30 },
  };
  const props = PropertiesService.getScriptProperties();
  const lastSentKey  = `lastSent_${level}`;
  const lastCountKey = `lastCount_${level}`;
  const dailyCapKey  = `dailyCap_${level}_${new Date().toISOString().slice(0, 10)}`;
  const now = Date.now();
  const lastSent  = parseInt(props.getProperty(lastSentKey)  || '0');
  // Track against all-time total so delta = actual new submissions since last alert
  const lastCount = parseInt(props.getProperty(lastCountKey) || '0');
  const cd = COOLDOWN[level] || { hours: 12, minNewComplaints: 20 };
  const hoursSinceLast  = (now - lastSent) / (1000 * 60 * 60);
  const newComplaintsSinceLast = stats.total - lastCount;
  // Daily send cap: max 2 real-time alerts per level per day
  const dailySendCount = parseInt(props.getProperty(dailyCapKey) || '0');
  if (dailySendCount >= 2) {
    Logger.log(`${level} alert skipped — daily cap reached (${dailySendCount} sends today)`);
    return;
  }
  if (hoursSinceLast < cd.hours) {
    Logger.log(`${level} alert skipped — only ${hoursSinceLast.toFixed(1)}h since last send (cooldown: ${cd.hours}h)`);
    return;
  }
  if (newComplaintsSinceLast < cd.minNewComplaints && lastSent > 0) {
    Logger.log(`${level} alert skipped — only ${newComplaintsSinceLast} new complaints since last send (min: ${cd.minNewComplaints})`);
    return;
  }
  // Build subjects/bodies after gate checks so delta count is accurate
  const subject    = buildSubject(level, stats, newComplaintsSinceLast);
  const body       = buildEmailBody(level, stats);
  const htmlBody   = buildHtmlEmailBody(level, stats);
  const subjectEs  = buildSubjectEs(level, stats, newComplaintsSinceLast);
  const bodyEs     = buildEmailBodyEs(level, stats);
  const htmlBodyEs = buildHtmlEmailBodyEs(level, stats);
  // Record this send
  props.setProperty(lastSentKey,  String(now));
  props.setProperty(lastCountKey, String(stats.total));
  props.setProperty(dailyCapKey,  String(dailySendCount + 1));
  let emailsSent = 0;
  recipientKeys.forEach(key => {
    const addr = CONFIG.officials[key];
    if (!addr || addr.startsWith('http')) return;
    const isMexican = MEXICAN_OFFICIALS.has(key);
    try {
      MailApp.sendEmail({
        to: addr,
        subject: isMexican ? subjectEs : subject,
        body:    isMexican ? bodyEs    : body,
        htmlBody: isMexican ? htmlBodyEs : htmlBody,
        name: CONFIG.SENDER_NAME,
        replyTo: Session.getActiveUser().getEmail()
      });
      emailsSent++;
      Utilities.sleep(300);
    } catch(err) {
      Logger.log(`Failed to send to ${key}: ${err}`);
    }
  });
  Logger.log(`${level} alert: ${emailsSent} emails sent`);
}

function buildSubject(level, stats, newSinceLast) {
  const delta = newSinceLast || stats.last1h;
  const variants = {
    LOCAL: [
      `[URGENT] ${stats.last1h} Residents Reporting Sewage Crisis Right Now — ${stats.date}`,
      `Constituent Alert: Active Sewage Odor Event in Imperial Beach / San Ysidro — ${stats.time}`,
      `Citizen Complaint Report: Hydrogen Sulfide Event in Progress — ${stats.date}`,
    ],
    FEDERAL: [
      `[NEW COMPLAINTS] ${delta} New Sewage Reports Since Last Alert — Tijuana Crisis Ongoing — ${stats.date}`,
      `Federal Action Needed: ${delta} New Citizen Reports Filed — Tijuana Sewage Crisis Active`,
      `Congressional Notification: ${delta} New Complaints Since Last Alert — Tijuana River Event — ${stats.date}`,
    ],
    FULL: [
      `[${delta} NEW REPORTS] Tijuana River Sewage Crisis Update — ${stats.last24h} Total Today — ${stats.date}`,
      `Crisis Update: ${delta} New Sewage Complaints Since Last Alert — ${stats.last24h} Reports Today`,
      `Full Alert: ${delta} New Citizen Reports Filed — Tijuana Sewage Crisis — ${stats.date}`,
    ],
  };
  const list = variants[level] || variants.LOCAL;
  return list[new Date().getDay() % list.length];
}

function buildEmailBody(level, stats) {
  const reportCount = level === 'LOCAL' ? stats.last1h : level === 'FEDERAL' ? stats.last2h : stats.last12h;
  const timeframe = level === 'LOCAL' ? 'in the past hour' : level === 'FEDERAL' ? 'in the past 2 hours' : 'in the past 12 hours';
  return `This is an automated notification from the Tijuana River Crisis Alert System.

DATE: ${stats.date}
TIME: ${stats.time}
ALERT LEVEL: ${level}

${reportCount} citizens filed sewage-related complaints ${timeframe}.

COMPLAINT DATA:
- Reports last hour: ${stats.last1h}
- Reports last 12 hours: ${stats.last12h}
- Reports last 24 hours: ${stats.last24h}
- Reports this week: ${stats.last7d}
- Average severity (1-5): ${stats.avgSeverity}
- Affected locations: ${stats.topLocations || 'Multiple areas'}
- Health symptoms: ${stats.symptomList || 'None specified'}
- Households with children/elderly affected: ${stats.childrenCount}
- Total reports to date: ${stats.total}

Residents of Imperial Beach, San Ysidro, and South San Diego are being exposed to toxic hydrogen sulfide gas from Tijuana River sewage. They are reporting headaches, nausea, respiratory distress, and inability to sleep.

WE ARE REQUESTING:
1. Immediate attention to IBWC South Bay International Wastewater Treatment Plant and CESPT pump stations.
2. Accelerated completion of the Saturn Boulevard Pipe Extension to address the Saturn Blvd sewage hotspot.
3. Accelerated implementation of Minute 333 infrastructure commitments.
4. A public statement acknowledging tonight's event.
5. Enforcement action against entities responsible for tonight's discharge.

— Tijuana River Crisis Alert System | tijuanariverwatch.com`;
}

function buildHtmlEmailBody(level, stats) {
  const reportCount = level === 'LOCAL' ? stats.last1h : level === 'FEDERAL' ? stats.last2h : stats.last12h;
  const timeframe = level === 'LOCAL' ? 'in the past hour' : level === 'FEDERAL' ? 'in the past 2 hours' : 'in the past 12 hours';
  const levelColor = level === 'FULL' ? '#dc2626' : level === 'FEDERAL' ? '#f97316' : '#2563eb';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;text-align:center;">
    <div style="display:inline-block;background:${levelColor};color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 14px;border-radius:999px;margin-bottom:12px;">${level} ALERT</div>
    <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 6px;">Tijuana River Sewage Crisis</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">${stats.date} · ${stats.time}</p>
  </div>
  <div style="background:${levelColor};padding:20px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">${reportCount}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.85);font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Citizen Complaints Filed ${timeframe}</div>
  </div>
  <div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:12px;"><div style="font-size:26px;font-weight:900;color:#0b1d35;">${stats.last24h}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;white-space:nowrap;">Last 24 Hours</div></td>
      <td style="text-align:center;padding:12px;border-left:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:900;color:#0b1d35;">${stats.avgSeverity}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;white-space:nowrap;">Avg Severity (1–5)</div></td>
      <td style="text-align:center;padding:12px;border-left:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:900;color:#0b1d35;">${stats.childrenCount}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;white-space:nowrap;">Children/Elderly Affected</div></td>
      <td style="text-align:center;padding:12px;border-left:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:900;color:#0b1d35;">${stats.total}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;white-space:nowrap;">Total Reports</div></td>
    </tr></table>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;">Residents of <strong>Imperial Beach, San Ysidro, and South San Diego County</strong> are being exposed to toxic hydrogen sulfide gas. Symptoms: <strong>${stats.symptomList || 'multiple'}</strong>. Areas: <strong>${stats.topLocations || 'South San Diego'}</strong>.</p>
    <h2 style="font-size:16px;color:#0b1d35;margin:20px 0 12px;">What We Are Requesting</h2>
    <ol style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>Immediate attention to IBWC South Bay International Wastewater Treatment Plant and CESPT pump stations.</li>
      <li>Accelerated completion of the Saturn Boulevard Pipe Extension to address the Saturn Blvd sewage hotspot.</li>
      <li>Accelerated implementation of Minute 333 infrastructure commitments.</li>
      <li>A public acknowledgment of tonight's event and its health impact.</li>
      <li>Enforcement action against entities responsible for tonight's discharge.</li>
    </ol>
    <div style="background:#0b1d35;border-radius:8px;padding:20px;text-align:center;">
      <p style="color:#a8c0d8;font-size:13px;margin:0 0 4px;">The citizens of South San Diego County are your constituents.</p>
      <p style="color:#fff;font-size:15px;font-weight:700;margin:0;">They are suffering tonight. They have been suffering for decades.</p>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Automated alert — Tijuana River Crisis Alert System | tijuanariverwatch.com</p>
  </div>
</div></body></html>`;
}

function buildSubjectEs(level, stats, newSinceLast) {
  const delta = newSinceLast || stats.last1h;
  const variants = {
    LOCAL: [
      `[URGENTE] ${stats.last1h} Residentes Reportan Crisis de Aguas Residuales Ahora — ${stats.date}`,
      `Alerta Ciudadana: Evento Activo de Olores Cloacales en Imperial Beach / San Ysidro — ${stats.time}`,
      `Quejas Ciudadanas: Evento de Sulfuro de Hidrógeno en Curso — ${stats.date}`,
    ],
    FEDERAL: [
      `[NUEVAS QUEJAS] ${delta} Nuevos Reportes Desde Última Alerta — Crisis del Río Tijuana — ${stats.date}`,
      `Se Requiere Acción: ${delta} Nuevas Quejas Ciudadanas Registradas — Crisis Activa — ${stats.date}`,
      `Notificación: ${delta} Nuevos Reportes Desde Última Alerta — Río Tijuana — ${stats.date}`,
    ],
    FULL: [
      `[${delta} NUEVOS REPORTES] Actualización Crisis Río Tijuana — ${stats.last24h} Total Hoy — ${stats.date}`,
      `Actualización: ${delta} Nuevas Quejas Desde Última Alerta — ${stats.last24h} Reportes Hoy`,
      `Alerta Total: ${delta} Nuevos Reportes — Crisis de Aguas Residuales — ${stats.date}`,
    ],
  };
  const list = variants[level] || variants.LOCAL;
  return list[new Date().getDay() % list.length];
}

function buildEmailBodyEs(level, stats) {
  const reportCount = level === 'LOCAL' ? stats.last1h : level === 'FEDERAL' ? stats.last2h : stats.last12h;
  const timeframe = level === 'LOCAL' ? 'en la última hora' : level === 'FEDERAL' ? 'en las últimas 2 horas' : 'en las últimas 12 horas';
  return `Esta es una notificación automatizada del Sistema de Alertas de Crisis del Río Tijuana.

FECHA: ${stats.date}
HORA: ${stats.time}
NIVEL DE ALERTA: ${level}

${reportCount} ciudadanos presentaron quejas relacionadas con aguas residuales ${timeframe}.

DATOS DE QUEJAS:
- Reportes última hora: ${stats.last1h}
- Reportes últimas 12 horas: ${stats.last12h}
- Reportes últimas 24 horas: ${stats.last24h}
- Reportes esta semana: ${stats.last7d}
- Severidad promedio (1-5): ${stats.avgSeverity}
- Zonas afectadas: ${stats.topLocations || 'Múltiples áreas'}
- Síntomas de salud: ${stats.symptomList || 'No especificados'}
- Hogares con niños/adultos mayores afectados: ${stats.childrenCount}
- Total de reportes acumulados: ${stats.total}

Los residentes de Imperial Beach, San Ysidro y el sur del Condado de San Diego están siendo expuestos a gas sulfuro de hidrógeno tóxico proveniente del Río Tijuana. Reportan dolores de cabeza, náuseas, dificultades respiratorias e incapacidad para dormir.

SOLICITAMOS:
1. Atención inmediata a la Planta Internacional de Tratamiento de Aguas Residuales de South Bay del IBWC y a las estaciones de bombeo de CESPT.
2. Finalización acelerada de la Extensión del Ducto de Saturn Boulevard para atender el punto crítico de derrames en esa zona.
3. Implementación acelerada de los compromisos de infraestructura del Acta 333.
4. Un comunicado público reconociendo el evento de esta noche.
5. Acciones de cumplimiento contra las entidades responsables de las descargas.

— Sistema de Alertas de Crisis del Río Tijuana | tijuanariverwatch.com`;
}

function buildHtmlEmailBodyEs(level, stats) {
  const reportCount = level === 'LOCAL' ? stats.last1h : level === 'FEDERAL' ? stats.last2h : stats.last12h;
  const timeframe = level === 'LOCAL' ? 'en la última hora' : level === 'FEDERAL' ? 'en las últimas 2 horas' : 'en las últimas 12 horas';
  const levelColor = level === 'FULL' ? '#dc2626' : level === 'FEDERAL' ? '#f97316' : '#2563eb';
  const levelLabel = level === 'FULL' ? 'ALERTA CRÍTICA' : level === 'FEDERAL' ? 'ALERTA FEDERAL' : 'ALERTA LOCAL';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;text-align:center;">
    <div style="display:inline-block;background:${levelColor};color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 14px;border-radius:999px;margin-bottom:12px;">${levelLabel}</div>
    <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 6px;">Crisis de Aguas Residuales del Río Tijuana</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">${stats.date} · ${stats.time}</p>
  </div>
  <div style="background:${levelColor};padding:20px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">${reportCount}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.85);font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Quejas Ciudadanas Presentadas ${timeframe}</div>
  </div>
  <div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:12px;"><div style="font-size:26px;font-weight:900;color:#0b1d35;">${stats.last24h}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;white-space:nowrap;">Últimas 24 Horas</div></td>
      <td style="text-align:center;padding:12px;border-left:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:900;color:#0b1d35;">${stats.avgSeverity}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;white-space:nowrap;">Severidad Prom. (1–5)</div></td>
      <td style="text-align:center;padding:12px;border-left:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:900;color:#0b1d35;">${stats.childrenCount}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;white-space:nowrap;">Niños/Mayores Afectados</div></td>
      <td style="text-align:center;padding:12px;border-left:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:900;color:#0b1d35;">${stats.total}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;white-space:nowrap;">Total de Reportes</div></td>
    </tr></table>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;">Los residentes de <strong>Imperial Beach, San Ysidro y el sur del Condado de San Diego</strong> están siendo expuestos a gas sulfuro de hidrógeno tóxico. Síntomas: <strong>${stats.symptomList || 'múltiples'}</strong>. Zonas: <strong>${stats.topLocations || 'Sur de San Diego'}</strong>.</p>
    <h2 style="font-size:16px;color:#0b1d35;margin:20px 0 12px;">Lo Que Solicitamos</h2>
    <ol style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>Atención inmediata a la Planta de South Bay del IBWC y a las estaciones de bombeo de CESPT.</li>
      <li>Finalización acelerada de la Extensión del Ducto de Saturn Boulevard para atender el punto crítico de derrames en esa zona.</li>
      <li>Implementación acelerada de los compromisos de infraestructura del Acta 333.</li>
      <li>Un comunicado público reconociendo el evento y su impacto en la salud.</li>
      <li>Acciones de cumplimiento contra las entidades responsables de las descargas de esta noche.</li>
    </ol>
    <div style="background:#0b1d35;border-radius:8px;padding:20px;text-align:center;">
      <p style="color:#a8c0d8;font-size:13px;margin:0 0 4px;">Los ciudadanos del sur del Condado de San Diego son sus vecinos.</p>
      <p style="color:#fff;font-size:15px;font-weight:700;margin:0;">Están sufriendo esta noche. Han sufrido durante décadas.</p>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Alerta automatizada — Sistema de Alertas de Crisis del Río Tijuana | tijuanariverwatch.com</p>
  </div>
</div></body></html>`;
}

/**
 * ── SCHEDULED MORNING RUN ───────────────────────────────────────────────
 * Set a single time-based trigger: runs daily at 7:00 AM Pacific.
 * Triggers: Triggers → Add Trigger → morningRun → Time-driven → Day timer → 7am
 */
function morningRun() {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;
  const allData = sheet.getDataRange().getValues();
  const stats   = analyzeReports(allData);

  const dayOfWeek = new Date().getDay(); // 0=Sun,1=Mon,4=Thu

  // 1. Nightly window summary (7pm–7am) → local/county officials only
  //    Skips silently if zero overnight reports.
  sendNightlyWindowSummary(allData, stats);

  // 2. Weekly digest on Mondays → full DIGEST list (federal/state officials)
  //    Federal contacts get weekly cadence — daily would train spam filters.
  if (dayOfWeek === 1) {
    sendWeeklyDigest();
    sendMediaWeeklyDigest(stats);     // Media outlets — weekly only
  }

  // 3. Advocacy orgs — twice-weekly (Mon + Thu), threshold-gated (25+ new complaints)
  if (dayOfWeek === 1 || dayOfWeek === 4) {
    sendAdvocacyUpdate(stats);
  }

  // 4. Spike alert — any day, fires when 100+ complaints in last 24h
  //    Sends to media + advocacy. Has its own 48h cooldown.
  checkAndSendSpikeAlert(stats);

  // NOTE: sendDailyDigest() removed — federal contacts receive weekly digest only.
  // Nightly local summary + weekly full digest is the right balance for deliverability.
}

/**
 * Nightly window summary: counts reports filed between 7pm yesterday and 7am today.
 * Sends to LOCAL list (county supervisors + city clerks).
 * Skips silently if zero reports in the window.
 */
function sendNightlyWindowSummary(allData, stats) {
  const now     = new Date();
  const sevenAM = new Date(now); sevenAM.setHours(7, 0, 0, 0);
  const sevenPM = new Date(now); sevenPM.setDate(sevenPM.getDate() - 1); sevenPM.setHours(19, 0, 0, 0);

  const dataRows = allData.slice(1);
  let windowCount = 0, severitySum = 0, severityCount = 0;
  let locations = {}, symptoms = {};
  let childrenCount = 0;

  dataRows.forEach(row => {
    const ts = new Date(row[COL.TIMESTAMP]);
    if (isNaN(ts) || ts < sevenPM || ts > sevenAM) return;
    windowCount++;
    const sev = parseInt(row[COL.SEVERITY]);
    if (sev >= 1 && sev <= 5) { severitySum += sev; severityCount++; }
    const loc = row[COL.LOCATION] || 'Unknown';
    locations[loc] = (locations[loc] || 0) + 1;
    (row[COL.SYMPTOMS] || '').split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      symptoms[s] = (symptoms[s] || 0) + 1;
    });
    const vuln = (row[COL.VULNERABLE] || '').toLowerCase();
    if (vuln.includes('child') || vuln.includes('both')) childrenCount++;
  });

  if (windowCount === 0) {
    Logger.log('Nightly summary: 0 reports in window — skipped');
    return;
  }

  const avgSev = severityCount > 0 ? (severitySum / severityCount).toFixed(1) : 'N/A';
  const topLocs = Object.entries(locations).sort((a,b) => b[1]-a[1]).slice(0,5).map(([l,c]) => `${l}: ${c}`).join(', ');
  const topSym  = Object.entries(symptoms).sort((a,b) => b[1]-a[1]).slice(0,4).map(([s,c]) => `${s} (${c})`).join(', ');

  const windowStats = { windowCount, avgSev, topLocs, topSym, childrenCount, total: stats.total,
    date: now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) };

  const subject = `Tijuana River Watch — Overnight Report: ${windowCount} Complaints (7pm–7am) — ${windowStats.date}`;
  const subjectEs = `Vigilancia del Río Tijuana — Reporte Nocturno: ${windowCount} Quejas (7pm–7am) — ${windowStats.date}`;

  const body = buildNightlyBody(windowStats);
  const bodyEs = buildNightlyBodyEs(windowStats);
  const htmlBody = buildNightlyHtml(windowStats);
  const htmlBodyEs = buildNightlyHtmlEs(windowStats);

  const recipientKeys = ['supervisor_d1', 'county_env', 'ib_mayor', 'sd_mayor', 'sd_water_board'];
  let sent = 0;
  recipientKeys.forEach(key => {
    const addr = CONFIG.officials[key];
    if (!addr || addr.startsWith('http')) return;
    const isMexican = MEXICAN_OFFICIALS.has(key);
    try {
      MailApp.sendEmail({
        to: addr,
        subject: isMexican ? subjectEs : subject,
        body:    isMexican ? bodyEs    : body,
        htmlBody: isMexican ? htmlBodyEs : htmlBody,
        name: CONFIG.SENDER_NAME,
        replyTo: 'tijuanariverwatch@gmail.com',
      });
      sent++;
      Utilities.sleep(400);
    } catch(err) { Logger.log('Nightly summary error for ' + key + ': ' + err); }
  });

  logAction(`NIGHTLY SUMMARY sent to ${sent} officials (${windowCount} reports in window)`, stats);
}

/**
 * Daily digest: summarizes the last 24 hours.
 * Sends to FEDERAL list (congress, EPA, IBWC, state water boards).
 * Skips if zero reports in last 24 hours.
 */
function sendDailyDigest(stats) {
  if (stats.last24h === 0) {
    Logger.log('Daily digest: 0 reports in last 24h — skipped');
    return;
  }

  const subject   = `Tijuana River Watch — Daily Report: ${stats.last24h} Complaints — ${stats.date}`;
  const subjectEs = `Vigilancia del Río Tijuana — Reporte Diario: ${stats.last24h} Quejas — ${stats.date}`;

  const recipientKeys = CONFIG.lists.FEDERAL;
  let sent = 0;
  recipientKeys.forEach(key => {
    const addr = CONFIG.officials[key];
    if (!addr || addr.startsWith('http')) return;
    const isMexican = MEXICAN_OFFICIALS.has(key);
    try {
      MailApp.sendEmail({
        to: addr,
        subject: isMexican ? subjectEs : subject,
        body:    isMexican ? buildDailyBodyEs(stats) : buildDailyBody(stats),
        htmlBody: isMexican ? buildDailyHtmlEs(stats) : buildDailyHtml(stats),
        name: CONFIG.SENDER_NAME,
        replyTo: 'tijuanariverwatch@gmail.com',
      });
      sent++;
      Utilities.sleep(400);
    } catch(err) { Logger.log('Daily digest error for ' + key + ': ' + err); }
  });

  // Operator copy
  try {
    MailApp.sendEmail({
      to: 'tijuanariverwatch@gmail.com',
      subject: `[DAILY DIGEST SENT] ${stats.last24h} complaints — ${stats.date}`,
      body: `Daily digest sent to ${sent} officials.\n24h: ${stats.last24h} | All-time: ${stats.total}\nAvg severity: ${stats.avgSeverity}/5\nAreas: ${stats.topLocations}`,
      name: CONFIG.SENDER_NAME,
    });
  } catch(err) { Logger.log('Operator copy error: ' + err); }

  logAction(`DAILY DIGEST sent to ${sent} officials`, stats);
}

// ── NIGHTLY WINDOW EMAIL BUILDERS ─────────────────────────────────────────

function buildNightlyBody(ws) {
  return `TIJUANA RIVER WATCH — OVERNIGHT REPORT (7pm–7am)
${ws.date}
tijuanariverwatch.com
${'─'.repeat(50)}

COMPLAINTS IN OVERNIGHT WINDOW: ${ws.windowCount}
AVERAGE SEVERITY (1–5): ${ws.avgSev}
AREAS AFFECTED: ${ws.topLocs || 'Multiple areas'}
REPORTED SYMPTOMS: ${ws.topSym || 'None specified'}
HOUSEHOLDS WITH CHILDREN OR ELDERLY: ${ws.childrenCount}
ALL-TIME TOTAL REPORTS: ${ws.total}

${'─'.repeat(50)}
Residents of Imperial Beach, Coronado, San Ysidro, and South San Diego County filed ${ws.windowCount} sewage odor complaints overnight. Hydrogen sulfide exposure is worst during nighttime hours when air movement slows.

WE ARE REQUESTING:
1. Immediate attention to IBWC South Bay International Wastewater Treatment Plant and CESPT pump stations.
2. Accelerated completion of the Saturn Boulevard Pipe Extension.
3. Accelerated implementation of Minute 333 infrastructure commitments.
4. A public statement acknowledging ongoing health impacts.
5. Enforcement action against entities responsible for ongoing discharges.

— Tijuana River Watch | tijuanariverwatch.com
To unsubscribe, reply with REMOVE.`;
}

function buildNightlyBodyEs(ws) {
  return `VIGILANCIA DEL RÍO TIJUANA — REPORTE NOCTURNO (7pm–7am)
${ws.date}
tijuanariverwatch.com
${'─'.repeat(50)}

QUEJAS EN LA VENTANA NOCTURNA: ${ws.windowCount}
SEVERIDAD PROMEDIO (1–5): ${ws.avgSev}
ZONAS AFECTADAS: ${ws.topLocs || 'Múltiples áreas'}
SÍNTOMAS REPORTADOS: ${ws.topSym || 'No especificados'}
HOGARES CON NIÑOS O ADULTOS MAYORES: ${ws.childrenCount}
TOTAL ACUMULADO DE REPORTES: ${ws.total}

${'─'.repeat(50)}
Los residentes de Imperial Beach, Coronado, San Ysidro y el sur del Condado de San Diego presentaron ${ws.windowCount} quejas por olores cloacales durante la noche.

SOLICITAMOS:
1. Atención inmediata a la Planta de South Bay del IBWC y a las estaciones de bombeo de CESPT.
2. Finalización acelerada de la Extensión del Ducto de Saturn Boulevard.
3. Implementación acelerada de los compromisos del Acta 333.
4. Un comunicado público reconociendo el impacto en la salud.
5. Acciones de cumplimiento contra los responsables de las descargas.

— Tijuana River Watch | tijuanariverwatch.com`;
}

function buildNightlyHtml(ws) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">Overnight Report · 7pm–7am</div>
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 4px;">Tijuana River Watch</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">${ws.date}</p>
  </div>
  <div style="background:#1e3a5f;padding:20px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">${ws.windowCount}</div>
    <div style="font-size:12px;color:#a8c0d8;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Overnight Complaints (7pm–7am)</div>
  </div>
  <div style="padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:10px;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${ws.avgSev}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Avg Severity</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${ws.childrenCount}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Children/Elderly</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${ws.total}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">All-Time Total</div></td>
    </tr></table>
  </div>
  <div style="padding:24px 32px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;"><strong>Areas:</strong> ${ws.topLocs || 'Multiple areas'}<br><strong>Symptoms:</strong> ${ws.topSym || 'None specified'}</p>
    <h2 style="font-size:15px;color:#0b1d35;margin:18px 0 10px;">What We Are Requesting</h2>
    <ol style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>Immediate attention to IBWC South Bay Wastewater Treatment Plant and CESPT pump stations.</li>
      <li>Accelerated completion of the Saturn Boulevard Pipe Extension.</li>
      <li>Accelerated implementation of Minute 333 infrastructure commitments.</li>
      <li>Public acknowledgment of ongoing health impacts.</li>
      <li>Enforcement action against entities responsible for ongoing discharges.</li>
    </ol>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Automated overnight summary — Tijuana River Watch | tijuanariverwatch.com</p>
  </div>
</div></body></html>`;
}

function buildNightlyHtmlEs(ws) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">Reporte Nocturno · 7pm–7am</div>
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 4px;">Vigilancia del Río Tijuana</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">${ws.date}</p>
  </div>
  <div style="background:#1e3a5f;padding:20px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">${ws.windowCount}</div>
    <div style="font-size:12px;color:#a8c0d8;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Quejas Nocturnas (7pm–7am)</div>
  </div>
  <div style="padding:24px 32px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;"><strong>Zonas:</strong> ${ws.topLocs || 'Múltiples áreas'}<br><strong>Síntomas:</strong> ${ws.topSym || 'No especificados'}</p>
    <ol style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;margin:16px 0;">
      <li>Atención inmediata a la Planta de South Bay del IBWC y a las estaciones de bombeo de CESPT.</li>
      <li>Finalización acelerada de la Extensión del Ducto de Saturn Boulevard.</li>
      <li>Implementación acelerada de los compromisos del Acta 333.</li>
      <li>Comunicado público sobre el impacto en la salud.</li>
      <li>Acciones de cumplimiento contra los responsables de las descargas.</li>
    </ol>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Resumen nocturno automatizado — Tijuana River Watch | tijuanariverwatch.com</p>
  </div>
</div></body></html>`;
}

// ── DAILY DIGEST EMAIL BUILDERS ────────────────────────────────────────────

function buildDailyBody(stats) {
  return `TIJUANA RIVER WATCH — DAILY REPORT
${stats.date}
tijuanariverwatch.com
${'─'.repeat(50)}

COMPLAINTS LAST 24 HOURS: ${stats.last24h}
COMPLAINTS THIS WEEK:     ${stats.last7d}
ALL-TIME TOTAL:           ${stats.total}

AVERAGE SEVERITY (1–5): ${stats.avgSeverity}
AREAS AFFECTED: ${stats.topLocations || 'Multiple areas'}
REPORTED SYMPTOMS: ${stats.symptomList || 'None specified'}
HOUSEHOLDS WITH CHILDREN OR ELDERLY: ${stats.childrenCount}

${'─'.repeat(50)}
Residents of Imperial Beach, Coronado, San Ysidro, Chula Vista, and South San Diego County continue to document hydrogen sulfide gas exposure from Tijuana River sewage.

WE ARE REQUESTING:
1. Immediate attention to IBWC South Bay International Wastewater Treatment Plant and CESPT pump stations.
2. Accelerated completion of the Saturn Boulevard Pipe Extension.
3. Accelerated implementation of Minute 333 infrastructure commitments.
4. Regular public updates on remediation progress.
5. Enforcement action against entities responsible for ongoing discharges.

— Tijuana River Watch | tijuanariverwatch.com
To unsubscribe, reply with REMOVE.`;
}

function buildDailyBodyEs(stats) {
  return `VIGILANCIA DEL RÍO TIJUANA — REPORTE DIARIO
${stats.date}
tijuanariverwatch.com
${'─'.repeat(50)}

QUEJAS ÚLTIMAS 24 HORAS: ${stats.last24h}
QUEJAS ESTA SEMANA:      ${stats.last7d}
TOTAL ACUMULADO:         ${stats.total}

SEVERIDAD PROMEDIO (1–5): ${stats.avgSeverity}
ZONAS AFECTADAS: ${stats.topLocations || 'Múltiples áreas'}
SÍNTOMAS REPORTADOS: ${stats.symptomList || 'No especificados'}
HOGARES CON NIÑOS O ADULTOS MAYORES: ${stats.childrenCount}

${'─'.repeat(50)}
SOLICITAMOS:
1. Atención inmediata a la Planta de South Bay del IBWC y a las estaciones de bombeo de CESPT.
2. Finalización acelerada de la Extensión del Ducto de Saturn Boulevard.
3. Implementación acelerada de los compromisos del Acta 333.
4. Actualizaciones públicas periódicas sobre el avance de las reparaciones.
5. Acciones de cumplimiento contra los responsables de las descargas.

— Tijuana River Watch | tijuanariverwatch.com`;
}

function buildDailyHtml(stats) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">Daily Report</div>
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 4px;">Tijuana River Watch</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">${stats.date}</p>
  </div>
  <div style="background:#1e3a5f;padding:20px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">${stats.last24h}</div>
    <div style="font-size:12px;color:#a8c0d8;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Complaints in the Last 24 Hours</div>
  </div>
  <div style="padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:10px;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.last7d}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">This Week</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.avgSeverity}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Avg Severity</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.childrenCount}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Children/Elderly</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.total}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">All-Time</div></td>
    </tr></table>
  </div>
  <div style="padding:24px 32px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;"><strong>Areas:</strong> ${stats.topLocations || 'Multiple areas'}<br><strong>Symptoms:</strong> ${stats.symptomList || 'None specified'}</p>
    <h2 style="font-size:15px;color:#0b1d35;margin:18px 0 10px;">What We Are Requesting</h2>
    <ol style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>Immediate attention to IBWC South Bay Wastewater Treatment Plant and CESPT pump stations.</li>
      <li>Accelerated completion of the Saturn Boulevard Pipe Extension.</li>
      <li>Accelerated implementation of Minute 333 infrastructure commitments.</li>
      <li>Regular public updates on remediation progress.</li>
      <li>Enforcement action against entities responsible for ongoing discharges.</li>
    </ol>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Automated daily report — Tijuana River Watch | tijuanariverwatch.com</p>
  </div>
</div></body></html>`;
}

function buildDailyHtmlEs(stats) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">Reporte Diario</div>
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 4px;">Vigilancia del Río Tijuana</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">${stats.date}</p>
  </div>
  <div style="background:#1e3a5f;padding:20px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">${stats.last24h}</div>
    <div style="font-size:12px;color:#a8c0d8;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Quejas en las Últimas 24 Horas</div>
  </div>
  <div style="padding:24px 32px;">
    <p style="font-size:14px;color:#374151;line-height:1.7;"><strong>Zonas:</strong> ${stats.topLocations || 'Múltiples áreas'}<br><strong>Síntomas:</strong> ${stats.symptomList || 'No especificados'}</p>
    <ol style="font-size:14px;color:#374151;line-height:1.8;padding-left:20px;margin:16px 0;">
      <li>Atención inmediata a la Planta de South Bay del IBWC y a las estaciones de bombeo de CESPT.</li>
      <li>Finalización acelerada de la Extensión del Ducto de Saturn Boulevard.</li>
      <li>Implementación acelerada de los compromisos del Acta 333.</li>
      <li>Actualizaciones públicas periódicas sobre el avance de las reparaciones.</li>
      <li>Acciones de cumplimiento contra los responsables de las descargas.</li>
    </ol>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Reporte diario automatizado — Tijuana River Watch | tijuanariverwatch.com</p>
  </div>
</div></body></html>`;
}

function sendWeeklyDigest() {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;
  const stats = analyzeReports(sheet.getDataRange().getValues());
  if (stats.last7d === 0) {
    Logger.log('No reports in last 7 days — digest skipped');
    return;
  }

  const recipientKeys = CONFIG.lists.DIGEST;
  const subject   = `Tijuana River Watch — Weekly Report: ${stats.last7d} Complaints (Week of ${stats.date})`;
  const subjectEs = `Vigilancia del Río Tijuana — Reporte Semanal: ${stats.last7d} Quejas (Semana del ${stats.date})`;

  let sent = 0;
  recipientKeys.forEach(key => {
    const addr = CONFIG.officials[key];
    if (!addr || addr.startsWith('http')) return;
    const isMexican = MEXICAN_OFFICIALS.has(key);
    try {
      MailApp.sendEmail({
        to: addr,
        subject: isMexican ? subjectEs : subject,
        body:    isMexican ? buildDigestBodyEs(stats) : buildDigestBody(stats),
        htmlBody: isMexican ? buildDigestHtmlEs(stats) : buildDigestHtml(stats),
        name: CONFIG.SENDER_NAME,
        replyTo: 'tijuanariverwatch@gmail.com',
      });
      sent++;
      Utilities.sleep(400);
    } catch(err) {
      Logger.log('Weekly digest error for ' + key + ': ' + err);
    }
  });

  // Also send a copy to the site operator
  try {
    MailApp.sendEmail({
      to: 'tijuanariverwatch@gmail.com',
      subject: `[WEEKLY DIGEST SENT] ${stats.last7d} complaints — ${stats.date}`,
      body: `Weekly digest sent to ${sent} officials.\n\n7-day: ${stats.last7d} | All-time: ${stats.total}\nAvg severity: ${stats.avgSeverity}/5\nAreas: ${stats.topLocations}\nSymptoms: ${stats.symptomList}\nChildren/elderly: ${stats.childrenCount}`,
      name: CONFIG.SENDER_NAME,
    });
  } catch(err) { Logger.log('Operator copy error: ' + err); }

  logAction('WEEKLY DIGEST sent to ' + sent + ' officials', stats);
}

function buildDigestBody(stats) {
  return `TIJUANA RIVER WATCH — WEEKLY COMPLAINT SUMMARY
Week ending ${stats.date}
tijuanariverwatch.com
${'─'.repeat(50)}

THIS WEEK:      ${stats.last7d} complaints filed
ALL-TIME TOTAL: ${stats.total} complaints

AVERAGE SEVERITY: ${stats.avgSeverity} / 5
AFFECTED AREAS:   ${stats.topLocations || 'Multiple areas'}
REPORTED SYMPTOMS: ${stats.symptomList || 'None specified'}
HOUSEHOLDS WITH CHILDREN OR ELDERLY: ${stats.childrenCount}

${'─'.repeat(50)}
This is an automated weekly summary from the Tijuana River Watch citizen complaint system. Residents of Imperial Beach, San Ysidro, Chula Vista, and South San Diego County continue to document hydrogen sulfide gas exposure from Tijuana River sewage.

For real-time threshold alerts, your office is already on our notification list.

WE ARE REQUESTING:
1. Immediate attention to IBWC South Bay International Wastewater Treatment Plant and CESPT pump stations.
2. Accelerated completion of the Saturn Boulevard Pipe Extension to address the Saturn Blvd sewage hotspot.
3. Accelerated implementation of Minute 333 infrastructure commitments.
4. Regular public updates on remediation progress.
5. Enforcement action against entities responsible for ongoing discharges.

— Tijuana River Watch | tijuanariverwatch.com
To unsubscribe from these notices, reply with REMOVE.`;
}

function buildDigestHtml(stats) {
  const weeklyAvg = stats.total > 0 ? (stats.total / Math.max(1, Math.ceil(stats.total / Math.max(stats.last7d, 1)))).toFixed(1) : 0;
  const trendColor = '#0b1d35';
  const trendLabel = `All-time total: ${stats.total} complaints`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">

  <!-- Header -->
  <div style="background:#0b1d35;padding:24px 32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">Weekly Report</div>
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 4px;">Tijuana River Watch</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">Week ending ${stats.date}</p>
  </div>

  <!-- 7-day headline stat -->
  <div style="background:#1e3a5f;padding:20px 32px;display:flex;align-items:center;">
    <div style="flex:1;">
      <div style="font-size:42px;font-weight:900;color:#fff;line-height:1;">${stats.last7d}</div>
      <div style="font-size:12px;color:#a8c0d8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Complaints this week</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#a8c0d8;font-weight:700;">${trendLabel}</div>
    </div>
  </div>

  <!-- Stats row -->
  <div style="padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:10px;">
        <div style="font-size:24px;font-weight:900;color:#0b1d35;">${stats.last7d}</div>
        <div style="font-size:10px;color:#8898b0;text-transform:uppercase;margin-top:2px;">7-Day Total</div>
      </td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;">
        <div style="font-size:24px;font-weight:900;color:#0b1d35;">${stats.total}</div>
        <div style="font-size:10px;color:#8898b0;text-transform:uppercase;margin-top:2px;">All-Time</div>
      </td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;">
        <div style="font-size:24px;font-weight:900;color:#0b1d35;">${stats.avgSeverity}</div>
        <div style="font-size:10px;color:#8898b0;text-transform:uppercase;margin-top:2px;">Avg Severity (1–5)</div>
      </td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;">
        <div style="font-size:24px;font-weight:900;color:#0b1d35;">${stats.childrenCount}</div>
        <div style="font-size:10px;color:#8898b0;text-transform:uppercase;margin-top:2px;">Kids/Elderly Affected</div>
      </td>
    </tr></table>
  </div>

  <!-- Detail rows -->
  <div style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#8898b0;width:38%;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;">Affected Areas</td>
        <td style="padding:10px 0;">${stats.topLocations || 'Multiple areas'}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#8898b0;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:0.5px;vertical-align:top;">Reported Symptoms</td>
        <td style="padding:10px 0;">${stats.symptomList || 'None specified'}</td>
      </tr>
    </table>

    <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:14px 16px;margin-top:20px;border-radius:0 4px 4px 0;">
      <p style="font-size:13px;color:#374151;margin:0;line-height:1.6;">Residents of <strong>Imperial Beach, San Ysidro, Chula Vista, and South San Diego County</strong> continue to document hydrogen sulfide gas exposure. This daily summary is part of an ongoing documentation effort to establish a public record of the crisis.</p>
    </div>

    <h2 style="font-size:14px;color:#0b1d35;margin:24px 0 10px;">We Are Requesting</h2>
    <ol style="font-size:13px;color:#374151;line-height:1.8;padding-left:18px;margin:0;">
      <li>Immediate attention to IBWC South Bay International Wastewater Treatment Plant and CESPT pump stations.</li>
      <li>Accelerated completion of the Saturn Boulevard Pipe Extension to address the Saturn Blvd sewage hotspot.</li>
      <li>Accelerated implementation of Minute 333 infrastructure commitments.</li>
      <li>Regular public updates on remediation progress.</li>
      <li>Enforcement action against entities responsible for ongoing discharges.</li>
    </ol>
  </div>

  <!-- Footer -->
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Tijuana River Watch · tijuanariverwatch.com · Daily automated summary</p>
    <p style="font-size:11px;color:#8898b0;margin:4px 0 0;">To unsubscribe, reply with REMOVE.</p>
  </div>

</div></body></html>`;
}

function buildDigestBodyEs(stats) {
  return `VIGILANCIA DEL RÍO TIJUANA — RESUMEN DIARIO DE QUEJAS
${stats.date}
tijuanariverwatch.com
${'─'.repeat(50)}

ÚLTIMAS 24 HORAS: ${stats.last24h} quejas presentadas
TOTAL 7 DÍAS:     ${stats.last7d} quejas
TOTAL ACUMULADO:  ${stats.total} quejas

SEVERIDAD PROMEDIO: ${stats.avgSeverity} / 5
ZONAS AFECTADAS:    ${stats.topLocations || 'Múltiples áreas'}
SÍNTOMAS REPORTADOS: ${stats.symptomList || 'No especificados'}
HOGARES CON NIÑOS O ADULTOS MAYORES: ${stats.childrenCount}

${'─'.repeat(50)}
Este es un resumen diario automatizado del sistema ciudadano de quejas de Tijuana River Watch. Los residentes de Imperial Beach, San Ysidro, Chula Vista y el sur del Condado de San Diego continúan documentando su exposición al gas sulfuro de hidrógeno proveniente del Río Tijuana.

SOLICITAMOS:
1. Atención inmediata a la Planta Internacional de Tratamiento de Aguas Residuales de South Bay del IBWC y a las estaciones de bombeo de CESPT.
2. Finalización acelerada de la Extensión del Ducto de Saturn Boulevard para atender el punto crítico de derrames en esa zona.
3. Implementación acelerada de los compromisos de infraestructura del Acta 333.
4. Actualizaciones públicas periódicas sobre el avance de las medidas correctivas.
5. Acciones de cumplimiento contra las entidades responsables de las descargas continuas.

— Tijuana River Watch | tijuanariverwatch.com
Para darse de baja, responda con BAJA.`;
}

function buildDigestHtmlEs(stats) {
  const trendColor = stats.last24h > stats.last7d / 7 ? '#dc2626' : '#16a34a';
  const trendLabel = stats.last24h > stats.last7d / 7 ? '↑ Por encima del promedio de 7 días' : '↓ Por debajo del promedio de 7 días';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">Reporte Diario</div>
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 4px;">Vigilancia del Río Tijuana</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">${stats.date}</p>
  </div>
  <div style="background:#1e3a5f;padding:20px 32px;">
    <div style="font-size:42px;font-weight:900;color:#fff;line-height:1;">${stats.last24h}</div>
    <div style="font-size:12px;color:#a8c0d8;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Quejas en las últimas 24 horas</div>
    <div style="font-size:11px;color:${trendColor};font-weight:700;margin-top:6px;">${trendLabel} · Promedio 7 días: ${(stats.last7d / 7).toFixed(1)}/día</div>
  </div>
  <div style="padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:10px;"><div style="font-size:24px;font-weight:900;color:#0b1d35;">${stats.last7d}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;margin-top:2px;">Total 7 Días</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:24px;font-weight:900;color:#0b1d35;">${stats.total}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;margin-top:2px;">Total Acumulado</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:24px;font-weight:900;color:#0b1d35;">${stats.avgSeverity}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;margin-top:2px;">Severidad Prom.</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:24px;font-weight:900;color:#0b1d35;">${stats.childrenCount}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;margin-top:2px;">Niños/Mayores</div></td>
    </tr></table>
  </div>
  <div style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#8898b0;width:38%;font-weight:600;text-transform:uppercase;font-size:11px;">Zonas Afectadas</td>
        <td style="padding:10px 0;">${stats.topLocations || 'Múltiples áreas'}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#8898b0;font-weight:600;text-transform:uppercase;font-size:11px;vertical-align:top;">Síntomas Reportados</td>
        <td style="padding:10px 0;">${stats.symptomList || 'No especificados'}</td>
      </tr>
    </table>
    <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:14px 16px;margin-top:20px;border-radius:0 4px 4px 0;">
      <p style="font-size:13px;color:#374151;margin:0;line-height:1.6;">Los residentes de <strong>Imperial Beach, San Ysidro, Chula Vista y el sur del Condado de San Diego</strong> continúan documentando su exposición al gas sulfuro de hidrógeno. Este resumen forma parte de un esfuerzo continuo de documentación pública de la crisis.</p>
    </div>
    <h2 style="font-size:14px;color:#0b1d35;margin:24px 0 10px;">Solicitamos</h2>
    <ol style="font-size:13px;color:#374151;line-height:1.8;padding-left:18px;margin:0;">
      <li>Atención inmediata a la Planta de South Bay del IBWC y a las estaciones de bombeo de CESPT.</li>
      <li>Finalización acelerada de la Extensión del Ducto de Saturn Boulevard para atender el punto crítico de derrames en esa zona.</li>
      <li>Implementación acelerada de los compromisos del Acta 333.</li>
      <li>Actualizaciones públicas periódicas sobre el avance correctivo.</li>
      <li>Acciones de cumplimiento contra los responsables de las descargas.</li>
    </ol>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Tijuana River Watch · tijuanariverwatch.com · Resumen diario automatizado</p>
    <p style="font-size:11px;color:#8898b0;margin:4px 0 0;">Para darse de baja, responda con BAJA.</p>
  </div>
</div></body></html>`;
}

// sendWeeklyReport() replaced by sendWeeklyDigest() above

/**
 * Sends an immediate per-submission forward to direct officials when a resident
 * leaves a personal comment OR clicks an email provider button.
 * Subject lines rotate through FORWARD_SUBJECTS to reduce spam-filter pattern matching.
 * Rate-limited: max 30/day, 5-minute cooldown between sends.
 *
 * @param {Object} p      - params object (handles both string and array values)
 * @param {string} trigger - 'comment' or 'email_sent' (for logging)
 */
function sendPerSubmissionForward(p, trigger) {
  // Normalize — works with e.parameter (strings) or e.parameters (arrays)
  function get(key) {
    const v = p[key];
    if (!v) return '';
    return Array.isArray(v) ? v[0] : v;
  }
  function getAll(key) {
    const v = p[key];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  const loc     = get('entry.1490422776') || 'South San Diego';
  const sev     = get('entry.907203543')  || '';
  const dur     = get('entry.247287864')  || '';
  const sym     = getAll('entry.1956466788').filter(Boolean).join(', ');
  const vuln    = get('entry.871476581')  || '';
  const name    = get('entry.1693083561') || 'Anonymous';
  const comment = get('entry.717805650')  || '';

  // ── Rate limiting ─────────────────────────────────────────────────────
  const props     = PropertiesService.getScriptProperties();
  const today     = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
  const countKey  = 'psf_count_' + today;
  const lastKey   = 'psf_last';
  const count     = parseInt(props.getProperty(countKey) || '0');
  const last      = parseInt(props.getProperty(lastKey)  || '0');
  const now       = Date.now();
  const MAX_DAY   = 30;
  const COOLDOWN  = 5 * 60 * 1000; // 5 minutes

  if (count >= MAX_DAY) {
    Logger.log('Per-submission forward: daily cap (' + MAX_DAY + ') reached, skipping');
    return;
  }
  if ((now - last) < COOLDOWN) {
    Logger.log('Per-submission forward: cooldown active (' + Math.round((COOLDOWN - (now - last)) / 1000) + 's remaining), skipping');
    return;
  }

  // ── Subject + intro rotation ──────────────────────────────────────────
  const date    = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'MMM d, yyyy');
  const subIdx  = Math.floor(Math.random() * FORWARD_SUBJECTS.length);
  const intIdx  = Math.floor(Math.random() * FORWARD_INTROS.length);

  const subject = FORWARD_SUBJECTS[subIdx]
    .replace(/{loc}/g, loc).replace(/{date}/g, date);
  const intro   = FORWARD_INTROS[intIdx]
    .replace(/{loc}/g, loc);

  // ── Body ──────────────────────────────────────────────────────────────
  let details = '  • Location: ' + loc + '\n';
  if (sev)  details += '  • Odor intensity: ' + sev + '/5\n';
  if (dur)  details += '  • Duration: ' + dur + '\n';
  if (sym)  details += '  • Symptoms reported: ' + sym + '\n';
  if (vuln) details += '  • Vulnerable residents affected: ' + vuln + '\n';

  let body = intro + '\n\n';
  body += 'COMPLAINT SUMMARY:\n' + details;

  if (comment.trim()) {
    body += '\nIN THE RESIDENT\'S OWN WORDS:\n"' + comment.trim() + '"\n';
  }

  body += '\n──────────────────────────────────────────\n';
  body += 'Filed via TijuanaRiverWatch.com\n';
  body += 'To stop receiving individual complaint notifications: tijuanariverwatch@gmail.com\n';

  // ── Send to direct regulatory officials only ──────────────────────────
  // Intentionally excludes media/advocacy — those get scheduled digests.
  const targets = ['supervisor_d1', 'county_env', 'ib_mayor', 'sd_water_board', 'ibwc'];
  let sent = 0;

  targets.forEach(function(key) {
    const addr = CONFIG.officials[key];
    if (!addr || addr.startsWith('http')) return;
    try {
      MailApp.sendEmail({
        to:      addr,
        subject: subject,
        body:    body,
        name:    CONFIG.SENDER_NAME,
        replyTo: 'tijuanariverwatch@gmail.com',
      });
      sent++;
      Utilities.sleep(350);
    } catch(err) {
      Logger.log('Per-submission forward error for ' + key + ': ' + err.toString());
    }
  });

  props.setProperty(countKey, String(count + 1));
  props.setProperty(lastKey,  String(now));
  Logger.log('Per-submission forward: sent to ' + sent + ' officials | trigger=' + trigger + ' | subject variant=' + subIdx + ' | intro variant=' + intIdx);
}

function sendUserConfirmation(p) {
  const name = p['entry.1693083561'] || 'Resident';
  const email = p['entry.30396298'];
  const location = p['entry.1490422776'] || 'Not specified';
  const severity = p['entry.907203543'] || 'Not specified';
  const duration = p['entry.247287864'] || 'Not specified';
  const symptoms = p['entry.1956466788'] || 'None reported';
  const comments = p['entry.717805650'] || 'None';
  const timestamp = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const subject = 'Your Tijuana River Watch Complaint Has Been Filed';

  const body = `Hi ${name},

Your complaint has been successfully filed and officials have been notified.

COMPLAINT RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Filed: ${timestamp}
Location: ${location}
Severity: ${severity} / 5
Duration: ${duration}
Symptoms: ${Array.isArray(symptoms) ? symptoms.join(', ') : symptoms}
Additional comments: ${comments}

OFFICIALS NOTIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your complaint has been logged in our system. When enough complaints accumulate,
automated alerts are sent directly to local, state, federal, and Mexican officials.

You can also send a personal email to officials at:
tijuanariverwatch.com

Thank you for taking action. Every report counts.

— Tijuana River Watch
tijuanariverwatch.com`;

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;text-align:center;">
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 6px;">Complaint Filed Successfully</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">Tijuana River Watch · ${timestamp}</p>
  </div>
  <div style="background:#16a34a;padding:14px 32px;text-align:center;">
    <p style="color:#fff;font-size:14px;font-weight:700;margin:0;">✓ Your complaint has been received and officials have been notified</p>
  </div>
  <div style="padding:28px 32px;">
    <h2 style="font-size:15px;color:#0b1d35;margin:0 0 16px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;">Complaint Receipt</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      <tr><td style="padding:8px 0;color:#8898b0;width:40%;">Location</td><td style="padding:8px 0;color:#0b1d35;font-weight:600;">${location}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 6px;color:#8898b0;">Severity</td><td style="padding:8px 6px;color:#0b1d35;font-weight:600;">${severity} / 5</td></tr>
      <tr><td style="padding:8px 0;color:#8898b0;">Duration</td><td style="padding:8px 0;color:#0b1d35;font-weight:600;">${duration}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 6px;color:#8898b0;">Symptoms</td><td style="padding:8px 6px;color:#0b1d35;font-weight:600;">${Array.isArray(symptoms) ? symptoms.join(', ') : symptoms}</td></tr>
      <tr><td style="padding:8px 0;color:#8898b0;vertical-align:top;">Comments</td><td style="padding:8px 0;color:#0b1d35;font-weight:600;">${comments}</td></tr>
    </table>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:16px;margin-top:24px;">
      <p style="font-size:13px;color:#0369a1;margin:0;line-height:1.6;">Your complaint has been logged. Automated alerts fire to local, state, federal, and Mexican officials when complaint thresholds are reached. You can also send a personal email to officials at <a href="https://tijuanariverwatch.com" style="color:#0369a1;">tijuanariverwatch.com</a>.</p>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Tijuana River Watch · tijuanariverwatch.com</p>
  </div>
</div>
</body></html>`;

  try {
    MailApp.sendEmail({ to: email, subject, body, htmlBody, name: CONFIG.SENDER_NAME });
  } catch(err) {
    Logger.log('Confirmation email error: ' + err);
  }
}

function logAction(action, stats) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let logSheet = ss.getSheetByName('Alert Log');
    if (!logSheet) {
      logSheet = ss.insertSheet('Alert Log');
      logSheet.appendRow(['Timestamp', 'Action', 'Reports 1h', 'Reports 12h', 'Reports 24h', 'Avg Severity']);
    }
    logSheet.appendRow([new Date(), action, stats.last1h, stats.last12h, stats.last24h, stats.avgSeverity]);
  } catch(err) { Logger.log('logAction error: ' + err); }
}

function logSubmission(e, stats) {
  Logger.log(`New submission. 1h: ${stats.last1h}, 12h: ${stats.last12h}, 24h: ${stats.last24h}, Total: ${stats.total}`);
}

// ── SUBSCRIBER MANAGEMENT ────────────────────────────────────────────────────

/**
 * Reads subscribed contacts from the 'Subscribers' sheet.
 * type: 'MEDIA' or 'ADVOCACY' (or omit for all active)
 * Returns array of { name, org, email, type }
 */
function getSubscribers(type) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName('Subscribers');
    if (!sheet) return [];
    const rows = sheet.getDataRange().getValues().slice(1); // skip header
    return rows
      .filter(r => r[3] && r[4] && (!type || r[3].toString().toUpperCase() === type) && r[5] !== 'UNSUBSCRIBED')
      .map(r => ({ name: r[0], org: r[1], email: r[2], type: r[3] }));
  } catch(err) {
    Logger.log('getSubscribers error: ' + err);
    return [];
  }
}

function addSubscriber(name, org, email, type) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName('Subscribers');
    if (!sheet) {
      sheet = ss.insertSheet('Subscribers');
      sheet.appendRow(['Name', 'Organization', 'Email', 'Type', 'Subscribed At', 'Status']);
      sheet.setFrozenRows(1);
    }
    // Check for duplicate
    const existing = sheet.getDataRange().getValues().slice(1);
    const dup = existing.find(r => r[2].toString().toLowerCase() === email);
    if (dup) {
      Logger.log('Subscriber already exists: ' + email);
      return;
    }
    sheet.appendRow([name, org, email, type.toUpperCase(), new Date(), 'ACTIVE']);
    Logger.log('Added subscriber: ' + email + ' (' + type + ')');
  } catch(err) {
    Logger.log('addSubscriber error: ' + err);
  }
}

function removeSubscriber(email) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName('Subscribers');
    if (!sheet) return;
    const rows = sheet.getDataRange().getValues();
    rows.forEach((r, i) => {
      if (i === 0) return; // skip header
      if (r[2].toString().toLowerCase() === email) {
        sheet.getRange(i + 1, 6).setValue('UNSUBSCRIBED');
        Logger.log('Unsubscribed: ' + email);
      }
    });
  } catch(err) {
    Logger.log('removeSubscriber error: ' + err);
  }
}

function sendSubscribeConfirmation(name, org, email, type) {
  const typeLabel  = type === 'ADVOCACY' ? 'advocacy organization' : 'media';
  const schedule   = type === 'ADVOCACY' ? 'twice weekly (Monday and Thursday)' : 'weekly (every Monday)';
  const unsubUrl   = `https://script.google.com/macros/s/AKfycbxFVSsB_rx3hNUZnJwpQRhTUt5Yw3uXVCpv5v_kOtR9J9c3ddBE1_bxIahTzUpaaQGf/exec?action=unsubscribe&email=${encodeURIComponent(email)}`;
  try {
    MailApp.sendEmail({
      to: email,
      subject: 'Subscribed: Tijuana River Watch Alerts',
      name: CONFIG.SENDER_NAME,
      body: `Hi ${name || 'there'},\n\nYou're now subscribed to Tijuana River Watch ${typeLabel} alerts.\n\nYou'll receive ${schedule} complaint summaries, plus immediate spike alerts when complaints exceed 100 in a 24-hour window.\n\nTo unsubscribe at any time: ${unsubUrl}\n\n— Tijuana River Watch\ntijuanariverwatch.com`,
      htmlBody: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:540px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;text-align:center;">
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0;">Subscribed Successfully</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:6px 0 0;">Tijuana River Watch Alerts</p>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#374151;">Hi ${name || 'there'},</p>
    <p style="font-size:14px;color:#374151;">You're now subscribed to <strong>${typeLabel} alerts</strong> from Tijuana River Watch.</p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:16px;margin:20px 0;">
      <p style="font-size:13px;color:#0369a1;margin:0;"><strong>What you'll receive:</strong><br>
      • ${schedule} complaint summaries<br>
      • Spike alerts when 100+ complaints are filed in 24 hours</p>
    </div>
    <p style="font-size:12px;color:#8898b0;margin-top:24px;">To unsubscribe: <a href="${unsubUrl}" style="color:#0369a1;">click here</a></p>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Tijuana River Watch · tijuanariverwatch.com</p>
  </div>
</div></body></html>`
    });
  } catch(err) {
    Logger.log('Subscribe confirmation email error: ' + err);
  }
}

// ── MEDIA WEEKLY DIGEST ───────────────────────────────────────────────────────

/**
 * Sends a clean press-style weekly digest to all media contacts (static + subscribed).
 * Runs every Monday from morningRun().
 * Skips if zero reports in last 7 days.
 */
function sendMediaWeeklyDigest(stats) {
  if (stats.last7d === 0) {
    Logger.log('Media digest: 0 reports this week — skipped');
    return;
  }

  const staticAddrs = CONFIG.lists.MEDIA_STATIC
    .map(k => CONFIG.officials[k])
    .filter(a => a && !a.startsWith('http'));
  const subAddrs = getSubscribers('MEDIA').map(s => s.email);
  const allAddrs = [...new Set([...staticAddrs, ...subAddrs])];

  const subject = `Data Tip: ${stats.last7d} Sewage Complaints Filed in South SD This Week — Tijuana River Watch`;
  const body = buildMediaDigestBody(stats);
  const htmlBody = buildMediaDigestHtml(stats);

  let sent = 0;
  allAddrs.forEach(addr => {
    try {
      MailApp.sendEmail({ to: addr, subject, body, htmlBody, name: CONFIG.SENDER_NAME, replyTo: 'tijuanariverwatch@gmail.com' });
      sent++;
      Utilities.sleep(500);
    } catch(err) { Logger.log('Media digest error for ' + addr + ': ' + err); }
  });

  logAction(`MEDIA WEEKLY DIGEST sent to ${sent} contacts (${stats.last7d} complaints this week)`, stats);
}

function buildMediaDigestBody(stats) {
  const unsubUrl = 'https://tijuanariverwatch.com/subscribe?action=unsubscribe';
  return `TIJUANA RIVER WATCH — WEEKLY DATA SUMMARY
Week ending ${stats.date}
tijuanariverwatch.com
${'─'.repeat(50)}

DATA TIP: ${stats.last7d} citizen sewage complaints filed this week in South San Diego County and Imperial Beach. ${stats.total} total since tracking began.

KEY METRICS (this week):
  Complaints filed:           ${stats.last7d}
  All-time total:             ${stats.total}
  Average severity (1–5):    ${stats.avgSeverity}
  Households w/ children/elderly affected: ${stats.childrenCount}
  Top affected areas:         ${stats.topLocations || 'Multiple areas'}
  Top reported symptoms:      ${stats.symptomList || 'None specified'}

ABOUT THIS DATA:
Complaints are self-reported by residents via tijuanariverwatch.com. Each entry includes location, severity rating, duration, symptoms, and whether children or elderly are present. Raw data available on request.

For more information or to request data access, reply to this email.

— Tijuana River Watch | tijuanariverwatch.com
To unsubscribe: ${unsubUrl}`;
}

function buildMediaDigestHtml(stats) {
  const unsubUrl = 'https://tijuanariverwatch.com/subscribe?action=unsubscribe';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">Weekly Data Summary · Media</div>
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 4px;">Tijuana River Watch</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">Week ending ${stats.date}</p>
  </div>
  <div style="background:#1e3a5f;padding:20px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">${stats.last7d}</div>
    <div style="font-size:12px;color:#a8c0d8;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Sewage Complaints Filed This Week</div>
    <div style="font-size:12px;color:#64a0c8;margin-top:6px;">${stats.total} total complaints since tracking began</div>
  </div>
  <div style="padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:10px;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.total}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">All-Time Total</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.avgSeverity}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Avg Severity (1–5)</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.childrenCount}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Children/Elderly</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.last24h}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Last 24 Hours</div></td>
    </tr></table>
  </div>
  <div style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#8898b0;width:38%;font-weight:600;text-transform:uppercase;font-size:11px;">Top Affected Areas</td>
        <td style="padding:10px 0;">${stats.topLocations || 'Multiple areas'}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#8898b0;font-weight:600;text-transform:uppercase;font-size:11px;vertical-align:top;">Reported Symptoms</td>
        <td style="padding:10px 0;">${stats.symptomList || 'None specified'}</td>
      </tr>
    </table>
    <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-top:20px;">
      <p style="font-size:12px;color:#555;margin:0;line-height:1.6;"><strong>About this data:</strong> Complaints are self-reported by residents via tijuanariverwatch.com. Each entry includes location, severity (1–5), duration, symptoms, and household vulnerability. Raw data available on request — reply to this email.</p>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Tijuana River Watch · tijuanariverwatch.com · Weekly media data summary</p>
    <p style="font-size:11px;color:#8898b0;margin:4px 0 0;"><a href="${unsubUrl}" style="color:#8898b0;">Unsubscribe</a></p>
  </div>
</div></body></html>`;
}

// ── ADVOCACY TWICE-WEEKLY UPDATE ──────────────────────────────────────────────

/**
 * Sends an action-oriented update to advocacy orgs (static + subscribed).
 * Runs Mon + Thu from morningRun(). Threshold-gated: 25+ new complaints since last send.
 */
function sendAdvocacyUpdate(stats) {
  const props = PropertiesService.getScriptProperties();
  const lastSentKey  = 'lastSent_ADVOCACY';
  const lastCountKey = 'lastCount_ADVOCACY';
  const now = Date.now();
  const lastSent  = parseInt(props.getProperty(lastSentKey)  || '0');
  const lastCount = parseInt(props.getProperty(lastCountKey) || '0');
  const hoursSinceLast = (now - lastSent) / (1000 * 60 * 60);
  const newSinceLast   = stats.total - lastCount;

  if (hoursSinceLast < 48) {
    Logger.log(`Advocacy update skipped — only ${hoursSinceLast.toFixed(1)}h since last send`);
    return;
  }
  if (newSinceLast < 25 && lastSent > 0) {
    Logger.log(`Advocacy update skipped — only ${newSinceLast} new complaints (min: 25)`);
    return;
  }

  const staticAddrs = CONFIG.lists.ADVOCACY_STATIC
    .map(k => CONFIG.officials[k])
    .filter(a => a && !a.startsWith('http'));
  const subAddrs = getSubscribers('ADVOCACY').map(s => s.email);
  const allAddrs = [...new Set([...staticAddrs, ...subAddrs])];

  const subject = `Tijuana River Watch — ${newSinceLast} New Sewage Complaints Since Last Update — ${stats.date}`;

  let sent = 0;
  allAddrs.forEach(addr => {
    try {
      MailApp.sendEmail({
        to: addr,
        subject,
        body: buildAdvocacyBody(stats, newSinceLast),
        htmlBody: buildAdvocacyHtml(stats, newSinceLast),
        name: CONFIG.SENDER_NAME,
        replyTo: 'tijuanariverwatch@gmail.com'
      });
      sent++;
      Utilities.sleep(500);
    } catch(err) { Logger.log('Advocacy update error for ' + addr + ': ' + err); }
  });

  props.setProperty(lastSentKey,  String(now));
  props.setProperty(lastCountKey, String(stats.total));
  logAction(`ADVOCACY UPDATE sent to ${sent} contacts (${newSinceLast} new complaints)`, stats);
}

function buildAdvocacyBody(stats, newSinceLast) {
  const unsubUrl = 'https://tijuanariverwatch.com/subscribe?action=unsubscribe';
  return `TIJUANA RIVER WATCH — ADVOCACY UPDATE
${stats.date} · tijuanariverwatch.com
${'─'.repeat(50)}

${newSinceLast} NEW COMPLAINTS SINCE LAST UPDATE
${stats.last7d} COMPLAINTS THIS WEEK · ${stats.total} ALL-TIME

KEY DATA:
  Avg severity (1–5):       ${stats.avgSeverity}
  Top areas:                ${stats.topLocations || 'Multiple areas'}
  Top symptoms:             ${stats.symptomList || 'None specified'}
  Children/elderly affected: ${stats.childrenCount}
  Reports last 24 hours:    ${stats.last24h}

${'─'.repeat(50)}
Citizens of Imperial Beach, San Ysidro, and South San Diego County continue to document hydrogen sulfide exposure. Your amplification and advocacy help translate this data into policy action.

DATA & MEDIA:
  Live complaint map:   tijuanariverwatch.com
  Data requests:        Reply to this email

— Tijuana River Watch | tijuanariverwatch.com
To unsubscribe: ${unsubUrl}`;
}

function buildAdvocacyHtml(stats, newSinceLast) {
  const unsubUrl = 'https://tijuanariverwatch.com/subscribe?action=unsubscribe';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0b1d35;padding:24px 32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">Advocacy Update</div>
    <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 4px;">Tijuana River Watch</h1>
    <p style="color:#a8c0d8;font-size:13px;margin:0;">${stats.date}</p>
  </div>
  <div style="background:#1e3a5f;padding:20px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">+${newSinceLast}</div>
    <div style="font-size:12px;color:#a8c0d8;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">New Complaints Since Last Update</div>
  </div>
  <div style="padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:10px;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.last7d}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">This Week</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.total}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">All-Time</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.avgSeverity}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Avg Severity</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.childrenCount}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Kids/Elderly</div></td>
    </tr></table>
  </div>
  <div style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#8898b0;width:38%;font-weight:600;text-transform:uppercase;font-size:11px;">Affected Areas</td>
        <td style="padding:10px 0;">${stats.topLocations || 'Multiple areas'}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#8898b0;font-weight:600;text-transform:uppercase;font-size:11px;vertical-align:top;">Reported Symptoms</td>
        <td style="padding:10px 0;">${stats.symptomList || 'None specified'}</td>
      </tr>
    </table>
    <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:14px 16px;margin-top:20px;border-radius:0 4px 4px 0;">
      <p style="font-size:13px;color:#374151;margin:0;line-height:1.6;">Citizens of <strong>Imperial Beach, San Ysidro, and South San Diego County</strong> continue to document hydrogen sulfide exposure. Your amplification and advocacy help translate this data into policy action.</p>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Tijuana River Watch · tijuanariverwatch.com · Advocacy update</p>
    <p style="font-size:11px;color:#8898b0;margin:4px 0 0;"><a href="${unsubUrl}" style="color:#8898b0;">Unsubscribe</a></p>
  </div>
</div></body></html>`;
}

// ── SPIKE ALERT ───────────────────────────────────────────────────────────────

/**
 * Fires when 100+ complaints are recorded in the last 24 hours.
 * Sends to media + advocacy contacts. Has a 48-hour cooldown.
 */
function checkAndSendSpikeAlert(stats) {
  if (stats.last24h < 100) return;

  const props = PropertiesService.getScriptProperties();
  const cooldownKey = 'lastSent_SPIKE';
  const now = Date.now();
  const lastSent = parseInt(props.getProperty(cooldownKey) || '0');
  const hoursSince = (now - lastSent) / (1000 * 60 * 60);

  if (hoursSince < 48) {
    Logger.log(`Spike alert skipped — ${hoursSince.toFixed(1)}h since last spike alert (48h cooldown)`);
    return;
  }

  const mediaAddrs = [
    ...CONFIG.lists.MEDIA_STATIC.map(k => CONFIG.officials[k]).filter(a => a && !a.startsWith('http')),
    ...getSubscribers('MEDIA').map(s => s.email)
  ];
  const advocacyAddrs = [
    ...CONFIG.lists.ADVOCACY_STATIC.map(k => CONFIG.officials[k]).filter(a => a && !a.startsWith('http')),
    ...getSubscribers('ADVOCACY').map(s => s.email)
  ];
  const allAddrs = [...new Set([...mediaAddrs, ...advocacyAddrs])];

  const subject = `[SPIKE ALERT] ${stats.last24h} Sewage Complaints in 24 Hours — Tijuana River — ${stats.date}`;
  const body = buildSpikeAlertBody(stats);
  const htmlBody = buildSpikeAlertHtml(stats);

  let sent = 0;
  allAddrs.forEach(addr => {
    try {
      MailApp.sendEmail({ to: addr, subject, body, htmlBody, name: CONFIG.SENDER_NAME, replyTo: 'tijuanariverwatch@gmail.com' });
      sent++;
      Utilities.sleep(500);
    } catch(err) { Logger.log('Spike alert error for ' + addr + ': ' + err); }
  });

  props.setProperty(cooldownKey, String(now));
  logAction(`SPIKE ALERT sent to ${sent} contacts (${stats.last24h} complaints in 24h)`, stats);
}

function buildSpikeAlertBody(stats) {
  const unsubUrl = 'https://tijuanariverwatch.com/subscribe?action=unsubscribe';
  return `[SPIKE ALERT] TIJUANA RIVER WATCH
${stats.date} · tijuanariverwatch.com
${'─'.repeat(50)}

${stats.last24h} SEWAGE COMPLAINTS FILED IN THE LAST 24 HOURS
This is ${stats.last24h >= 200 ? 'an extreme' : 'a significant'} spike in citizen reporting.

CURRENT DATA:
  Last 24 hours:              ${stats.last24h} complaints
  Last 12 hours:              ${stats.last12h} complaints
  Last 7 days:                ${stats.last7d} complaints
  All-time total:             ${stats.total} complaints
  Average severity (1–5):    ${stats.avgSeverity}
  Top affected areas:         ${stats.topLocations || 'Multiple areas'}
  Reported symptoms:          ${stats.symptomList || 'None specified'}
  Children/elderly affected:  ${stats.childrenCount}

Live data: tijuanariverwatch.com
Raw data available on request — reply to this email.

— Tijuana River Watch | tijuanariverwatch.com
To unsubscribe: ${unsubUrl}`;
}

function buildSpikeAlertHtml(stats) {
  const unsubUrl = 'https://tijuanariverwatch.com/subscribe?action=unsubscribe';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#7f1d1d;padding:24px 32px;text-align:center;">
    <div style="display:inline-block;background:#ef4444;color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 14px;border-radius:999px;margin-bottom:10px;">Spike Alert</div>
    <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 6px;">Tijuana River Watch</h1>
    <p style="color:#fca5a5;font-size:13px;margin:0;">${stats.date}</p>
  </div>
  <div style="background:#ef4444;padding:24px 32px;text-align:center;">
    <div style="font-size:64px;font-weight:900;color:#fff;line-height:1;">${stats.last24h}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.9);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:6px;">Sewage Complaints in the Last 24 Hours</div>
  </div>
  <div style="padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:center;padding:10px;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.last12h}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Last 12h</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.last7d}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">This Week</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.total}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">All-Time</div></td>
      <td style="text-align:center;padding:10px;border-left:1px solid #e2e8f0;"><div style="font-size:22px;font-weight:900;color:#0b1d35;">${stats.childrenCount}</div><div style="font-size:10px;color:#8898b0;text-transform:uppercase;">Kids/Elderly</div></td>
    </tr></table>
  </div>
  <div style="padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#8898b0;width:38%;font-weight:600;text-transform:uppercase;font-size:11px;">Affected Areas</td>
        <td style="padding:10px 0;">${stats.topLocations || 'Multiple areas'}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#8898b0;font-weight:600;text-transform:uppercase;font-size:11px;">Avg Severity</td>
        <td style="padding:10px 0;">${stats.avgSeverity} / 5</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#8898b0;font-weight:600;text-transform:uppercase;font-size:11px;vertical-align:top;">Reported Symptoms</td>
        <td style="padding:10px 0;">${stats.symptomList || 'None specified'}</td>
      </tr>
    </table>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:14px 16px;margin-top:20px;">
      <p style="font-size:13px;color:#374151;margin:0;line-height:1.6;">Live complaint data available at <a href="https://tijuanariverwatch.com" style="color:#dc2626;">tijuanariverwatch.com</a>. Raw dataset available on request — reply to this email.</p>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="font-size:11px;color:#8898b0;margin:0;">Tijuana River Watch · tijuanariverwatch.com</p>
    <p style="font-size:11px;color:#8898b0;margin:4px 0 0;"><a href="${unsubUrl}" style="color:#8898b0;">Unsubscribe</a></p>
  </div>
</div></body></html>`;
}

function testSetup() {
  Logger.log('=== TESTING SETUP ===');
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
    const rows = sheet ? sheet.getDataRange().getValues() : [[]];
    const stats = analyzeReports(rows);
    Logger.log('Stats: ' + JSON.stringify(stats));
    MailApp.sendEmail({ to: Session.getActiveUser().getEmail(), subject: '[TEST] Tijuana River Alert System — Setup OK', body: 'Setup confirmed.\n\nStats: ' + JSON.stringify(stats, null, 2), name: CONFIG.SENDER_NAME });
    Logger.log('Test email sent to: ' + Session.getActiveUser().getEmail());
  } catch(err) { Logger.log('TEST FAILED: ' + err.toString()); }
}
