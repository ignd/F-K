# Enregistrer les factures dans Google Sheets

Installation unique (environ 5 minutes) avec le compte Google de F&K PRO.
Ensuite, chaque facture enregistrée dans l'application est copiée dans un tableur Google privé
et retrouvée automatiquement sur n'importe quel ordinateur ou téléphone.

## 1. Créer le tableur
1. Ouvrir https://sheets.new (connecté au compte Google de F&K PRO).
2. Le renommer, par exemple **Factures F&K PRO**.

## 2. Ajouter le script
1. Dans le tableur : menu **Extensions → Apps Script**.
2. Effacer tout le contenu du fichier `Code.gs` affiché.
3. Copier-coller le contenu de [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. À la ligne `const CODE_ACCES = 'CHANGEZ-MOI';`, remplacer `CHANGEZ-MOI` par un **code secret**
   (au moins 12 caractères, par exemple `FK-Dakar-2026-x7Qm`). Gardez-le : il sera demandé dans l'application.
5. Cliquer sur l'icône **Enregistrer** (disquette).

## 3. Publier le script
1. En haut à droite : **Déployer → Nouveau déploiement**.
2. Roue dentée à côté de « Sélectionner le type » → **Application Web**.
3. Régler :
   - **Exécuter en tant que** : *Moi*
   - **Qui a accès** : *Tout le monde*
     (nécessaire pour que le site puisse écrire ; les données restent protégées par le code secret)
4. **Déployer**, puis **Autoriser l'accès** et choisir le compte Google.
   Si Google affiche « Google n'a pas validé cette application » : **Paramètres avancés → Accéder à … (non sécurisé)** —
   c'est normal pour un script personnel.
5. Copier l'**URL de l'application Web** (elle se termine par `/exec`).

## 4. Relier l'application
1. Ouvrir https://ignd.github.io/F-K/
2. En bas : **Paramètres de l'entreprise → Enregistrement en ligne (Google Sheets)**.
3. Coller l'**adresse du script** et saisir le **code d'accès**.
4. Cliquer sur **Tester et synchroniser** : le badge en haut passe au vert « Google Sheets ».

Les factures déjà enregistrées sur cet ordinateur sont envoyées automatiquement dans le tableur.
Répéter l'étape 4 sur chaque ordinateur ou téléphone utilisé.

## Bon à savoir
- L'onglet **Factures** du tableur liste : numéro, type, date, client, total TTC. Ne modifiez pas la colonne « Données ».
- Pour supprimer une facture, utilisez le bouton ✕ dans l'application (la ligne est retirée du tableur).
- Si vous modifiez le script plus tard : **Déployer → Gérer les déploiements → Modifier → Nouvelle version**
  (l'adresse `/exec` reste la même).
- Ne partagez l'adresse et le code qu'avec les personnes autorisées à voir les factures.
