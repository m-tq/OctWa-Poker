module.exports = {
  apps: [
    {
      name: 'oct-poker-server',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3003,
        // Anda juga bisa menambahkan variabel lain di sini atau membiarkan
        // dotenv memuatnya dari file .env.production jika diatur di src/config.ts
      },
      // Menggunakan interpreter node langsung untuk menjalankan file JS yang sudah di-build
      interpreter: 'node'
    }
  ]
};
