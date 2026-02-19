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

    // Margen seguro (10% a cada lado para facilitar interacción)
    const marginX = width * 0.10;

    // 1. DEFINIR CAJAS
    // Caja Inventario: Parte superior
    invBox = {
        x: marginX,
        y: height * 0.12, // Espacio para el texto arriba
        w: width - (marginX * 2),
        h: height * 0.30
    };

    // BOTÓN VOLVER (Arriba)
    backBtn.w = 240;
    backBtn.h = 30;
    backBtn.x = width / 2 - backBtn.w / 2;
    backBtn.y = height * 0.02;

    // BOTÓN REINICIAR (Debajo de la caja de inventario)
    restartBtn.x = width / 2 - restartBtn.w / 2;
    restartBtn.y = invBox.y + invBox.h + (height * 0.02); // 2% del alto de separación

    // Caja Sistema Solar: Parte inferior
    sysBox = {
        x: marginX,
        y: height * 0.50,
        w: width - (marginX * 2),
        h: height * 0.45
    };

    // --- 2. ZONAS DESTINO (Dentro de sysBox) ---
    const sysCenterY = sysBox.y + (sysBox.h / 2);
    // Distribución: Sol a la izquierda, luego gaps variables
    const positionsPct = [0.10, 0.20, 0.27, 0.34, 0.41, 0.50, 0.63, 0.77, 0.89, 0.96];

    solarSystemData.forEach((data, index) => {
        let distinctX = sysBox.x + (sysBox.w * positionsPct[index]);
        let distinctY = sysCenterY;
        if (data.type !== "belt" && data.type !== "star") {
            const zigzag = height * 0.08;
            distinctY = (index % 2 !== 0) ? sysCenterY + zigzag : sysCenterY - zigzag;
        }

        let zoneObj = {
            id: data.id,
            name: data.name,
            baseColor: data.color,
            color: data.color.replace(")", ", 0.2)").replace("rgb", "rgba").replace("#", "#"),
            x: distinctX,
            y: distinctY,
            type: data.type
        };

        const scale = 1.0;
        if (data.type === "star") zoneObj.r = 60;
        else if (data.type === "belt") {
            zoneObj.w = 60;
            zoneObj.h = sysBox.h * 0.8;
            for (let i = 0; i < 40; i++) {
                asteroidParticles.push({
                    x: distinctX + (Math.random() - 0.5) * 40,
                    y: sysCenterY + (Math.random() - 0.5) * (sysBox.h * 0.8),
                    r: Math.random() * 3 + 1
                });
            }
        } else if (data.type === "saturn") {
            zoneObj.r = 35;
            zoneObj.ringR = 35 * 2.2;
        } else {
            zoneObj.r = data.r + 5;
        }

        zones.push(zoneObj);
    });

    // --- 3. INVENTARIO (Dentro de invBox) ---
    let shuffledData = [...solarSystemData].sort(() => Math.random() - 0.5);
    shuffledData.forEach((data) => {
        let halfW, halfH;
        if (data.type === "belt") {
            halfW = 20; halfH = 40;
        } else {
            let safeR = data.r;
            if (data.type === "saturn") safeR = 50;
            halfW = safeR; halfH = safeR;
        }

        const minX = invBox.x + halfW;
        const maxX = invBox.x + invBox.w - halfW;
        const minY = invBox.y + halfH;
        const maxY = invBox.y + invBox.h - halfH;

        let posX = minX + Math.random() * Math.max(0, maxX - minX);
        let posY = minY + Math.random() * Math.max(0, maxY - minY);

        let planetObj = {
            id: data.id,
            name: data.name,
            color: data.color,
            x: posX,
            y: posY,
            type: data.type,
            isDragging: false,
            isLocked: false,
            r: data.r, w: data.w, h: data.h,
            originalX: posX, originalY: posY
        };

        if (data.type === "belt") { planetObj.w = 40; planetObj.h = 80; }
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
        const halfW = (obj.w || 40) / 2;
        const halfH = (obj.h || 40) / 2;
        return x > (obj.x - halfW) && x < (obj.x + halfW) &&
            y > (obj.y - halfH) && y < (obj.y + halfH);
    } else {
        return getDistance(x, y, obj.x, obj.y) < (obj.r || 20) * 1.5; // Hitbox un poco más grande
    }
}

// --- EVENTOS MOUSE / TOUCH ---
let isDragging = false;
let draggedPlanet = null;
let dragOffset = { x: 0, y: 0 };

function getPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function handleStart(e) {
    if (isGameWon) {
        // Cerrar mensajes de felicitación al hacer clic
        isGameWon = false;
        return;
    }

    // Evitar scroll y comportamiento default solo si es touch
    if (e.type === 'touchstart') e.preventDefault();

    const pos = getPos(e);

    // 1. Verificar Botones
    // Volver
    if (pos.x > backBtn.x && pos.x < backBtn.x + backBtn.w &&
        pos.y > backBtn.y && pos.y < backBtn.y + backBtn.h) {
        window.location.href = 'index.html';
        return;
    }
    // Reiniciar
    if (pos.x > restartBtn.x && pos.x < restartBtn.x + restartBtn.w &&
        pos.y > restartBtn.y && pos.y < restartBtn.y + restartBtn.h) {
        resetGame();
        return;
    }

    // 2. Iterar al revés para agarrar el de arriba
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p.isLocked) continue;

        if (isInside(pos.x, pos.y, p)) {
            draggedPlanet = p;
            isDragging = true;
            dragOffset.x = pos.x - p.x;
            dragOffset.y = pos.y - p.y;

            // Mover al final para dibujar encima
            planets.splice(i, 1);
            planets.push(p);


            return;
        }
    }
}

function handleMove(e) {
    if (!isDragging || !draggedPlanet) return;
    if (e.type === 'touchmove') e.preventDefault();

    const pos = getPos(e);
    draggedPlanet.x = pos.x - dragOffset.x;
    draggedPlanet.y = pos.y - dragOffset.y;
}

function handleEnd(e) {
    if (!isDragging || !draggedPlanet) return;

    checkDrop(draggedPlanet);

    isDragging = false;
    draggedPlanet = null;

}

canvasElement.addEventListener('mousedown', handleStart);
canvasElement.addEventListener('touchstart', handleStart, { passive: false });

canvasElement.addEventListener('mousemove', handleMove);
canvasElement.addEventListener('touchmove', handleMove, { passive: false });

window.addEventListener('mouseup', handleEnd); // Window para no perder el drop si sale del canvas
window.addEventListener('touchend', handleEnd);

// --- LÓGICA DE DROP ---
function checkDrop(planet) {
    let landedZone = zones.find(z => z.id === planet.id);

    if (landedZone) {
        let hit = false;
        if (landedZone.type === "belt") {
            hit = isInside(planet.x, planet.y, landedZone);
        } else {
            const dist = getDistance(planet.x, planet.y, landedZone.x, landedZone.y);
            const threshold = landedZone.r + 30; // Margen generoso
            hit = dist < threshold;
        }

        if (hit) {
            planet.x = landedZone.x;
            planet.y = landedZone.y;
            planet.isLocked = true;

            if (planet.type === "belt") {
                planet.w = landedZone.w;
                planet.h = landedZone.h;
            }

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

    // BOTÓN VOLVER (Arriba)
    canvasCtx.fillStyle = "#ff4444";
    canvasCtx.beginPath();
    canvasCtx.roundRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h, 10);
    canvasCtx.fill();
    canvasCtx.strokeStyle = "white";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();

    canvasCtx.fillStyle = "white";
    canvasCtx.font = "bold 16px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.textBaseline = "middle";
    canvasCtx.fillText("Volver a la página anterior", backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);

    // BOTÓN REINICIAR (Debajo del inventario)
    canvasCtx.fillStyle = "#4444ff";
    canvasCtx.beginPath();
    canvasCtx.roundRect(restartBtn.x, restartBtn.y, restartBtn.w, restartBtn.h, 10);
    canvasCtx.fill();
    canvasCtx.strokeStyle = "white";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();

    canvasCtx.fillStyle = "white";
    canvasCtx.fillText("REINICIAR", restartBtn.x + restartBtn.w / 2, restartBtn.y + restartBtn.h / 2);


    // Texto Instrucción (Abajo del botón)
    canvasCtx.fillStyle = "rgba(200, 200, 255, 0.9)";
    canvasCtx.font = "bold 20px Arial";
    canvasCtx.fillText("Arrastra los elementos dentro de la caja a su posición correcta", canvasElement.width / 2, invBox.y - 15);

    // Caja Inventario
    canvasCtx.strokeStyle = "rgba(0, 255, 255, 0.3)";
    canvasCtx.strokeRect(invBox.x, invBox.y, invBox.w, invBox.h);

    canvasCtx.restore();

    zones.forEach(zone => {
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
        if (planet.isDragging) {
            canvasCtx.shadowColor = "white"; canvasCtx.shadowBlur = 15;
            canvasCtx.translate(planet.x, planet.y);
            canvasCtx.scale(1.1, 1.1);
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
