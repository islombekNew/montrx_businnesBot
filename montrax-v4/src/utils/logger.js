import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';

const LOG_DIR = process.env.LOG_DIR || './logs';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const fmt = winston.format;

const logFormat = fmt.printf(({ level, message, timestamp, stack }) =>
  `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fmt.combine(fmt.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fmt.errors({ stack: true }), logFormat),
  transports: [
    new winston.transports.Console({
      format: fmt.combine(fmt.colorize(), fmt.timestamp({ format: 'HH:mm:ss' }), logFormat),
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'bot-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
    }),
  ],
});

export default logger;
