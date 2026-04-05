import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { WeaponSystem } from './WeaponSystem.js';

export class PlayerController {
    constructor(camera, world, scene, assetManager, soundManager, particles) {
        this.camera = camera;
        this.world = world;
        this.scene = scene;
        this.soundManager = soundManager;
        this.particles = particles;
        
        // Stats
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.speed = 15;
        this.jumpForce = 15;
        this.dashForce = 45;
        this.dashCooldown = 2;
        this.lastDashTime = -this.dashCooldown;
        this.maxJumps = 2;
        this.jumpsLeft = 2;
        this.isDashing = false;
        this.dashDirection = new THREE.Vector3();
        this.invulnerableTimer = 0;
        
        // Upgrades
        this.regenRate = 0;
        this.healOnKill = 0;
        this.hasShield = false;
        this.shieldCooldown = 0;
        this.shieldTimer = 0;
        
        // Camera FX
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        this.baseFov = 80;
        this.currentFov = 80;
        this.targetFov = 80;
        this.cameraTilt = 0;
        this.targetCameraTilt = 0;
        
        // Dash slash timing
        this.dashSlashPending = false;
        this.dashSlashTime = 0;
        this.DASH_SLASH_DELAY = 0.12; // 120ms after dash to check for hits
        
        // Movement smoothing
        this.velocityTarget = new THREE.Vector3();
        this.velocityLerp = 0.25;
        
        // Dash afterimage
        this.dashTrailMeshes = [];
        
        this.weapon = new WeaponSystem(camera, scene, assetManager, soundManager, particles);
        
        this.setupPhysics();
        this.setupControls();
        this._setupDashOverlay();
    }

    _setupDashOverlay() {
        // Screen-space dash afterimage overlay
        this.dashOverlay = document.createElement('div');
        this.dashOverlay.style.cssText = `
            position: fixed; inset: 0; pointer-events: none; z-index: 900;
            background: linear-gradient(135deg, rgba(0,240,255,0) 0%, rgba(0,240,255,0.18) 50%, rgba(0,240,255,0) 100%);
            opacity: 0; transition: opacity 0.05s;
            mix-blend-mode: screen;
        `;
        document.body.appendChild(this.dashOverlay);
        
        // Dash streak lines
        this.dashStreaks = document.createElement('div');
        this.dashStreaks.style.cssText = `
            position: fixed; inset: 0; pointer-events: none; z-index: 899;
            opacity: 0; overflow: hidden;
        `;
        document.body.appendChild(this.dashStreaks);
        for (let i = 0; i < 8; i++) {
            const streak = document.createElement('div');
            streak.style.cssText = `
                position: absolute;
                height: ${1 + Math.random()}px;
                background: linear-gradient(90deg, transparent, rgba(0,240,255,0.9), transparent);
                top: ${Math.random() * 100}%;
                left: 0; right: 0;
                transform: scaleX(0);
            `;
            this.dashStreaks.appendChild(streak);
        }
    }

    reset() {
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.speed = 15;
        this.jumpForce = 15;
        this.dashForce = 45;
        this.dashCooldown = 2;
        this.lastDashTime = -this.dashCooldown;
        this.maxJumps = 2;
        this.jumpsLeft = 2;
        this.isDashing = false;
        this.invulnerableTimer = 0;
        this.regenRate = 0;
        this.healOnKill = 0;
        this.hasShield = false;
        this.shieldCooldown = 0;
        this.shieldTimer = 0;
        this.dashSlashPending = false;
        this.currentFov = this.baseFov;
        this.targetFov = this.baseFov;
        this.cameraTilt = 0;
        
        this.weapon.setProfile('AK47');
        this.weapon.clearAmmoPacks();
        
        this.body.position.set(0, 5, 0);
        this.body.velocity.set(0, 0, 0);
    }

    setupPhysics() {
        const radius = 0.75;
        const shape = new CANNON.Sphere(radius);
        
        this.body = new CANNON.Body({
            mass: 70,
            material: new CANNON.Material({ friction: 0, restitution: 0 }),
            fixedRotation: true,
            allowSleep: false
        });
        
        this.body.addShape(shape);
        this.body.position.set(0, 5, 0);
        this.world.addBody(this.body);

        this.isGrounded = false;
        this.body.addEventListener("collide", (e) => {
            const contact = e.contact;
            let normal;
            if (contact.bi === this.body) {
                normal = contact.ni;
            } else {
                normal = contact.ni.negate(new CANNON.Vec3());
            }
            if (normal.y > 0.1) {
                this.isGrounded = true;
                this.jumpsLeft = this.maxJumps;
            }
        });
    }

    setupControls() {
        this.keys = { w: false, a: false, s: false, d: false, shift: false };
        this.mouseDelta = new THREE.Vector2(0, 0);
        this.pitchObject = new THREE.Object3D();
        this.yawObject = new THREE.Object3D();
        this.yawObject.add(this.pitchObject);
        this.pitchObject.add(this.camera);
        this.scene.add(this.yawObject);

        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.isAiming = false;
        this.isShooting = false;
        
        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === document.body) {
                if (e.button === 0) this.isShooting = true;
                if (e.button === 2) this.isAiming = true;
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isShooting = false;
            if (e.button === 2) this.isAiming = false;
        });
        
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onKeyDown(e) {
        const code = e.code || '';
        const key = e.key ? e.key.toLowerCase() : '';
        if (code === 'KeyW' || key === 'w' || key === 'arrowup') this.keys.w = true;
        if (code === 'KeyA' || key === 'a' || key === 'arrowleft') this.keys.a = true;
        if (code === 'KeyS' || key === 's' || key === 'arrowdown') this.keys.s = true;
        if (code === 'KeyD' || key === 'd' || key === 'arrowright') this.keys.d = true;
        if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') { 
            if (!this.keys.shift) this.dash(); 
            this.keys.shift = true; 
        }
        if (code === 'Space' || key === ' ') { e.preventDefault(); this.jump(); }
        if (code === 'KeyR' || key === 'r') this.weapon.reload();
    }

    onKeyUp(e) {
        const code = e.code || '';
        const key = e.key ? e.key.toLowerCase() : '';
        if (code === 'KeyW' || key === 'w' || key === 'arrowup') this.keys.w = false;
        if (code === 'KeyA' || key === 'a' || key === 'arrowleft') this.keys.a = false;
        if (code === 'KeyS' || key === 's' || key === 'arrowdown') this.keys.s = false;
        if (code === 'KeyD' || key === 'd' || key === 'arrowright') this.keys.d = false;
        if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') this.keys.shift = false;
    }

    onMouseMove(e) {
        if (document.pointerLockElement !== document.body) return;
        
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;
        const sensitivity = 0.0022;

        this.yawObject.rotation.y -= movementX * sensitivity;
        this.pitchObject.rotation.x -= movementY * sensitivity;
        
        this.mouseDelta.x += movementX;
        this.mouseDelta.y += movementY;
        
        this.pitchObject.rotation.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitchObject.rotation.x));
    }

    jump() {
        if (this.jumpsLeft > 0) {
            this.body.velocity.y = this.jumpForce;
            this.jumpsLeft--;
            this.isGrounded = false;
            this.soundManager.playJump();
            
            // Small FOV pulse on jump
            if (this.jumpsLeft < this.maxJumps - 1) {
                this.targetFov = this.baseFov + 8;
                setTimeout(() => { this.targetFov = this.baseFov; }, 200);
            }
        }
    }

    dash() {
        const time = performance.now() / 1000;
        if (time - this.lastDashTime >= this.dashCooldown) {
            this.lastDashTime = time;
            
            const dir = new THREE.Vector3();
            if (this.keys.w) dir.z -= 1;
            if (this.keys.s) dir.z += 1;
            if (this.keys.a) dir.x -= 1;
            if (this.keys.d) dir.x += 1;
            
            if (dir.lengthSq() === 0) dir.z = -1; // Default: forward dash
            
            dir.normalize();
            dir.applyQuaternion(this.yawObject.quaternion);
            dir.y = 0;
            dir.normalize();
            
            this.dashDirection.copy(dir);
            
            // Apply explosive velocity
            this.body.velocity.x = dir.x * this.dashForce;
            this.body.velocity.z = dir.z * this.dashForce;
            this.body.velocity.y = Math.max(this.body.velocity.y, 2);
            
            this.soundManager.playDash();
            
            this.isDashing = true;
            this.invulnerableTimer = Math.max(this.invulnerableTimer, 0.35); // Dash i-frames
            
            // === DASH SCREEN FX ===
            this._playDashScreenFX(dir);
            
            // === FOV PUNCH ===
            this.targetFov = this.baseFov + 22;
            
            // Spawn dash trail particles
            if (this.particles) {
                for (let i = 0; i < 8; i++) {
                    setTimeout(() => {
                        if (this.particles) this.particles.spawnDashTrail(this.body.position);
                    }, i * 25);
                }
            }
            
            // Schedule continuous dash logic
            this.dashSlicedEnemies = new Set();
            
            setTimeout(() => { 
                this.isDashing = false;
                this.targetFov = this.baseFov;
            }, 250);
        }
    }

    _playDashScreenFX(dir) {
        // Flash the overlay
        if (this.dashOverlay) {
            this.dashOverlay.style.opacity = '1';
            setTimeout(() => { this.dashOverlay.style.opacity = '0'; }, 80);
        }
        
        // Animate streak lines
        if (this.dashStreaks) {
            this.dashStreaks.style.opacity = '1';
            const streaks = this.dashStreaks.querySelectorAll('div');
            streaks.forEach((s, i) => {
                s.style.transform = 'scaleX(0)';
                setTimeout(() => {
                    s.style.transition = `transform ${60 + i * 10}ms ease-out`;
                    s.style.transform = 'scaleX(1)';
                    setTimeout(() => {
                        s.style.transition = `transform 80ms ease-in, opacity 80ms`;
                        s.style.opacity = '0';
                        setTimeout(() => { 
                            s.style.opacity = '1';
                            s.style.transform = 'scaleX(0)';
                        }, 80);
                    }, 60 + i * 10);
                }, i * 8);
            });
            setTimeout(() => { this.dashStreaks.style.opacity = '0'; }, 250);
        }
    }

    performContinuousDashSlash(enemies, onKill, onHitMarker) {
        let hitSomeone = false;
        const slashRadius = 6.0; // Slightly larger for reliable dash hits
        const baseDamage = 250; 
        
        const dashDir = this.dashDirection.clone();
        if (dashDir.lengthSq() < 0.001) {
            this.camera.getWorldDirection(dashDir);
            dashDir.y = 0;
            dashDir.normalize();
        }

        for (const enemy of enemies) {
            if (!enemy.active) continue;
            if (this.dashSlicedEnemies.has(enemy)) continue;
            
            const dist = this.body.position.distanceTo(enemy.mesh.position);
            if (dist < slashRadius) {
                // If enemy is close enough during dash, they get hit! No angle check needed for a full-body dash attack.
                this.dashSlicedEnemies.add(enemy);
                const died = enemy.takeDamage(baseDamage, dashDir);
                
                if (enemy.body) {
                    enemy.body.velocity.x += dashDir.x * 35;
                    enemy.body.velocity.z += dashDir.z * 35;
                    enemy.body.velocity.y += 10;
                }

                if (this.particles) {
                    this.particles.spawnExplosion(enemy.mesh.position, 0x00ffff, 15);
                    this.particles.spawnHitSparks(enemy.mesh.position, dashDir.clone().negate(), 0xffdd00, 15);
                    this.particles.spawnSwordSlash(enemy.mesh.position, dashDir, 0x00ffff);
                }
                
                hitSomeone = true;
                if (died && onKill) {
                    onKill(enemy.mesh.position.clone(), enemy.type);
                }
            }
        }
        
        if (hitSomeone && onHitMarker) {
            onHitMarker(true, false);
            this.soundManager.playShoot();
            this.triggerScreenShake(0.7, 0.35);
        }
    }

    takeDamage(amount) {
        if (this.isDashing || this.invulnerableTimer > 0) return false;
        
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        this.invulnerableTimer = 0.3;
        this.soundManager.playPlayerHit();
        this.triggerScreenShake(0.35, 0.25);
        return this.health <= 0;
    }

    triggerScreenShake(intensity, duration) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeTime = Math.max(this.shakeTime, duration);
    }

    update(dt, time, enemies, onKill, onHitMarker) {
        this.body.wakeUp();

        // Dash slash disabled — dash is for movement/evasion only
        // if (this.isDashing) {
        //     this.performContinuousDashSlash(enemies, onKill, onHitMarker);
        // }

        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= dt;
        }

        // === MOVEMENT ===
        const input = new THREE.Vector3();
        if (this.keys.w) input.z -= 1;
        if (this.keys.s) input.z += 1;
        if (this.keys.a) input.x -= 1;
        if (this.keys.d) input.x += 1;
        
        const isSprinting = input.z < 0 && !this.keys.s; // Forward = sprint feel
        
        if (input.lengthSq() > 0) {
            input.normalize();
        }
        input.applyQuaternion(this.yawObject.quaternion);
        
        const isMoving = input.lengthSq() > 0;
        const currentSpeed = this.isGrounded ? this.speed : this.speed * 0.75;
        
        if (!this.isDashing) {
            if (isMoving) {
                // Smooth velocity approach for responsive but not twitchy movement
                const targetVX = input.x * currentSpeed;
                const targetVZ = input.z * currentSpeed;
                const factor = Math.min(1.0, dt * 20); // Scale factor for ~0.35 at 60fps
                this.body.velocity.x += (targetVX - this.body.velocity.x) * factor;
                this.body.velocity.z += (targetVZ - this.body.velocity.z) * factor;
            } else {
                const decay = Math.max(0, 1.0 - dt * 25);
                this.body.velocity.x *= decay;
                this.body.velocity.z *= decay;
            }
            
            // Camera tilt while strafing
            if (this.keys.a && !this.keys.d) this.targetCameraTilt = 0.03;
            else if (this.keys.d && !this.keys.a) this.targetCameraTilt = -0.03;
            else this.targetCameraTilt = 0;
        } else {
            // During dash, add slight tilt based on dash direction
            this.targetCameraTilt = -this.dashDirection.x * 0.06;
        }
        
        // Smooth camera tilt
        this.cameraTilt += (this.targetCameraTilt - this.cameraTilt) * Math.min(1.0, dt * 10);
        this.pitchObject.rotation.z = this.cameraTilt;
        
        // FOV interpolation
        this.currentFov += (this.targetFov - this.currentFov) * Math.min(1.0, dt * 12);
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();

        // Sync camera with physics body
        const pos = this.body.interpolatedPosition || this.body.position;
        this.yawObject.position.set(pos.x, pos.y + 0.75, pos.z);
        
        // Screen shake
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeZ = (Math.random() - 0.5) * this.shakeIntensity;
            this.yawObject.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
            this.shakeIntensity *= 0.82;
        }

        // Weapon update
        this.weapon.update(dt, time, this.body.velocity, this.isGrounded, this.isAiming, this.mouseDelta);
        this.mouseDelta.set(0, 0);
        
        if (this.isShooting) {
            const result = this.weapon.shoot(enemies, time);
            if (result) {
                if (result.hit) {
                    onHitMarker(true, result.died);
                }
                if (result.died && onKill) {
                    onKill(result.enemyPos, result.enemyType);
                }
            }
        }

        // Reset grounded state
        if (Math.abs(this.body.velocity.y) > 0.5) {
            this.isGrounded = false;
        }
    }
}
