// Script temporaire pour créer des icônes de base
const fs = require('fs');
const path = require('path');

// Créer un fichier ICO de base (16x16 pixels, format très simple)
const createBasicIco = () => {
  // En-tête ICO
  const iconDir = Buffer.from([
    0x00, 0x00, // Reserved
    0x01, 0x00, // Type (1 = ICO)
    0x01, 0x00, // Number of images (1)
    
    // Image directory entry
    0x10,       // Width (16px)
    0x10,       // Height (16px)
    0x00,       // Color palette
    0x00,       // Reserved
    0x01, 0x00, // Color planes
    0x20, 0x00, // Bits per pixel (32)
    0x68, 0x01, 0x00, 0x00, // Size of image data
    0x16, 0x00, 0x00, 0x00  // Offset to image data
  ]);

  // Créer une image 16x16 bleue simple
  const pixels = [];
  for (let i = 0; i < 16 * 16; i++) {
    pixels.push(0xEB, 0x63, 0x25, 0xFF); // Bleu #2563EB en BGRA
  }

  // En-tête BMP
  const bmpHeader = Buffer.from([
    0x28, 0x00, 0x00, 0x00, // Header size (40 bytes)
    0x10, 0x00, 0x00, 0x00, // Width (16px)
    0x20, 0x00, 0x00, 0x00, // Height (32px for ICO = 2x height)
    0x01, 0x00,             // Planes
    0x20, 0x00,             // Bits per pixel (32)
    0x00, 0x00, 0x00, 0x00, // Compression (none)
    0x00, 0x01, 0x00, 0x00, // Image size
    0x00, 0x00, 0x00, 0x00, // X pixels per meter
    0x00, 0x00, 0x00, 0x00, // Y pixels per meter
    0x00, 0x00, 0x00, 0x00, // Colors used
    0x00, 0x00, 0x00, 0x00  // Important colors
  ]);

  const pixelData = Buffer.from(pixels);
  
  // Masque AND (tous les pixels opaques)
  const andMask = Buffer.alloc(16 * 4, 0x00);

  const ico = Buffer.concat([iconDir, bmpHeader, pixelData, andMask]);
  
  fs.writeFileSync(path.join(__dirname, 'assets', 'icon.ico'), ico);
  fs.writeFileSync(path.join(__dirname, 'assets', 'tray.ico'), ico);
  
  console.log('Icônes créées!');
};

createBasicIco();