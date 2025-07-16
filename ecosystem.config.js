module.exports = {
  apps: [{
    name: '3cx-ninja-server',
    script: './server/dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '2G',
    watch: false,
    autorestart: true,
    restart_delay: 5000,
    kill_timeout: 5000
  }]
};