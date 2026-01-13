module.exports = {
  apps: [
    {
      name: "cloudfne",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      },
      // Logging
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      
      // Auto restart
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      
      // Advanced PM2 features
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 4000,
      
      // Merge logs from all instances
      merge_logs: true,
      
      // Kill timeout
      kill_timeout: 5000,
      
      // Wait for graceful shutdown
      listen_timeout: 10000,
      shutdown_with_message: true
    }
  ]
};