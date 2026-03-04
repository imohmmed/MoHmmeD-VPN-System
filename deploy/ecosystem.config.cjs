const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
const env = {};

if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && key.trim()) env[key.trim()] = val.join('=').trim();
  });
}

module.exports = {
  apps: [{
    name: "mohmmedvpn",
    script: "npm",
    args: "run start",
    cwd: "/var/www/mohmmedvpn",
    env: {
      NODE_ENV: "production",
      PORT: "5000",
      ...env
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: "512M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/var/www/mohmmedvpn/logs/error.log",
    out_file: "/var/www/mohmmedvpn/logs/output.log",
  }]
};
