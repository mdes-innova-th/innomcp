module.exports = {
  apps: [
    {
      name: 'innomcp-backend',
      script: 'dist/index.js',
      cwd: 'C:/Users/USER-NT/DEV/innomcp/innomcp-node',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      restart_delay: 3000,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 3011
      }
    }
  ]
};
