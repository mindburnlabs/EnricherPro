
import { v4 as uuidv4 } from 'uuid';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    jobId?: string;
    agent?: string;
    traceId?: string;
    [key: string]: any;
}

class StructuredLogger {
    private static instance: StructuredLogger;
    private logLevel: LogLevel = 'info';

    private constructor() {
        if (process.env.LOG_LEVEL) {
            this.logLevel = process.env.LOG_LEVEL as LogLevel;
        }
    }

    static getInstance(): StructuredLogger {
        if (!StructuredLogger.instance) {
            StructuredLogger.instance = new StructuredLogger();
        }
        return StructuredLogger.instance;
    }

    private format(level: LogLevel, message: string, context: LogContext = {}) {
        const traceId = context.traceId || uuidv4();
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            traceId,
            ...context
        });
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }

    debug(message: string, context?: LogContext) {
        if (this.shouldLog('debug')) {
            console.debug(this.format('debug', message, context));
        }
    }

    info(message: string, context?: LogContext) {
        if (this.shouldLog('info')) {
            console.info(this.format('info', message, context));
        }
    }

    warn(message: string, context?: LogContext) {
        if (this.shouldLog('warn')) {
            console.warn(this.format('warn', message, context));
        }
    }

    error(message: string, error?: Error | any, context?: LogContext) {
        if (this.shouldLog('error')) {
            const errDetails = error instanceof Error ? { stack: error.stack, name: error.name } : { error };
            console.error(this.format('error', message, { ...context, ...errDetails }));
        }
    }
}

export const logger = StructuredLogger.getInstance();
