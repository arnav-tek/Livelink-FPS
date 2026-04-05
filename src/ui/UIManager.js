export class UIManager {
    constructor(gameManager) {
        this.gameManager = gameManager;
        
        this.elements = {
            healthFill: document.getElementById('health-fill'),
            healthValue: document.getElementById('health-value'),
            ammoFill: document.getElementById('ammo-fill'),
            ammoValue: document.getElementById('ammo-value'),
            dash: document.getElementById('dash-display'),
            scoreValue: document.getElementById('score-value'),
            waveValue: document.getElementById('wave-value'),
            menus: document.getElementById('menus'),
            startScreen: document.getElementById('start-screen'),
            gameOverScreen: document.getElementById('game-over-screen'),
            upgradeScreen: document.getElementById('upgrade-screen'),
            startBtn: document.getElementById('start-btn'),
            restartBtn: document.getElementById('restart-btn'),
            upgradeOptions: document.getElementById('upgrade-options'),
            damageOverlay: document.getElementById('damage-overlay'),
            lowHealthOverlay: document.getElementById('low-health-overlay'),
            uiLayer: document.getElementById('ui-layer'),
            playerNameInput: document.getElementById('player-name-input'),
            playerGreeting: document.getElementById('player-greeting'),
            startHighScores: document.getElementById('start-high-scores'),
            gameoverHighScores: document.getElementById('gameover-high-scores'),
            finalScore: document.getElementById('final-score'),
            hitMarker: document.getElementById('hit-marker'),
            comboDisplay: document.getElementById('combo-display'),
            comboCount: document.getElementById('combo-count'),
            comboMultiplier: document.getElementById('combo-multiplier'),
            waveAnnounce: document.getElementById('wave-announce'),
            waveAnnounceText: document.getElementById('wave-announce-text'),
            waveAnnounceSub: document.getElementById('wave-announce-sub'),
            killFeed: document.getElementById('kill-feed'),
            reloadIndicator: document.getElementById('reload-indicator'),
            crosshair: document.getElementById('crosshair'),
            minimapCanvas: document.getElementById('minimap-canvas'),
        };

        this.hitMarkerTimeout = null;
        this.minimapCtx = this.elements.minimapCanvas ? this.elements.minimapCanvas.getContext('2d') : null;
        this.levelGenerator = null;
        
        this.bindEvents();
    }

    bindEvents() {
        const savedName = localStorage.getItem('deadlink_player_name');
        if (savedName) {
            this.elements.playerNameInput.value = savedName;
        }

        this.elements.startBtn.addEventListener('click', () => {
            const name = this.elements.playerNameInput.value.trim() || 'OPERATIVE';
            localStorage.setItem('deadlink_player_name', name);
            this.elements.playerGreeting.innerText = `OPERATIVE: ${name.toUpperCase()}`;
            this.elements.playerGreeting.classList.add('visible');
            this.gameManager.startGame(name);
        });

        this.elements.restartBtn.addEventListener('click', () => {
            const name = this.elements.playerNameInput.value.trim() || 'OPERATIVE';
            this.elements.playerGreeting.innerText = `OPERATIVE: ${name.toUpperCase()}`;
            this.elements.playerGreeting.classList.add('visible');
            this.gameManager.restartGame(name);
        });

        // Allow Enter key to start game
        this.elements.playerNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.elements.startBtn.click();
            }
        });
    }

    initMinimap(levelGenerator) {
        this.levelGenerator = levelGenerator;
    }

    updateHUD(health, maxHealth, ammo, maxAmmo, dashReady, score, wave, reloading) {
        // Health bar
        const healthPercent = Math.max(0, health / maxHealth) * 100;
        this.elements.healthFill.style.width = healthPercent + '%';
        this.elements.healthValue.innerText = `${Math.max(0, Math.floor(health))}`;
        
        // Health bar color
        if (healthPercent > 50) {
            this.elements.healthFill.className = 'bar-fill healthy';
        } else if (healthPercent > 25) {
            this.elements.healthFill.className = 'bar-fill warning';
        } else {
            this.elements.healthFill.className = 'bar-fill'; // Red default
        }
        
        // Low health vignette
        if (this.elements.lowHealthOverlay) {
            this.elements.lowHealthOverlay.style.opacity = healthPercent < 30 ? 
                String((1 - healthPercent / 30) * 0.6) : '0';
        }
        
        // Ammo bar
        const ammoPercent = (ammo / maxAmmo) * 100;
        this.elements.ammoFill.style.width = ammoPercent + '%';
        this.elements.ammoValue.innerText = `${ammo}/${maxAmmo}`;
        
        // Dash
        if (dashReady) {
            this.elements.dash.className = 'ready';
            this.elements.dash.innerText = '⚡ DASH READY';
        } else {
            this.elements.dash.className = 'cooldown';
            this.elements.dash.innerText = '⚡ COOLDOWN';
        }
        this.elements.dash.id = 'dash-display';
        
        // Score
        this.elements.scoreValue.innerText = score.toLocaleString();
        this.elements.waveValue.innerText = `WAVE ${wave}`;
        
        // Reload indicator
        if (this.elements.reloadIndicator) {
            if (reloading) {
                this.elements.reloadIndicator.classList.add('show');
            } else {
                this.elements.reloadIndicator.classList.remove('show');
            }
        }
    }

    updateCrosshair(speed, shooting) {
        if (!this.elements.crosshair) return;
        
        const lines = this.elements.crosshair.querySelectorAll('.crosshair-line');
        const spread = Math.min(8 + speed * 0.8 + (shooting ? 6 : 0), 30);
        
        lines.forEach(line => {
            if (line.classList.contains('top')) line.style.top = `-${12 + spread}px`;
            if (line.classList.contains('bottom')) line.style.bottom = `-${12 + spread}px`;
            if (line.classList.contains('left')) line.style.left = `-${12 + spread}px`;
            if (line.classList.contains('right')) line.style.right = `-${12 + spread}px`;
        });
    }

    showHitMarker(isHit, isKill) {
        if (!this.elements.hitMarker) return;
        
        if (this.hitMarkerTimeout) clearTimeout(this.hitMarkerTimeout);
        
        this.elements.hitMarker.classList.add('show');
        this.elements.hitMarker.classList.toggle('kill', isKill);
        
        // GSAP Pop effect
        gsap.fromTo(this.elements.hitMarker, 
            { scale: 0.5, opacity: 1 }, 
            { scale: 1.2, opacity: 0, duration: 0.2, ease: "power2.out" }
        );
        
        this.hitMarkerTimeout = setTimeout(() => {
            this.elements.hitMarker.classList.remove('show', 'kill');
        }, 200);
    }

    showDamage() {
        gsap.fromTo(this.elements.damageOverlay, 
            { opacity: 0.8 }, 
            { opacity: 0, duration: 0.5, ease: "power2.out" }
        );
        
        // Screen shake
        gsap.fromTo(this.elements.uiLayer,
            { x: -10, y: 5 },
            { x: 0, y: 0, duration: 0.3, ease: "elastic.out(1, 0.3)" }
        );
    }

    updateCombo(combo, multiplier) {
        if (!this.elements.comboDisplay) return;
        
        if (combo >= 2) {
            this.elements.comboDisplay.classList.add('active');
            
            // Only play popup animation if number changed
            if (this.elements.comboCount.innerText !== combo.toString()) {
                this.elements.comboCount.innerText = combo;
                this.elements.comboMultiplier.innerText = `×${multiplier}`;
                
                // Scale pulse on increment with GSAP
                gsap.fromTo(this.elements.comboCount,
                    { scale: 1.6, color: "#ffffff" },
                    { scale: 1, color: "#ffaa00", duration: 0.4, ease: "elastic.out(1, 0.4)" }
                );
            }
        } else {
            this.elements.comboDisplay.classList.remove('active');
        }
    }

    showWaveAnnouncement(wave, onComplete) {
        if (!this.elements.waveAnnounce) {
            if (onComplete) onComplete();
            return;
        }
        
        this.elements.waveAnnounceText.innerText = `WAVE ${wave}`;
        
        const subtitles = [
            'INCOMING HOSTILES',
            'THREAT LEVEL RISING',
            'PREPARE FOR COMBAT',
            'ENEMIES DETECTED',
            'STAY ALERT',
            'DANGER APPROACHING'
        ];
        this.elements.waveAnnounceSub.innerText = subtitles[Math.floor(Math.random() * subtitles.length)];
        
        this.elements.waveAnnounce.style.opacity = '1';
        this.elements.waveAnnounce.style.pointerEvents = 'auto'; // allow visual block if any
        
        // GSAP Timeline for dramatic wave intro
        const tl = gsap.timeline({
            onComplete: () => {
                this.elements.waveAnnounce.style.opacity = '0';
                this.elements.waveAnnounce.style.pointerEvents = 'none';
            }
        });
        
        tl.fromTo(this.elements.waveAnnounceText, 
            { scale: 5, opacity: 0, letterSpacing: "2em" },
            { scale: 1, opacity: 1, letterSpacing: "0.2em", duration: 0.8, ease: "expo.out" }
        )
        .fromTo(this.elements.waveAnnounceSub,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.4"
        )
        .call(() => {
            if (onComplete) onComplete();
        }, null, 1.2) // Spawn enemies exactly 1.2s into the animation
        .to([this.elements.waveAnnounceText, this.elements.waveAnnounceSub], 
            { opacity: 0, duration: 0.5, delay: 1.0 }
        );
    }

    addKillFeed(enemyType, points) {
        if (!this.elements.killFeed) return;
        
        const entry = document.createElement('div');
        entry.className = 'kill-entry';
        entry.innerText = `▸ ${enemyType} +${points}`;
        this.elements.killFeed.prepend(entry);
        
        // Remove old entries
        while (this.elements.killFeed.children.length > 5) {
            this.elements.killFeed.removeChild(this.elements.killFeed.lastChild);
        }
        
        // Auto-remove after animation
        setTimeout(() => {
            if (entry.parentNode) entry.parentNode.removeChild(entry);
        }, 2000);
    }

    updateMinimap(playerPos, playerRotation, activeEnemies) {
        if (!this.minimapCtx) return;
        
        const ctx = this.minimapCtx;
        const w = 140, h = 140;
        const mapSize = this.levelGenerator ? this.levelGenerator.size : 50;
        const scale = w / mapSize;
        
        // Clear
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, w, h);
        
        // Grid
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
        ctx.lineWidth = 0.5;
        const gridStep = 5 * scale;
        for (let x = 0; x < w; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += gridStep) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        
        // Obstacles
        if (this.levelGenerator && this.levelGenerator.obstacles) {
            ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
            for (const ob of this.levelGenerator.obstacles) {
                const sx = (ob.x + mapSize / 2) * scale;
                const sy = (ob.z + mapSize / 2) * scale;
                const sw = ob.w * scale;
                const sd = ob.d * scale;
                ctx.fillRect(sx - sw / 2, sy - sd / 2, sw, sd);
            }
        }
        
        // Enemies
        for (const enemy of activeEnemies) {
            const ex = (enemy.mesh.position.x + mapSize / 2) * scale;
            const ey = (enemy.mesh.position.z + mapSize / 2) * scale;
            
            let color;
            switch (enemy.type) {
                case 'KAMIKAZE': color = '#ff9900'; break;
                case 'SNIPER': color = '#0088ff'; break;
                case 'TANK': color = '#7c3aed'; break;
                case 'TELEPORTER': color = '#ff00aa'; break;
                default: color = '#ff1744';
            }
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(ex, ey, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Player
        const px = (playerPos.x + mapSize / 2) * scale;
        const py = (playerPos.z + mapSize / 2) * scale;
        
        // Facing direction cone
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-playerRotation);
        
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 15, -Math.PI / 4, Math.PI / 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        
        // Player dot
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    showStartScreen(highScores) {
        this.elements.menus.classList.remove('hidden');
        this.elements.startScreen.classList.remove('hidden');
        this.elements.gameOverScreen.classList.add('hidden');
        this.elements.upgradeScreen.classList.add('hidden');
        this.elements.playerGreeting.innerText = '';
        this.elements.playerGreeting.classList.remove('visible');
        this.renderHighScores(this.elements.startHighScores, highScores);
        this.setHUDVisible(false);
    }

    showGameOver(score, highScores, wave, maxCombo, stats) {
        document.exitPointerLock();
        this.elements.menus.classList.remove('hidden');
        this.elements.startScreen.classList.add('hidden');
        this.elements.gameOverScreen.classList.remove('hidden');
        this.elements.upgradeScreen.classList.add('hidden');
        this.elements.finalScore.innerText = `SCORE: ${score.toLocaleString()}`;
        
        // Render stats
        const headshotsEl = document.getElementById('stat-headshots');
        const bodyshotsEl = document.getElementById('stat-bodyshots');
        if (headshotsEl) headshotsEl.innerText = stats ? stats.headshots : 0;
        if (bodyshotsEl) bodyshotsEl.innerText = stats ? stats.bodyshots : 0;
        
        this.elements.playerGreeting.innerText = '';
        this.elements.playerGreeting.classList.remove('visible');
        this.renderHighScores(this.elements.gameoverHighScores, highScores);
        this.setHUDVisible(false);
    }

    renderHighScores(tbody, scores) {
        tbody.innerHTML = '';
        if (!scores || scores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#5a6080; font-size:12px;">NO DATA FOUND</td></tr>';
            return;
        }
        scores.forEach((entry, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="rank-val">${index + 1}</td>
                <td>${entry.name}</td>
                <td class="score-val">${entry.score.toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    showUpgrades(upgrades, onSelect) {
        document.exitPointerLock();
        this.elements.menus.classList.remove('hidden');
        this.elements.startScreen.classList.add('hidden');
        this.elements.gameOverScreen.classList.add('hidden');
        this.elements.upgradeScreen.classList.remove('hidden');
        
        // Background blur effect
        gsap.fromTo(this.elements.menus, 
            { backdropFilter: "blur(0px)", backgroundColor: "rgba(0,0,0,0)" },
            { backdropFilter: "blur(10px)", backgroundColor: "rgba(0,0,0,0.6)", duration: 0.5 }
        );
        
        this.elements.upgradeOptions.innerHTML = '';
        upgrades.forEach((upgrade, index) => {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <div class="upgrade-icon">${upgrade.icon || '⚡'}</div>
                <div class="upgrade-title">${upgrade.name}</div>
                <div class="upgrade-desc">${upgrade.description}</div>
            `;
            
            // Hover logic
            card.addEventListener('mouseenter', () => {
                gsap.to(card, { y: -10, scale: 1.05, duration: 0.2, ease: "back.out(1.7)", borderColor: '#00f0ff', boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)' });
            });
            card.addEventListener('mouseleave', () => {
                gsap.to(card, { y: 0, scale: 1.0, duration: 0.2, ease: "power2.out", borderColor: 'rgba(0, 240, 255, 0.2)', boxShadow: '0 0 0px rgba(0,0,0,0)' });
            });
            
            card.addEventListener('click', () => {
                gsap.to(this.elements.upgradeOptions.children, {
                    scale: 0.8, opacity: 0, y: 30, duration: 0.3, stagger: 0.05, ease: "power2.in",
                    onComplete: () => {
                        onSelect(upgrade);
                        this.hideMenus();
                        this.gameManager.requestPointerLock();
                    }
                });
            });
            
            this.elements.upgradeOptions.appendChild(card);
        });

        // Stagger entrance animation
        gsap.fromTo(this.elements.upgradeOptions.children, 
            { opacity: 0, y: -50, scale: 0.9 },
            { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.15, ease: "back.out(1.5)" }
        );
    }

    hideMenus() {
        this.elements.menus.classList.add('hidden');
        this.setHUDVisible(true);
    }

    setHUDVisible(visible) {
        const display = visible ? '' : 'none';
        const hud = document.getElementById('hud');
        const score = document.getElementById('score-display');
        const minimap = document.getElementById('minimap');
        const crosshair = document.getElementById('crosshair');
        const comboDisplay = document.getElementById('combo-display');
        const killFeed = document.getElementById('kill-feed');
        if (hud) hud.style.display = display;
        if (score) score.style.display = display;
        if (minimap) minimap.style.display = display;
        if (crosshair) crosshair.style.display = display;
        if (comboDisplay) comboDisplay.style.display = display;
        if (killFeed) killFeed.style.display = display;
    }
}
