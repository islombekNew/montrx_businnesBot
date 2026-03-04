module.exports = {
  apps: [{
    name: 'montrax-bot',
    script: 'src/index.js',
    interpreter: 'node',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    env: {
      NODE_ENV: 'production',
    },
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
