#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MODELS = {
  'tiny': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    size: '39 MB'
  },
  'base': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    size: '142 MB'
  },
  'small': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    size: '466 MB'
  },
  'medium': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    size: '1.5 GB'
  },
  'large': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    size: '2.9 GB'
  }
};

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let downloadedBytes = 0;

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location, (redirectResponse) => {
          handleResponse(redirectResponse);
        });
      } else {
        handleResponse(response);
      }

      function handleResponse(res) {
        const totalBytes = parseInt(res.headers['content-length'], 10);

        res.pipe(file);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stdout.write(`\rTéléchargement: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
        });

        file.on('finish', () => {
          file.close();
          console.log('\n✓ Téléchargement terminé');
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function setupWhisper() {
  console.log('🎯 Configuration de Whisper pour la transcription locale\n');

  const modelName = process.argv[2] || 'base';
  const model = MODELS[modelName];

  if (!model) {
    console.error(`❌ Modèle inconnu: ${modelName}`);
    console.log('Modèles disponibles:', Object.keys(MODELS).join(', '));
    process.exit(1);
  }

  const modelsDir = path.join(__dirname, '..', 'server', 'models', 'whisper');
  const modelPath = path.join(modelsDir, `ggml-${modelName}.bin`);

  // Créer le répertoire
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  // Vérifier si le modèle existe déjà
  if (fs.existsSync(modelPath)) {
    console.log(`✓ Le modèle ${modelName} est déjà installé`);
    return;
  }

  console.log(`📥 Téléchargement du modèle ${modelName} (${model.size})...`);
  
  try {
    await downloadFile(model.url, modelPath);
    
    // Télécharger aussi l'exécutable whisper.cpp si nécessaire
    const platform = process.platform;
    const whisperExe = path.join(modelsDir, platform === 'win32' ? 'main.exe' : 'main');
    
    if (!fs.existsSync(whisperExe)) {
      console.log('\n📥 Téléchargement de whisper.cpp...');
      
      // Clone et compile whisper.cpp
      const whisperCppDir = path.join(modelsDir, 'whisper.cpp');
      
      if (!fs.existsSync(whisperCppDir)) {
        console.log('Clonage de whisper.cpp...');
        execSync(`git clone https://github.com/ggerganov/whisper.cpp.git "${whisperCppDir}"`, { stdio: 'inherit' });
      }
      
      console.log('Compilation de whisper.cpp...');
      process.chdir(whisperCppDir);
      
      if (platform === 'win32') {
        // Windows: utiliser cmake
        execSync('cmake -B build', { stdio: 'inherit' });
        execSync('cmake --build build --config Release', { stdio: 'inherit' });
        fs.copyFileSync(path.join('build', 'bin', 'Release', 'main.exe'), whisperExe);
      } else {
        // Linux/Mac: utiliser make
        execSync('make', { stdio: 'inherit' });
        fs.copyFileSync('main', whisperExe);
        fs.chmodSync(whisperExe, '755');
      }
    }

    console.log('\n✅ Installation terminée!');
    console.log(`\nPour tester: ${whisperExe} -m ${modelPath} -f audio.wav`);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Information sur les modèles
if (process.argv[2] === '--help') {
  console.log('Usage: node setup-whisper.js [model]\n');
  console.log('Modèles disponibles:');
  Object.entries(MODELS).forEach(([name, info]) => {
    console.log(`  ${name.padEnd(8)} - ${info.size}`);
  });
  console.log('\nRecommandations:');
  console.log('  - tiny:   Très rapide, qualité basique');
  console.log('  - base:   Bon compromis vitesse/qualité (recommandé)');
  console.log('  - small:  Meilleure qualité, plus lent');
  console.log('  - medium: Haute qualité, nécessite GPU');
  console.log('  - large:  Meilleure qualité, très lent sans GPU');
  process.exit(0);
}

setupWhisper();