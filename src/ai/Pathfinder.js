import * as THREE from 'three';

// Binary min-heap for efficient A* open set
class MinHeap {
    constructor(compareFn) {
        this.data = [];
        this.compareFn = compareFn;
    }
    push(item) {
        this.data.push(item);
        this._bubbleUp(this.data.length - 1);
    }
    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this._sinkDown(0);
        }
        return top;
    }
    get size() { return this.data.length; }
    _bubbleUp(i) {
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.compareFn(this.data[i], this.data[parent]) < 0) {
                [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
                i = parent;
            } else break;
        }
    }
    _sinkDown(i) {
        const n = this.data.length;
        while (true) {
            let smallest = i;
            const l = 2*i+1, r = 2*i+2;
            if (l < n && this.compareFn(this.data[l], this.data[smallest]) < 0) smallest = l;
            if (r < n && this.compareFn(this.data[r], this.data[smallest]) < 0) smallest = r;
            if (smallest !== i) {
                [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
                i = smallest;
            } else break;
        }
    }
}

export class Pathfinder {
    constructor(size, cellSize = 1) {
        this.size = size;
        this.cellSize = cellSize;
        this.gridSize = Math.ceil(size / cellSize);
        this.grid = new Array(this.gridSize).fill(0).map(() => new Array(this.gridSize).fill(0));
        this.offset = size / 2;
        
        // Path cache: key -> {path, timestamp}
        this._cache = new Map();
        this._cacheMaxAge = 0.5; // seconds
        this._cacheTime = performance.now() / 1000;
        
        // Influence map for flanking (updated lazily)
        this.influenceMap = null;
        this._influenceDirty = true;
    }

    addObstacle(x, z, w, d) {
        const margin = 0.5; // inflate obstacles slightly so enemies don't clip
        const startX = Math.max(0, Math.floor((x - w/2 - margin + this.offset) / this.cellSize));
        const endX = Math.min(this.gridSize - 1, Math.ceil((x + w/2 + margin + this.offset) / this.cellSize));
        const startZ = Math.max(0, Math.floor((z - d/2 - margin + this.offset) / this.cellSize));
        const endZ = Math.min(this.gridSize - 1, Math.ceil((z + d/2 + margin + this.offset) / this.cellSize));

        for (let i = startX; i <= endX; i++) {
            for (let j = startZ; j <= endZ; j++) {
                this.grid[i][j] = 1;
            }
        }
        this._influenceDirty = true;
    }

    worldToGrid(x, z) {
        const gx = Math.floor((x + this.offset) / this.cellSize);
        const gz = Math.floor((z + this.offset) / this.cellSize);
        return {
            x: Math.max(0, Math.min(this.gridSize - 1, gx)),
            z: Math.max(0, Math.min(this.gridSize - 1, gz))
        };
    }

    gridToWorld(gx, gz) {
        return {
            x: gx * this.cellSize - this.offset + this.cellSize / 2,
            z: gz * this.cellSize - this.offset + this.cellSize / 2
        };
    }

    findPath(startX, startZ, endX, endZ, agentRadius = 0) {
        const start = this.worldToGrid(startX, startZ);
        const end = this.worldToGrid(endX, endZ);

        // Cache lookup
        const cacheKey = `${start.x},${start.z}|${end.x},${end.z}`;
        const now = performance.now() / 1000;
        const cached = this._cache.get(cacheKey);
        if (cached && (now - cached.time) < this._cacheMaxAge) {
            return cached.path;
        }

        // Resolve blocked target
        let target = end;
        if (this.grid[end.x][end.z] === 1) {
            const nearest = this.findNearestWalkable(end.x, end.z);
            if (nearest) target = nearest;
            else return null;
        }

        const path = this._astar(start, target);
        if (path) {
            const smoothed = this.smoothPath(path);
            this._cache.set(cacheKey, { path: smoothed, time: now });
            // Limit cache size
            if (this._cache.size > 200) {
                const firstKey = this._cache.keys().next().value;
                this._cache.delete(firstKey);
            }
            return smoothed;
        }

        this._cache.set(cacheKey, { path: null, time: now });
        return null;
    }

    _astar(start, end) {
        const gscore = new Float32Array(this.gridSize * this.gridSize).fill(Infinity);
        const fscore = new Float32Array(this.gridSize * this.gridSize).fill(Infinity);
        const cameFrom = new Int32Array(this.gridSize * this.gridSize).fill(-1);

        const idx = (x, z) => x * this.gridSize + z;
        const startIdx = idx(start.x, start.z);
        gscore[startIdx] = 0;
        fscore[startIdx] = this.heuristic(start, end);

        const heap = new MinHeap((a, b) => fscore[a] - fscore[b]);
        heap.push(startIdx);
        const inOpen = new Uint8Array(this.gridSize * this.gridSize);
        inOpen[startIdx] = 1;

        const endIdx = idx(end.x, end.z);

        while (heap.size > 0) {
            const currentIdx = heap.pop();
            inOpen[currentIdx] = 0;

            if (currentIdx === endIdx) {
                return this._reconstructFromArray(cameFrom, currentIdx);
            }

            const cx = Math.floor(currentIdx / this.gridSize);
            const cz = currentIdx % this.gridSize;

            const dirs = [[0,1,1],[1,0,1],[0,-1,1],[-1,0,1],[1,1,1.414],[-1,-1,1.414],[1,-1,1.414],[-1,1,1.414]];
            for (const [dx, dz, cost] of dirs) {
                const nx = cx + dx, nz = cz + dz;
                if (nx < 0 || nx >= this.gridSize || nz < 0 || nz >= this.gridSize) continue;
                if (this.grid[nx][nz] === 1) continue;
                // Prevent diagonal through walls
                if (dx !== 0 && dz !== 0) {
                    if (this.grid[cx + dx][cz] === 1 || this.grid[cx][cz + dz] === 1) continue;
                }

                const nIdx = idx(nx, nz);
                const tentative = gscore[currentIdx] + cost;
                if (tentative < gscore[nIdx]) {
                    cameFrom[nIdx] = currentIdx;
                    gscore[nIdx] = tentative;
                    fscore[nIdx] = tentative + this.heuristic({x: nx, z: nz}, end);
                    if (!inOpen[nIdx]) {
                        inOpen[nIdx] = 1;
                        heap.push(nIdx);
                    }
                }
            }
        }

        return null;
    }

    _reconstructFromArray(cameFrom, currentIdx) {
        const path = [];
        let cur = currentIdx;
        while (cur !== -1) {
            const x = Math.floor(cur / this.gridSize);
            const z = cur % this.gridSize;
            path.unshift(this.gridToWorld(x, z));
            cur = cameFrom[cur];
            if (cur === cameFrom[cur]) break; // safety
        }
        return path;
    }

    findNearestWalkable(gx, gz) {
        const queue = [{x: gx, z: gz}];
        const visited = new Set([`${gx},${gz}`]);
        
        while(queue.length > 0) {
            const current = queue.shift();
            if (this.grid[current.x][current.z] === 0) {
                return current;
            }
            
            const neighbors = this.getNeighbors(current, true);
            for (const n of neighbors) {
                const key = `${n.x},${n.z}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push(n);
                }
            }
        }
        return null;
    }

    // Get a flanking position offset from the direct path to the player
    getFlankingPosition(enemyX, enemyZ, playerX, playerZ, flankSide = 1) {
        const dx = playerX - enemyX;
        const dz = playerZ - enemyZ;
        const len = Math.sqrt(dx*dx + dz*dz);
        if (len < 0.01) return { x: playerX, z: playerZ };
        
        // Perpendicular offset
        const perpX = -dz / len;
        const perpZ = dx / len;
        const flankDist = Math.min(len * 0.4, 12);
        
        return {
            x: playerX + perpX * flankSide * flankDist - dx / len * 3,
            z: playerZ + perpZ * flankSide * flankDist - dz / len * 3
        };
    }

    heuristic(a, b) {
        // Octile distance (better for 8-directional movement)
        const dx = Math.abs(a.x - b.x);
        const dz = Math.abs(a.z - b.z);
        return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    }

    getNeighbors(node, ignoreObstacles = false) {
        const neighbors = [];
        const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
        
        for (const [dx, dz] of dirs) {
            const nx = node.x + dx;
            const nz = node.z + dz;
            
            if (nx >= 0 && nx < this.gridSize && nz >= 0 && nz < this.gridSize) {
                if (ignoreObstacles || this.grid[nx][nz] === 0) {
                    if (!ignoreObstacles && dx !== 0 && dz !== 0) {
                        if (this.grid[node.x + dx][node.z] === 1 || this.grid[node.x][node.z + dz] === 1) {
                            continue;
                        }
                    }
                    neighbors.push({ x: nx, z: nz });
                }
            }
        }
        return neighbors;
    }

    reconstructPath(cameFrom, current) {
        const path = [this.gridToWorld(current.x, current.z)];
        let currKey = `${current.x},${current.z}`;
        
        while (cameFrom.has(currKey)) {
            current = cameFrom.get(currKey);
            currKey = `${current.x},${current.z}`;
            path.unshift(this.gridToWorld(current.x, current.z));
        }
        
        return this.smoothPath(path);
    }
    
    smoothPath(path) {
        if (!path || path.length <= 2) return path;
        
        const smoothed = [path[0]];
        let current = 0;
        
        while (current < path.length - 1) {
            let furthest = current + 1;
            for (let i = current + 2; i < path.length; i++) {
                if (this.hasLineOfSight(path[current], path[i])) {
                    furthest = i;
                } else {
                    break;
                }
            }
            smoothed.push(path[furthest]);
            current = furthest;
        }
        
        return smoothed;
    }
    
    hasLineOfSight(p1, p2) {
        const g1 = this.worldToGrid(p1.x, p1.z);
        const g2 = this.worldToGrid(p2.x, p2.z);
        
        let x0 = g1.x, y0 = g1.z;
        const x1 = g2.x, y1 = g2.z;
        
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;
        
        const maxSteps = dx + dy + 2;
        let steps = 0;
        while (steps++ < maxSteps) {
            if (x0 < 0 || x0 >= this.gridSize || y0 < 0 || y0 >= this.gridSize) return false;
            if (this.grid[x0][y0] === 1) return false;
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        
        return true;
    }
}
