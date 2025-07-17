#!/usr/bin/env node

// Script de démarrage du serveur 3CX-Ninja
// Ce script gère le démarrage du serveur même si les fichiers TypeScript ne sont pas encore compilés

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[START] Démarrage du serveur 3CX-Ninja...');

// Vérifier si le serveur est compilé
const distPath = path.join(__dirname, 'server/dist/index.js');
const srcPath = path.join(__dirname, 'server/src/index.ts');

if (fs.existsSync(distPath)) {
  // Démarrer le serveur compilé
  console.log('[START] Démarrage du serveur compilé...');
  require(distPath);
} else if (fs.existsSync(srcPath)) {
  // Compiler et démarrer avec ts-node
  console.log('[START] Compilation et démarrage avec ts-node...');
  
  // Vérifier si ts-node est installé
  try {
    require.resolve('ts-node');
    require.resolve('typescript');
    
    // Configurer ts-node
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs',
        target: 'es2020',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        skipLibCheck: true
      }
    });
    
    // Démarrer le serveur TypeScript
    require(srcPath);
  } catch (error) {
    console.error('[START] ts-node n\'est pas installé. Installation en cours...');
    
    // Installer ts-node et typescript
    const install = spawn('npm', ['install', '--no-save', 'ts-node', 'typescript'], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    install.on('close', (code) => {
      if (code !== 0) {
        console.error('[START] Erreur lors de l\'installation de ts-node');
        process.exit(1);
      }
      
      // Réessayer après l'installation
      console.log('[START] Relancement du serveur...');
      const restart = spawn(process.argv[0], [process.argv[1]], {
        cwd: __dirname,
        stdio: 'inherit',
        detached: false
      });
      
      restart.on('close', (code) => {
        process.exit(code);
      });
    });
  }
} else {
  // Créer un serveur minimal pour éviter l'erreur 502
  console.log('[START] Création d\'un serveur minimal...');
  
  const express = require('express');
  const app = express();
  const port = process.env.PORT || 3000;
  
  app.get('/health', (req, res) => {
    res.json({
      status: 'starting',
      message: 'Le serveur est en cours de démarrage. Veuillez patienter...'
    });
  });
  
  app.get('*', (req, res) => {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Le serveur 3CX-Ninja est en cours de démarrage. Veuillez réessayer dans quelques instants.',
      status: 'starting'
    });
  });
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`[START] Serveur minimal écoute sur le port ${port}`);
    console.log('[START] Le serveur complet démarrera automatiquement une fois la compilation terminée.');
    
    // Essayer de compiler en arrière-plan
    const compile = spawn('npm', ['run', 'build'], {
      cwd: path.join(__dirname, 'server'),
      stdio: 'inherit',
      detached: false
    });
    
    compile.on('close', (code) => {
      if (code === 0) {
        console.log('[START] Compilation terminée. Redémarrage du serveur...');
        // Redémarrer le processus
        process.exit(0);
      } else {
        console.error('[START] Erreur de compilation. Vérifiez les logs.');
      }
    });
  });
}

// Gestion des signaux
process.on('SIGTERM', () => {
  console.log('[START] SIGTERM reçu, arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[START] SIGINT reçu, arrêt du serveur...');
  process.exit(0);
});