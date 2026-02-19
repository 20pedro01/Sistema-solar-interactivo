# 🌌 Sistema Solar Web interactivo

¡Bienvenido al **Sistema Solar Web Interactivo**! Un proyecto educativo diseñado para que niños y entusiastas del espacio aprendan sobre nuestro sistema solar de una manera dinámica y divertida.


## 🚀 Características principales

Este proyecto ofrece dos modos de interacción únicos:

1.  **👆 Modo táctil / Mouse**: Arrastra y suelta los planetas para ordenarlos en sus órbitas. Ideal para dispositivos móviles y tablets.
2.  **📷 Modo cámara (IA)**: ¡Controla el sistema solar con tus manos! Usando la tecnología de **MediaPipe**, el juego detecta tu dedo índice frente a la cámara web para mover los planetas en tiempo real. (Optimizado para PC).

## 🛠️ Tecnologías utilizadas

*   **Frontend**: HTML5, CSS3 (Animaciones estelares, Glassmorphism).
*   **Lógica**: JavaScript (Vanilla JS).
*   **Inteligencia Artificial**: [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html) para el reconocimiento gestual.
*   **Servidor Local**: Python (con FastAPI/Uvicorn) para pruebas rápidas.

## 📂 Estructura del proyecto

*   `index.html`: Pantalla de inicio y selector de modo.
*   `camera.html`: Interfaz del modo con reconocimiento de cámara.
*   `drag.html`: Interfaz del modo de arrastre táctil.
*   `game_logic.js`: El "cerebro" que maneja la física y detección de IA.
*   `Assets/`: Carpeta con iconos SVG de los planetas y el Sol.
*   `server.py`: Pequeño servidor Python para ejecutar el proyecto localmente.

## 💻 Cómo ejecutarlo

### Opción 1: Directo en el navegador
Simplemente abre el archivo `index.html` en tu navegador favorito (Chrome recomendado para el modo cámara).

### Opción 2: Usando el servidor Python
Si tienes Python instalado:
1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta:
   ```bash
   python server.py
   ```
3. Abre tu navegador en `http://localhost:8000`.

## 👤 Autor
**Pedro Cauich 🐧**
*   [Instagram](https://www.instagram.com/pedro_cauichpat/)
*   [TikTok](https://www.tiktok.com/@pedro_cauich)
*   [GitHub](https://github.com/20pedro01/)

---
*Este proyecto fue creado con fines educativos y de aprendizaje en desarrollo web e IA.*
