module.exports = {
  apps: [{
    name: 'gadget-revive-admin',
    cwd: '/var/www/gadget-revive-admin',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3001',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      NEXT_PUBLIC_API_URL: 'https://api.gadgetandrevive.com/api'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
  }]
};
