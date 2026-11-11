'use strict';

const mysql = require('mysql2');

const required = ['DB_HOST', 'DB_DATABASE'];
const missing = required.filter((key) => !process.env[key]);
if (!process.env.DB_USERNAME && !process.env.DB_USER) missing.push('DB_USERNAME (or DB_USER)');
if (missing.length) {
  throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
});

const promisePool = pool.promise();

module.exports = {
  pool,
  promisePool,
  getConnection: pool.getConnection.bind(pool),
  query: pool.query.bind(pool),
  execute: pool.execute.bind(pool),
  end: pool.end.bind(pool),
};
