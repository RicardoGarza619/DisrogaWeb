const { Jimp } = require('jimp');
const path = require('path');

const INPUT  = path.join(__dirname, 'public', 'img', 'logo.png');
const OUTPUT = path.join(__dirname, 'public', 'img', 'logo.png');

async function removeBg() {
  const img = await Jimp.read(INPUT);
  const { width, height } = img.bitmap;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = img.bitmap.data[idx];
      const g = img.bitmap.data[idx + 1];
      const b = img.bitmap.data[idx + 2];

      // Hacer transparentes los píxeles claros (blanco/gris)
      const isBright   = r > 190 && g > 190 && b > 190;
      const isLightGray = Math.abs(r-g) < 15 && Math.abs(g-b) < 15 && r > 160;

      if (isBright || isLightGray) {
        img.bitmap.data[idx + 3] = 0;
      }
    }
  }

  await img.write(OUTPUT);
  console.log('✅ Logo guardado sin fondo:', OUTPUT);
}

removeBg().catch(e => console.error('Error:', e.message));
