import * as THREE from 'three';

export class WeaponSystem {
    constructor(camera, scene, assetManager, soundManager, particles) {
        this.camera = camera;
        this.scene = scene;
        this.soundManager = soundManager;
        this.particles = particles;
        
        this.fireRate = 0.12;
        this.lastFireTime = 0;
        this.maxAmmo = 30;
        this.ammo = this.maxAmmo;
        this.reloading = false;
        this.pickingUpAmmo = false;
        this.reloadTime = 1.5;
        this.damage = 25;
        this.aoeRadius = 0;
        this.piercing = false;
        this.pellets = 1;
        this.spread = 0;
        this.recoilKick = {z: 0.12, y: 0.04, x: 0.08};
        this.currentWeapon = 'AK47';
        
        this.setProfile('AK47');
        
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 150;
        this.center = new THREE.Vector2(0, 0);

        // Weapon Sway & Bob
        this.weaponContainer = new THREE.Group();
        this.camera.add(this.weaponContainer);
        
        this.weaponMesh = assetManager.getGunPlaceholder();
        this.weaponContainer.add(this.weaponMesh);
        
        this.hipPosition = this.weaponMesh.position.clone();
        this.aimPosition = new THREE.Vector3(0, -0.12, -0.3);
        this.currentBasePosition = this.hipPosition.clone();
        
        this.recoilOffset = new THREE.Vector3();
        this.targetRotationX = 0;
        this.currentRotationX = 0;
        
        this.bobTime = 0;
        this.currentSway = new THREE.Vector3();
        this.targetSway = new THREE.Vector3();
        
        // Muzzle flash
        const flashGeo = new THREE.PlaneGeometry(0.6, 0.6);
        const flashMat = new THREE.MeshBasicMaterial({ 
            color: 0x00f0ff, 
            transparent: true, 
            opacity: 0, 
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
        this.muzzleFlash.position.set(0, 0.02, -0.5);
        this.weaponMesh.add(this.muzzleFlash);
        
        this.flashLight = new THREE.PointLight(0x00f0ff, 0, 6);
        this.weaponMesh.add(this.flashLight);
        
        // Shared Ammo Pack Geometry/Materials
        this.ammoGeo = new THREE.BoxGeometry(0.35, 0.2, 0.35);
        this.ammoMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ff88, emissive: 0x00aa55, emissiveIntensity: 0.5,
            metalness: 0.3, roughness: 0.4
        });
        
        this.ringGeo = new THREE.RingGeometry(0.3, 0.5, 16);
        this.ringMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ff88, transparent: true, opacity: 0.3,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending 
        });

        // Ammo Packs
        this.ammoPacks = [];
    }

    setProfile(weaponName) {
        this.currentWeapon = weaponName;
        this.aoeRadius = 0; // Reset explosive rounds upgrade
        switch (weaponName) {
            case 'AK47':
                this.fireRate = 0.12;
                this.maxAmmo = 30;
                this.damage = 25;
                this.piercing = false;
                this.pellets = 1;
                this.spread = 0;
                this.recoilKick = {z: 0.12, y: 0.04, x: 0.08};
                break;
            case 'SHOTGUN':
                this.fireRate = 0.7;
                this.maxAmmo = 8;
                this.damage = 18; // Per pellet
                this.piercing = false;
                this.pellets = 8;
                this.spread = 0.12;
                this.recoilKick = {z: 0.4, y: 0.15, x: 0.3};
                break;
            case 'DEAGLE':
                this.fireRate = 0.4;
                this.maxAmmo = 7;
                this.damage = 80;
                this.piercing = true;
                this.pellets = 1;
                this.spread = 0;
                this.recoilKick = {z: 0.3, y: 0.2, x: 0.4};
                break;
            case 'SNIPER':
                this.fireRate = 1.2;
                this.maxAmmo = 5;
                this.damage = 250;
                this.piercing = true;
                this.pellets = 1;
                this.spread = 0;
                this.recoilKick = {z: 0.6, y: 0.25, x: 0.5};
                break;
        }
        this.ammo = this.maxAmmo;
        this.reloading = false;
    }

    update(dt, time, velocity, isGrounded, isAiming, mouseDelta) {
        const targetPos = isAiming ? this.aimPosition : this.hipPosition;
        this.currentBasePosition.lerp(targetPos, dt * 15);

        const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        const bobMultiplier = isAiming ? 0.15 : 1.0;
        
        if (isGrounded && speed > 0.1) {
            this.bobTime += dt * speed * 1.5;
        } else {
            this.bobTime += (0 - this.bobTime) * dt * 5;
        }

        const bobAmplitude = 0.0015 * bobMultiplier;
        const bobY = Math.sin(this.bobTime * 2) * bobAmplitude * speed;
        const bobX = Math.cos(this.bobTime) * bobAmplitude * speed;

        const maxSway = 0.05;
        const swaySensitivity = 0.0005 * bobMultiplier;
        
        this.targetSway.x = THREE.MathUtils.clamp(-mouseDelta.x * swaySensitivity, -maxSway, maxSway);
        this.targetSway.y = THREE.MathUtils.clamp(mouseDelta.y * swaySensitivity, -maxSway, maxSway);
        this.targetSway.y += THREE.MathUtils.clamp(-velocity.y * 0.002 * bobMultiplier, -maxSway, maxSway);

        this.currentSway.lerp(this.targetSway, dt * 10);

        // Smooth recoil recovery
        this.recoilOffset.lerp(new THREE.Vector3(), dt * 12);
        
        // Smooth reload rotation
        this.targetRotationX = this.reloading ? -Math.PI / 4 : 0;
        this.currentRotationX += (this.targetRotationX - this.currentRotationX) * dt * 12;
        
        // Apply rotations
        this.weaponMesh.rotation.x = this.currentRotationX;
        this.weaponMesh.rotation.y = this.currentSway.x * 1.5;
        this.weaponMesh.rotation.z = -this.currentSway.x * 0.5;

        // Apply positions
        this.weaponMesh.position.copy(this.currentBasePosition);
        this.weaponMesh.position.x += bobX + this.currentSway.x;
        this.weaponMesh.position.y += bobY + this.currentSway.y;
        this.weaponMesh.position.add(this.recoilOffset);

        // Muzzle flash fade
        if (this.muzzleFlash.material.opacity > 0) {
            this.muzzleFlash.material.opacity -= dt * 12;
            this.flashLight.intensity -= dt * 25;
        }
    }

    shoot(enemies, time) {
        if (this.reloading || this.pickingUpAmmo || this.ammo <= 0 || time - this.lastFireTime < this.fireRate) return null;
        
        this.ammo--;
        this.lastFireTime = time;
        this.soundManager.playShoot();
        
        // Auto-reload when empty
        if (this.ammo <= 0) {
            setTimeout(() => this.reload(), 300);
        }
        
        // Muzzle flash
        this.muzzleFlash.material.opacity = 1;
        this.muzzleFlash.rotation.z = Math.random() * Math.PI;
        const flashScale = (this.currentWeapon === 'DEAGLE' || this.currentWeapon === 'SNIPER') ? 1.5 : (0.7 + Math.random() * 0.5);
        this.muzzleFlash.scale.set(flashScale, flashScale, flashScale);
        this.flashLight.intensity = (this.currentWeapon === 'DEAGLE' || this.currentWeapon === 'SNIPER') ? 6 : 3;
        
        // Dynamic Recoil
        this.recoilOffset.z += this.recoilKick.z;
        this.recoilOffset.y += this.recoilKick.y;
        this.currentRotationX += this.recoilKick.x;

        let result = { hit: false, died: false, enemyPos: null, enemyType: null };

        // Raycast logic with multiple pellets
        for (let i = 0; i < this.pellets; i++) {
            this.raycaster.setFromCamera(this.center, this.camera);
            
            // Apply spread if needed (for shotgun)
            if (this.spread > 0) {
                const spreadDir = new THREE.Vector3(
                    (Math.random() - 0.5) * this.spread,
                    (Math.random() - 0.5) * this.spread,
                    (Math.random() - 0.5) * this.spread
                );
                this.raycaster.ray.direction.add(spreadDir).normalize();
            }

            const enemyMeshes = enemies.map(e => e.mesh);
            const wallMeshes = (window.GAME && window.GAME.levelGenerator) ? window.GAME.levelGenerator.wallMeshes : [];
            const intersects = this.raycaster.intersectObjects([...enemyMeshes, ...wallMeshes], true);
            
            if (intersects.length > 0) {
                const processedEnemies = new Set();
                
                for (const hit of intersects) {
                    let hitEnemy = null;
                    let currentObj = hit.object;
                    
                    // Check if it's a wall
                    let checkObj = currentObj;
                    let hitWall = false;
                    while (checkObj) {
                        if (checkObj.userData.isWall) { hitWall = true; break; }
                        checkObj = checkObj.parent;
                    }
                    if (hitWall) {
                        // Spawn simple wall hit spark and stop pellet
                        if (this.particles) this.particles.spawnHitSparks(hit.point, hit.face ? hit.face.normal.clone() : this.raycaster.ray.direction.clone().negate(), 0xaaaaaa, 3);
                        break; 
                    }

                    while (currentObj && !hitEnemy) {
                        hitEnemy = enemies.find(e => e.mesh === currentObj);
                        currentObj = currentObj.parent;
                    }
                    
                    if (hitEnemy && !processedEnemies.has(hitEnemy)) {
                        processedEnemies.add(hitEnemy);
                        
                        // Headshot calculation
                        const relativeY = hit.point.y - hitEnemy.mesh.position.y;
                        let isHeadshot = false;
                        if (relativeY >= 0.8) {
                            isHeadshot = true;
                            if (window.GAME) window.GAME.stats.headshots++;
                        } else {
                            if (window.GAME) window.GAME.stats.bodyshots++;
                        }
                        
                        // Headshot deals bonus damage (1.5x)
                        const dmgMultiplier = isHeadshot ? 1.5 : 1.0;
                        const died = hitEnemy.takeDamage(this.damage * dmgMultiplier, this.raycaster.ray.direction);
                        
                        if (this.particles) {
                            const hitNormal = hit.face ? hit.face.normal.clone() : this.raycaster.ray.direction.clone().negate();
                            // Headshot sparks are orange, bodyshots are yellow
                            const sparkColor = isHeadshot ? 0xff4400 : 0xffdd00;
                            this.particles.spawnHitSparks(hit.point, hitNormal, sparkColor, isHeadshot ? 8 : 6);
                        }
                        
                        result.hit = true;
                        if (died) {
                            result.died = true;
                            result.enemyPos = hitEnemy.mesh.position.clone();
                            result.enemyType = hitEnemy.type;
                        }
                        
                        // AoE damage
                        if (this.aoeRadius > 0) {
                            for (const other of enemies) {
                                if (other !== hitEnemy && other.active) {
                                    const dist = other.mesh.position.distanceTo(hit.point);
                                    if (dist < this.aoeRadius) {
                                        const aoeDmg = (this.damage * dmgMultiplier) * (1 - dist / this.aoeRadius) * 0.5;
                                        const aoeDir = new THREE.Vector3().subVectors(other.mesh.position, hit.point).normalize();
                                        other.takeDamage(aoeDmg, aoeDir);
                                    }
                                }
                            }
                        }
                        
                        if (!this.piercing) break; // Only hit first enemy unless piercing
                    }
                }
            }
            
            // Bullet tracer per pellet
            this.createTracer(this.raycaster.ray.origin, 
                intersects.length > 0 ? intersects[0].point : 
                this.raycaster.ray.origin.clone().addScaledVector(this.raycaster.ray.direction, 100)
            );
        }
        
        return result;
    }

    createTracer(start, end) {
        const material = new THREE.LineBasicMaterial({ 
            color: 0x00f0ff, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending 
        });
        const points = [start.clone(), end.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        
        let opacity = 0.6;
        const fade = setInterval(() => {
            opacity -= 0.15;
            material.opacity = opacity;
            if (opacity <= 0) {
                clearInterval(fade);
                this.scene.remove(line);
                geometry.dispose();
                material.dispose();
            }
        }, 16);
    }

    reload() {
        if (this.reloading || this.pickingUpAmmo || this.ammo === this.maxAmmo) return;
        this.reloading = true;
        this.soundManager.playReload();
        
        setTimeout(() => {
            this.ammo = this.maxAmmo;
            this.reloading = false;
        }, this.reloadTime * 1000);
    }

    pickupAmmo(amount) {
        if (this.ammo === this.maxAmmo || this.reloading || this.pickingUpAmmo) return false;
        
        this.pickingUpAmmo = true;
        
        this.recoilOffset.y -= 0.1;
        this.currentRotationX -= 0.15;
        
        // Emissive flash
        this.weaponMesh.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
                const mat = child.material;
                if (!mat.userData) mat.userData = {};
                mat.userData.originalEmissive = mat.emissive.getHex();
                mat.emissive.setHex(0x00ff88);
                setTimeout(() => {
                    if (mat && mat.emissive) {
                        mat.emissive.setHex(mat.userData.originalEmissive || 0x000000);
                    }
                }, 200);
            }
        });
        
        setTimeout(() => {
            this.ammo = Math.min(this.ammo + amount, this.maxAmmo);
            this.pickingUpAmmo = false;
            this.soundManager.playPickup();
        }, 300);
        
        return true;
    }

    spawnAmmoPack(position) {
        const group = new THREE.Group();
        
        // Main box
        const box = new THREE.Mesh(this.ammoGeo, this.ammoMat);
        box.castShadow = true;
        group.add(box);
        
        // Glow ring
        const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.1;
        group.add(ring);
        
        // Removed dynamic PointLight to conserve WebGL light limits.
        // It already glows via emissive and ring.
        
        group.position.copy(position);
        group.position.y = 0.3;
        
        this.scene.add(group);
        
        this.ammoPacks.push({
            mesh: group,
            life: 15.0,
            rotationSpeed: 2.0,
            bobPhase: Math.random() * Math.PI * 2
        });
    }

    clearAmmoPacks() {
        for (const pack of this.ammoPacks) {
            this.scene.remove(pack.mesh);
        }
        this.ammoPacks = [];
    }

    updateAmmoPacks(dt, playerPos) {
        for (let i = this.ammoPacks.length - 1; i >= 0; i--) {
            const pack = this.ammoPacks[i];
            pack.life -= dt;
            
            pack.mesh.rotation.y += pack.rotationSpeed * dt;
            pack.mesh.position.y = 0.3 + Math.sin(pack.life * 4 + pack.bobPhase) * 0.1;
            
            // Pulse effect near death
            if (pack.life < 3) {
                const pulse = Math.sin(pack.life * 10) * 0.5 + 0.5;
                const mainMesh = pack.mesh.children[0];
                if (mainMesh && mainMesh.material) {
                    mainMesh.material.emissiveIntensity = 0.3 + pulse * 0.7;
                }
            }
            
            const dist = pack.mesh.position.distanceTo(playerPos);
            if (dist < 1.8) {
                if (this.pickupAmmo(10)) {
                    this.scene.remove(pack.mesh);
                    this.ammoPacks.splice(i, 1);
                }
                continue;
            }
            
            if (pack.life <= 0) {
                this.scene.remove(pack.mesh);
                this.ammoPacks.splice(i, 1);
            }
        }
    }
}
