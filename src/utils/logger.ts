import winston from 'winston';
import path from 'path';
import fs from 'fs';

const isVercel = Boolean(process.env.VERCEL);

// Only create logs directory if not on Vercel (Vercel doesn't allow file system writes)
let logsDir: string | null = null;
if (!isVercel) {
  logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const transports: winston.transport[] = [];

// On Vercel, only use console logging (file system is read-only)
if (isVercel) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  // In non-Vercel environments, use file transports
  if (logsDir) {
    transports.push(
      // Write all logs to combined.log
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // Write errors to error.log
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }
  
  // Add console transport in development
  if (process.env.NODE_ENV !== 'production') {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );
  }
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'eco-swift-backend' },
  transports,
});

// Export convenience methods
export default logger;

