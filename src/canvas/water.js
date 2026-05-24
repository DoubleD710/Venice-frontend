// Canvas owner for Venice's layered atmospheric water rendering.
export function createWaterCanvas(canvas) {
  const context = canvas ? canvas.getContext('2d') : null;
  let animationFrame = 0;
  let lastTime = 0;
  let isRunning = false;
  const ripples = [];
  const maxRipples = 24;

  const waves = [
    { speed: 0.00055, height: 16, length: 0.005, alpha: 0.07, y: 0.42 },
    { speed: 0.00085, height: 24, length: 0.004, alpha: 0.055, y: 0.54 },
    { speed: 0.0012, height: 12, length: 0.008, alpha: 0.045, y: 0.66 }
  ];

  function resize() {
    if (!canvas) {
      return;
    }

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * scale);
    canvas.height = Math.floor(window.innerHeight * scale);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function clearFrame(width, height) {
    context.clearRect(0, 0, width, height);
  }

  function drawAtmosphere(width, height, time) {
    const glow = 0.18 + Math.sin(time * 0.001) * 0.04;
    const gradient = context.createRadialGradient(
      width * 0.5,
      height * 0.42,
      0,
      width * 0.5,
      height * 0.42,
      width * 0.44
    );

    gradient.addColorStop(0, `rgba(143, 215, 199, ${glow})`);
    gradient.addColorStop(0.55, 'rgba(143, 215, 199, 0.055)');
    gradient.addColorStop(1, 'rgba(143, 215, 199, 0)');

    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.42, width * 0.36, height * 0.2, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawLightVeil(width, height, time) {
    const drift = Math.sin(time * 0.00045) * width * 0.04;
    const gradient = context.createLinearGradient(0, height * 0.18, width, height * 0.88);

    gradient.addColorStop(0, 'rgba(244, 240, 234, 0)');
    gradient.addColorStop(0.52, 'rgba(244, 240, 234, 0.045)');
    gradient.addColorStop(1, 'rgba(244, 240, 234, 0)');

    context.save();
    context.translate(drift, 0);
    context.fillStyle = gradient;
    context.fillRect(-width * 0.1, 0, width * 1.2, height);
    context.restore();
  }

  function drawWaveLayer(width, height, time, wave) {
    const baseY = height * wave.y;

    context.beginPath();
    context.moveTo(0, height);

    for (let x = 0; x <= width; x += 18) {
      const primary = Math.sin(x * wave.length + time * wave.speed) * wave.height;
      const secondary = Math.sin(x * wave.length * 0.54 - time * wave.speed * 1.7) * wave.height * 0.45;
      const y = baseY + primary + secondary;

      context.lineTo(x, y);
    }

    context.lineTo(width, height);
    context.closePath();
    context.fillStyle = `rgba(143, 215, 199, ${wave.alpha})`;
    context.fill();
  }

  function drawWaveHighlights(width, height, time) {
    context.strokeStyle = 'rgba(244, 240, 234, 0.075)';
    context.lineWidth = 1;

    for (let row = 0; row < 3; row += 1) {
      const baseY = height * (0.44 + row * 0.11);

      context.beginPath();

      for (let x = 0; x <= width; x += 24) {
        const y = baseY + Math.sin(x * 0.01 + time * 0.001 + row) * 8;

        if (x === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.stroke();
    }
  }

  function drawRipples(time) {
    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      const ripple = ripples[index];
      const age = time - ripple.startedAt;
      const life = 1300;
      const progress = age / life;

      if (progress >= 1) {
        ripples.splice(index, 1);
        continue;
      }

      const radius = 18 + progress * 150 * ripple.strength;
      const alpha = (1 - progress) * 0.22 * ripple.strength;

      context.strokeStyle = `rgba(244, 240, 234, ${alpha})`;
      context.lineWidth = 1 + ripple.strength;
      context.beginPath();
      context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function draw(time = 0) {
    if (!context) {
      return;
    }

    lastTime = time;
    const width = window.innerWidth;
    const height = window.innerHeight;

    clearFrame(width, height);
    drawAtmosphere(width, height, time);
    drawLightVeil(width, height, time);
    waves.forEach((wave) => drawWaveLayer(width, height, time, wave));
    drawWaveHighlights(width, height, time);
    drawRipples(time);

    animationFrame = window.requestAnimationFrame(draw);
  }

  return {
    start() {
      if (!canvas || !context || isRunning) {
        return;
      }

      isRunning = true;
      resize();
      window.addEventListener('resize', resize);
      animationFrame = window.requestAnimationFrame(draw);
    },
    stop() {
      isRunning = false;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    },
    ripple(x, y, strength = 1) {
      if (ripples.length >= maxRipples) {
        ripples.shift();
      }

      ripples.push({
        x,
        y,
        strength: Math.max(0.2, Math.min(strength, 2)),
        startedAt: lastTime || performance.now()
      });
    }
  };
}
