# Roadmap — Coda Shmup mobile

Objectif : un vrai shmup mobile jouable dans le navigateur, contrôlable au gyroscope, avec un mode coop local.

Branche de travail : `mobile-game` (créée depuis `eval`, qui reste intacte).

## Phase 0 — Base mobile
- [x] Entrées par `IInputSource` → `InputState` sérialisable (`moveX`, `dragX`, `rotate`, `fire`). `LocalInput` = clavier + tactile (drag relatif, tir tant que le doigt est posé). Gyroscope en phase 1.
- [x] `PauseScene` : pause auto quand l'app passe en arrière-plan, ESC/P. Audio débloqué par Phaser au premier tap.
- [x] PWA : `manifest.json`, service worker, plein écran, portrait.
- [x] `npm run dev-mobile` : HTTPS sur le réseau local (le gyroscope exige HTTPS). Vite accepte `game.tsuki-dev.fr` (tunnel).

## Phase 1 — Gyroscope
- [x] `GyroInput` : `DeviceOrientationEvent.gamma` → vitesse X, zone morte, lissage.
- [x] Permission iOS (`DeviceOrientationEvent.requestPermission()`) via un bouton sur l'écran d'accueil.
- [x] Calibration (angle neutre au lancement) + bouton recalibrer.
- [x] Options : sensibilité, inversion, mode tactile/gyro (sauvegardées via `SaveManager`). Repli tactile si pas de gyro.

## Phase 2 — Vrai jeu
- [x] `WaveManager` + `levels.json` : niveaux = vagues puis boss, difficulté en dents de scie.
- [x] Ennemis data-driven (`enemies.json`) : scout, weaver (sinus), kamikaze, tank, tourelle visante ; formations random/column/sides/line/V.
- [x] `Boss` : barre de vie, FSM de phases (entrée → pattern A → pattern B < 50 % PV → enragé), patterns via `SpreadWeapon`.
- [x] Score + multiplicateur de combo ; crédits lâchés par les ennemis.
- [x] Power-ups en run : tir multiple, bouclier, aimant, soin, bombe.
- [x] Méta-progression : boutique entre les runs (cadence, dégâts, PV, vitesse, aimant ; coût `base × 1.12^n`), vaisseaux à débloquer.
- [x] UI/UX : titre, sélection de niveau, boutique, options, pause, résultats ; HUD mobile (pause, bombe, combo, crédits, barre de boss) ; zones sûres ; juice (particules, textes flottants, flash, vibration).
- [x] Audio : SFX synthétisés en WebAudio (explosion, pièce, bonus, coup, bombe, alarme), option son.
- [ ] Musique de fond (pas d'asset dispo).

## Phase 2b — Game jam : identité ION // PLASMA
- [x] Mécanique de polarité (`polarity.json`) : tout est ION (cyan) ou PLASMA (magenta). Tirs de sa couleur absorbés → jauge de Résonance ; tirs opposés = dégâts ; tirs du joueur ×2 sur la polarité opposée.
- [x] Bascule : changer de polarité avec la jauge ≥ seuil convertit les balles ennemies proches en tirs du joueur dirigés vers les ennemis, et blesse les ennemis dans le rayon.
- [x] Contrôles : 2e doigt, tap rapide, bouton-jauge du HUD, X / ↑ au clavier ; en mode gyro, tout tap bascule.
- [x] Polarité dans les données : par groupe de vague (`ion`/`plasma`/`alternate`/`random`), par phase de boss (+ cycle), par pattern (`alternate` = à chaque tir).
- [x] Niveau 1 tutoriel (astuces par vague), boss : barre à la couleur de la coque + « FAIBLE AU … ».
- [x] Direction artistique pixel art générée en code (`TextureFactory`) : sprites dessinés en grilles, boss dessinés en basse résolution + contour auto, palette douce, balles ION = anneaux creux / PLASMA = pleines (lisible sans couleur). Police Press Start 2P (OFL). Atlas Kenney plus utilisé.
- [x] UI unifiée (`UiStyle`, `Button` plat, `Backdrop` sur tous les menus), télégraphe avant tir des ennemis, sons d'absorption / bascule / résonance.
- [x] Fini de gagner sans bouger : ennemis non tués reviennent par le haut, tirs visés, surcharge à jauge pleine (`overloadAtFullCharge`).
- [x] Boss qui parlent (boîte de dialogue, intro / phases / défaite) et nouveaux patterns : `curtain`, `ring`, `lunge`, `boomerang`, `traps`, polarité `counter`. Deux boss originaux : Orchidée Vorace et Lame Écarlate (duelliste).

## Phase 3 — Multijoueur coop
- [x] Coop 2–4 joueurs, hôte autoritaire : l'hôte simule, les invités envoient leurs entrées (30 Hz) et reçoivent des instantanés génériques (20 Hz) interpolés. Le vaisseau de l'invité est déplacé en local (pas de latence sur son propre vaisseau).
- [x] Transport : WebSocket relayé par le serveur (au lieu de WebRTC P2P) : marche en 4G et derrière tous les NAT sans TURN. Isolé dans `src/net/Net.ts`, WebRTC possible plus tard.
- [x] Serveur Node unique `server/index.mjs` : sert `dist/` + salons WebSocket `/ws` (code à 4 chiffres, 4 joueurs max). En dev, Vite proxifie `/ws` (`npm run server` + `npm run dev-mobile`, ou `npm run dev-coop`).
- [x] `Dockerfile` : build Vite puis image Node, écoute sur `PORT` (3001).
- [ ] Cloudflare Tunnel (`cloudflared`) : `game.tsuki-dev.fr` → `http://localhost:3001` du conteneur.
- [x] Rejoindre : écran COOP, code à 4 chiffres (pavé numérique) ou lien `?salon=1234`.
- [x] Règles coop : ennemis visent le joueur le plus proche, boss un joueur au hasard ; difficulté +50 % par joueur ; défaite quand tous les vaisseaux sont détruits ; crédits gagnés par chacun dans sa sauvegarde.
- [ ] QR code du salon.
- [x] Fun en coop (`coop.json`, `CoopRules`) : un joueur mort devient FANTÔME (ralentit les ennemis proches, tap = « BOU ! » qui les repousse et les empêche de tirer, revit en restant collé 1,2 s à un allié) ; HIGH-FIVE (deux vaisseaux qui se touchent : « CLAP ! », jauges partagées + bonus) ; BASCULE SYNCHRO (deux Bascules à moins de 450 ms : onde géante, dégâts x2).

## Bonus (à la fin, si le temps le permet)
- [ ] Détection « joueurs proches » : regroupement par IP publique (header `CF-Connecting-IP`, même Wi-Fi) → popup « Jouer ensemble ? ».

## Règles
- Chaque étape : `npm run build-nolog` passe, playtest sur téléphone, commits atomiques.
- Valeurs de gameplay dans des JSON, pas en dur.
