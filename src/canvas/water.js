// Canvas owner for atmospheric water rendering.
export function createWaterCanvas(canvas) {
  const context = canvas ? canvas.getContext('2d') : null;
  let animationFrame = 0;
  let lastTime = 0;
  const ripples = [];

  const waves = [
    { speed: 0.0007, height: 18, length: 0.006, alpha: 0.08, y: 0.48 },
    { speed: 0.001, height: 26, length: 0.004, alpha: 0.055, y: 0.56 },
    { speed: 0.0014, height: 12, length: 0.009, alpha: 0.045, y: 0.38 }
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

    context.clearRect(0, 0, width, height);
    drawAtmosphere(width, height, time);
    waves.forEach((wave) => drawWaveLayer(width, height, time, wave));
    drawRipples(time);

    animationFrame = window.requestAnimationFrame(draw);
  }

  return {
    start() {
      if (!canvas || !context) {
        return;
      }

      resize();
      window.addEventListener('resize', resize);
      animationFrame = window.requestAnimationFrame(draw);
    },
    stop() {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    },
    ripple(x, y, strength = 1) {
      ripples.push({
        x,
        y,
        strength: Math.max(0.2, Math.min(strength, 2)),
        startedAt: lastTime || performance.now()
      });
    }
  };
}
