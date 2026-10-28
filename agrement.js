'use strict';

/* ================= Stockage local (partagé avec la facturation) ================= */
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

const CLE_COURRIER = 'fk.agrement';
const CLE_PARAMS = 'fk.parametres';
const CLE_CACHET = 'fk.cachet';

// Coordonnées par défaut ; celles modifiées dans la facturation sont reprises
const ENTREPRISE = {
  nom: 'F&K PRO',
  activite: "Agence de communication et d'événementiel",
  adresse: '2 Voies Liberté 6, Lot 2298 – Dakar',
  tel: '33 867 16 61 / 76 761 00 00',
  email: 'fandkpro2018@gmail.com',
  ninea: '0052030130023',
  rc: 'SN.DKR.2018.E.9465',
  banque: '0115126000150',
  ...store.get(CLE_PARAMS, {}),
};

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Modèle : la demande d'agrément adressée à l'USSEIN
function modele() {
  return {
    lieu: 'Dakar',
    date: aujourdhui(),
    dest: "À Monsieur le Directeur Général\nde l'Université du Sine Saloum\nEl-Hâdj Ibrahima Niass (USSEIN)",
    sigle: "l'USSEIN",
    objet: "Demande d'agrément",
    appel: 'Monsieur le Directeur Général,',
    intro: "J'ai l'honneur de solliciter auprès de votre haute bienveillance l'agrément de notre entreprise, F&K PRO, "
      + "agence de communication et d'événementiel, en qualité de prestataire de {sigle} dans les domaines ci-après :",
    domaines: [
      'Fourniture de matériels et de mobiliers de bureau ;',
      "Fourniture de supports de communication et d'objets promotionnels : casquettes, tee-shirts, polos, banderoles, kakémonos, enseignes lumineuses, signalétique, etc. ;",
      'Fourniture de consommables informatiques ;',
      "Conception graphique et impression de documents : blocs-notes, magazines, agendas, badges, cartons d'invitation, calendriers, etc. ;",
      "Confection de tenues et d'uniformes.",
    ].join('\n'),
    engagement: 'Notre structure s\'engage à vous apporter des prestations de qualité, dans le respect des délais convenus et des règles de la commande publique.',
    politesse: "Dans l'espoir d'une suite favorable, je vous prie d'agréer, Monsieur le Directeur Général, l'expression de ma haute considération.",
    pj: '',
    signataire: 'La Directrice',
    cachetOn: true,
  };
}

let courrier = { ...modele(), ...store.get(CLE_COURRIER, {}) };

const $ = (id) => document.getElementById(id);
const lignes = (txt) => String(txt || '').split('\n').map((s) => s.trim()).filter(Boolean);

function echapper(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dateFr(iso) {
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  const mois = new Date(a, m - 1, j).toLocaleDateString('fr-FR', { month: 'long' });
  return `${j === 1 ? '1er' : j} ${mois} ${a}`;
}

const CHAMPS = {
  'c-lieu': 'lieu', 'c-date': 'date', 'c-dest': 'dest', 'c-sigle': 'sigle', 'c-objet': 'objet', 'c-appel': 'appel',
  'c-intro': 'intro', 'c-domaines': 'domaines', 'c-engagement': 'engagement', 'c-politesse': 'politesse',
  'c-pj': 'pj', 'c-signataire': 'signataire',
};

function remplirFormulaire() {
  for (const [id, k] of Object.entries(CHAMPS)) $(id).value = courrier[k] ?? '';
  $('c-cachet-on').checked = !!courrier.cachetOn;
}

function majApercu() {
  const e = ENTREPRISE;
  $('l-coord').innerHTML = `<p><strong>${echapper(e.nom)}</strong></p><p>${echapper(e.activite)}</p>`
    + `<p>${echapper(e.adresse)}</p><p>Tél. : ${echapper(e.tel)}</p><p>${echapper(e.email)}</p>`;

  $('l-date').textContent = `${courrier.lieu || 'Dakar'}, le ${dateFr(courrier.date)}`;
  $('l-dest').innerHTML = lignes(courrier.dest).map((s) => `<p>${echapper(s)}</p>`).join('');
  $('l-objet').textContent = courrier.objet;
  $('l-appel').textContent = courrier.appel;
  // {sigle} dans l'introduction est remplacé par le sigle de l'organisme
  $('l-intro').innerHTML = echapper(courrier.intro.replace(/\{sigle\}/g, courrier.sigle || ''))
    .replace(/F&amp;K PRO/, '<strong>F&amp;K PRO</strong>');
  $('l-domaines').innerHTML = lignes(courrier.domaines).map((s) => `<li>${echapper(s)}</li>`).join('');
  $('l-engagement').textContent = courrier.engagement;
  $('l-engagement').hidden = !courrier.engagement.trim();

  const pj = lignes(courrier.pj);
  $('l-pj-bloc').hidden = !pj.length;
  $('l-pj').innerHTML = pj.map((s) => `<li>${echapper(s)}</li>`).join('');
  $('l-pj-phrase').textContent = pj.length ? 'Vous trouverez ci-joint les pièces administratives de notre entreprise.' : '';
  $('l-pj-phrase').hidden = !pj.length;
  $('l-politesse').textContent = courrier.politesse;

  $('l-signataire').textContent = courrier.signataire;
  const cachet = store.get(CLE_CACHET, null);
  const img = $('l-cachet');
  if (courrier.cachetOn && cachet) { img.src = cachet; img.classList.add('show'); }
  else { img.removeAttribute('src'); img.classList.remove('show'); }

  $('l-foot1').textContent = `${e.nom} · ${e.adresse} · Tél. : ${e.tel} · ${e.email}`;
  $('l-foot2').textContent = `NINEA : ${e.ninea} · RC : ${e.rc} · N° de compte bancaire : ${e.banque}`;

  document.title = `${courrier.objet} — ${lignes(courrier.dest).slice(-1)[0] || 'F&K PRO'}`;
  store.set(CLE_COURRIER, courrier);
}

function init() {
  remplirFormulaire();
  majApercu();
  for (const [id, k] of Object.entries(CHAMPS)) {
    $(id).addEventListener('input', (ev) => { courrier[k] = ev.target.value; majApercu(); });
  }
  $('c-cachet-on').addEventListener('change', (ev) => { courrier.cachetOn = ev.target.checked; majApercu(); });
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Remplacer le texte actuel par le modèle par défaut ?')) return;
    courrier = modele();
    remplirFormulaire();
    majApercu();
  });
}

init();
