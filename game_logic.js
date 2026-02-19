// --- CONFIGURACIÓN BASE ---
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('canvas-overlay');
const canvasCtx = canvasElement.getContext('2d');
const statusText = document.getElementById('status-text');

// DETECCIÓN DE MÓVIL
const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Inyectar librería de confeti dinámicamente
if (!document.getElementById('confetti-script')) {
    const script = document.createElement('script');
    script.id = 'confetti-script';
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    document.body.appendChild(script);
}

// --- ESTADO DEL JUEGO ---
let HAND_DETECTED = false;
let IS_PINCHING = false;
let PINCH_THRESHOLD = 0.05;
let isGameWon = false;
let rocketY = 0; // Animación cohete
let rocketX = 0; // Animación cohete X
let rocketAngle = 0; // Ángulo de trayectoria

// Definición de las cajas delimitadoras
let invBox = { x: 0, y: 0, w: 0, h: 0 };
let sysBox = { x: 0, y: 0, w: 0, h: 0 };
let backBtn = { x: 0, y: 0, w: 120, h: 40 };
let restartBtn = { x: 0, y: 0, w: 150, h: 40 };

// Cohete
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

let planets = [];
let zones = [];
let asteroidParticles = [];

// ALGORITMO DE INICIALIZACIÓN (Responsive)
function initGameElements() {
    planets = [];
    zones = [];
    asteroidParticles = [];

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Margen seguro (10% a cada lado para facilitar detección de pinza)
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
    backBtn.w = 240; // Menos ancho (menos espacio lateral)
    backBtn.h = 25;  // Menos alto (menos espacio vertical)
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
resizeCanvas();

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
        return getDistance(x, y, obj.x, obj.y) < (obj.r || 20);
    }
}

// --- LÓGICA DE JUEGO ---
function checkDrop(planet) {
    let landedZone = zones.find(z => z.id === planet.id);

    if (landedZone) {
        let hit = false;
        if (landedZone.type === "belt") {
            hit = isInside(planet.x, planet.y, landedZone);
        } else {
            const dist = getDistance(planet.x, planet.y, landedZone.x, landedZone.y);
            const threshold = landedZone.r + 30;
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

    // Retorno suave
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

    // Lanzar confeti (si la librería está cargada)
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

function onResults(results) {
    if (IS_MOBILE) {
        drawGameElements();
        return;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        HAND_DETECTED = true;
        const landmarks = results.multiHandLandmarks[0];

        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        const cursorX = (1.0 - indexTip.x) * canvasElement.width;
        const cursorY = indexTip.y * canvasElement.height;
        const thumbX = (1.0 - thumbTip.x) * canvasElement.width;
        const thumbY = thumbTip.y * canvasElement.height;

        const pinchDist = getDistance(indexTip.x, indexTip.y, thumbTip.x, thumbTip.y);
        // Ajustar umbrales para mejorar experiencia
        const PINCH_START = 0.05;
        const PINCH_STOP = 0.08;

        if (IS_PINCHING) {
            if (pinchDist > PINCH_STOP) IS_PINCHING = false;
        } else {
            if (pinchDist < PINCH_START) IS_PINCHING = true;
        }

        updateGameLogic(cursorX, cursorY, IS_PINCHING);
        drawGameElements();
        drawCursor(cursorX, cursorY, IS_PINCHING);

        statusText.innerText = IS_PINCHING ? "AGARRANDO" : "Mano detectada";
    } else {
        HAND_DETECTED = false;
        drawGameElements();
        statusText.innerText = "Esperando mano...";
    }

    canvasCtx.restore();
}

function updateGameLogic(cursorX, cursorY, isPinching) {
    planets.forEach(planet => {
        if (planet.isLocked) return;

        if (isPinching) {
            if (!planet.isDragging) {
                const anyDragging = planets.some(p => p.isDragging);
                if (isInside(cursorX, cursorY, planet) && !anyDragging) {
                    planet.isDragging = true;
                }
            }
            if (planet.isDragging) {
                planet.x = cursorX;
                planet.y = cursorY;
            }
        } else {
            if (planet.isDragging) {
                planet.isDragging = false;
                checkDrop(planet);
            }
        }
    });
}

// --- DIBUJAR ---
function drawGameElements() {
    canvasCtx.save();

    if (IS_MOBILE) {
        // PANTALLA DE AVISO PARA MÓVILES
        canvasCtx.fillStyle = "black";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

        canvasCtx.fillStyle = "white";
        canvasCtx.font = "bold 20px Arial";
        canvasCtx.textAlign = "center";
        canvasCtx.fillText("Este modo está optimizado", canvasElement.width / 2, canvasElement.height / 2 - 20);
        canvasCtx.fillText("exclusivamente para PC", canvasElement.width / 2, canvasElement.height / 2 + 20);

        // Dibujar botón volver (Reutilizamos la posición y estilo)
        canvasCtx.fillStyle = "#ff4444";
        canvasCtx.beginPath();
        canvasCtx.roundRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h, 10);
        canvasCtx.fill();
        canvasCtx.fillStyle = "white";
        canvasCtx.font = "bold 16px Arial";
        canvasCtx.fillText("Volver a la página anterior", backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);

        canvasCtx.restore();
        return; // Detener el resto del dibujo
    }

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


function drawCursor(x, y, isPinching) {
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, isPinching ? 10 : 15, 0, 2 * Math.PI);
    canvasCtx.fillStyle = isPinching ? "#00ff00" : "rgba(255, 255, 0, 0.5)";
    canvasCtx.fill();
    canvasCtx.strokeStyle = "white";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
}

// Event handlers
canvasElement.addEventListener('mousedown', (e) => {
    if (isGameWon) {
        // Cerrar mensajes de felicitación al hacer clic
        isGameWon = false;
        return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseX > backBtn.x && mouseX < backBtn.x + backBtn.w &&
        mouseY > backBtn.y && mouseY < backBtn.y + backBtn.h) {
        window.location.href = 'index.html';
    }

    if (mouseX > restartBtn.x && mouseX < restartBtn.x + restartBtn.w &&
        mouseY > restartBtn.y && mouseY < restartBtn.y + restartBtn.h) {
        resetGame();
    }


});

canvasElement.addEventListener('touchstart', (e) => {
    const rect = canvasElement.getBoundingClientRect();
    const touch = e.touches[0];
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;

    if (mouseX > backBtn.x && mouseX < backBtn.x + backBtn.w &&
        mouseY > backBtn.y && mouseY < backBtn.y + backBtn.h) {
        window.location.href = 'index.html';
    }
}, { passive: false });

// --- INICIALIZACIÓN IA ---
// --- INICIALIZACIÓN ---
if (IS_MOBILE) {
    // Si estamos en móvil, NO iniciamos la cámara para ahorrar recursos
    // y mostramos directamente la pantalla de aviso.
    // Llamamos a drawGameElements una vez para pintar el aviso.
    // (Y nos aseguramos de que se repinte si cambia el tamaño)
    drawGameElements();
} else {
    // Inicialización IA (Solo PC)
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    camera.start();
}
