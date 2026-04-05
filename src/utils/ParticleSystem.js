import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.trailParticles = [];
    }

    spawnExplosion(position, color = 0xff3300, count = 20) {
        const colors = [color, 0xffaa00, 0xff4400, 0xffff00];
        for (let i = 0; i < count; i++) {
            const size = 0.05 + Math.random() * 0.2;
            const geo = new THREE.BoxGeometry(size, size, size);
            const col = colors[Math.floor(Math.random() * colors.length)];
            const mat = new THREE.MeshBasicMaterial({ 
                color: col, 
                transparent: true, 
                opacity: 1,
                blending: THREE.AdditiveBlending 
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            
            const dir = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.5,
                (Math.random() - 0.5) * 2
            ).normalize();
            
            const speed = 8 + Math.random() * 15;
            
            this.scene.add(mesh);
            this.particles.push({
                mesh,
                velocity: dir.multiplyScalar(speed),
                life: 0.5 + Math.random() * 0.8,
                maxLife: 0.5 + Math.random() * 0.8,
                gravity: -15,
                shrink: true
            });
        }
        
        // Flash sphere
        const flashGeo = new THREE.SphereGeometry(1 + Math.random() * 0.5, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ 
            color: color, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending 
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);
        this.particles.push({
            mesh: flash,
            velocity: new THREE.Vector3(),
            life: 0.2,
            maxLife: 0.2,
            scale: 1,
            expand: 4,
            shrink: false
        });
    }

    spawnHitSparks(position, normal, color = 0xffdd00, count = 8) {
        for (let i = 0; i < count; i++) {
            const size = 0.03 + Math.random() * 0.06;
            const geo = new THREE.BoxGeometry(size, size, size * 3);
            const mat = new THREE.MeshBasicMaterial({ 
                color, transparent: true, opacity: 1,
                blending: THREE.AdditiveBlending 
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            
            // Sparks fly away from the surface
            const dir = new THREE.Vector3(
                normal.x + (Math.random() - 0.5) * 1.5,
                normal.y + Math.random() * 0.8,
                normal.z + (Math.random() - 0.5) * 1.5
            ).normalize();
            
            this.scene.add(mesh);
            this.particles.push({
                mesh,
                velocity: dir.multiplyScalar(5 + Math.random() * 10),
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.3,
                gravity: -8,
                shrink: true
            });
        }
    }

    spawnMuzzleSparks(position, direction, count = 5) {
        for (let i = 0; i < count; i++) {
            const size = 0.02 + Math.random() * 0.04;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0xffcc00, transparent: true, opacity: 1,
                blending: THREE.AdditiveBlending 
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            
            const dir = new THREE.Vector3(
                direction.x + (Math.random() - 0.5) * 0.8,
                direction.y + (Math.random() - 0.5) * 0.8,
                direction.z + (Math.random() - 0.5) * 0.8
            ).normalize();
            
            this.scene.add(mesh);
            this.particles.push({
                mesh,
                velocity: dir.multiplyScalar(8 + Math.random() * 12),
                life: 0.1 + Math.random() * 0.15,
                maxLife: 0.15,
                gravity: -5,
                shrink: true
            });
        }
    }

    spawnDashTrail(position, color = 0x00f0ff) {
        const size = 0.3 + Math.random() * 0.2;
        const geo = new THREE.SphereGeometry(size, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ 
            color, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        this.scene.add(mesh);
        
        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(0, 0.5, 0),
            life: 0.4,
            maxLife: 0.4,
            shrink: true
        });
    }

    spawnSwordSlash(position, direction, color = 0x00f0ff) {
        // Create an arcing slash plane or crescent geometry
        const size = 6.0; // massive slash radius
        const geo = new THREE.PlaneGeometry(size, size/2);
        
        // Custom simple canvas texture to create crescent shape
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        // Draw a thick arc Crescent
        ctx.arc(64, 128, 60, Math.PI, 0, false);
        ctx.lineWidth = 25;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.stroke(); // Double stroke for glow

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            map: texture,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geo, mat);
        
        // Position it slightly in front of the origin position
        const slashPos = position.clone().addScaledVector(direction, 2.0);
        mesh.position.copy(slashPos);
        
        // Make it face the direction but flat to the floor
        mesh.lookAt(slashPos.clone().add(direction));
        mesh.rotation.z = (Math.random() - 0.5) * 0.5; // Slight random tilt
        
        this.scene.add(mesh);
        
        // Particles system custom animation for slash
        this.particles.push({
            mesh,
            velocity: direction.clone().multiplyScalar(10), // Travels rapidly forward
            life: 0.15, // Extremely fast
            maxLife: 0.15,
            expand: 8, // Grows rapidly
            shrink: false,
            slashArc: true // Custom hook if we want rotational animation in update()
        });
    }

    spawnAmbientParticle(bounds) {
        const size = 0.02 + Math.random() * 0.03;
        const geo = new THREE.BoxGeometry(size, size, size);
        const colors = [0x00f0ff, 0xff00aa, 0x3388ff, 0x00ff88];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({ 
            color, transparent: true, opacity: 0.3 + Math.random() * 0.3,
            blending: THREE.AdditiveBlending 
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.position.set(
            (Math.random() - 0.5) * bounds,
            Math.random() * 8,
            (Math.random() - 0.5) * bounds
        );
        
        this.scene.add(mesh);
        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                0.2 + Math.random() * 0.3,
                (Math.random() - 0.5) * 0.3
            ),
            life: 5 + Math.random() * 5,
            maxLife: 8,
            shrink: false,
            ambient: true
        });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            
            // Move
            p.mesh.position.addScaledVector(p.velocity, dt);
            
            // Gravity
            if (p.gravity) {
                p.velocity.y += p.gravity * dt;
            }
            
            // Expand
            if (p.expand) {
                p.scale = (p.scale || 1) + p.expand * dt;
                p.mesh.scale.set(p.scale, p.scale, p.scale);
            }
            
            // Fade
            const fraction = p.life / p.maxLife;
            p.mesh.material.opacity = fraction * (p.ambient ? 0.3 : 1);
            
            // Shrink
            if (p.shrink) {
                const s = Math.max(fraction, 0.01);
                p.mesh.scale.set(s, s, s);
            }
            
            // Slash specific arc spinning
            if (p.slashArc) {
                // p.mesh.rotation.z += 15 * dt; // Un-comment if we want a spinning projectile, but slice is better static.
            }
        }
    }

    clear() {
        for (const p of this.particles) {
            this.scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) p.mesh.material.dispose();
        }
        this.particles = [];
    }
}
