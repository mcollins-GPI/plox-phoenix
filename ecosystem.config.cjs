'use strict';

module.exports = {
  apps: [
    {
      name: 'dropsonic',
      script: 'dropsonic.js',
      cwd: __dirname,
      interpreter: 'node', // override on server: full nvm node path
      env_file: '.env',
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 2000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
