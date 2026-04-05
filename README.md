# Deadline — Web-based Roguelite FPS

![Gameplay Showcase](./gameplay_demo.webp)

A fast-paced, high-octane FPS built with **Three.js** and **Cannon-es**, featuring procedural generation, smart AI combat, and a satisfying dash-slash roguelite loop.

## 🚀 Features

- **Procedural Level Generation**: Each run offers a new layout of walls and cover. 
- **Diverse Enemy Archetypes**: From swift `CHASERs` and exploding `KAMIKAZEs` to hulking `TANKs` and calculated `BOSS` encounters every 5 waves.
- **Weapon System**: Interchangeable profiles including AK47, Shotgun, and Sniper models with dynamic recoil and spray patterns.
- **High Mobility**: Advanced Movement system with multi-stage jumps and iframe-enabled dashing.
- **Roguelite Upgrades**: Dynamic stat scaling and ability resets across game sessions.

## 🛠️ Technology Stack

- **Graphics**: [Three.js](https://threejs.org/)
- **Physics**: [Cannon-es](https://pmndrs.github.io/cannon-es/)
- **Animations**: [GSAP](https://gsap.com/)
- **Build Tool**: [Vite](https://vitejs.dev/)

## 🔧 Installation & Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/arnav-tek/Livelink-FPS.git
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Launch the development server**:
   ```bash
   npm run dev
   ```
4. **Play**: Open `http://localhost:3000` in your browser.

## 🎮 Controls

- **WASD**: Movement
- **SPACE**: Jump (Double jump supported)
- **SHIFT**: Dash
- **MOUSE**: Aiming / Looking
- **LMB**: Shoot
- **RMB**: Focus Sights
- **R**: Reload

## 📜 Development Status

This project is in active development. Recent fixes include:
- Resolved Boss crash at Wave 5.
- Fixed Weapon / Upgrade persistence across restarts.
- Optimized Cannon-es physics for variable frame-rate independence.
- Enhanced Gunner model and projectile visual fidelity.
