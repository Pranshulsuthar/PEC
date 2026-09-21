const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  connectTimeout: Number.parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4'
};

const database = process.env.DB_NAME || 'pec';

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error('DB_PORT must be a valid port number');
}

if (!/^[A-Za-z0-9_$]+$/.test(database)) {
  throw new Error('DB_NAME contains unsupported characters');
}

const pool = mysql.createPool({ ...config, database });

async function ensureDatabase() {
  const connection = await mysql.createConnection(config);
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await connection.end();
  }
}

async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = pool;
module.exports.ensureDatabase = ensureDatabase;
module.exports.testConnection = testConnection;
