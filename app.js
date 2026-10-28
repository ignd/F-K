'use strict';

/* ================= Stockage local (sécurisé par try/catch) ================= */
const store = {
  get(cle, defaut) {
    try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; }
    catch { return defaut; }
  },
  set(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); return true; }
    catch { return false; }
  },
};

const CLE_PARAMS = 'fk.parametres';
const CLE_FACTURES = 'fk.factures';
const CLE_BROUILLON = 'fk.brouillon';
const CLE_CACHET = 'fk.cachet';

/* ================= Valeurs par défaut (issues de la proforma F&K) ================= */
const PARAMS_DEFAUT = {
  nom: 'F&K PRO',
  activite: "Agence de communication et d'événementiel",
  adresse: '2 Voies Liberté 6, Lot 2298 – Dakar',
  tel: '33 867 16 61 / 76 761 00 00',
  email: 'fandkpro2018@gmail.com',
  ninea: '0052030130023',
  rc: 'SN.DKR.2018.E.9465',
  banque: '0115126000150',
  suffixe: 'FNK',
  prochain: 11,
  prochainBL: 1,
  nbDefaut: '',
  cloudUrl: '',
  cloudCode: '',
};

const LIBELLES = {
  proforma: { titre: 'FACTURE PROFORMA', arrete: 'Arrêtée la présente facture proforma à la somme de :' },
  facture:  { titre: 'FACTURE',          arrete: 'Arrêtée la présente facture à la somme de :' },
  devis:    { titre: 'DEVIS',            arrete: 'Arrêté le présent devis à la somme de :' },
  livraison: { titre: 'BON DE LIVRAISON', arrete: '' },
};
const estBL = (f) => f && f.type === 'livraison';

let params = { ...PARAMS_DEFAUT, ...store.get(CLE_PARAMS, {}) };
// Ajoute le second numéro sur les appareils qui ont encore l'ancien téléphone seul
if (params.tel === '33 867 16 61') { params.tel = PARAMS_DEFAUT.tel; store.set(CLE_PARAMS, params); }
let facture = null;

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Les bons de livraison ont leur propre numérotation (BL-0001/FNK/2026)
function numeroSuivant(type) {
  const annee = new Date().getFullYear();
  if (type === 'livraison') return `BL-${String(params.prochainBL).padStart(4, '0')}/${params.suffixe}/${annee}`;
  return `${String(params.prochain).padStart(4, '0')}/${params.suffixe}/${annee}`;
}

function nouvelleFacture() {
  return {
    id: null,
    type: 'proforma',
    numero: numeroSuivant('proforma'),
    date: aujourdhui(),
    lieu: 'Dakar',
    client: '',
    clientDetails: '',
    lignes: [{ designation: '', detail: '', nombre: 1, qte: 1, pu: 0 }],
    devise: 'XOF',
    tvaOn: true,
    tva: 18,
    signataire: 'La Directrice',
    cachetOn: true,
    nb: params.nbDefaut || '',
  };
}

/* ================= Montant en lettres (français) ================= */
const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function moins100(n) {
  if (n < 17) return UNITES[n];
  if (n < 20) return 'dix-' + UNITES[n - 10];
  if (n < 70) {
    const d = Math.floor(n / 10), u = n % 10;
    if (u === 0) return DIZAINES[d];
    return DIZAINES[d] + (u === 1 ? ' et un' : '-' + UNITES[u]);
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : 'soixante-' + moins100(n - 60);
  if (n === 80) return 'quatre-vingts';
  return 'quatre-vingt-' + moins100(n - 80);
}

// « final » : le nombre n'est pas suivi de « mille » (accord de vingt et cent)
function moins1000(n, final) {
  const c = Math.floor(n / 100), r = n % 100;
  let txt = '';
  if (c > 0) {
    txt = c === 1 ? 'cent' : UNITES[c] + ' cent';
    if (c > 1 && r === 0 && final) txt += 's';
  }
  if (r > 0) {
    let reste = moins100(r);
    if (r === 80 && !final) reste = 'quatre-vingt';
    txt = txt ? txt + ' ' + reste : reste;
  }
  return txt;
}

function enLettres(montant) {
  let n = Math.round(Math.abs(montant));
  if (n === 0) return 'zéro';
  const parts = [];
  const milliards = Math.floor(n / 1e9); n %= 1e9;
  const millions = Math.floor(n / 1e6); n %= 1e6;
  const milliers = Math.floor(n / 1e3); n %= 1e3;
  if (milliards) parts.push(moins1000(milliards, true) + ' milliard' + (milliards > 1 ? 's' : ''));
  if (millions) parts.push(moins1000(millions, true) + ' million' + (millions > 1 ? 's' : ''));
  if (milliers) parts.push(milliers === 1 ? 'mille' : moins1000(milliers, false) + ' mille');
  if (n) parts.push(moins1000(n, true));
  return parts.join(' ');
}

/* ================= Formatage ================= */
const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
const nb = (v) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : 0; };
const pad2 = (n) => (Number.isInteger(n) && n < 10 && n >= 0 ? '0' + n : String(n).replace('.', ','));

/* ================= Devises ================= */
const DEVISES = {
  XOF: { libelle: 'Francs CFA (XOF)', court: 'F CFA', unite: ['franc CFA', 'francs CFA'], dec: 0 },
  USD: { libelle: 'Dollars US (USD)', court: 'USD', unite: ['dollar US', 'dollars US'], centime: ['cent', 'cents'], dec: 2 },
  EUR: { libelle: 'Euros (EUR)', court: '€', unite: ['euro', 'euros'], centime: ['centime', 'centimes'], dec: 2 },
};
const devise = (f) => DEVISES[f && f.devise] || DEVISES.XOF;
const arrondi = (n, f) => (devise(f).dec ? Math.round(n * 100) / 100 : Math.round(n));

// Montant formaté selon la devise (centimes affichés seulement s'il y en a)
function fmtD(n, f) {
  if (!devise(f).dec) return fmt(n);
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 })
    .replace(/[  ]/g, ' ');
}

// « Mille neuf cent treize (1 913) dollars US » ; « un million de … » pour les millions ronds
function phraseMontant(n, f) {
  const d = devise(f);
  const total = Math.round(n * 100);
  const entier = Math.floor(total / 100), cents = d.dec ? total % 100 : 0;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const unite = (entier % 1e6 === 0 && entier > 0 ? 'de ' : '') + d.unite[entier >= 2 ? 1 : 0];
  if (!cents) return `${cap(enLettres(entier))} (${fmtD(n, f)}) ${unite}`;
  return `${cap(enLettres(entier))} ${unite} et ${enLettres(cents)} ${d.centime[cents >= 2 ? 1 : 0]} (${fmtD(n, f)} ${d.court})`;
}

function dateFr(iso) {
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(a, m - 1, j);
  const jour = j === 1 ? '1er' : String(j);
  return `${jour} ${d.toLocaleDateString('fr-FR', { month: 'long' })} ${a}`;
}

function echapper(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// NB : le titre de ligne (avant « : ») et les pourcentages passent en orange gras
function mettreEnValeurNb(ligne) {
  let html = echapper(ligne).replace(/\d+(?:[,.]\d+)?\s?%/g, (p) => `<strong>${p}</strong>`);
  html = html.replace(/^([^:<]{2,40}?)(\s*:)/, '<strong>$1$2</strong>');
  return html;
}

function calculer(f) {
  const ht = f.lignes.reduce((s, l) => s + nb(l.nombre) * nb(l.qte) * nb(l.pu), 0);
  const tva = f.tvaOn ? arrondi(ht * nb(f.tva) / 100, f) : 0;
  return { ht, tva, ttc: ht + tva };
}

/* ================= Formulaire ================= */
const $ = (id) => document.getElementById(id);

const CHAMPS = {
  'f-type': 'type', 'f-devise': 'devise', 'f-numero': 'numero', 'f-date': 'date', 'f-lieu': 'lieu',
  'f-client': 'client', 'f-client-details': 'clientDetails', 'f-tva': 'tva', 'f-signataire': 'signataire', 'f-nb': 'nb',
};
const CASES = { 'f-tva-on': 'tvaOn', 'f-cachet-on': 'cachetOn' };
const CHAMPS_PARAMS = {
  's-nom': 'nom', 's-activite': 'activite', 's-adresse': 'adresse', 's-tel': 'tel', 's-email': 'email',
  's-ninea': 'ninea', 's-rc': 'rc', 's-banque': 'banque', 's-suffixe': 'suffixe', 's-prochain': 'prochain', 's-prochain-bl': 'prochainBL', 's-nb': 'nbDefaut',
  's-cloud-url': 'cloudUrl', 's-cloud-code': 'cloudCode',
};

function remplirFormulaire() {
  if (!DEVISES[facture.devise]) facture.devise = 'XOF';
  for (const [id, k] of Object.entries(CHAMPS)) $(id).value = facture[k] ?? '';
  for (const [id, k] of Object.entries(CASES)) $(id).checked = !!facture[k];
  dessinerLignes();
}

function remplirParams() {
  for (const [id, k] of Object.entries(CHAMPS_PARAMS)) $(id).value = params[k];
}

function dessinerLignes() {
  const conteneur = $('lines');
  conteneur.innerHTML = '';
  facture.lignes.forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = `
      <label>Désignation <input data-k="designation" value="${echapper(l.designation)}" placeholder="Ex. : Location de salle"></label>
      <label>Précision (facultatif, une info par ligne) <textarea data-k="detail" rows="2">${echapper(l.detail)}</textarea></label>
      <div class="row3">
        <label>Nombre <input data-k="nombre" type="number" min="0" step="any" value="${l.nombre}"></label>
        <label>Qté <input data-k="qte" type="number" min="0" step="any" value="${l.qte}"></label>
        <label>Prix unitaire <input data-k="pu" type="number" min="0" step="any" value="${l.pu}"></label>
      </div>
      <div class="line-foot">
        <span>Prix total : <strong data-total>${fmtD(nb(l.nombre) * nb(l.qte) * nb(l.pu), facture)}</strong></span>
        <button class="btn small danger" data-suppr>Supprimer</button>
      </div>`;
    div.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      l[k] = e.target.value;
      div.querySelector('[data-total]').textContent = fmtD(nb(l.nombre) * nb(l.qte) * nb(l.pu), facture);
      majApercu();
    });
    div.querySelector('[data-suppr]').addEventListener('click', () => {
      facture.lignes.splice(i, 1);
      if (!facture.lignes.length) facture.lignes.push({ designation: '', detail: '', nombre: 1, qte: 1, pu: 0 });
      dessinerLignes();
      majApercu();
    });
    conteneur.appendChild(div);
  });
}

/* ================= Aperçu ================= */
function majApercu() {
  const lib = LIBELLES[facture.type] || LIBELLES.proforma;
  const t = calculer(facture);

  const bl = estBL(facture);
  // Bon de livraison : pas de prix ni de totaux, case de réception pour le client
  $('sheet').classList.toggle('mode-bl', bl);
  $('p-label-client').textContent = bl ? 'Livré à' : 'Facturé à';
  $('p-type').textContent = lib.titre;
  $('p-numero').textContent = facture.numero;
  $('p-date').textContent = dateFr(facture.date);

  $('p-nom').textContent = params.nom;
  $('p-activite').textContent = params.activite;
  $('p-adresse').textContent = params.adresse;
  $('p-contact').textContent = `Tél. : ${params.tel} · ${params.email}`;

  $('p-client').textContent = facture.client || '—';
  $('p-client-details').innerHTML = facture.clientDetails
    .split('\n').filter((s) => s.trim()).map((s) => `<p>${echapper(s)}</p>`).join('');

  // Ligne sans prix = gros titre de section ; les lignes suivantes en sont le détail (indentées)
  let dansSection = false;
  $('p-lines').innerHTML = facture.lignes
    .filter((l) => l.designation || nb(l.pu))
    .map((l) => {
      // Pas de lignes de section dans un bon de livraison (les lignes n'ont pas de prix)
      if (!nb(l.pu) && !bl) {
        dansSection = true;
        return `
      <tr class="section">
        <td class="desc" colspan="5">${echapper(l.designation)}${l.detail ? `<small>${echapper(l.detail)}</small>` : ''}</td>
      </tr>`;
      }
      return `
      <tr${dansSection ? ' class="detail"' : ''}>
        <td class="desc">${echapper(l.designation)}${l.detail ? `<small>${echapper(l.detail)}</small>` : ''}</td>
        <td>${pad2(nb(l.nombre))}</td>
        <td>${pad2(nb(l.qte))}</td>
        <td class="r col-prix">${fmtD(nb(l.pu), facture)}</td>
        <td class="r total col-prix">${fmtD(nb(l.nombre) * nb(l.qte) * nb(l.pu), facture)}</td>
      </tr>`;
    }).join('');

  const dv = devise(facture);
  $('p-devise').textContent = dv.libelle;
  $('p-ht').textContent = `${fmtD(t.ht, facture)} ${dv.court}`;
  $('p-tva-row').style.display = facture.tvaOn ? '' : 'none';
  $('p-tva-label').textContent = `TVA ${String(nb(facture.tva)).replace('.', ',')} %`;
  $('p-tva').textContent = `${fmtD(t.tva, facture)} ${dv.court}`;
  $('p-ttc-label').textContent = facture.tvaOn ? 'Total TTC' : 'Total net à payer';
  $('p-ttc').textContent = `${fmtD(t.ttc, facture)} ${dv.court}`;

  $('p-arrete').textContent = lib.arrete;
  $('p-lettres').textContent = `${phraseMontant(t.ttc, facture)}${facture.tvaOn ? ' TTC' : ''}.`;

  const nbTexte = (facture.nb || '').trim();
  $('p-nb-bloc').style.display = nbTexte ? '' : 'none';
  $('p-nb').innerHTML = nbTexte.split('\n').filter((s) => s.trim()).map((s) => `<p>${mettreEnValeurNb(s)}</p>`).join('');

  $('p-fait').textContent = `Fait à ${facture.lieu || 'Dakar'}, le ${dateFr(facture.date)}`;
  $('p-signataire').textContent = facture.signataire;

  const cachet = store.get(CLE_CACHET, null);
  const img = $('p-cachet');
  if (facture.cachetOn && cachet) { img.src = cachet; img.classList.add('show'); }
  else { img.removeAttribute('src'); img.classList.remove('show'); }

  $('p-foot1').textContent = `${params.nom} · ${params.adresse} · Tél. : ${params.tel} · ${params.email}`;
  $('p-foot2').textContent = `NINEA : ${params.ninea} · RC : ${params.rc} · N° de compte bancaire : ${params.banque}`;

  document.title = `${lib.titre} ${facture.numero} — ${facture.client || 'F&K PRO'}`;
  store.set(CLE_BROUILLON, facture);
}

/* ================= Historique ================= */
function factures() { return store.get(CLE_FACTURES, []); }

function dessinerHistorique() {
  const q = $('f-search').value.trim().toLowerCase();
  const liste = factures()
    .filter((f) => !q || `${f.numero} ${f.client}`.toLowerCase().includes(q))
    .sort((a, b) => (b.date + b.numero).localeCompare(a.date + a.numero));
  const ul = $('history');
  if (!liste.length) { ul.innerHTML = '<li class="empty">Aucune facture enregistrée.</li>'; return; }
  ul.innerHTML = liste.map((f) => `
    <li>
      <div class="info"><b>${echapper(f.numero)}</b>${estBL(f) ? '' : ` · ${fmtD(calculer(f).ttc, f)} ${devise(f).court}`}
        <span>${echapper(LIBELLES[f.type]?.titre || '')} — ${echapper(f.client || 'Sans client')} — ${dateFr(f.date)}</span></div>
      <button class="btn small" data-ouvrir="${f.id}">Ouvrir</button>
      <button class="btn small" data-dupliquer="${f.id}">Dupliquer</button>
      <button class="btn small danger" data-suppr="${f.id}" title="Supprimer">✕</button>
    </li>`).join('');
}

/* ================= Enregistrement en ligne (Google Sheets) ================= */
const enLigne = () => !!(params.cloudUrl && params.cloudCode);

// POST en text/plain : évite la requête préalable CORS refusée par Apps Script
async function appelCloud(action, extra = {}) {
  const rep = await fetch(params.cloudUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, code: params.cloudCode, ...extra }),
  });
  let json;
  try { json = await rep.json(); }
  catch { throw new Error('réponse invalide (vérifiez l\'adresse du script)'); }
  if (!json.ok) throw new Error(json.erreur || 'erreur inconnue');
  return json;
}

const avecTotal = (f) => ({ ...f, totalTTC: calculer(f).ttc });

function majStatut(texte, erreur) {
  const s = $('cloud-statut');
  s.textContent = texte || (enLigne() ? 'Google Sheets' : 'Sur cet ordinateur uniquement');
  s.classList.toggle('err', !!erreur);
  s.classList.toggle('ok', !erreur && enLigne());
}

// Le compteur suit le plus grand numéro déjà utilisé (factures saisies sur d'autres appareils)
function ajusterCompteur() {
  const annee = new Date().getFullYear();
  // [clé du compteur, motif du numéro, type qui l'utilise]
  const compteurs = [
    ['prochain', new RegExp(`^(\\d+)/${params.suffixe}/${annee}$`), 'proforma'],
    ['prochainBL', new RegExp(`^BL-(\\d+)/${params.suffixe}/${annee}$`), 'livraison'],
  ];
  for (const [cle, motif, type] of compteurs) {
    const max = factures().reduce((m, f) => {
      const r = motif.exec(f.numero || '');
      return r ? Math.max(m, Number(r[1])) : m;
    }, 0);
    if (max + 1 <= nb(params[cle])) continue;
    const ancien = numeroSuivant(type);
    params[cle] = max + 1;
    store.set(CLE_PARAMS, params);
    remplirParams();
    if (!facture.id && facture.numero === ancien) {
      facture.numero = numeroSuivant(type);
      $('f-numero').value = facture.numero;
      majApercu();
    }
  }
}

// Fusionne le tableur et l'historique local (la version la plus récente l'emporte)
async function synchroniser(silencieux) {
  if (!enLigne()) { majStatut(); return true; }
  majStatut('Synchronisation…');
  try {
    const { factures: distantes } = await appelCloud('list');
    const locales = factures();
    const parId = new Map(locales.map((f) => [f.id, f]));
    for (const d of distantes) {
      const l = parId.get(d.id);
      if (!l || (d.majLe || '') >= (l.majLe || '')) parId.set(d.id, d);
    }
    // Envoie les factures créées hors connexion
    const idsDistants = new Set(distantes.map((d) => d.id));
    for (const l of locales) {
      if (!idsDistants.has(l.id)) await appelCloud('save', { facture: avecTotal(l) });
    }
    store.set(CLE_FACTURES, [...parId.values()]);
    ajusterCompteur();
    dessinerHistorique();
    majStatut(`Google Sheets · ${parId.size} facture(s)`);
    if (!silencieux) toast('Factures synchronisées avec Google Sheets.');
    return true;
  } catch (e) {
    majStatut('Hors ligne', true);
    if (!silencieux) toast('Connexion à Google Sheets impossible : ' + e.message);
    return false;
  }
}

async function enregistrer() {
  // Récupère d'abord les numéros saisis ailleurs pour éviter les doublons
  if (!facture.id && enLigne()) await synchroniser(true);
  const liste = factures();
  const doublon = liste.find((f) => f.numero === facture.numero && f.id !== facture.id);
  if (doublon) { toast(`Le numéro ${facture.numero} est déjà utilisé.`); return; }
  facture.majLe = new Date().toISOString();
  if (!facture.id) {
    facture.id = Date.now().toString(36);
    // Le compteur avance seulement si le numéro automatique a été utilisé
    const cle = estBL(facture) ? 'prochainBL' : 'prochain';
    if (facture.numero === numeroSuivant(facture.type)) {
      params[cle] = nb(params[cle]) + 1;
      store.set(CLE_PARAMS, params);
      remplirParams();
    }
    liste.push(facture);
  } else {
    const i = liste.findIndex((f) => f.id === facture.id);
    if (i >= 0) liste[i] = facture; else liste.push(facture);
  }
  const local = store.set(CLE_FACTURES, liste);
  dessinerHistorique();
  if (!enLigne()) {
    toast(local ? `Facture ${facture.numero} enregistrée sur cet ordinateur.` : "Échec de l'enregistrement (stockage indisponible).");
    return;
  }
  try {
    await appelCloud('save', { facture: avecTotal(facture) });
    toast(`Facture ${facture.numero} enregistrée dans Google Sheets.`);
    synchroniser(true);
  } catch (e) {
    majStatut('Hors ligne', true);
    toast(`Enregistrée sur cet ordinateur seulement (${e.message}). Elle sera envoyée à la prochaine synchronisation.`);
  }
}

function charger(f) {
  facture = JSON.parse(JSON.stringify(f));
  remplirFormulaire();
  majApercu();
}

/* ================= Sauvegarde par fichier ================= */
function exporter() {
  const donnees = { format: 'fk-factures', version: 1, exporteLe: new Date().toISOString(), factures: factures() };
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' }));
  lien.download = `factures-fk-${aujourdhui()}.json`;
  lien.click();
  URL.revokeObjectURL(lien.href);
}

function importer(texte) {
  let entrantes;
  try {
    const json = JSON.parse(texte);
    entrantes = Array.isArray(json) ? json : json.factures;
    if (!Array.isArray(entrantes)) throw new Error();
  } catch {
    toast("Fichier non reconnu : choisissez un fichier exporté depuis l'application.");
    return;
  }
  const liste = factures();
  let ajoutees = 0, ignorees = 0;
  for (const f of entrantes) {
    if (!f || !f.id || !f.numero || !Array.isArray(f.lignes)) { ignorees++; continue; }
    const i = liste.findIndex((x) => x.id === f.id);
    // Un même numéro sous un autre identifiant serait un doublon
    if (i < 0 && liste.some((x) => x.numero === f.numero)) { ignorees++; continue; }
    if (i < 0) { liste.push(f); ajoutees++; }
    else if ((f.majLe || '') > (liste[i].majLe || '')) { liste[i] = f; ajoutees++; }
  }
  store.set(CLE_FACTURES, liste);
  ajusterCompteur();
  dessinerHistorique();
  toast(`${ajoutees} facture(s) importée(s)${ignorees ? `, ${ignorees} ignorée(s) (déjà présentes)` : ''}.`);
  // La synchronisation envoie les factures importées vers Google Sheets
  if (enLigne()) synchroniser(true);
}

/* ================= Divers ================= */
let minuteur;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(minuteur);
  minuteur = setTimeout(() => t.classList.remove('show'), 2600);
}

// Exemple initial : la proforma n° 0010/FNK/2026 traduite en français
function exemple() {
  return {
    ...nouvelleFacture(),
    numero: '0010/FNK/2026',
    date: '2026-09-23',
    client: 'Africa Free Routing',
    clientDetails: 'Lieu de l\'événement : PFANE\n« Plateforme des Acteurs Non Étatiques »\n9357 Rue SC 35, Dakar',
    lignes: [
      { designation: 'Location de salle – PFANE', detail: '« Plateforme des Acteurs Non Étatiques »', nombre: 5, qte: 1, pu: 150000 },
      { designation: 'Déjeuner', detail: '', nombre: 5, qte: 50, pu: 7000 },
      { designation: 'Production audiovisuelle', detail: 'Photos, clips vidéo, compilation', nombre: 5, qte: 1, pu: 250000 },
    ],
  };
}

/* ================= Initialisation ================= */
function init() {
  facture = store.get(CLE_BROUILLON, null) || exemple();
  remplirFormulaire();
  remplirParams();
  majApercu();
  dessinerHistorique();

  for (const [id, k] of Object.entries(CHAMPS)) {
    $(id).addEventListener('input', (e) => {
      // Changer de type sur une nouvelle pièce : reprend le bon compteur (facture ou BL)
      if (k === 'type' && !facture.id && facture.numero === numeroSuivant(facture.type)) {
        facture.numero = numeroSuivant(e.target.value);
        $('f-numero').value = facture.numero;
      }
      facture[k] = e.target.value;
      majApercu();
    });
  }
  for (const [id, k] of Object.entries(CASES)) {
    $(id).addEventListener('change', (e) => { facture[k] = e.target.checked; majApercu(); });
  }
  for (const [id, k] of Object.entries(CHAMPS_PARAMS)) {
    $(id).addEventListener('input', (e) => {
      params[k] = k === 'prochain' || k === 'prochainBL' ? Math.max(1, nb(e.target.value)) : e.target.value;
      store.set(CLE_PARAMS, params);
      majApercu();
      if (k === 'cloudUrl' || k === 'cloudCode') majStatut();
    });
  }

  $('btn-add-line').addEventListener('click', () => {
    facture.lignes.push({ designation: '', detail: '', nombre: 1, qte: 1, pu: 0 });
    dessinerLignes();
    majApercu();
  });
  $('btn-new').addEventListener('click', () => { charger(nouvelleFacture()); toast('Nouvelle facture.'); });
  $('btn-save').addEventListener('click', enregistrer);
  $('btn-print').addEventListener('click', () => window.print());
  $('f-search').addEventListener('input', dessinerHistorique);
  $('btn-sync').addEventListener('click', () => {
    if (!enLigne()) { toast("Renseignez l'adresse du script et le code d'accès dans les paramètres."); return; }
    synchroniser(false);
  });
  $('btn-cloud-test').addEventListener('click', () => synchroniser(false));
  $('btn-export').addEventListener('click', exporter);
  $('btn-import').addEventListener('click', () => $('f-import').click());
  $('f-import').addEventListener('change', (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    fichier.text().then(importer);
    e.target.value = '';
  });

  $('history').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const liste = factures();
    if (b.dataset.ouvrir) charger(liste.find((f) => f.id === b.dataset.ouvrir));
    if (b.dataset.dupliquer) {
      const src = liste.find((f) => f.id === b.dataset.dupliquer);
      charger({ ...src, id: null, numero: numeroSuivant(src.type), date: aujourdhui() });
      toast('Copie créée : pensez à enregistrer.');
    }
    if (b.dataset.suppr) {
      const f = liste.find((x) => x.id === b.dataset.suppr);
      if (f && confirm(`Supprimer la facture ${f.numero} ?`)) {
        store.set(CLE_FACTURES, liste.filter((x) => x.id !== f.id));
        dessinerHistorique();
        if (enLigne()) {
          appelCloud('delete', { id: f.id })
            .then(() => { toast(`Facture ${f.numero} supprimée de Google Sheets.`); synchroniser(true); })
            .catch((err) => toast('Suppression dans Google Sheets impossible : ' + err.message));
        }
      }
    }
  });

  $('s-cachet').addEventListener('change', (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      if (store.set(CLE_CACHET, lecteur.result)) toast('Cachet enregistré sur cet appareil.');
      else toast('Image trop lourde pour être conservée.');
      majApercu();
    };
    lecteur.readAsDataURL(fichier);
  });
  $('btn-cachet-del').addEventListener('click', () => {
    try { localStorage.removeItem(CLE_CACHET); } catch { /* stockage indisponible */ }
    majApercu();
  });

  // Raccourci Ctrl+S pour enregistrer
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); }
  });

  majStatut();
  synchroniser(true);
}

init();
