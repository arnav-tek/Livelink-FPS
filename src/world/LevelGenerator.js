import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Pathfinder } from '../ai/Pathfinder.js';

export class LevelGenerator {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;
        this.size = 50;
        this.pathfinder = new Pathfinder(this.size, 1.5);
        this.obstacles = []; // Track for minimap
        this.wallMeshes = []; // Track actual meshes for raycasting
    }

    generate() {
        this.createFloor();
        this.createWalls();
        this.createObstacles();
        this.createLighting();
        this.createAtmosphere();
        return this.pathfinder;
    }

    createFloor() {
        // Grid floor with clearly visible neon lines
        const floorGeo = new THREE.PlaneGeometry(this.size, this.size, this.size, this.size);
        
        // Create canvas texture for grid
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Medium-dark base — NOT pure black
        ctx.fillStyle = '#0d1a20';
        ctx.fillRect(0, 0, 1024, 1024);
        
        // Fine grid lines — very visible
        const gridCount = 50;
        const cellSize = 1024 / gridCount;
        
        ctx.strokeStyle = 'rgba(0, 220, 255, 0.25)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= gridCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, 1024);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(1024, i * cellSize);
            ctx.stroke();
        }
        
        // Major grid lines — bright
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.lineWidth = 2.5;
        for (let i = 0; i <= gridCount; i += 5) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, 1024);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(1024, i * cellSize);
            ctx.stroke();
        }
        
        // Center cross — magenta accent
        ctx.strokeStyle = 'rgba(255, 0, 170, 0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(512, 0);
        ctx.lineTo(512, 1024);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 512);
        ctx.lineTo(1024, 512);
        ctx.stroke();
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        const floorMat = new THREE.MeshStandardMaterial({ 
            map: texture,
            roughness: 0.8, 
            metalness: 0.1,
            emissive: new THREE.Color(0x0a2030),
            emissiveIntensity: 1.0
        });
        
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.receiveShadow = true;
        this.scene.add(floorMesh);

        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0 });
        floorBody.addShape(floorShape);
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(floorBody);
    }

    createWalls() {
        const h = 12;
        // Boundary walls with neon trim
        this.createWall(0, h/2, -this.size/2, this.size, h, 1, true);
        this.createWall(0, h/2, this.size/2, this.size, h, 1, true);
        this.createWall(-this.size/2, h/2, 0, 1, h, this.size, true);
        this.createWall(this.size/2, h/2, 0, 1, h, this.size, true);
    }

    createObstacles() {
        const obstacles = [];
        const spacing = 8;
        
        for (let i = 0; i < 12; i++) {
            let x, z, w, d;
            let tries = 0;
            let valid = false;
            
            while (!valid && tries < 20) {
                w = 2 + Math.random() * 3;
                d = 2 + Math.random() * 3;
                x = (Math.random() - 0.5) * (this.size - 12);
                z = (Math.random() - 0.5) * (this.size - 12);
                
                // Don't place near center (player spawn)
                if (Math.abs(x) < 5 && Math.abs(z) < 5) { tries++; continue; }
                
                // Don't place too close to other obstacles
                valid = true;
                for (const ob of obstacles) {
                    const dist = Math.sqrt((x - ob.x) ** 2 + (z - ob.z) ** 2);
                    if (dist < spacing) { valid = false; break; }
                }
                tries++;
            }
            
            if (valid) {
                const h = 2 + Math.random() * 4;
                this.createWall(x, h / 2, z, w, h, d, false);
                obstacles.push({ x, z, w, d, h });
            }
        }
        
        // Add some decorative pillars
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const radius = 15 + Math.random() * 5;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            this.createPillar(x, z);
        }
    }

    createPillar(x, z) {
        const h = 6 + Math.random() * 4;
        const r = 0.4;
        
        const geo = new THREE.CylinderGeometry(r, r, h, 8);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x151525, metalness: 0.7, roughness: 0.3
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        
        // Neon ring at base
        const ringGeo = new THREE.TorusGeometry(r + 0.1, 0.03, 8, 16);
        const colors = [0x00f0ff, 0xff00aa, 0x00ff88];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const ringMat = new THREE.MeshBasicMaterial({ 
            color, transparent: true, opacity: 0.8 
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x, 0.3, z);
        ring.rotation.x = Math.PI / 2;
        this.scene.add(ring);
        
        // Light at base
        const light = new THREE.PointLight(color, 0.5, 6);
        light.position.set(x, 0.5, z);
        this.scene.add(light);
        
        // Physics
        const shape = new CANNON.Cylinder(r, r, h, 8);
        const body = new CANNON.Body({ mass: 0 });
        const q = new CANNON.Quaternion();
        body.addShape(shape);
        body.position.set(x, h / 2, z);
        this.world.addBody(body);
        
        this.pathfinder.addObstacle(x, z, r * 2 + 1.5, r * 2 + 1.5);
    }

    createWall(x, y, z, w, h, d, isBoundary = false) {
        const geo = new THREE.BoxGeometry(w, h, d);
        
        let mat;
        if (isBoundary) {
            mat = new THREE.MeshStandardMaterial({ 
                color: 0x1a2a3a,
                metalness: 0.4,
                roughness: 0.6,
                emissive: new THREE.Color(0x0a1520),
                emissiveIntensity: 0.5
            });
        } else {
            // Visible, varied wall colors — dark teal/blue palette
            const wallColors = [0x1a3040, 0x203040, 0x182838, 0x1e3545];
            mat = new THREE.MeshStandardMaterial({ 
                color: wallColors[Math.floor(Math.random() * wallColors.length)],
                metalness: 0.4,
                roughness: 0.5,
                emissive: new THREE.Color(0x051015),
                emissiveIntensity: 0.3
            });
        }
        
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isWall = true;
        this.scene.add(mesh);
        this.wallMeshes.push(mesh);
        
        // Neon edge lines on obstacles — bright and clearly visible
        if (!isBoundary) {
            const edgeColors = [0x00f0ff, 0xff00aa, 0x44aaff, 0x00ff88];
            const edgeColor = edgeColors[Math.floor(Math.random() * edgeColors.length)];
            const edges = new THREE.EdgesGeometry(geo);
            const lineMat = new THREE.LineBasicMaterial({ 
                color: edgeColor, transparent: true, opacity: 0.9
            });
            const wireframe = new THREE.LineSegments(edges, lineMat);
            wireframe.position.copy(mesh.position);
            this.scene.add(wireframe);
            
            // Accent light on top — bright enough to illuminate nearby floor
            const accentLight = new THREE.PointLight(edgeColor, 1.5, 8);
            accentLight.position.set(x, y + h/2 + 0.5, z);
            this.scene.add(accentLight);
            
            this.obstacles.push({ x, z, w, d });
        }

        const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2));
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(x, y, z);
        this.world.addBody(body);
        
        this.pathfinder.addObstacle(x, z, w + 1.5, d + 1.5);
    }

    createLighting() {
        // Strong ambient — key fix for visibility
        const ambient = new THREE.AmbientLight(0xaaccdd, 1.2);
        this.scene.add(ambient);

        // Main directional light — bright cool white with slight blue tint
        const dirLight = new THREE.DirectionalLight(0xddeeff, 1.5);
        dirLight.position.set(15, 35, 15);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 35;
        dirLight.shadow.camera.bottom = -35;
        dirLight.shadow.camera.left = -35;
        dirLight.shadow.camera.right = 35;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
        
        // Secondary fill light from opposite side (no shadows)
        const fillLight = new THREE.DirectionalLight(0x8899bb, 0.8);
        fillLight.position.set(-15, 20, -15);
        this.scene.add(fillLight);
        
        // Hemisphere light — sky blue above, teal below
        const hemiLight = new THREE.HemisphereLight(0x88aacc, 0x1a3040, 1.2);
        this.scene.add(hemiLight);
        
        // Bright neon accent lights — high intensity, wide range
        const accentPositions = [
            { pos: [0, 6, -this.size/2 + 3], color: 0x00f0ff, intensity: 3, dist: 35 },
            { pos: [0, 6,  this.size/2 - 3], color: 0xff00aa, intensity: 3, dist: 35 },
            { pos: [-this.size/2 + 3, 6, 0], color: 0x00ff88, intensity: 3, dist: 35 },
            { pos: [ this.size/2 - 3, 6, 0], color: 0x4488ff, intensity: 3, dist: 35 },
            { pos: [-this.size/4, 8, -this.size/4], color: 0xff88aa, intensity: 2, dist: 28 },
            { pos: [ this.size/4, 8,  this.size/4], color: 0x88ddff, intensity: 2, dist: 28 },
            { pos: [ this.size/4, 8, -this.size/4], color: 0xaaff88, intensity: 2, dist: 28 },
            { pos: [-this.size/4, 8,  this.size/4], color: 0xff8844, intensity: 2, dist: 28 },
        ];
        
        for (const { pos, color, intensity, dist } of accentPositions) {
            const light = new THREE.PointLight(color, intensity, dist);
            light.position.set(...pos);
            this.scene.add(light);
        }
    }

    createAtmosphere() {
        // Ground glow plane
        const glowGeo = new THREE.PlaneGeometry(this.size * 0.8, this.size * 0.8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x00ccff,
            transparent: true,
            opacity: 0.04,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowPlane = new THREE.Mesh(glowGeo, glowMat);
        glowPlane.rotation.x = -Math.PI / 2;
        glowPlane.position.y = 0.02;
        this.scene.add(glowPlane);
        
        // High ceiling fill lights to illuminate upper walls
        const ceilingPositions = [
            { x: 0, z: 0, color: 0xaabbcc },
            { x: -this.size/4, z: -this.size/4, color: 0x8899aa },
            { x:  this.size/4, z:  this.size/4, color: 0x8899aa },
            { x: -this.size/4, z:  this.size/4, color: 0x8899aa },
            { x:  this.size/4, z: -this.size/4, color: 0x8899aa },
        ];
        for (const { x, z, color } of ceilingPositions) {
            const light = new THREE.PointLight(color, 1.5, 40);
            light.position.set(x, 14, z);
            this.scene.add(light);
        }
    }
}
