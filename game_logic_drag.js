// 1. CONFIGURACIÓN E IMPORTACIONES
const canvasElement = document.getElementById('canvas-overlay'); 
const canvasCtx = canvasElement.getContext('2d');

// Inyectar librería de confeti dinámicamente
if (!document.getElementById('confetti-script')) {
    const script = document.createElement('script');
    script.id = 'confetti-script';
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    document.body.appendChild(script);
}

// Variables de Juego Globales
let planets = [];
let zones = [];
let invBox = {}, sysBox = {};
let isGameWon = false;
let rocketX = 0, rocketY = 0, rocketAngle = 0;
let asteroidParticles = [];
let isPCGlobal = false;
let isFullscreen = false;

// Definiciones de Botones
const fsBtn = { x: 0, y: 0, w: 50, h: 50 };
const backBtn = { x: 20, y: 20, w: 50, h: 50 };
const restartBtn = { x: 0, y: 0, w: 50, h: 50 };

// Intentar bloquear orientación en móviles
if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(e => {});
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        isFullscreen = true;
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            isFullscreen = false;
        }
    }
}

// Solución Imagen Cohete
const rocketImg = new Image();
rocketImg.src = "https://cdn-icons-png.flaticon.com/512/1356/1356479.png";

const solarSystemData = [
    { id: "sol", name: "Sol", color: "#FFD700", r: 60, type: "star", src: "Assets/Sol.svg" },
    { id: "mercurio", name: "Mercurio", color: "#A9A9A9", r: 12, type: "circle", src: "Assets/Mercurio.svg" },
    { id: "venus", name: "Venus", color: "#FFA500", r: 20, type: "circle", src: "Assets/Venus.svg" },
    { id: "tierra", name: "Tierra", color: "#1E90FF", r: 22, type: "circle", src: "Assets/Tierra.svg" },
    { id: "marte", name: "Marte", color: "#FF4500", r: 18, type: "circle", src: "Assets/Marte.svg" },
    { id: "cinturon", name: "Cinturón", color: "#8B4513", w: 50, h: 180, type: "belt", src: "Assets/Cinturón.svg" },
    { id: "jupiter", name: "Júpiter", color: "#DEB887", r: 55, type: "circle", src: "Assets/Júpiter.svg" },
    { id: "saturno", name: "Saturno", color: "#F4C430", r: 45, type: "saturn", src: "Assets/Saturno.svg" },
    { id: "urano", name: "Urano", color: "#00FFFF", r: 35, type: "circle", src: "Assets/Urano.svg" },
    { id: "neptuno", name: "Neptuno", color: "#00008B", r: 34, type: "circle", src: "Assets/Neptuno.svg" }
];

const planetImages = {};
solarSystemData.forEach(p => {
    const img = new Image();
    img.src = p.src;
    planetImages[p.id] = img;
});

// ALGORITMO DE INICIALIZACIÓN (Responsive)
function initGameElements() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPC = width > 1024;
    isPCGlobal = isPC;

    // Reset
    planets = [];
    zones = [];
    asteroidParticles = [];
    isGameWon = false;

    // 1. BOTONES
    const padding = isPC ? 30 : 15;
    backBtn.x = padding; backBtn.y = padding;
    restartBtn.x = width - padding - 50; restartBtn.y = padding;
    
    if (!isPC) {
        fsBtn.x = width - padding - 50; 
        fsBtn.y = height - padding - 55;
    } else {
        fsBtn.x = -1000;
    }

    // 2. CAJA INVENTARIO (Panel superior)
    const sideMargin = isPC ? width * 0.12 : width * 0.10; 
    invBox = {
        x: sideMargin, 
        y: padding,
        w: width - (sideMargin * 2),
        h: isPC ? height * 0.18 : Math.min(height * 0.30, 140) // Un poco más alto para separar del texto
    };

    // 3. CAJA SISTEMA (Panel inferior)
    sysBox = {
        x: sideMargin,
        y: invBox.y + invBox.h + (isPC ? 40 : 5), // Reducido para dar más aire interno
        w: width - (sideMargin * 2),
        h: height - (invBox.y + invBox.h + (isPC ? 80 : 25))
    };

    // --- 4. ZONAS DESTINO (Dentro de sysBox) ---
    const sysCenterY = sysBox.y + (sysBox.h / 2);
    // Distribución horizontal: Espaciar más los últimos planetas y corregir Júpiter
    const positionsPct = isPC 
        ? [0.05, 0.15, 0.23, 0.31, 0.38, 0.48, 0.62, 0.77, 0.89, 0.98]
        : [0.05, 0.14, 0.21, 0.28, 0.35, 0.46, 0.56, 0.76, 0.88, 0.98]; // Júpiter (0.56) más cerca del cinturón

    solarSystemData.forEach((data, index) => {
        let distinctX = sysBox.x + (sysBox.w * positionsPct[index]);
        let distinctY = sysCenterY;
        
        // Zigzag (Aumentar para móviles con pantalla pequeña)
        if (data.type !== "belt") {
            const zigzagAmt = isPC ? sysBox.h * 0.20 : sysBox.h * 0.18;
            distinctY = (index % 2 !== 0) ? sysCenterY + zigzagAmt : sysCenterY - zigzagAmt;
        }

        let zoneObj = {
            id: data.id,
            name: data.name,
            baseColor: data.color,
            color: data.color.replace(")", ", 0.2)").replace("rgb", "rgba").replace("#", "#"),
            x: distinctX,
            y: distinctY,
            type: data.type,
            originalR: data.r 
        };

        const sizeFactor = isPC ? 1.2 : 0.85; 
        if (data.type === "star") zoneObj.r = Math.min(70 * sizeFactor, sysBox.h * 0.4);
        else if (data.type === "belt") {
            zoneObj.w = Math.min(60 * sizeFactor, sysBox.w * 0.05);
            zoneObj.h = sysBox.h * 0.85;
            for (let i = 0; i < 40; i++) {
                asteroidParticles.push({
                    x: distinctX + (Math.random() - 0.5) * zoneObj.w,
                    y: sysCenterY + (Math.random() - 0.5) * (sysBox.h * 0.8),
                    r: Math.random() * 2 + 1
                });
            }
        } else if (data.type === "saturn") {
            zoneObj.r = Math.min(45 * sizeFactor, sysBox.h * 0.18);
            zoneObj.ringR = zoneObj.r * 2.2;
        } else {
            zoneObj.r = Math.min((data.r + 5) * sizeFactor, sysBox.h * 0.18);
        }

        zones.push(zoneObj);
    });

    // --- 5. INVENTARIO (Dentro de invBox) ---
    let shuffledData = [...solarSystemData].sort(() => Math.random() - 0.5);
    shuffledData.forEach((data, i) => {
        const cols = 10; // Una sola fila de 10 elementos
        const colW = invBox.w / cols;
        const rowH = invBox.h; // Ocupan todo el alto disponible
        const col = i % cols;

        let posX = invBox.x + (col * colW) + (colW / 2);
        let posY = invBox.y + (rowH / 2);

        // Aumentamos la escala para que se vean mucho más grandes
        const invScale = isPC ? 0.8 : 0.65; 
        let planetObj = {
            id: data.id,
            name: data.name,
            color: data.color,
            x: posX,
            y: posY,
            type: data.type,
            isDragging: false,
            isLocked: false,
            targetR: data.r * (isPC ? 1.2 : 0.85), 
            r: data.r * invScale, 
            w: (data.w || 40) * (data.id === "saturno" ? invScale * 1.5 : invScale),
            h: (data.h || 80) * invScale,
            originalX: posX, 
            originalY: posY
        };
        // Saturno en inventario ajustado para el nuevo tamaño
        if (planetObj.id === "saturno") planetObj.r *= 0.75;

        planets.push(planetObj);
    });
}

// --- UTILIDADES ---
function resizeCanvas() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    initGameElements();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Start immediately

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function isInside(x, y, obj) {
    if (obj.type === "belt") {
        const halfW = (obj.w || 60) * 1.5;
        const halfH = (obj.h || 80) / 2;
        return x > (obj.x - halfW) && x < (obj.x + halfW) &&
            y > (obj.y - halfH) && y < (obj.y + halfH);
    } else {
        let multiplier = 2.0;
        if (obj.type === "saturn") multiplier = 4.0; // Saturno tiene anillos grandes
        if (obj.r && obj.r < 20) multiplier = 3.5;  // Planetas pequeños como Mercurio
        return getDistance(x, y, obj.x, obj.y) < (obj.r || 20) * multiplier;
    }
}

// --- EVENTOS MOUSE / TOUCH ---
let selectedPlanet = null;
let dragOffset = { x: 0, y: 0 };

function getPos(e) {
    const rect = canvasElement.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
        x: (clientX - rect.left) * (canvasElement.width / rect.width),
        y: (clientY - rect.top) * (canvasElement.height / rect.height)
    };
}

function handleStart(e) {
    // Intentar bloquear orientación en el primer toque (requiere gesto del usuario)
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
    }

    if (isGameWon) {
        isGameWon = false;
        resetGame();
        return;
    }

    // 1. Verificar Botones (Área activa circular)
    const pos = getPos(e);

    const restartDist = getDistance(pos.x, pos.y, restartBtn.x + 25, restartBtn.y + 25);
    if (restartDist < 40) {
        resetGame();
        return;
    }

    const fsDist = getDistance(pos.x, pos.y, fsBtn.x + 25, fsBtn.y + 25);
    if (fsDist < 40) {
        toggleFullscreen();
        return;
    }

    const backDist = getDistance(pos.x, pos.y, backBtn.x + 25, backBtn.y + 25);
    if (backDist < 40) {
        window.location.href = 'index.html';
        return;
    }

    // 2. ¿Tocamos un planeta?
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p.isLocked) continue;
        if (isInside(pos.x, pos.y, p)) {
            if (e.type === 'touchstart') e.preventDefault(); // Ahora sí prevenimos para evitar scroll
            selectedPlanet = p;
            selectedPlanet.isDragging = true;
            dragOffset.x = pos.x - p.x;
            dragOffset.y = pos.y - p.y;
            // Traer al frente
            planets.splice(i, 1);
            planets.push(p);
            return;
        }
    }
}

function handleMove(e) {
    if (!selectedPlanet || !selectedPlanet.isDragging) return;
    if (e.type === 'touchmove') e.preventDefault();

    const pos = getPos(e);
    selectedPlanet.x = pos.x - dragOffset.x;
    selectedPlanet.y = pos.y - dragOffset.y;
}

function handleEnd(e) {
    if (!selectedPlanet || !selectedPlanet.isDragging) return;
    
    selectedPlanet.isDragging = false;
    checkDrop(selectedPlanet);
    selectedPlanet = null;
}

canvasElement.addEventListener('mousedown', handleStart);
canvasElement.addEventListener('mousemove', handleMove);
canvasElement.addEventListener('mouseup', handleEnd);

canvasElement.addEventListener('touchstart', handleStart, { passive: false });
canvasElement.addEventListener('touchmove', handleMove, { passive: false });
canvasElement.addEventListener('touchend', handleEnd, { passive: false });

// --- LÓGICA DE DROP ---
function checkDrop(planet) {
    let landedZone = zones.find(z => z.id === planet.id);

    if (landedZone) {
        let hit = false;
        if (landedZone.type === "belt") {
            hit = isInside(planet.x, planet.y, landedZone);
        } else {
            const dist = getDistance(planet.x, planet.y, landedZone.x, landedZone.y);
            const threshold = landedZone.r + 100; // Umbral ultra generoso para móviles (antes 60)
            hit = dist < threshold;
        }

        if (hit) {
            planet.x = landedZone.x;
            planet.y = landedZone.y;
            planet.isLocked = true;
            
            // Crecer al tamaño de la zona
            planet.r = landedZone.type === "star" ? landedZone.r : (landedZone.r - 5);
            if (planet.type === "belt") {
                planet.w = landedZone.w;
                planet.h = landedZone.h;
            }
            if (planet.type === "saturn") planet.r = landedZone.r;

            // Verificar Victoria
            if (planets.every(p => p.isLocked)) {
                triggerWin();
            }
            return;
        }
    }

    // Retorno suave (animación simple: teletransporte por ahora, idealmente lerp)
    planet.x = planet.originalX;
    planet.y = planet.originalY;
}

function triggerWin() {
    isGameWon = true;

    // Configurar trayectoria: Esquina inferior izquierda -> Superior derecha
    rocketX = 0;
    rocketY = window.innerHeight;

    const targetX = window.innerWidth;
    const targetY = 0;

    const dx = targetX - rocketX;
    const dy = targetY - rocketY;

    rocketAngle = Math.atan2(dy, dx);
    if (Math.abs(rocketAngle) < 0.1) rocketAngle = -0.785;

    // Lanzar confeti (usando librería global window.confetti si existe)
    if (window.confetti) {
        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 }
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 }
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }
}

function resetGame() {
    isGameWon = false;
    rocketY = 0;
    initGameElements();
}

// --- DIBUJADO ---
function drawGameElements() {
    canvasCtx.save();

    // BOTONES SUPERIORES (PC y Móvil)
    // VOLVER
    canvasCtx.fillStyle = "rgba(255, 68, 68, 0.8)";
    canvasCtx.beginPath();
    canvasCtx.arc(backBtn.x + 25, backBtn.y + 25, 25, 0, Math.PI * 2);
    canvasCtx.fill();
    canvasCtx.strokeStyle = "white";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
    
    canvasCtx.fillStyle = "white";
    canvasCtx.beginPath();
    canvasCtx.moveTo(backBtn.x + 15, backBtn.y + 25);
    canvasCtx.lineTo(backBtn.x + 35, backBtn.y + 15);
    canvasCtx.lineTo(backBtn.x + 35, backBtn.y + 35);
    canvasCtx.closePath();
    canvasCtx.fill();

    // REINICIAR
    canvasCtx.fillStyle = "rgba(68, 68, 255, 0.8)";
    canvasCtx.beginPath();
    canvasCtx.arc(restartBtn.x + 25, restartBtn.y + 25, 25, 0, Math.PI * 2);
    canvasCtx.fill();
    canvasCtx.strokeStyle = "white";
    canvasCtx.stroke();
    
    canvasCtx.strokeStyle = "white";
    canvasCtx.beginPath();
    canvasCtx.arc(restartBtn.x + 25, restartBtn.y + 25, 12, 0.2, Math.PI * 1.8);
    canvasCtx.stroke();

    // BOTÓN PANTALLA COMPLETA - SOLO MÓVIL (Esquina inferior derecha)
    if (!isPCGlobal) {
        canvasCtx.fillStyle = "rgba(255, 165, 0, 0.8)";
        canvasCtx.beginPath();
        canvasCtx.arc(fsBtn.x + 25, fsBtn.y + 25, 25, 0, Math.PI * 2);
        canvasCtx.fill();
        canvasCtx.strokeStyle = "white";
        canvasCtx.stroke();
        
        // Icono corchetes
        canvasCtx.strokeStyle = "white";
        canvasCtx.lineWidth = 2;
        const s = 10;
        const x = fsBtn.x + 25, y = fsBtn.y + 25;
        canvasCtx.beginPath();
        canvasCtx.moveTo(x - s, y - s + 5); canvasCtx.lineTo(x - s, y - s); canvasCtx.lineTo(x - s + 5, y - s);
        canvasCtx.moveTo(x + s - 5, y - s); canvasCtx.lineTo(x + s, y - s); canvasCtx.lineTo(x + s, y - s + 5);
        canvasCtx.moveTo(x + s, y + s - 5); canvasCtx.lineTo(x + s, y + s); canvasCtx.lineTo(x + s - 5, y + s);
        canvasCtx.moveTo(x - s + 5, y + s); canvasCtx.lineTo(x - s, y + s); canvasCtx.lineTo(x - s, y + s - 5);
        canvasCtx.stroke();
    }

    // Texto Instrucción 
    canvasCtx.fillStyle = "white";
    canvasCtx.font = isPCGlobal ? "bold 22px Arial" : "bold 16px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.fillText("Arrastra los planetas a su posición", canvasElement.width / 2, 35);

    // Caja Inventario (Borde sutil)
    canvasCtx.strokeStyle = "rgba(0, 255, 255, 0.2)";
    canvasCtx.setLineDash([5, 5]);
    canvasCtx.strokeRect(invBox.x, invBox.y, invBox.w, invBox.h);
    canvasCtx.setLineDash([]);
    canvasCtx.restore();

    // DIBUJAR ZONAS (Fantasmas)
    zones.forEach(zone => {
        canvasCtx.save();
        canvasCtx.strokeStyle = zone.baseColor;
        canvasCtx.lineWidth = 2;
        canvasCtx.setLineDash([4, 4]);
        canvasCtx.fillStyle = zone.color;

        const img = planetImages[zone.id];
        if (img && (img.complete || img.naturalWidth > 0)) {
            canvasCtx.globalAlpha = 0.3;
            let size = zone.r * 2.0;

            if (zone.type === "belt") {
                canvasCtx.drawImage(img, zone.x - zone.w / 2, zone.y - zone.h / 2, zone.w, zone.h);
            } else if (zone.type === "saturn") {
                canvasCtx.save();
                canvasCtx.translate(zone.x, zone.y);
                canvasCtx.rotate(-Math.PI / 1);
                let satW = zone.r * 4.5;
                let satH = zone.r * 2.5;
                canvasCtx.drawImage(img, -satW / 2, -satH / 2 + 5, satW, satH);
                canvasCtx.restore();
            } else {
                canvasCtx.drawImage(img, zone.x - size / 2, zone.y - size / 2, size, size);
            }
        }
        canvasCtx.globalAlpha = 1.0;

        // Contornos de las zonas
        if (zone.type === "star" || zone.type === "circle") {
            canvasCtx.beginPath();
            canvasCtx.arc(zone.x, zone.y, zone.r, 0, 2 * Math.PI);
            canvasCtx.stroke();
        } else if (zone.type === "saturn") {
            canvasCtx.beginPath();
            const rot = Math.PI / 10;
            const rX = zone.r * 2.2;
            const rY = zone.r * 0.45;
            canvasCtx.ellipse(zone.x + 8, zone.y - 1, zone.r * 1.2, zone.r * 0.7, rot, 3.8, 5.6);
            canvasCtx.ellipse(zone.x, zone.y, rX, rY, rot, 5.6, 0.7);
            canvasCtx.ellipse(zone.x - 4, zone.y - 2, zone.r * 1.2, zone.r * 0.7, rot, 0.7, 2.5);
            canvasCtx.ellipse(zone.x, zone.y, rX, rY, rot, 2.5, 3.8);
            canvasCtx.closePath();
            canvasCtx.stroke();
        }

        // Etiquetas inteligentes
        canvasCtx.setLineDash([]);
        canvasCtx.fillStyle = "rgba(255, 255, 255, 0.95)";
        canvasCtx.font = isPCGlobal ? "bold 16px Arial" : "bold 14px Arial";
        canvasCtx.textAlign = "center";
        
        let labelOffset = (zone.type === "belt" ? zone.h / 2 : zone.r) + 12;
        if (zone.type === "saturn") labelOffset += 8;
        
        const relY = (zone.y - sysBox.y) / sysBox.h;
        let ly = (relY > 0.5) ? zone.y - labelOffset - 5 : zone.y + labelOffset + 15;
        ly = Math.max(20, Math.min(canvasElement.height - 10, ly));
        
        canvasCtx.fillText(zone.name, zone.x, ly);
        canvasCtx.restore();
    });

    // DIBUJAR PLANETAS (Arrastrables)
    planets.forEach(planet => {
        canvasCtx.save();
        if (planet === selectedPlanet) {
            canvasCtx.shadowColor = "cyan"; canvasCtx.shadowBlur = 20;
            canvasCtx.translate(planet.x, planet.y);
            canvasCtx.scale(1.2, 1.2);
            canvasCtx.translate(-planet.x, -planet.y);
        }

        const img = planetImages[planet.id];
        if (img && (img.complete || img.naturalWidth > 0)) {
            let size = planet.r * 2.0;
            if (planet.type === "belt") {
                canvasCtx.drawImage(img, planet.x - planet.w / 2, planet.y - planet.h / 2, planet.w, planet.h);
            } else if (planet.type === "saturn") {
                let satW = planet.r * 4.5;
                let satH = planet.r * 2.5;
                canvasCtx.drawImage(img, planet.x - satW / 2, planet.y - satH / 2, satW, satH);
            } else {
                canvasCtx.drawImage(img, planet.x - size / 2, planet.y - size / 2, size, size);
            }
        } else {
            canvasCtx.fillStyle = planet.color;
            canvasCtx.beginPath(); canvasCtx.arc(planet.x, planet.y, planet.r, 0, 2 * Math.PI); canvasCtx.fill();
        }
        canvasCtx.restore();
    });

    if (isGameWon) {
        canvasCtx.save();
        canvasCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.fillStyle = "#FFD700";
        canvasCtx.font = "bold 50px Arial";
        canvasCtx.textAlign = "center";
        canvasCtx.shadowColor = "orange";
        canvasCtx.shadowBlur = 20;
        canvasCtx.fillText("¡CUIDADO ALIENÍGENA!", canvasElement.width / 2, canvasElement.height / 2 - 60);
        canvasCtx.fillStyle = "white";
        canvasCtx.font = "24px Arial";
        canvasCtx.shadowBlur = 0;
        canvasCtx.fillText("Has armado el Sistema Solar", canvasElement.width / 2, canvasElement.height / 2);
        canvasCtx.fillStyle = "#aaa";
        canvasCtx.font = "italic 20px Arial";
        canvasCtx.fillText("Haz clic en cualquier parte para volver", canvasElement.width / 2, canvasElement.height / 2 + 40);

        if (rocketImg.complete || rocketImg.naturalWidth > 0) {
            if (Math.abs(rocketAngle) < 0.01) rocketAngle = Math.atan2(-canvasElement.height, canvasElement.width);
            const speed = 25;
            rocketX += Math.cos(rocketAngle) * speed;
            rocketY += Math.sin(rocketAngle) * speed;
            canvasCtx.save();
            canvasCtx.translate(rocketX, rocketY);
            canvasCtx.rotate(rocketAngle + Math.PI / 4);
            canvasCtx.drawImage(rocketImg, -50, -50, 100, 100);
            canvasCtx.restore();
        }
        canvasCtx.restore();
    }
}

function loop() {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    drawGameElements();
    requestAnimationFrame(loop);
}

loop();
