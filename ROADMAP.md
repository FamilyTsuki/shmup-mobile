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

## Phase 3 — Multijoueur coop
- [ ] Coop 2–4 joueurs, hôte autoritaire : l'hôte simule, les clients envoient leurs inputs et reçoivent l'état (~20 Hz) avec interpolation.
- [ ] Transport : WebRTC DataChannel P2P.
- [ ] Serveur Node unique dans `server/` : sert le build `dist/` + WebSocket de signalisation sur la même origine.
- [ ] `Dockerfile` : build Vite puis image Node, écoute sur `localhost:PORT` dans le conteneur Cosmo Cloud.
- [ ] Cloudflare Tunnel (`cloudflared`) : `game.tsuki-dev.fr` → `http://localhost:PORT` du conteneur. HTTPS/`wss://` fournis par Cloudflare.
- [ ] NAT : STUN public + TURN en repli (4G / réseaux stricts).
- [ ] Rejoindre une partie : code de salon à 4 lettres / QR code.
- [ ] `NetManager` (plugin) : entités synchronisées par ID, inputs via `InputManager`.

## Bonus (à la fin, si le temps le permet)
- [ ] Détection « joueurs proches » : regroupement par IP publique (header `CF-Connecting-IP`, même Wi-Fi) → popup « Jouer ensemble ? ».

## Règles
- Chaque étape : `npm run build-nolog` passe, playtest sur téléphone, commits atomiques.
- Valeurs de gameplay dans des JSON, pas en dur.
