// pm2: pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: 'axxon-webhook-proxy',
      script: 'backend/src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
