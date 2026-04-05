import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { AssetManager } from './AssetManager.js';
import { SoundManager } from './SoundManager.js';
import { PlayerController } from '../player/PlayerController.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { LevelGenerator } from '../world/LevelGenerator.js';
import { UIManager } from '../ui/UIManager.js';
import { ParticleSystem } from '../utils/ParticleSystem.js';

// All available upgrades for roguelike variety
const ALL_UPGRADES = [
    { id: 'speed', name: 'KINETIC BOOSTER', icon: '⚡', description: '+20% Movement Speed', apply: (p) => { p.speed *= 1.2; } },
    { id: 'damage', name: 'PLASMA ROUNDS', icon: '🔥', description: '+40% Weapon Damage', apply: (p) => { p.weapon.damage *= 1.4; } },
    { id: 'dash', name: 'PHASE SHIFT', icon: '💨', description: '-30% Dash Cooldown', apply: (p) => { p.dashCooldown *= 0.7; } },
    { id: 'firerate', name: 'OVERCLOCK', icon: '⏱️', description: '+25% Fire Rate', apply: (p) => { p.weapon.fireRate *= 0.75; } },
    { id: 'maxhp', name: 'NANO ARMOR', icon: '🛡️', description: '+30 Max Health', apply: (p) => { p.maxHealth += 30; p.health = p.maxHealth; } },
    { id: 'regen', name: 'BIO REGEN', icon: '💚', description: 'Passive HP Regen (2/s)', apply: (p) => { p.regenRate = (p.regenRate || 0) + 2; } },
    { id: 'magsize', name: 'EXTENDED MAG', icon: '📦', description: '+10 Magazine Size', apply: (p) => { p.weapon.maxAmmo += 10; p.weapon.ammo = p.weapon.maxAmmo; } },
    { id: 'vampiric', name: 'SIPHON CORE', icon: '🩸', description: 'Heal 5 HP per Kill', apply: (p) => { p.healOnKill = (p.healOnKill || 0) + 5; } },
    { id: 'explosive', name: 'FRAG ROUNDS', icon: '💥', description: 'Shots deal AoE Damage', apply: (p) => { p.weapon.aoeRadius = (p.weapon.aoeRadius || 0) + 3; } },
    { id: 'doublejump', name: 'THRUSTER PACK', icon: '🚀', description: '+1 Extra Jump', apply: (p) => { p.maxJumps = (p.maxJumps || 2) + 1; } },
    { id: 'piercing', name: 'RAILGUN MOD', icon: '🔷', description: 'Shots Pierce Enemies', apply: (p) => { p.weapon.piercing = true; } },
    { id: 'shield', name: 'ENERGY SHIELD', icon: '🔵', description: 'Block 1 Hit Every 10s', apply: (p) => { p.shieldCooldown = 10; p.shieldTimer = 0; p.hasShield = true; } },
    { id: 'wpn_shotgun', name: 'HEAVY SHOTGUN', icon: '💥', description: '8-Pellet Spread Blast', apply: (p) => { p.weapon.setProfile('SHOTGUN'); } },
    { id: 'wpn_deagle', name: 'DESERT EAGLE', icon: '🔫', description: 'Massive Single Target DMG', apply: (p) => { p.weapon.setProfile('DEAGLE'); } },
    { id: 'wpn_ak', name: 'AK-47 ASSAULT', icon: '🎯', description: 'Standard Auto Rifle', apply: (p) => { p.weapon.setProfile('AK47'); } },
    { id: 'wpn_sniper', name: 'RAIL SNIPER', icon: '⚡', description: 'Infinite Pierce, Huge DMG', apply: (p) => { p.weapon.setProfile('SNIPER'); } }
];

export class GameManager {
    constructor() {
        this.state = 'MENU'; // MENU, PLAYING, UPGRADE, GAMEOVER
        this.score = 0;
        this.wave = 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.comboMultiplier = 1;
        this.maxCombo = 0;
        this.stats = { headshots: 0, bodyshots: 0 };
        
        this.clock = new THREE.Clock();
        this.timeStep = 1 / 120; // Silky smooth 120hz physics ticks
        this.lastCallTime = performance.now() / 1000;
        
        window.GAME = this; // Expose to window for testing

        this.initThree();
        this.initCannon();
        
        this.assetManager = new AssetManager();
        this.soundManager = new SoundManager();
        this.particles = new ParticleSystem(this.scene);
        this.uiManager = new UIManager(this);
        
        this.playerName = 'OPERATIVE';
        this.highScores = this.loadHighScores();
    }

    async init() {
        await this.assetManager.loadAssets();
        
        this.levelGenerator = new LevelGenerator(this.world, this.scene);
        const pathfinder = this.levelGenerator.generate();
        
        this.player = new PlayerController(this.camera, this.world, this.scene, this.assetManager, this.soundManager, this.particles);
        this.enemyManager = new EnemyManager(this.world, this.scene, this.assetManager, this.soundManager, pathfinder, this.particles);
        this.enemyManager.setCamera(this.camera);
        
        this.uiManager.showStartScreen(this.highScores);
        this.uiManager.initMinimap(this.levelGenerator);
        
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Handle pointer lock loss
        document.addEventListener('pointerlockchange', () => {
            if (this.state === 'PLAYING' && !document.pointerLockElement) {
                // Player pressed ESC during gameplay — don't pause, just let them reclick
            }
        });
        
        this.animate();
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d1830);
        this.scene.fog = new THREE.FogExp2(0x0d1830, 0.008); // Much less fog
        
        this.camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 200);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.4; // Brighter overall
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.getElementById('game-container').appendChild(this.renderer.domElement);
    }

    initCannon() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -30, 0);
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.solver.iterations = 10;
        
        const defaultMaterial = new CANNON.Material("default");
        const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
            friction: 0.0,
            restitution: 0.0
        });
        this.world.addContactMaterial(defaultContactMaterial);
        this.world.defaultContactMaterial = defaultContactMaterial;
    }

    loadHighScores() {
        const stored = localStorage.getItem('deadlink_highscores');
        if (stored) {
            try { return JSON.parse(stored); }
            catch (e) { return []; }
        }
        return [];
    }

    saveHighScore() {
        this.highScores.push({ name: this.playerName, score: this.score, wave: this.wave, combo: this.maxCombo });
        this.highScores.sort((a, b) => b.score - a.score);
        this.highScores = this.highScores.slice(0, 5);
        localStorage.setItem('deadlink_highscores', JSON.stringify(this.highScores));
    }

    startGame(playerName) {
        if (playerName) this.playerName = playerName;
        this.soundManager.resume();
        this.state = 'PLAYING';
        this.score = 0;
        this.wave = 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.comboMultiplier = 1;
        this.maxCombo = 0;
        this.stats = { headshots: 0, bodyshots: 0 };
        this.player.reset();
        this.enemyManager.clearAll();
        this.startWave();
        this.uiManager.hideMenus();
        this.requestPointerLock();
        this.soundManager.startAmbient();
    }

    restartGame(playerName) {
        this.startGame(playerName);
    }

    startWave() {
        // Wave 1: 8 enemies. Gentle scaling so player can progress.
        const base = 8;
        const scaling = Math.pow(1.15, this.wave - 1);
        const enemyCount = Math.min(Math.floor(base * scaling), this.enemyManager.maxEnemies - 2);
        const bounds = this.levelGenerator.size;
        
        // Show wave announcement with enemy count
        this.uiManager.showWaveAnnouncement(this.wave, () => {
            this.enemyManager.spawnWave(enemyCount, bounds, this.wave, this.player.body.position);
        });
    }

    requestPointerLock() {
        document.body.requestPointerLock();
    }

    handlePlayerDamage(amount) {
        // Shield check
        if (this.player.hasShield && this.player.shieldTimer <= 0) {
            this.player.shieldTimer = this.player.shieldCooldown;
            this.soundManager.playShield();
            return; // Blocked!
        }
        
        this.uiManager.showDamage();
        const died = this.player.takeDamage(amount);
        if (died) {
            this.state = 'GAMEOVER';
            this.saveHighScore();
            this.uiManager.showGameOver(this.score, this.highScores, this.wave, this.maxCombo, this.stats);
            this.soundManager.stopAmbient();
        }
    }

    handleEnemyKill(position, enemyType) {
        // Combo system
        this.combo++;
        this.comboTimer = 3.5;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        
        // Uncapped Multiplier
        if (this.combo >= 3) {
            this.comboMultiplier = 1 + Math.floor(this.combo / 5) * 0.5 + 0.5;
        } else {
            this.comboMultiplier = 1;
        }
        
        const baseScore = 100;
        const points = Math.floor(baseScore * this.comboMultiplier);
        this.score += points;
        
        // Vampiric healing
        if (this.player.healOnKill) {
            this.player.health = Math.min(this.player.health + this.player.healOnKill, this.player.maxHealth);
        }
        
        // === KILL TEXT ANIMATION ===
        if (position) {
            this.enemyManager.spawnKillText(position, this.combo);
        }
        
        // Kill feed
        this.uiManager.addKillFeed(enemyType || 'ENEMY', points);
        this.uiManager.updateCombo(this.combo, this.comboMultiplier);
        
        // Ammo drop chance
        if (position && Math.random() < 0.3) {
            this.player.weapon.spawnAmmoPack(position);
        }
        
        // Spawn particles at death position
        if (position) {
            this.particles.spawnExplosion(position, 0xff3300, 18);
        }
        
        const activeEnemies = this.enemyManager.getActiveEnemies().length;
        if (activeEnemies === 0 && this.enemyManager.pendingSpawns === 0) {
            this.showUpgrades();
        }
    }

    showUpgrades() {
        this.state = 'UPGRADE';
        // Randomly pick 3 unique upgrades
        const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
        const picks = shuffled.slice(0, 3);
        this.uiManager.showUpgrades(picks, (upgrade) => this.applyUpgrade(upgrade));
    }

    applyUpgrade(upgrade) {
        upgrade.apply(this.player);
        this.wave++;
        this.player.health = Math.min(this.player.health + 30, this.player.maxHealth);
        this.state = 'PLAYING';
        this.startWave();
    }

    update() {
        const time = performance.now() / 1000;
        const dt = this.clock.getDelta();
        const clampedDt = Math.min(dt, 0.05);

        if (this.state === 'PLAYING') {
            this.player.update(clampedDt, time, this.enemyManager.getActiveEnemies(), 
                (pos, type) => this.handleEnemyKill(pos, type),
                (isHit, isKill) => this.uiManager.showHitMarker(isHit, isKill)
            );
            this.enemyManager.update(clampedDt, time, this.player.body.position, 
                (dmg) => this.handlePlayerDamage(dmg),
                (pos, type) => this.handleEnemyKill(pos, type),
                (intensity, duration) => this.player.triggerScreenShake(intensity, duration)
            );
            
            this.player.weapon.updateAmmoPacks(clampedDt, this.player.body.position);
            
            // Passive regen
            if (this.player.regenRate && this.player.health < this.player.maxHealth) {
                this.player.health = Math.min(this.player.health + this.player.regenRate * clampedDt, this.player.maxHealth);
            }
            
            // Shield cooldown
            if (this.player.hasShield && this.player.shieldTimer > 0) {
                this.player.shieldTimer -= clampedDt;
            }
            
            // Combo decay
            if (this.comboTimer > 0) {
                this.comboTimer -= clampedDt;
                if (this.comboTimer <= 0) {
                    this.combo = 0;
                    this.comboMultiplier = 1;
                    this.uiManager.updateCombo(0, 1);
                }
            }
            
            // Update HUD
            const dashReady = (time - this.player.lastDashTime) >= this.player.dashCooldown;
            this.uiManager.updateHUD(
                this.player.health, this.player.maxHealth,
                this.player.weapon.ammo, this.player.weapon.maxAmmo,
                dashReady, this.score, this.wave,
                this.player.weapon.reloading
            );

            // Minimap
            this.uiManager.updateMinimap(
                this.player.body.position,
                this.player.yawObject.rotation.y,
                this.enemyManager.getActiveEnemies()
            );
            
            // Out of bounds reset
            if (this.player.body.position.y < -20) {
                this.player.body.position.set(0, 5, 0);
                this.player.body.velocity.set(0, 0, 0);
            }
            
            // Physics step
            const timeSinceLastCall = time - this.lastCallTime;
            const cappedTime = Math.min(timeSinceLastCall, 0.1);
            this.world.step(this.timeStep, cappedTime, 10); // allow more catch-up steps for stutter protection
            this.lastCallTime = time;
        } else {
            this.lastCallTime = time; // Keep tracking time even in menus
        }

        // Update particles always (for visual continuity)
        this.particles.update(clampedDt);

        // Dynamic crosshair
        if (this.state === 'PLAYING') {
            const vel = this.player.body.velocity;
            const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
            const shooting = this.player.isShooting;
            this.uiManager.updateCrosshair(speed, shooting);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
