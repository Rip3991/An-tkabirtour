import * as THREE from 'three';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createTravertineTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#cfa96e';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const rowH = 512 / rows;
  const colW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const shade = (Math.sin(r * 3.1 + c * 5.7) * 0.5 + 0.5) * 18 - 9;
      const baseR = Math.min(255, Math.max(0, 209 + shade));
      const baseG = Math.min(255, Math.max(0, 171 + shade));
      const baseB = Math.min(255, Math.max(0, 112 + shade * 0.7));
      ctx.fillStyle = `rgb(${baseR | 0}, ${baseG | 0}, ${baseB | 0})`;
      ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);

      // Subtle travertine sedimentary striations
      ctx.fillStyle = 'rgba(130, 95, 52, 0.08)';
      for (let s = 0; s < 4; s++) {
        const sy = y + 6 + s * (rowH / 4);
        ctx.fillRect(x + 4, sy, colW - 8, 2);
      }
    }
  }

  // Subtle mortar lines
  ctx.strokeStyle = 'rgba(110, 82, 46, 0.35)';
  ctx.lineWidth = 2;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * rowH);
    ctx.lineTo(512, r * rowH);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createKilimPlazaTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 1024);
  ctx.fillStyle = '#c9b9a1';
  ctx.fillRect(0, 0, 1024, 1024);

  // Outer travertine border frame
  ctx.fillStyle = '#9c8b76';
  ctx.fillRect(36, 36, 952, 952);
  ctx.fillStyle = '#d3c4ad';
  ctx.fillRect(54, 54, 916, 916);

  // Subtle stone grid tiles
  ctx.strokeStyle = 'rgba(110, 96, 78, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 54; i <= 970; i += 44) {
    ctx.beginPath();
    ctx.moveTo(i, 54);
    ctx.lineTo(i, 970);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(54, i);
    ctx.lineTo(970, i);
    ctx.stroke();
  }

  // Inner kilim geometric frame
  ctx.strokeStyle = '#8e7d68';
  ctx.lineWidth = 8;
  ctx.strokeRect(110, 110, 804, 804);
  ctx.strokeStyle = 'rgba(142, 125, 104, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(128, 128, 768, 768);

  // Crisp, legible "K. Atatürk" signature in dark basalt stone centered in Toren Meydani
  ctx.save();
  ctx.translate(512, 505);
  ctx.transform(1, 0, -0.16, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 700 116px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#232428';
  ctx.fillText('K. Atatürk', 0, 0);

  // Signature underline sweep
  ctx.strokeStyle = '#232428';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-250, 74);
  ctx.quadraticCurveTo(0, 48, 255, 58);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAslanliPaverTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  // Grass-filled joints base
  ctx.fillStyle = '#4c6838';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const rowH = 512 / rows;
  const colW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const v = (Math.sin(r * 4.3 + c * 2.1) * 0.5 + 0.5) * 14 - 7;
      ctx.fillStyle = `rgb(${(198 + v) | 0}, ${(186 + v) | 0}, ${(166 + v) | 0})`;
      ctx.fillRect(x + 4, y + 4, colW - 8, rowH - 8);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createInscriptionTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#c89e5a';
  ctx.fillRect(0, 0, 256, 512);

  ctx.fillStyle = '#f1d382';
  for (let y = 24; y < 488; y += 14) {
    const lineW = 160 + Math.sin(y * 0.37) * 35;
    ctx.fillRect(28, y, lineW, 5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createTurkishFlagTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 340);
  ctx.fillStyle = '#e30a17';
  ctx.fillRect(0, 0, 512, 340);

  // Outer white crescent
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(185, 170, 82, 0, Math.PI * 2);
  ctx.fill();

  // Inner red cutout
  ctx.fillStyle = '#e30a17';
  ctx.beginPath();
  ctx.arc(206, 170, 66, 0, Math.PI * 2);
  ctx.fill();

  // 5-pointed star
  ctx.fillStyle = '#ffffff';
  const cx = 296;
  const cy = 170;
  const outerR = 34;
  const innerR = 13;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2 + 0.15;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBustInscriptionTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 640);
  ctx.fillStyle = '#15171b';
  ctx.fillRect(0, 0, 512, 640);

  // Subtle granite grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let i = 0; i < 400; i++) {
    const gx = (i * 73) % 512;
    const gy = (i * 137) % 640;
    ctx.fillRect(gx, gy, 2, 2);
  }

  // Gold lettering: NE MUTLU TÜRKÜM DİYENE
  ctx.fillStyle = '#e4be63';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('NE', 256, 150);
  ctx.fillText('MUTLU', 256, 225);
  ctx.fillText('TÜRKÜM', 256, 300);
  ctx.fillText('DİYENE', 256, 375);

  // Stylized K. Atatürk signature flourish in gold
  ctx.strokeStyle = '#e4be63';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(120, 480);
  ctx.bezierCurveTo(160, 430, 175, 515, 210, 465);
  ctx.bezierCurveTo(245, 425, 275, 495, 315, 455);
  ctx.bezierCurveTo(345, 430, 365, 470, 395, 445);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(135, 505);
  ctx.quadraticCurveTo(260, 485, 385, 472);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLawnTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#537a31';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle mowed lawn stripes
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(110, 152, 62, 0.16)' : 'rgba(55, 88, 30, 0.14)';
    ctx.fillRect(0, i * 32, 512, 32);
  }

  // Natural grass & sun-dappled turf speckles
  for (let i = 0; i < 1400; i++) {
    const gx = (i * 97) % 512;
    const gy = (i * 193) % 512;
    const shade = (i % 3 === 0) ? 'rgba(130, 170, 72, 0.28)' : 'rgba(42, 68, 22, 0.25)';
    ctx.fillStyle = shade;
    ctx.fillRect(gx, gy, 3, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  tex.anisotropy = maxAnisotropy;
  return tex;
}
