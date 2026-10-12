/**
 * F&K PRO — enregistrement des factures dans Google Sheets.
 * À coller dans Extensions > Apps Script du tableur (voir INSTALLATION-GOOGLE-SHEETS.md).
 */

// Code d'accès : remplacez-le par un code secret, puis saisissez le même dans l'application
const CODE_ACCES = 'CHANGEZ-MOI';

const NOM_FEUILLE = 'Factures';
const ENTETES = ['ID', 'Numéro', 'Type', 'Date', 'Client', 'Total TTC (F CFA)', 'Mis à jour le', 'Données (ne pas modifier)'];

function feuille_() {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  let f = classeur.getSheetByName(NOM_FEUILLE);
  if (!f) {
    f = classeur.insertSheet(NOM_FEUILLE);
    f.appendRow(ENTETES);
    f.setFrozenRows(1);
    f.getRange('1:1').setFontWeight('bold');
    // Texte brut : empêche Sheets de convertir numéros et dates
    f.getRange('A:E').setNumberFormat('@');
    f.getRange('H:H').setNumberFormat('@');
  }
  return f;
}

function reponse_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

// Ligne (1-based) de la facture, ou 0 si absente
function ligneDe_(f, id) {
  const derniere = f.getLastRow();
  if (derniere < 2) return 0;
  const ids = f.getRange(2, 1, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function doGet() {
  return reponse_({ ok: true, message: 'Service de facturation F&K PRO actif.' });
}

function doPost(e) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.code !== CODE_ACCES) return reponse_({ ok: false, erreur: "code d'accès incorrect" });
    const f = feuille_();

    if (req.action === 'list') {
      const derniere = f.getLastRow();
      if (derniere < 2) return reponse_({ ok: true, factures: [] });
      const donnees = f.getRange(2, 8, derniere - 1, 1).getValues();
      const factures = [];
      donnees.forEach((l) => { try { if (l[0]) factures.push(JSON.parse(l[0])); } catch (err) { /* ligne ignorée */ } });
      return reponse_({ ok: true, factures });
    }

    if (req.action === 'save') {
      const x = req.facture;
      if (!x || !x.id) return reponse_({ ok: false, erreur: 'facture invalide' });
      const ligne = [String(x.id), x.numero, x.type, x.date, x.client, Number(x.totalTTC) || 0, new Date(), JSON.stringify(x)];
      const n = ligneDe_(f, x.id);
      if (n) f.getRange(n, 1, 1, ligne.length).setValues([ligne]);
      else f.appendRow(ligne);
      return reponse_({ ok: true });
    }

    if (req.action === 'delete') {
      const n = ligneDe_(f, req.id);
      if (n) f.deleteRow(n);
      return reponse_({ ok: true });
    }

    return reponse_({ ok: false, erreur: 'action inconnue' });
  } catch (err) {
    return reponse_({ ok: false, erreur: String(err) });
  } finally {
    verrou.releaseLock();
  }
}
