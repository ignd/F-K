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
  tel: '33 867 16 61',
  email: 'fandkpro2018@gmail.com',
  ninea: '0052030130023',
  rc: 'SN.DKR.2018.E.9465',
  banque: '0115126000150',
  suffixe: 'FNK',
  prochain: 11,
  nbDefaut: '',
};

const LIBELLES = {
  proforma: { titre: 'FACTURE PROFORMA', arrete: 'Arrêtée la présente facture proforma à la somme de :' },
  facture:  { titre: 'FACTURE',          arrete: 'Arrêtée la présente facture à la somme de :' },
  devis:    { titre: 'DEVIS',            arrete: 'Arrêté le présent devis à la somme de :' },
};

let params = { ...PARAMS_DEFAUT, ...store.get(CLE_PARAMS, {}) };
let facture = null;

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function numeroSuivant() {
  const annee = new Date().getFullYear();
  return `${String(params.prochain).padStart(4, '0')}/${params.suffixe}/${annee}`;
}

function nouvelleFacture() {
  return {
    id: null,
    type: 'proforma',
    numero: numeroSuivant(),
    date: aujourdhui(),
    lieu: 'Dakar',
    client: '',
    clientDetails: '',
    lignes: [{ designation: '', detail: '', nombre: 1, qte: 1, pu: 0 }],
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

function calculer(f) {
  const ht = f.lignes.reduce((s, l) => s + nb(l.nombre) * nb(l.qte) * nb(l.pu), 0);
  const tva = f.tvaOn ? Math.round(ht * nb(f.tva) / 100) : 0;
  return { ht, tva, ttc: ht + tva };
}

/* ================= Formulaire ================= */
const $ = (id) => document.getElementById(id);

const CHAMPS = {
  'f-type': 'type', 'f-numero': 'numero', 'f-date': 'date', 'f-lieu': 'lieu',
  'f-client': 'client', 'f-client-details': 'clientDetails', 'f-tva': 'tva', 'f-signataire': 'signataire', 'f-nb': 'nb',
};
const CASES = { 'f-tva-on': 'tvaOn', 'f-cachet-on': 'cachetOn' };
const CHAMPS_PARAMS = {
  's-nom': 'nom', 's-activite': 'activite', 's-adresse': 'adresse', 's-tel': 'tel', 's-email': 'email',
  's-ninea': 'ninea', 's-rc': 'rc', 's-banque': 'banque', 's-suffixe': 'suffixe', 's-prochain': 'prochain', 's-nb': 'nbDefaut',
};

function remplirFormulaire() {
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
      <label>Précision (facultatif) <input data-k="detail" value="${echapper(l.detail)}"></label>
      <div class="row3">
        <label>Nombre <input data-k="nombre" type="number" min="0" step="any" value="${l.nombre}"></label>
        <label>Qté <input data-k="qte" type="number" min="0" step="any" value="${l.qte}"></label>
        <label>Prix unitaire <input data-k="pu" type="number" min="0" step="any" value="${l.pu}"></label>
      </div>
      <div class="line-foot">
        <span>Montant : <strong data-total>${fmt(nb(l.nombre) * nb(l.qte) * nb(l.pu))}</strong></span>
        <button class="btn small danger" data-suppr>Supprimer</button>
      </div>`;
    div.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      l[k] = e.target.value;
      div.querySelector('[data-total]').textContent = fmt(nb(l.nombre) * nb(l.qte) * nb(l.pu));
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

  $('p-lines').innerHTML = facture.lignes
    .filter((l) => l.designation || nb(l.pu))
    .map((l) => `
      <tr>
        <td class="desc">${echapper(l.designation)}${l.detail ? `<small>${echapper(l.detail)}</small>` : ''}</td>
        <td>${pad2(nb(l.nombre))}</td>
        <td>${pad2(nb(l.qte))}</td>
        <td class="r">${fmt(nb(l.pu))}</td>
        <td class="r total">${fmt(nb(l.nombre) * nb(l.qte) * nb(l.pu))}</td>
      </tr>`).join('');

  $('p-ht').textContent = fmt(t.ht) + ' F CFA';
  $('p-tva-row').style.display = facture.tvaOn ? '' : 'none';
  $('p-tva-label').textContent = `TVA ${String(nb(facture.tva)).replace('.', ',')} %`;
  $('p-tva').textContent = fmt(t.tva) + ' F CFA';
  $('p-ttc-label').textContent = facture.tvaOn ? 'Total TTC' : 'Total net à payer';
  $('p-ttc').textContent = fmt(t.ttc) + ' F CFA';

  const lettres = enLettres(t.ttc);
  $('p-arrete').textContent = lib.arrete;
  $('p-lettres').textContent =
    `${lettres.charAt(0).toUpperCase() + lettres.slice(1)} (${fmt(t.ttc)}) francs CFA${facture.tvaOn ? ' TTC' : ''}.`;

  const nbTexte = (facture.nb || '').trim();
  $('p-nb-bloc').style.display = nbTexte ? '' : 'none';
  $('p-nb').innerHTML = nbTexte.split('\n').filter((s) => s.trim()).map((s) => `<p>${echapper(s)}</p>`).join('');

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
      <div class="info"><b>${echapper(f.numero)}</b> · ${fmt(calculer(f).ttc)} F
        <span>${echapper(LIBELLES[f.type]?.titre || '')} — ${echapper(f.client || 'Sans client')} — ${dateFr(f.date)}</span></div>
      <button class="btn small" data-ouvrir="${f.id}">Ouvrir</button>
      <button class="btn small" data-dupliquer="${f.id}">Dupliquer</button>
      <button class="btn small danger" data-suppr="${f.id}" title="Supprimer">✕</button>
    </li>`).join('');
}

function enregistrer() {
  const liste = factures();
  const doublon = liste.find((f) => f.numero === facture.numero && f.id !== facture.id);
  if (doublon) { toast(`Le numéro ${facture.numero} est déjà utilisé.`); return; }
  if (!facture.id) {
    facture.id = Date.now().toString(36);
    // Le compteur avance seulement si le numéro automatique a été utilisé
    if (facture.numero === numeroSuivant()) {
      params.prochain = nb(params.prochain) + 1;
      store.set(CLE_PARAMS, params);
      remplirParams();
    }
    liste.push(facture);
  } else {
    const i = liste.findIndex((f) => f.id === facture.id);
    if (i >= 0) liste[i] = facture; else liste.push(facture);
  }
  if (store.set(CLE_FACTURES, liste)) toast(`Facture ${facture.numero} enregistrée.`);
  else toast("Échec de l'enregistrement (stockage indisponible).");
  dessinerHistorique();
}

function charger(f) {
  facture = JSON.parse(JSON.stringify(f));
  remplirFormulaire();
  majApercu();
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
    $(id).addEventListener('input', (e) => { facture[k] = e.target.value; majApercu(); });
  }
  for (const [id, k] of Object.entries(CASES)) {
    $(id).addEventListener('change', (e) => { facture[k] = e.target.checked; majApercu(); });
  }
  for (const [id, k] of Object.entries(CHAMPS_PARAMS)) {
    $(id).addEventListener('input', (e) => {
      params[k] = k === 'prochain' ? Math.max(1, nb(e.target.value)) : e.target.value;
      store.set(CLE_PARAMS, params);
      majApercu();
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

  $('history').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const liste = factures();
    if (b.dataset.ouvrir) charger(liste.find((f) => f.id === b.dataset.ouvrir));
    if (b.dataset.dupliquer) {
      const src = liste.find((f) => f.id === b.dataset.dupliquer);
      charger({ ...src, id: null, numero: numeroSuivant(), date: aujourdhui() });
      toast('Copie créée : pensez à enregistrer.');
    }
    if (b.dataset.suppr) {
      const f = liste.find((x) => x.id === b.dataset.suppr);
      if (f && confirm(`Supprimer la facture ${f.numero} ?`)) {
        store.set(CLE_FACTURES, liste.filter((x) => x.id !== f.id));
        dessinerHistorique();
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
}

init();
