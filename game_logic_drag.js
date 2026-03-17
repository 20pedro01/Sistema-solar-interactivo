// 1. CONFIGURACIÓN E IMPORTACIONES
const canvasElement = document.getElementById('canvas-overlay'); // CORRECTED ID
const canvasCtx = canvasElement.getContext('2d');


// Inyectar librería de confeti dinámicamente (si no existe)
if (!document.getElementById('confetti-script')) {
    const script = document.createElement('script');
    script.id = 'confetti-script';
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    document.body.appendChild(script);
}

// Ajustar canvas a pantalla completa
canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;

// Variables de Juego
let planets = [];
let zones = [];
let invBox = {}, sysBox = {};
let isGameWon = false;
let rocketX = 0, rocketY = 0, rocketAngle = 0;
let asteroidParticles = [];

// Intentar bloquear orientación en móviles
if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(e => {
        console.log("No se pudo bloquear la orientación:", e);
    });
}

// BOTONES (Definidos globalmente para uso en eventos y dibujado)
const backBtn = { x: 20, y: 20, w: 200, h: 40 };
const restartBtn = { x: 0, y: 0, w: 200, h: 50 }; // Posición calculada en init

// Solución Imagen Cohete
const rocketImg = new Image();
rocketImg.src = "https://cdn-icons-png.flaticon.com/512/1356/1356479.png";


// --- DEFINICIÓN DEL SISTEMA SOLAR ---
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
    planets = [];
    zones = [];
    asteroidParticles = [];

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPC = width > 1024;

    // 1. BOTONES (Esquinas superiores con margen)
    const padding = isPC ? 30 : 15;
    backBtn.w = 50; backBtn.h = 50;
    backBtn.x = padding; backBtn.y = padding;

    restartBtn.w = 50; restartBtn.h = 50;
    restartBtn.x = width - padding - 50; restartBtn.y = padding;

    // 2. CAJA INVENTARIO (Panel superior)
    // Más alta en PC, más margen lateral
    const sideMargin = width * 0.08;
    invBox = {
        x: sideMargin, 
        y: padding,
        w: width - (sideMargin * 2),
        h: isPC ? height * 0.20 : Math.min(height * 0.22, 110)
    };

    // 3. CAJA SISTEMA (Panel inferior)
    sysBox = {
        x: sideMargin,
        y: invBox.y + invBox.h + (isPC ? 60 : 30),
        w: width - (sideMargin * 2),
        h: height - (invBox.y + invBox.h + (isPC ? 100 : 50))
    };

    // --- 4. ZONAS DESTINO (Dentro de sysBox) ---
    const sysCenterY = sysBox.y + (sysBox.h / 2);
    // Distribución horizontal proporcional (Sol más centrado si es PC)
    const positionsPct = [0.05, 0.16, 0.24, 0.32, 0.40, 0.52, 0.68, 0.82, 0.91, 0.98];

    solarSystemData.forEach((data, index) => {
        let distinctX = sysBox.x + (sysBox.w * positionsPct[index]);
        let distinctY = sysCenterY;
        
        // Zigzag más pronunciado en PC
        if (data.type !== "belt" && data.type !== "star" && sysBox.h > 200) {
            const zigzagAmt = isPC ? sysBox.h * 0.20 : sysBox.h * 0.15;
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
            originalR: data.r // Guardar radio original
        };

        const sizeFactor = isPC ? 1.2 : 1.0;
        if (data.type === "star") zoneObj.r = Math.min(70 * sizeFactor, sysBox.h * 0.35);
        else if (data.type === "belt") {
            zoneObj.w = Math.min(60 * sizeFactor, sysBox.w * 0.06);
            zoneObj.h = sysBox.h * 0.85;
            for (let i = 0; i < 40; i++) {
                asteroidParticles.push({
                    x: distinctX + (Math.random() - 0.5) * zoneObj.w,
                    y: sysCenterY + (Math.random() - 0.5) * zoneObj.h,
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
        const cols = isPC ? 5 : 5;
        const colW = invBox.w / cols;
        const rowH = invBox.h / 2;
        const col = i % cols;
        const row = Math.floor(i / cols);

        let posX = invBox.x + (col * colW) + (colW / 2);
        let posY = invBox.y + (row * rowH) + (rowH / 2);

        // Los planetas en inventario son un poco más pequeños pero crecen al soltarse
        let planetObj = {
            id: data.id,
            name: data.name,
            color: data.color,
            x: posX,
            y: posY,
            type: data.type,
            isDragging: false,
            isLocked: false,
            targetR: data.r * (isPC ? 1.2 : 1.0), // El tamaño que debe tener en el sistema
            r: data.r * 0.6, // Tamaño inicial en inventario
            w: (data.w || 40) * 0.6,
            h: (data.h || 80) * 0.6,
            originalX: posX, 
            originalY: posY
        };

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

    // No prevenir default aquí para permitir clics en botones, pero sí para el canvas después
    const pos = getPos(e);

    // 1. Verificar Botones (Área activa circular)
    const distBack = getDistance(pos.x, pos.y, backBtn.x + 25, backBtn.y + 25);
    if (distBack < 40) {
        window.location.href = 'index.html';
        return;
    }

    const distRestart = getDistance(pos.x, pos.y, restartBtn.x + 25, restartBtn.y + 25);
    if (distRestart < 40) {
        resetGame();
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

// --- DIBUJADO (Loop Principal) ---
function drawGameElements() {
    canvasCtx.save();

    // BOTÓN VOLVER (Círculo rojo con flecha)
    canvasCtx.fillStyle = "rgba(255, 68, 68, 0.8)";
    canvasCtx.beginPath();
    canvasCtx.arc(backBtn.x + 25, backBtn.y + 25, 25, 0, Math.PI * 2);
    canvasCtx.fill();
    canvasCtx.strokeStyle = "white";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
    
    // Icono Flecha Volver
    canvasCtx.fillStyle = "white";
    canvasCtx.beginPath();
    canvasCtx.moveTo(backBtn.x + 15, backBtn.y + 25);
    canvasCtx.lineTo(backBtn.x + 35, backBtn.y + 15);
    canvasCtx.lineTo(backBtn.x + 35, backBtn.y + 35);
    canvasCtx.closePath();
    canvasCtx.fill();

    // BOTÓN REINICIAR (Círculo azul con flecha circular)
    canvasCtx.fillStyle = "rgba(68, 68, 255, 0.8)";
    canvasCtx.beginPath();
    canvasCtx.arc(restartBtn.x + 25, restartBtn.y + 25, 25, 0, Math.PI * 2);
    canvasCtx.fill();
    canvasCtx.strokeStyle = "white";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
    
    // Icono Reiniciar (Círculo incompleto)
    canvasCtx.strokeStyle = "white";
    canvasCtx.beginPath();
    canvasCtx.arc(restartBtn.x + 25, restartBtn.y + 25, 12, 0.2, Math.PI * 1.8);
    canvasCtx.stroke();

    // Texto Instrucción 
    canvasCtx.fillStyle = "white";
    canvasCtx.font = "bold 16px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.fillText("Arrastra los planetas a su posición", canvasElement.width / 2, 25);

    // Caja Inventario (Borde sutil)
    canvasCtx.strokeStyle = "rgba(0, 255, 255, 0.2)";
    canvasCtx.setLineDash([5, 5]);
    canvasCtx.strokeRect(invBox.x, invBox.y, invBox.w, invBox.h);
    canvasCtx.setLineDash([]);

    canvasCtx.restore();

    zones.forEach(zone => {
        // ... (resto del código de zonas igual)
        canvasCtx.save();
        canvasCtx.strokeStyle = zone.baseColor;
        canvasCtx.lineWidth = 2;
        canvasCtx.setLineDash([4, 4]);
        canvasCtx.fillStyle = zone.color;

        if (planetImages[zone.id] && planetImages[zone.id].complete) {
            canvasCtx.globalAlpha = 0.3;
            let size = zone.r * 2.0;

            if (zone.type === "belt") {
                canvasCtx.drawImage(planetImages[zone.id], zone.x - zone.w / 2, zone.y - zone.h / 2, zone.w, zone.h);
            } else if (zone.type === "saturn") {
                // Dibujar Saturno fantasma ROTADO
                canvasCtx.save();
                canvasCtx.translate(zone.x, zone.y);
                canvasCtx.rotate(-Math.PI / 1);
                let satW = zone.r * 4.5;
                let satH = zone.r * 2.5;
                canvasCtx.drawImage(planetImages[zone.id], -satW / 2, -satH / 2 + 5, satW, satH);
                canvasCtx.restore();
            } else {
                canvasCtx.drawImage(planetImages[zone.id], zone.x - size / 2, zone.y - size / 2, size, size);
            }
        }
        canvasCtx.globalAlpha = 1.0;

        // Outlines
        if (zone.type === "star") {
            canvasCtx.beginPath();
            canvasCtx.arc(zone.x, zone.y, zone.r, 0, 2 * Math.PI);
            canvasCtx.stroke();
        } else if (zone.type === "belt") {
            // No stroke
        } else if (zone.type === "saturn") {
            // Contorno Saturno
            canvasCtx.beginPath();
            const rot = Math.PI / 10;
            canvasCtx.ellipse(zone.x + 10, zone.y - 1, zone.r * 1.5, zone.r * 0.8, rot, 3.8, 5.6);
            canvasCtx.ellipse(zone.x, zone.y, zone.r * 2.8, zone.r * 0.5, rot, 5.6, 0.7);
            canvasCtx.ellipse(zone.x - 6, zone.y - 2.5, zone.r * 1.5, zone.r * 0.8, rot, 0.7, 2.5);
            canvasCtx.ellipse(zone.x, zone.y, zone.r * 2.8, zone.r * 0.5, rot, 2.5, 3.8);
            canvasCtx.closePath();
            canvasCtx.stroke();
        } else {
            canvasCtx.beginPath();
            canvasCtx.arc(zone.x, zone.y, zone.r, 0, 2 * Math.PI);
            canvasCtx.stroke();
        }

        // Labels
        canvasCtx.setLineDash([]);
        canvasCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
        canvasCtx.font = "12px Arial";
        let labelOffset = (zone.type === "belt" ? zone.h / 2 : zone.r) + 20;
        if (zone.type === "saturn") labelOffset += 10;
        canvasCtx.textAlign = "center";
        canvasCtx.fillText(zone.name, zone.x, zone.y + (zone.type === "star" ? zone.r + 20 : labelOffset));
        canvasCtx.restore();
    });

    planets.forEach(planet => {
        canvasCtx.save();
        if (planet === selectedPlanet) {
            canvasCtx.shadowColor = "cyan"; canvasCtx.shadowBlur = 20;
            canvasCtx.translate(planet.x, planet.y);
            canvasCtx.scale(1.2, 1.2);
            canvasCtx.translate(-planet.x, -planet.y);
        }

        if (planetImages[planet.id] && planetImages[planet.id].complete) {
            let size = planet.r * 2.0;
            if (planet.type === "belt") {
                canvasCtx.drawImage(planetImages[planet.id], planet.x - planet.w / 2, planet.y - planet.h / 2, planet.w, planet.h);
            } else if (planet.type === "saturn") {
                let satW = planet.r * 4.5;
                let satH = planet.r * 2.5;
                canvasCtx.drawImage(planetImages[planet.id], planet.x - satW / 2, planet.y - satH / 2, satW, satH);
            } else {
                canvasCtx.drawImage(planetImages[planet.id], planet.x - size / 2, planet.y - size / 2, size, size);
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

        if (rocketImg.complete) {
            if (Math.abs(rocketAngle) < 0.01) {
                rocketAngle = Math.atan2(0 - canvasElement.height, canvasElement.width - 0);
            }
            const speed = 30;
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
