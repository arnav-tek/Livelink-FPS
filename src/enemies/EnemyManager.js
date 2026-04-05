import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ─────────────────────────────────────────────────────────
//  ENEMY TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────
const ENEMY_TYPES = {
    CHASER:     { color: 0xff1744, speed: 6,   health: 100,  damage: 10,  range: 2.5,  scale: 1,    canShoot: false },
    KAMIKAZE:   { color: 0xff9900, speed: 10,  health: 40,   damage: 30,  range: 3,    scale: 0.7,  canShoot: false },
    SNIPER:     { color: 0x0088ff, speed: 3.5, health: 70,   damage: 40,  range: 28,   scale: 1.2,  canShoot: true },
    TANK:       { color: 0x7c3aed, speed: 2.8, health: 450,  damage: 40,  range: 3.5,  scale: 1.5,  canShoot: false },
    TELEPORTER: { color: 0xff00aa, speed: 4.5, health: 65,   damage: 20,  range: 2,    scale: 0.9,  canShoot: true },
    BRUTE:      { color: 0xff1111, speed: 4,   health: 650,  damage: 60,  range: 4.0,  scale: 1.8,  canShoot: false },
    SWARMER:    { color: 0x00ffaa, speed: 9,   health: 25,   damage: 15,  range: 2.5,  scale: 0.8,  canShoot: false },
    GUNNER:     { color: 0xffcc00, speed: 4.5, health: 80,   damage: 15,  range: 22,   scale: 1.1,  canShoot: true },
    BOSS:       { color: 0xff0000, speed: 3,   health: 4000, damage: 50,  range: 5,    scale: 2.5,  canShoot: true },
};

// ─────────────────────────────────────────────────────────
//  KILL TEXT SYSTEM
// ─────────────────────────────────────────────────────────
const KILL_PHRASES = [
    'OBLITERATED!', 'SHREDDED!', 'DELETED!', 'DECIMATED!',
    'ANNIHILATED!', 'VAPORIZED!', 'PULVERIZED!', 'LIQUIDATED!',
    'DESTROYED!', 'TERMINATED!', 'ELIMINATED!', 'ERASED!',
    'WRECKED!', 'DEMOLISHED!', 'DEVASTATED!', 'CRUSHED!'
];

function spawnKillText(worldPos, camera, scene, combo = 1) {
    const el = document.createElement('div');
    const phrase = KILL_PHRASES[Math.floor(Math.random() * KILL_PHRASES.length)];
    
    // For high combos, go insane
    const isInsane = combo >= 5;
    const isMega = combo >= 10;
    
    const hue = isInsane ? Math.floor(Math.random() * 360) : (combo > 3 ? 45 : 180);
    const size = Math.min(16 + combo * 3, isMega ? 48 : 36);
    
    el.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 950;
        font-family: 'Rajdhani', 'Impact', sans-serif;
        font-weight: 900;
        font-size: ${size}px;
        color: hsl(${hue}, 100%, ${isMega ? 70 : 60}%);
        text-shadow: 
            0 0 10px hsl(${hue}, 100%, 50%),
            0 0 20px hsl(${hue}, 100%, 40%),
            0 0 40px hsl(${hue}, 100%, 30%),
            2px 2px 0 rgba(0,0,0,0.8);
        letter-spacing: ${isMega ? '0.15em' : '0.08em'};
        white-space: nowrap;
        transform-origin: center center;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        opacity: 0;
        user-select: none;
    `;
    el.textContent = isMega ? `🔥 ${phrase} 🔥` : phrase;
    document.body.appendChild(el);
    
    // Project world position to screen
    if (worldPos && camera) {
        const projected = worldPos.clone().project(camera);
        if (projected.z < 1) {
            const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;
            el.style.left = `${screenX}px`;
            el.style.top = `${screenY}px`;
        }
    }
    
    // GSAP animation - crazy entrance
    const tl = window.gsap ? window.gsap.timeline({
        onComplete: () => el.remove()
    }) : null;
    
    if (tl) {
        tl.fromTo(el, 
            { opacity: 0, scale: isInsane ? 2.5 : 1.8, y: 0, rotateZ: (Math.random() - 0.5) * 30 },
            { opacity: 1, scale: 1, y: 0, rotateZ: 0, duration: isInsane ? 0.12 : 0.18, ease: 'power3.out' }
        )
        .to(el,
            { y: -(40 + combo * 4), opacity: 0, scale: isMega ? 1.3 : 0.7, 
              filter: `blur(${isMega ? 4 : 2}px)`,
              duration: 0.55 + (isInsane ? 0.2 : 0), ease: 'power2.in', delay: isMega ? 0.35 : 0.2 }
        );
        
        // Shake effect for mega kills
        if (isMega) {
            tl.to(el, { rotateZ: '+=10', duration: 0.05, yoyo: true, repeat: 5, ease: 'none' }, 0.02);
        }
    } else {
        // Fallback without GSAP
        el.style.opacity = '1';
        el.style.transition = 'all 0.7s ease-out';
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translate(-50%, -150%) scale(0.7)';
        }, 50);
        setTimeout(() => el.remove(), 800);
    }
}

// ─────────────────────────────────────────────────────────
//  ENEMY CLASS
// ─────────────────────────────────────────────────────────
class Enemy {
    constructor(world, scene, assetManager, soundManager, pathfinder, particles) {
        this.world = world;
        this.scene = scene;
        this.assetManager = assetManager;
        this.soundManager = soundManager;
        this.pathfinder = pathfinder;
        this.particles = particles;
        this.active = false;
        
        this.mesh = null;
        this.type = 'CHASER';
        
        // Health bar
        this.healthBarGroup = new THREE.Group();
        
        const bgGeo = new THREE.PlaneGeometry(1.2, 0.12);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.6 });
        this.healthBarBg = new THREE.Mesh(bgGeo, bgMat);
        
        const fgGeo = new THREE.PlaneGeometry(1.2, 0.12);
        fgGeo.translate(0.6, 0, 0);
        // Fix: Clone the material so it is uniquely owned by this enemy
        const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        this.healthBarFg = new THREE.Mesh(fgGeo, fgMat.clone());
        this.healthBarFg.position.x = -0.6;
        
        this.healthBarGroup.add(this.healthBarBg);
        this.healthBarGroup.add(this.healthBarFg);
        
        // Physics body
        const shape = new CANNON.Cylinder(0.5, 0.5, 2, 8);
        this.body = new CANNON.Body({
            mass: 50,
            material: new CANNON.Material({ friction: 0.1, restitution: 0 }),
            fixedRotation: true
        });
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.body.addShape(shape, new CANNON.Vec3(0, 0, 0), q);
        this.body.linearDamping = 0.88;
        this.bodyInWorld = false;
        
        this.isAiming = false;
        this.laserLine = null;
        
        // Advanced AI state
        this.aiState = 'CHASE'; // CHASE, FLANK, RETREAT, SHOOT, CIRCLE
        this.stateTimer = 0;
        this.flankSide = Math.random() > 0.5 ? 1 : -1;
        this.flankTarget = null;
        this.zigZagPhase = Math.random() * Math.PI * 2;
        this.currentPath = null;
        this.lastPathTime = 0;
        this.lastAttackTime = 0;
        this.isShooting = false;
        this.shootCooldown = 0;
        this.alertRadius = 40; // Enemies track player from far
    }

    spawn(position, type = 'CHASER') {
        this.active = true;
        this.type = type;
        
        const stats = ENEMY_TYPES[type];
        this.maxHealth = stats.health;
        this.health = stats.health;
        this.speed = stats.speed;
        this.attackRange = stats.range;
        this.damage = stats.damage;
        this.canShoot = stats.canShoot;
        
        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = this.assetManager.getEnemyModel(type);
        this.mesh.scale.set(stats.scale, stats.scale, stats.scale);
        
        this.healthBarGroup.position.y = 1.5 * stats.scale;
        this.mesh.add(this.healthBarGroup);
        this.updateHealthBar();
        
        this.body.position.copy(position);
        this.body.velocity.set(0, 0, 0);
        this.body.wakeUp();
        
        if (!this.bodyInWorld) {
            this.world.addBody(this.body);
            this.bodyInWorld = true;
        }
        
        this.scene.add(this.mesh);
        
        this.lastAttackTime = 0;
        this.isAiming = false;
        this.flankSide = Math.random() > 0.5 ? 1 : -1;
        this.zigZagPhase = Math.random() * Math.PI * 2;
        this.currentPath = null;
        this.lastPathTime = -(Math.random() * 2.0); // Stagger initial pathfinding
        this.aiState = 'CHASE';
        this.stateTimer = Math.random() * 2;
        this.shootCooldown = Math.random() * 2; // Stagger initial shots
        this.spawnGraceTimer = 1.5; // Can't attack for 1.5s after spawning
    }

    updateHealthBar() {
        const percent = Math.max(0, this.health / this.maxHealth);
        this.healthBarFg.scale.x = Math.max(percent, 0.001);
        
        if (percent > 0.5) this.healthBarFg.material.color.setHex(0x00ff88);
        else if (percent > 0.2) this.healthBarFg.material.color.setHex(0xf0ff00);
        else this.healthBarFg.material.color.setHex(0xff003c);
        
        this.healthBarFg.material.needsUpdate = true;
    }

    despawn() {
        this.active = false;
        if (this.bodyInWorld) {
            this.world.removeBody(this.body);
            this.bodyInWorld = false;
        }
        this.scene.remove(this.mesh);
        if (this.laserLine) {
            this.scene.remove(this.laserLine);
            if (this.laserLine.geometry) this.laserLine.geometry.dispose();
            if (this.laserLine.material) this.laserLine.material.dispose();
            this.laserLine = null;
        }
        this.isAiming = false;
        this.currentPath = null;
    }

    takeDamage(amount, direction) {
        this.health -= amount;
        this.updateHealthBar();
        
        // Flash emissive
        this.mesh.traverse(child => {
            if (child.isMesh && child.material && child.material.emissive) {
                child.material.emissive.setHex(0xffffff);
                setTimeout(() => {
                    if (this.active && child.material && child.material.emissive) {
                        child.material.emissive.setHex(0x330000);
                    }
                }, 80);
            }
        });
        
        // Knockback
        if (direction) {
            const mult = this.type === 'TANK' || this.type === 'BRUTE' ? 0.15 : 1.0;
            this.body.applyImpulse(
                new CANNON.Vec3(direction.x * 280 * mult, 60 * mult, direction.z * 280 * mult),
                this.body.position
            );
            // React to being hit – switch to aggressive state
            if (this.aiState !== 'SHOOT') this.aiState = 'CHASE';
        }
        
        if (this.health <= 0) {
            this.soundManager.playEnemyDeath();
            if (this.particles) {
                const stats = ENEMY_TYPES[this.type];
                this.particles.spawnExplosion(this.mesh.position, stats ? stats.color : 0xff4400, 22);
            }
            this.despawn();
            return true;
        } else {
            this.soundManager.playEnemyHit();
        }
        return false;
    }

    createExplosionEffect(onExplosion, shakeIntensity = 1.5, shakeDuration = 0.6) {
        if (onExplosion) onExplosion(shakeIntensity, shakeDuration);
        this.soundManager.playExplosion();
        
        if (this.particles) this.particles.spawnExplosion(this.mesh.position, 0xffaa00, 35);
        
        const geo = new THREE.SphereGeometry(3, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(this.mesh.position);
        this.scene.add(mesh);
        
        const ringGeo = new THREE.RingGeometry(0.1, 0.6, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(this.mesh.position);
        ring.position.y += 0.5;
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);
        
        let scale = 1, ringScale = 1, ticks = 0;
        const expand = setInterval(() => {
            ticks++;
            scale += 0.6; mesh.scale.set(scale, scale, scale); mat.opacity -= 0.08;
            ringScale += 1.5; ring.scale.set(ringScale, ringScale, ringScale); ringMat.opacity -= 0.06;
            if (mat.opacity <= 0 || ticks > 20) {
                clearInterval(expand);
                this.scene.remove(mesh); this.scene.remove(ring);
                geo.dispose(); mat.dispose(); ringGeo.dispose(); ringMat.dispose();
            }
        }, 30);
    }

    // ── Advanced AI decision-making ──
    _decideState(dt, dist, time) {
        this.stateTimer -= dt;
        if (this.stateTimer > 0) return;
        
        const rand = Math.random();
        
        if (this.type === 'CHASER') {
            if (dist < 6 && rand < 0.4) {
                this.aiState = 'CIRCLE'; this.stateTimer = 1.5 + rand;
            } else if (dist > 12 && rand < 0.3) {
                this.aiState = 'FLANK'; this.stateTimer = 2 + rand * 2;
            } else {
                this.aiState = 'CHASE'; this.stateTimer = 1 + rand;
            }
        } else if (this.type === 'GUNNER') {
            if (dist < 8) {
                this.aiState = 'RETREAT'; this.stateTimer = 1.5;
            } else if (dist < 22) {
                this.aiState = 'SHOOT'; this.stateTimer = 2 + rand;
            } else {
                this.aiState = 'CHASE'; this.stateTimer = 1;
            }
        } else if (this.type === 'TELEPORTER') {
            if (rand < 0.5) {
                this.aiState = 'FLANK'; this.stateTimer = 1.5;
            } else {
                this.aiState = 'CHASE'; this.stateTimer = 2;
            }
        }
    }

    _getPathDirection(playerPos, time) {
        if (!this.pathfinder) return null;

        // Fast path: if we have line of sight to the player, just go straight to them. No A* needed.
        if (time - this.lastPathTime > 0.2) {
            const hasLOS = this.pathfinder.hasLineOfSight(this.mesh.position, playerPos);
            if (hasLOS) {
                this.currentPath = [playerPos];
                this.lastPathTime = time + (Math.random() * 0.5); // Check LOS less often if we have it
                const dir = new THREE.Vector3(playerPos.x - this.mesh.position.x, 0, playerPos.z - this.mesh.position.z);
                return dir.lengthSq() > 0.001 ? dir.normalize() : null;
            }
        }

        // Stagger repath to avoid lag spikes, and repath less often
        const repath = time - this.lastPathTime > 0.6 + Math.random() * 0.4 || !this.currentPath || this.currentPath.length === 0;
        if (repath) {
            this.lastPathTime = time;
            this.currentPath = this.pathfinder.findPath(
                this.mesh.position.x, this.mesh.position.z,
                playerPos.x, playerPos.z
            );
        }
        
        if (!this.currentPath || this.currentPath.length === 0) return null;
        
        // Follow the path waypoints
        while (this.currentPath.length > 1) {
            const target = this.currentPath[0];
            const dw = Math.hypot(target.x - this.mesh.position.x, target.z - this.mesh.position.z);
            if (dw < 1.0) { // Distance to consider waypoint reached (grid size is 1)
                this.currentPath.shift();
            } else {
                break;
            }
        }
        
        const target = this.currentPath[0];
        const dir = new THREE.Vector3(target.x - this.mesh.position.x, 0, target.z - this.mesh.position.z);
        return dir.lengthSq() > 0.001 ? dir.normalize() : null;
    }

    update(dt, time, playerPos, onAttack, onExplosion, spawnProjectile, activeEnemies) {
        if (!this.active) return;
        
        // Spawn grace period — enemies can move but not attack
        if (this.spawnGraceTimer > 0) {
            this.spawnGraceTimer -= dt;
        }
        const canAttack = this.spawnGraceTimer <= 0;
        // Wrap onAttack to respect grace period
        const guardedAttack = canAttack ? onAttack : () => {};
        
        this.mesh.position.copy(this.body.interpolatedPosition || this.body.position);
        this.healthBarGroup.lookAt(playerPos.x, playerPos.y, playerPos.z);
        
        const enemyLookPos = new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z);
        this.mesh.lookAt(enemyLookPos);
        
        const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
        toPlayer.y = 0;
        const dist = toPlayer.length();
        
        let moveDir = dist > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3();
        
        // Decide AI state
        this._decideState(dt, dist, time);
        
        // Get pathfinder direction (fallback: direct)
        const pathDir = (dist > this.attackRange) ? this._getPathDirection(playerPos, time) : null;
        if (pathDir) {
            moveDir.lerp(pathDir, 0.8).normalize();
        }
        
        // ── Separation from other enemies ──
        let sep = new THREE.Vector3();
        if (activeEnemies) {
            const sepRadius = this.type === 'TANK' || this.type === 'BRUTE' ? 4 : 3;
            for (const other of activeEnemies) {
                if (other === this || !other.active) continue;
                const d = this.mesh.position.distanceTo(other.mesh.position);
                if (d < sepRadius && d > 0.01) {
                    const away = new THREE.Vector3().subVectors(this.mesh.position, other.mesh.position).normalize();
                    away.multiplyScalar((sepRadius - d) / sepRadius);
                    sep.add(away);
                }
            }
        }
        
        // ──────────────────────────────────────────
        //  TYPE-SPECIFIC AI
        // ──────────────────────────────────────────
        if (this.type === 'CHASER') {
            this._updateChaser(dt, time, dist, moveDir, sep, guardedAttack);
        } else if (this.type === 'KAMIKAZE') {
            this._updateKamikaze(dt, time, dist, moveDir, sep, guardedAttack, onExplosion);
        } else if (this.type === 'SNIPER') {
            this._updateSniper(dt, time, dist, moveDir, playerPos, canAttack ? spawnProjectile : () => {});
        } else if (this.type === 'TANK') {
            this._updateTank(dt, time, dist, moveDir, sep, guardedAttack, onExplosion);
        } else if (this.type === 'TELEPORTER') {
            this._updateTeleporter(dt, time, dist, moveDir, playerPos, guardedAttack, canAttack ? spawnProjectile : () => {});
        } else if (this.type === 'BRUTE') {
            this._updateBrute(dt, time, dist, moveDir, guardedAttack, onExplosion);
        } else if (this.type === 'SWARMER') {
            this._updateSwarmer(dt, time, dist, moveDir, sep, guardedAttack);
        } else if (this.type === 'GUNNER') {
            this._updateGunner(dt, time, dist, moveDir, sep, playerPos, canAttack ? spawnProjectile : () => {});
        } else if (this.type === 'BOSS') {
            this._updateBoss(dt, time, dist, moveDir, guardedAttack, canAttack ? spawnProjectile : () => {});
        }
    }

    _applyMove(moveDir, speedMult = 1) {
        const force = this.speed * speedMult * 100;
        this.body.applyForce(new CANNON.Vec3(moveDir.x * force, 0, moveDir.z * force), this.body.position);
    }

    _updateChaser(dt, time, dist, moveDir, sep, onAttack) {
        if (dist > this.attackRange) {
            const combined = moveDir.clone().add(sep.multiplyScalar(0.4));
            if (combined.lengthSq() > 0.001) combined.normalize();
            
            // Circle-strafe once close
            if (this.aiState === 'CIRCLE' && dist < 8) {
                const tangent = new THREE.Vector3(-combined.z, 0, combined.x).multiplyScalar(this.flankSide);
                combined.lerp(tangent, 0.7).normalize();
            } else if (dist < 16) {
                // Flanking approach
                const tangent = new THREE.Vector3(-combined.z, 0, combined.x).multiplyScalar(this.flankSide);
                combined.lerp(tangent, 0.35).normalize();
            }
            
            const speedBoost = dist > 20 ? 1.3 : 1;
            this._applyMove(combined, speedBoost);
        } else {
            if (time - this.lastAttackTime > 0.9) {
                this.lastAttackTime = time;
                onAttack(this.damage);
            }
        }
    }

    _updateKamikaze(dt, time, dist, moveDir, sep, onAttack, onExplosion) {
        const combined = moveDir.clone().add(sep.multiplyScalar(0.2));
        if (combined.lengthSq() > 0.001) combined.normalize();
        
        // Intense zigzag at close range
        if (dist > this.attackRange) {
            const tangent = new THREE.Vector3(-combined.z, 0, combined.x);
            const zz = Math.sin(time * 8 + this.zigZagPhase) * (dist < 12 ? 1.5 : 0.8);
            combined.addScaledVector(tangent, zz);
            if (combined.lengthSq() > 0.001) combined.normalize();
        }
        
        this._applyMove(combined, 1.2);
        
        if (dist < this.attackRange) {
            onAttack(this.damage);
            this.createExplosionEffect(onExplosion, 2.0, 0.8);
            this.health = 0;
            this.despawn();
        }
    }

    _updateSniper(dt, time, dist, moveDir, playerPos, spawnProjectile) {
        if (this.isAiming) {
            this.body.velocity.x *= 0.75;
            this.body.velocity.z *= 0.75;
            
            if (this.laserLine) {
                const pos = this.laserLine.geometry.attributes.position.array;
                pos[0] = this.mesh.position.x; pos[1] = this.mesh.position.y + 1.2; pos[2] = this.mesh.position.z;
                pos[3] = playerPos.x; pos[4] = playerPos.y; pos[5] = playerPos.z;
                this.laserLine.geometry.attributes.position.needsUpdate = true;
                // Pulse opacity
                this.laserLine.material.opacity = 0.4 + Math.sin(time * 20) * 0.3;
            }

            if (time - this.aimStartTime > 1.0) {
                this.isAiming = false;
                if (this.laserLine) { 
                    this.scene.remove(this.laserLine); 
                    if (this.laserLine.geometry) this.laserLine.geometry.dispose();
                    if (this.laserLine.material) this.laserLine.material.dispose();
                    this.laserLine = null; 
                }
                
                const projDir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
                projDir.y += 0.02;
                projDir.normalize();
                spawnProjectile(this.mesh.position, projDir, this.damage);
                this.lastAttackTime = time;
            }
        } else {
            if (dist > this.attackRange) {
                this._applyMove(moveDir);
            } else if (dist < 10) {
                // Retreat
                this._applyMove(moveDir.clone().negate(), 0.8);
            } else {
                // Strafe while sniping
                const tangent = new THREE.Vector3(-moveDir.z, 0, moveDir.x).multiplyScalar(this.flankSide);
                this._applyMove(tangent, 0.6);
                this.body.velocity.x *= 0.88;
                this.body.velocity.z *= 0.88;
                
                if (time - this.lastAttackTime > 2.5) {
                    this.isAiming = true;
                    this.aimStartTime = time;
                    
                    const mat = new THREE.LineBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.6 });
                    const pts = [this.mesh.position.clone(), playerPos.clone()];
                    const geo = new THREE.BufferGeometry().setFromPoints(pts);
                    this.laserLine = new THREE.Line(geo, mat);
                    this.scene.add(this.laserLine);
                    this.soundManager.playLaser();
                }
            }
        }
    }

    _updateTank(dt, time, dist, moveDir, sep, onAttack, onExplosion) {
        const combined = moveDir.clone().add(sep.multiplyScalar(0.15));
        if (combined.lengthSq() > 0.001) combined.normalize();
        
        if (dist > this.attackRange) {
            this._applyMove(combined, 1.4); // Tanks are surprisingly fast at range
        } else {
            if (time - this.lastAttackTime > 1.3) {
                this.lastAttackTime = time;
                onAttack(this.damage);
                onExplosion(0.6, 0.25);
            }
        }
    }

    _updateTeleporter(dt, time, dist, moveDir, playerPos, onAttack, spawnProjectile) {
        if (dist > this.attackRange) {
            this._applyMove(moveDir);
            
            if (time - this.lastAttackTime > 2.5 && dist > 8) {
                this.lastAttackTime = time;
                const dir = moveDir.clone();
                const teleportPos = new THREE.Vector3(
                    playerPos.x - dir.x * 4 + (Math.random() - 0.5) * 4,
                    1.5,
                    playerPos.z - dir.z * 4 + (Math.random() - 0.5) * 4
                );
                
                if (this.particles) this.particles.spawnExplosion(this.mesh.position, 0xff00aa, 12);
                this.body.position.copy(teleportPos);
                this.body.velocity.set(0, 0, 0);
                this.soundManager.playTeleport();
                if (this.particles) this.particles.spawnExplosion(teleportPos, 0xff00aa, 12);
                
                // Shoot immediately after teleport
                if (this.canShoot && spawnProjectile) {
                    setTimeout(() => {
                        if (!this.active) return;
                        const pDir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
                        spawnProjectile(this.mesh.position, pDir, this.damage);
                    }, 200);
                }
            }
        } else {
            if (time - this.lastAttackTime > 0.8) {
                this.lastAttackTime = time;
                onAttack(this.damage);
            }
        }
    }

    _updateBrute(dt, time, dist, moveDir, onAttack, onExplosion) {
        if (dist > this.attackRange) {
            // Brutes charge at player regardless
            this._applyMove(moveDir, 1.8);
            
            // Occasional shockwave shots at medium range
        } else {
            if (time - this.lastAttackTime > 1.8) {
                this.lastAttackTime = time;
                onAttack(this.damage);
                onExplosion(1.2, 0.5);
            }
        }
    }

    _updateSwarmer(dt, time, dist, moveDir, sep, onAttack) {
        const combined = moveDir.clone().add(sep.multiplyScalar(0.5));
        if (combined.lengthSq() > 0.001) combined.normalize();
        
        if (dist > this.attackRange) {
            const tangent = new THREE.Vector3(-combined.z, 0, combined.x);
            const zz = Math.sin(time * 12 + this.zigZagPhase) * 2.0;
            combined.addScaledVector(tangent, zz);
            if (combined.lengthSq() > 0.001) combined.normalize();
            this._applyMove(combined, 1.1);
        } else {
            if (time - this.lastAttackTime > 0.7) {
                this.lastAttackTime = time;
                onAttack(this.damage);
            }
        }
    }

    _updateGunner(dt, time, dist, moveDir, sep, playerPos, spawnProjectile) {
        const combined = moveDir.clone().add(sep.multiplyScalar(0.3));
        if (combined.lengthSq() > 0.001) combined.normalize();
        
        if (dist > 22) {
            // Chase from far
            this._applyMove(combined, 1.1);
        } else if (dist < 7) {
            // Retreat to preferred shooting range
            this._applyMove(combined.negate(), 0.9);
        } else {
            // Optimal range: strafe and shoot
            const tangent = new THREE.Vector3(-combined.z, 0, combined.x).multiplyScalar(this.flankSide);
            this._applyMove(tangent.add(sep.multiplyScalar(0.4)), 0.7);
            this.body.velocity.x *= 0.9;
            this.body.velocity.z *= 0.9;
            
            // Gunner fires in bursts
            if (this.shootCooldown > 0) {
                this.shootCooldown -= dt;
            } else if (time - this.lastAttackTime > 1.8 && spawnProjectile) {
                this.lastAttackTime = time;
                this.soundManager.playLaser();
                
                // 3-round burst
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (!this.active || !spawnProjectile) return;
                        // Calculate physical offset of the gun muzzle to spawn projectiles from the gun instead of center
                        const muzzleOffset = new THREE.Vector3(0.35, 0.3, -1.0);
                        muzzleOffset.applyQuaternion(this.mesh.quaternion);
                        const spawnPos = this.mesh.position.clone().add(muzzleOffset);

                        const pDir = new THREE.Vector3().subVectors(playerPos, spawnPos).normalize();
                        // Add spread
                        pDir.x += (Math.random() - 0.5) * 0.08;
                        pDir.z += (Math.random() - 0.5) * 0.08;
                        pDir.normalize();
                        spawnProjectile(spawnPos, pDir, this.damage);
                    }, i * 150);
                }
                this.shootCooldown = 0.5;
                
                // Flip flank side occasionally
                if (Math.random() < 0.4) this.flankSide *= -1;
            }
        }
    }

    _updateBoss(dt, time, dist, moveDir, onAttack, spawnProjectile) {
        if (dist > this.attackRange) {
            // Replaced hardcoded dt with clamped equivalent for BOSS move
            this._applyMove(moveDir, 0.9);
        }
        if (time - this.lastAttackTime > 1.3) {
            this.lastAttackTime = time;
            this.soundManager.playLaser();
            const count = 12;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + (time % 4) * 1.5;
                const pDir = new THREE.Vector3(Math.cos(angle), 0.04, Math.sin(angle)).normalize();
                spawnProjectile(this.mesh.position, pDir, this.damage);
            }
        }
    }
}

// ─────────────────────────────────────────────────────────
//  ENEMY MANAGER
// ─────────────────────────────────────────────────────────
export class EnemyManager {
    constructor(world, scene, assetManager, soundManager, pathfinder, particles) {
        this.world = world;
        this.scene = scene;
        this.assetManager = assetManager;
        this.soundManager = soundManager;
        this.pathfinder = pathfinder;
        this.particles = particles;
        this.enemies = [];
        this.maxEnemies = 80;
        
        this.projectiles = [];
        this.camera = null; // Set by GameManager for kill text projection
        this.lastKillCombo = 0;

        // Spawn queue: process a few enemies per frame to avoid lag spikes
        this._spawnQueue = [];
        this.pendingSpawns = 0;

        // Shared Geometry and Material for Projectiles
        this.projGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6);
        this.projGeo.rotateX(Math.PI / 2);
        this.projMat = new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.95 });
        
        this.projGlowGeo = new THREE.CylinderGeometry(0.22, 0.22, 2.2, 6);
        this.projGlowGeo.rotateX(Math.PI / 2);
        this.projGlowMat = new THREE.MeshBasicMaterial({ color: 0xff4466, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });

        for (let i = 0; i < this.maxEnemies; i++) {
            this.enemies.push(new Enemy(world, scene, assetManager, soundManager, pathfinder, particles));
        }
    }

    setCamera(camera) {
        this.camera = camera;
    }

    spawnProjectile(position, direction, damage) {
        const mesh = new THREE.Mesh(this.projGeo, this.projMat);
        const glow = new THREE.Mesh(this.projGlowGeo, this.projGlowMat);
        mesh.add(glow);
        
        mesh.position.copy(position).addScaledVector(direction, 2.0);
        mesh.position.y += 1.0;
        mesh.lookAt(mesh.position.clone().add(direction));
        
        this.scene.add(mesh);
        this.soundManager.playLaser();
        
        this.projectiles.push({ mesh, direction: direction.clone(), speed: 60, damage, life: 3.5 });
    }

    // ─── Wave Spawning ────────────────────────────────────
    spawnWave(count, levelBounds, waveNumber = 1, playerPos = null) {
        let spawned = 0;
        const available = this.enemies.filter(e => !e.active);
        
        // Gentler scaling so player can survive past wave 2
        const healthMult = Math.pow(1.15, waveNumber - 1);
        const speedMult = Math.min(1.8, Math.pow(1.04, waveNumber - 1));
        
        // 4 corner spawn positions (far from center where player starts)
        const edge = levelBounds / 2 - 5;
        const corners = [
            { x: -edge, z: -edge },  // bottom-left
            { x:  edge, z: -edge },  // bottom-right
            { x: -edge, z:  edge },  // top-left
            { x:  edge, z:  edge },  // top-right
        ];
        
        let cornerIdx = 0;
        
        while (spawned < count && available.length > 0) {
            // Pick the next corner (cycles through all 4)
            const corner = corners[cornerIdx % 4];
            cornerIdx++;
            
            let squadSize = Math.min(
                Math.floor(Math.random() * 3) + 2,  // 2-4 per squad
                count - spawned,
                available.length
            );
            
            const squadType = this._pickSquadType(waveNumber);
            const spacing = 3.0;
            
            for (let i = 0; i < squadSize; i++) {
                const enemy = available.pop();
                if (!enemy) break;
                
                // Scatter around the corner point
                const ox = (Math.random() - 0.5) * spacing * 2;
                const oz = (Math.random() - 0.5) * spacing * 2;
                const sx = Math.max(-levelBounds/2 + 3, Math.min(levelBounds/2 - 3, corner.x + ox));
                const sz = Math.max(-levelBounds/2 + 3, Math.min(levelBounds/2 - 3, corner.z + oz));
                
                this._spawnQueue.push({
                    enemy, i, squadSize, formation: 'SCATTER',
                    cx: sx, cz: sz, dirX: 0, dirZ: 0, rightX: 0, rightZ: 0, spacing,
                    levelBounds, squadType, waveNumber,
                    healthMult, speedMult,
                    useDirectPos: true  // Flag to skip formation calc
                });
                this.pendingSpawns++;
                spawned++;
            }
        }
        
        // Boss every 5 waves
        if (waveNumber % 5 === 0) {
            const bossCount = waveNumber >= 10 ? 2 : 1;
            for (let b = 0; b < bossCount; b++) {
                const boss = available.pop();
                if (boss) {
                    const corner = corners[b % 4];
                    this._spawnQueue.push({
                        enemy: boss, isBoss: true,
                        bX: corner.x, bZ: corner.z, waveNumber,
                        healthMult, speedMult
                    });
                    this.pendingSpawns++;
                }
            }
        }
    }

    // Process a few queued spawns per frame to spread the load
    processSpawnQueue() {
        const SPAWNS_PER_FRAME = 3;
        let processed = 0;
        
        while (this._spawnQueue.length > 0 && processed < SPAWNS_PER_FRAME) {
            const data = this._spawnQueue.shift();
            this.pendingSpawns--;
            processed++;
            
            if (data.isBoss) {
                if (!data.enemy || !data.enemy.spawn) {
                    console.warn("Boss enemy data is missing! Preventing crash.");
                    continue; // Skip safely without crashing
                }
                const spawnX = data.bX !== undefined ? data.bX : 0;
                const spawnZ = data.bZ !== undefined ? data.bZ : 0;
                
                data.enemy.spawn(new CANNON.Vec3(spawnX, 2.5, spawnZ), 'BOSS');
                const waveMult = Math.pow(1.3, Math.max(0, (data.waveNumber || 5) / 5 - 1));
                data.enemy.maxHealth = 4000 * waveMult;
                data.enemy.health = data.enemy.maxHealth;
                data.enemy.speed = 3;
                data.enemy.updateHealthBar();
                continue;
            }
            
            const { enemy, i, squadSize, formation, cx, cz, dirX, dirZ, rightX, rightZ, spacing,
                    levelBounds, squadType, waveNumber, healthMult, speedMult, useDirectPos } = data;
            
            let sx, sz;
            
            if (useDirectPos) {
                // Corner spawn — position already computed
                sx = cx;
                sz = cz;
            } else {
                let ox = 0, oz = 0;
                if (formation === 'V') {
                    const row = Math.floor((i + 1) / 2), side = i % 2 === 0 ? 1 : -1;
                    if (i === 0) { ox = 0; oz = 0; }
                    else { ox = -dirX * row * spacing + rightX * side * row * spacing; oz = -dirZ * row * spacing + rightZ * side * row * spacing; }
                } else if (formation === 'LINE') {
                    const off = (i - (squadSize - 1) / 2) * spacing;
                    ox = rightX * off; oz = rightZ * off;
                } else if (formation === 'CIRCLE') {
                    const ca = (i / squadSize) * Math.PI * 2, r = spacing * 1.2;
                    ox = Math.cos(ca) * r; oz = Math.sin(ca) * r;
                } else {
                    ox = (Math.random() - 0.5) * spacing * 2.5;
                    oz = (Math.random() - 0.5) * spacing * 2.5;
                }
                sx = Math.max(-levelBounds/2 + 4, Math.min(levelBounds/2 - 4, cx + ox));
                sz = Math.max(-levelBounds/2 + 4, Math.min(levelBounds/2 - 4, cz + oz));
            }
            
            // Snap to walkable grid cell
            if (this.pathfinder) {
                const gp = this.pathfinder.worldToGrid(sx, sz);
                if (this.pathfinder.grid[gp.x] && this.pathfinder.grid[gp.x][gp.z] === 1) {
                    const near = this.pathfinder.findNearestWalkable(gp.x, gp.z);
                    if (near) { const wp = this.pathfinder.gridToWorld(near.x, near.z); sx = wp.x; sz = wp.z; }
                }
            }
            
            let typeOverride = squadType;
            if (i === 0 && Math.random() < 0.2 && waveNumber >= 2) {
                const elites = ['TANK', 'BRUTE', 'GUNNER'];
                typeOverride = elites[Math.floor(Math.random() * elites.length)];
            }
            
            const typeScale = ENEMY_TYPES[typeOverride]?.scale || 1.0;
            enemy.spawn(new CANNON.Vec3(sx, 1.0 * typeScale, sz), typeOverride);
            enemy.maxHealth = Math.floor(enemy.maxHealth * healthMult);
            enemy.health = enemy.maxHealth;
            enemy.speed *= speedMult;
            enemy.updateHealthBar();
        }
    }

    _pickSquadType(waveNumber) {
        if (waveNumber === 1) {
            // Wave 1: only CHASER and KAMIKAZE for learning
            return Math.random() < 0.7 ? 'CHASER' : 'KAMIKAZE';
        }
        
        const r = Math.random();
        if (waveNumber >= 8 && r < 0.12) return 'BRUTE';
        if (waveNumber >= 5 && r < 0.22) return 'TANK';
        if (waveNumber >= 3 && r < 0.35) return 'GUNNER';  // Shooters!
        if (r < 0.48) return 'SNIPER';
        if (r < 0.62) return 'KAMIKAZE';
        if (r < 0.73) return 'SWARMER';
        if (waveNumber >= 4 && r < 0.83) return 'TELEPORTER';
        return 'CHASER';
    }

    getActiveEnemies() {
        return this.enemies.filter(e => e.active);
    }

    update(dt, time, playerPos, onAttack, onKill, onExplosion) {
        // Drip-feed spawns from the queue (3 per frame)
        this.processSpawnQueue();
        
        const activeEnemies = this.getActiveEnemies();
        
        for (const enemy of this.enemies) {
            if (enemy.active) {
                const hadHealth = enemy.health > 0;
                enemy.update(dt, time, playerPos, onAttack, onExplosion,
                    (pos, dir, dmg) => this.spawnProjectile(pos, dir, dmg),
                    activeEnemies
                );
                
                // Kamikaze kill event
                if (hadHealth && enemy.health <= 0 && !enemy.active && enemy.type === 'KAMIKAZE') {
                    onKill(enemy.mesh ? enemy.mesh.position.clone() : null, 'KAMIKAZE');
                }
            }
        }
        
        // Projectile update
        const wallMeshes = (window.GAME && window.GAME.levelGenerator) ? window.GAME.levelGenerator.wallMeshes : [];
        const raycaster = new THREE.Raycaster();
        
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const moveDist = p.speed * dt;
            
            // Check wall collision first
            raycaster.set(p.mesh.position, p.direction);
            const intersects = raycaster.intersectObjects(wallMeshes, false);
            
            if (intersects.length > 0 && intersects[0].distance <= moveDist) {
                // Hit wall
                if (this.particles) this.particles.spawnHitSparks(intersects[0].point, p.direction.clone().negate(), 0xff0044, 4);
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }

            p.mesh.position.addScaledVector(p.direction, moveDist);
            p.life -= dt;
            
            const distToPlayer = p.mesh.position.distanceTo(new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z));
            if (distToPlayer < 1.5) {
                onAttack(p.damage);
                if (this.particles) this.particles.spawnHitSparks(p.mesh.position, p.direction.clone().negate(), 0xff0044, 5);
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            } else if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }

    // Called from GameManager when an enemy dies - to spawn kill text
    spawnKillText(worldPos, combo) {
        spawnKillText(worldPos, this.camera, this.scene, combo);
    }

    clearAll() {
        // Flush any pending spawn queue
        this._spawnQueue = [];
        this.pendingSpawns = 0;
        
        for (const enemy of this.enemies) {
            if (enemy.active) enemy.despawn();
        }
        for (const p of this.projectiles) this.scene.remove(p.mesh);
        this.projectiles = [];
    }
}
