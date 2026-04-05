import * as THREE from 'three';

export class AssetManager {
    constructor() {
        this.models = {};
        this.textures = {};
        this.textureLoader = new THREE.TextureLoader();
    }

    async loadAssets() {
        console.log("Assets loaded (procedural models used)");
        return Promise.resolve();
    }

    getGunPlaceholder() {
        const gunGroup = new THREE.Group();
        
        // Main body — sleek dark chassis
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.45);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a2e, roughness: 0.3, metalness: 0.7 
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        gunGroup.add(body);
        
        // Upper rail
        const railGeo = new THREE.BoxGeometry(0.06, 0.03, 0.35);
        const railMat = new THREE.MeshStandardMaterial({ 
            color: 0x252540, roughness: 0.2, metalness: 0.8 
        });
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(0, 0.075, -0.02);
        rail.castShadow = true;
        gunGroup.add(rail);
        
        // Barrel
        const barrelGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.35, 8);
        barrelGeo.rotateX(Math.PI / 2);
        const barrelMat = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a45, roughness: 0.2, metalness: 0.9 
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, 0.02, -0.35);
        barrel.castShadow = true;
        gunGroup.add(barrel);
        
        // Barrel tip (muzzle brake)
        const muzzleGeo = new THREE.CylinderGeometry(0.035, 0.025, 0.08, 8);
        muzzleGeo.rotateX(Math.PI / 2);
        const muzzleMat = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a30, roughness: 0.2, metalness: 0.9 
        });
        const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
        muzzle.position.set(0, 0.02, -0.5);
        gunGroup.add(muzzle);
        
        // Grip
        const gripGeo = new THREE.BoxGeometry(0.06, 0.14, 0.07);
        const gripMat = new THREE.MeshStandardMaterial({ 
            color: 0x0a0a15, roughness: 0.8, metalness: 0.1 
        });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.set(0, -0.1, 0.08);
        grip.rotation.x = Math.PI / 10;
        grip.castShadow = true;
        gunGroup.add(grip);
        
        // Scope/sight — holographic style
        const scopeGeo = new THREE.BoxGeometry(0.04, 0.045, 0.08);
        const scopeMat = new THREE.MeshStandardMaterial({ 
            color: 0x252540, roughness: 0.3, metalness: 0.8 
        });
        const scope = new THREE.Mesh(scopeGeo, scopeMat);
        scope.position.set(0, 0.105, 0.02);
        scope.castShadow = true;
        gunGroup.add(scope);
        
        // Glowing energy core — cyan
        const coreGeo = new THREE.BoxGeometry(0.05, 0.06, 0.18);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0, 0.02);
        gunGroup.add(core);
        
        // Side accent strips
        for (const side of [-1, 1]) {
            const stripGeo = new THREE.BoxGeometry(0.005, 0.03, 0.3);
            const stripMat = new THREE.MeshBasicMaterial({ 
                color: 0x00f0ff, transparent: true, opacity: 0.5 
            });
            const strip = new THREE.Mesh(stripGeo, stripMat);
            strip.position.set(side * 0.045, 0, -0.05);
            gunGroup.add(strip);
        }
        
        // Position relative to camera
        gunGroup.position.set(0.22, -0.2, -0.5);
        return gunGroup;
    }

    getEnemyModel(type) {
        switch (type) {
            case 'CHASER': return this.createChaserModel();
            case 'KAMIKAZE': return this.createKamikazeModel();
            case 'SNIPER': return this.createSniperModel();
            case 'TANK': return this.createTankModel();
            case 'TELEPORTER': return this.createTeleporterModel();
            case 'BRUTE': return this.createBruteModel();
            case 'SWARMER': return this.createSwarmerModel();
            case 'GUNNER': return this.createGunnerModel();
            case 'BOSS': return this.createBossModel();
            default: return this.createChaserModel();
        }
    }

    createChaserModel() {
        const group = new THREE.Group();
        
        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.8, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xff1744, roughness: 0.4, metalness: 0.5,
            emissive: new THREE.Color(0xcc0022), emissiveIntensity: 0.8
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        
        // Head/visor
        const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a50, roughness: 0.2, metalness: 0.8,
            emissive: new THREE.Color(0x110011), emissiveIntensity: 0.3
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.1; head.scale.set(1, 0.7, 0.8);
        group.add(head);
        
        // Eyes — bright glow
        const eyeGeo = new THREE.SphereGeometry(0.1, 6, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4455 });
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(side * 0.12, 1.15, -0.2);
            group.add(eye);
        }
        // Eye glow light
        const eyeLight = new THREE.PointLight(0xff2233, 0.6, 3);
        eyeLight.position.set(0, 1.1, -0.3);
        group.add(eyeLight);
        
        // Shoulder plates
        for (const side of [-1, 1]) {
            const plateGeo = new THREE.BoxGeometry(0.15, 0.3, 0.25);
            const plateMat = new THREE.MeshStandardMaterial({ 
                color: 0x550011, metalness: 0.7, roughness: 0.3,
                emissive: new THREE.Color(0x220008), emissiveIntensity: 0.5
            });
            const plate = new THREE.Mesh(plateGeo, plateMat);
            plate.position.set(side * 0.5, 0.5, 0);
            group.add(plate);
        }
        
        return group;
    }

    createKamikazeModel() {
        const group = new THREE.Group();
        
        // Spiky body
        const bodyGeo = new THREE.OctahedronGeometry(0.5, 0);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xff9900, roughness: 0.3, metalness: 0.4,
            emissive: new THREE.Color(0xcc4400), emissiveIntensity: 0.9
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);
        
        // Inner glow core
        const coreGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ 
            color: 0xffcc00, transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending
        });
        group.add(new THREE.Mesh(coreGeo, coreMat));
        
        // Spikes
        const spikeGeo = new THREE.ConeGeometry(0.08, 0.4, 4);
        const spikeMat = new THREE.MeshStandardMaterial({ 
            color: 0xff8800, metalness: 0.6, roughness: 0.3,
            emissive: new THREE.Color(0xcc4400), emissiveIntensity: 0.6
        });
        const spikePositions = [
            [0, 0.5, 0], [0, -0.5, 0],
            [0.5, 0, 0], [-0.5, 0, 0],
            [0, 0, 0.5], [0, 0, -0.5]
        ];
        for (const [x, y, z] of spikePositions) {
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.set(x * 1.2, y * 1.2, z * 1.2);
            spike.lookAt(0, 0, 0); spike.rotateX(Math.PI);
            group.add(spike);
        }
        
        const light = new THREE.PointLight(0xff8800, 1.2, 6);
        group.add(light);
        
        return group;
    }

    createSniperModel() {
        const group = new THREE.Group();
        
        // Tall thin body
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.35, 2.2, 6);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x0088cc, roughness: 0.3, metalness: 0.6,
            emissive: new THREE.Color(0x0044aa), emissiveIntensity: 0.7
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);
        
        // Scope head
        const headGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.5, 6);
        const headMat = new THREE.MeshStandardMaterial({ 
            color: 0x004488, metalness: 0.8, roughness: 0.2,
            emissive: new THREE.Color(0x002244), emissiveIntensity: 0.5
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.35;
        group.add(head);
        
        // Scope lens — glowing bright
        const lensGeo = new THREE.CircleGeometry(0.13, 8);
        const lensMat = new THREE.MeshBasicMaterial({ color: 0x00eeff });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, 1.4, -0.26);
        group.add(lens);
        const lensLight = new THREE.PointLight(0x00ccff, 0.8, 4);
        lensLight.position.set(0, 1.4, -0.4);
        group.add(lensLight);
        
        // Antenna
        const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
        const antennaMat = new THREE.MeshStandardMaterial({ 
            color: 0x0099ff, metalness: 0.9,
            emissive: new THREE.Color(0x004488), emissiveIntensity: 0.5
        });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.set(0, 1.8, 0);
        antenna.rotation.z = Math.PI / 8;
        group.add(antenna);
        
        return group;
    }

    createTankModel() {
        const group = new THREE.Group();
        
        // Massive body
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.6, 1.0);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x7c3aed, roughness: 0.5, metalness: 0.5,
            emissive: new THREE.Color(0x4400cc), emissiveIntensity: 0.6
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);
        
        const plateMat = new THREE.MeshStandardMaterial({ 
            color: 0x5522bb, metalness: 0.7, roughness: 0.3,
            emissive: new THREE.Color(0x220077), emissiveIntensity: 0.4
        });
        
        // Front plate
        const frontGeo = new THREE.BoxGeometry(1.3, 1.2, 0.15);
        const front = new THREE.Mesh(frontGeo, plateMat);
        front.position.set(0, 0.1, -0.55);
        group.add(front);
        
        // Shoulder guards
        for (const side of [-1, 1]) {
            const shoulderGeo = new THREE.BoxGeometry(0.3, 0.6, 0.8);
            const shoulder = new THREE.Mesh(shoulderGeo, plateMat);
            shoulder.position.set(side * 0.75, 0.3, 0);
            group.add(shoulder);
        }
        
        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
        const headMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a1a77, metalness: 0.8, roughness: 0.2,
            emissive: new THREE.Color(0x1a0055), emissiveIntensity: 0.4
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.0;
        group.add(head);
        
        // Visor slit — bright red
        const visorGeo = new THREE.BoxGeometry(0.4, 0.06, 0.05);
        const visorMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 1.0, -0.22);
        group.add(visor);
        
        // Glow light
        const tankLight = new THREE.PointLight(0x7700ff, 0.8, 5);
        tankLight.position.y = 0.5;
        group.add(tankLight);
        
        return group;
    }

    createBossModel() {
        const group = new THREE.Group();
        
        // Massive core body
        const bodyGeo = new THREE.BoxGeometry(2.5, 3.5, 2.5);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x111111, roughness: 0.8, metalness: 0.9,
            emissive: new THREE.Color(0x330000), emissiveIntensity: 0.5
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.75;
        body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        
        // Huge glowing mechanical eye
        const eyeGeo = new THREE.SphereGeometry(0.6, 16, 16);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(0, 2.5, -1.2);
        eye.scale.set(1.5, 0.4, 1);
        group.add(eye);
        
        // Bleeding eye light
        const eyeLight = new THREE.PointLight(0xff0000, 4, 15);
        eyeLight.position.set(0, 2.5, -1.5);
        group.add(eyeLight);

        // Armor plating chunks
        for (let x = -1; x <= 1; x+=2) {
            const pauldronGeo = new THREE.BoxGeometry(1, 1.5, 1.5);
            const pauldronMat = new THREE.MeshStandardMaterial({ 
                color: 0x333333, roughness: 0.5, metalness: 0.7 
            });
            const pauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
            pauldron.position.set(x * 1.5, 2.5, 0);
            pauldron.rotation.z = x * 0.2;
            group.add(pauldron);
        }

        group.scale.set(1.5, 1.5, 1.5); // Making it exceptionally huge
        return group;
    }

    createTeleporterModel() {
        const group = new THREE.Group();
        
        // Ethereal body
        const bodyGeo = new THREE.CylinderGeometry(0.35, 0.2, 1.8, 6);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xcc1177, roughness: 0.3, metalness: 0.5,
            transparent: true, opacity: 0.8,
            emissive: 0x440033, emissiveIntensity: 0.5
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);
        
        // Inner energy
        const coreGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ 
            color: 0xff44aa, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 0.5;
        group.add(core);
        
        // Floating rings
        for (let i = 0; i < 3; i++) {
            const ringGeo = new THREE.TorusGeometry(0.4 + i * 0.1, 0.02, 6, 16);
            const ringMat = new THREE.MeshBasicMaterial({ 
                color: 0xff00aa, transparent: true, opacity: 0.4 - i * 0.1
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = -0.3 + i * 0.6;
            ring.rotation.x = Math.PI / 2;
            ring.rotation.z = i * Math.PI / 3;
            group.add(ring);
        }
        
        // Point light
        const light = new THREE.PointLight(0xff00aa, 0.5, 6);
        group.add(light);
        
        return group;
    }

    createBruteModel() {
        const group = new THREE.Group();
        
        const bodyGeo = new THREE.BoxGeometry(1.6, 2.0, 1.2);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x880000, roughness: 0.7, metalness: 0.3,
            emissive: new THREE.Color(0x330000), emissiveIntensity: 0.6
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);
        
        // Heavy spikes on shoulders
        const spikeGeo = new THREE.ConeGeometry(0.2, 0.6, 4);
        const spikeMat = new THREE.MeshStandardMaterial({
            color: 0x222222, metalness: 0.9, roughness: 0.2
        });
        for (const side of [-1, 1]) {
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.set(side * 0.9, 1.0, 0);
            spike.rotation.z = side * -Math.PI / 4;
            group.add(spike);
        }
        
        // Massive glowing core
        const coreGeo = new THREE.BoxGeometry(0.8, 0.8, 1.3);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x111111, metalness: 0.8,
            emissive: new THREE.Color(0xff1111), emissiveIntensity: 1.0
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 0.2;
        group.add(core);

        const light = new THREE.PointLight(0xff0000, 1.5, 6);
        light.position.y = 0.2;
        group.add(light);
        
        return group;
    }

    createSwarmerModel() {
        const group = new THREE.Group();
        
        // Swift wedge
        const bodyGeo = new THREE.ConeGeometry(0.3, 1.0, 3);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ff88, roughness: 0.3, metalness: 0.8,
            emissive: new THREE.Color(0x008844), emissiveIntensity: 0.8
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI / 2; // Flat and long
        body.castShadow = true;
        group.add(body);
        
        // Glowing trail core
        const coreGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0, 0.3);
        group.add(core);

        const light = new THREE.PointLight(0x00ffaa, 0.5, 3);
        group.add(light);
        
        return group;
    }

    createGunnerModel() {
        const group = new THREE.Group();
        
        // Stocky body
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.45, 1.6, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xccaa00, roughness: 0.4, metalness: 0.6,
            emissive: new THREE.Color(0x665500), emissiveIntensity: 0.7
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);
        
        // Head with scope
        const headGeo = new THREE.BoxGeometry(0.4, 0.3, 0.35);
        const headMat = new THREE.MeshStandardMaterial({ 
            color: 0x998800, metalness: 0.8, roughness: 0.2,
            emissive: new THREE.Color(0x443300), emissiveIntensity: 0.4
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.05;
        group.add(head);
        
        // Scope lens — glowing
        const lensGeo = new THREE.CircleGeometry(0.1, 8);
        const lensMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, 1.1, -0.18);
        group.add(lens);
        
        // Gun arm (right side)
        const armGeo = new THREE.CylinderGeometry(0.08, 0.06, 1.2, 6);
        armGeo.rotateX(Math.PI / 2);
        const armMat = new THREE.MeshStandardMaterial({ 
            color: 0x555555, metalness: 0.9, roughness: 0.2
        });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(0.35, 0.3, -0.4);
        group.add(arm);
        
        // Muzzle tip glow
        const muzzleGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
        const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
        muzzle.position.set(0.35, 0.3, -1.0);
        group.add(muzzle);
        
        // Shoulder plates
        for (const side of [-1, 1]) {
            const plateGeo = new THREE.BoxGeometry(0.12, 0.25, 0.2);
            const plateMat = new THREE.MeshStandardMaterial({ 
                color: 0xaa8800, metalness: 0.6, roughness: 0.3,
                emissive: new THREE.Color(0x553300), emissiveIntensity: 0.4
            });
            const plate = new THREE.Mesh(plateGeo, plateMat);
            plate.position.set(side * 0.45, 0.5, 0);
            group.add(plate);
        }
        
        // Glow light
        const light = new THREE.PointLight(0xffcc00, 0.6, 4);
        light.position.set(0, 0.5, -0.3);
        group.add(light);
        
        return group;
    }

    // Legacy compatibility
    getEnemyPlaceholder() {
        return this.createChaserModel();
    }
}
