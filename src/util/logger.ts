type LogContext = Record<string, unknown>;

const serialize = (context?: LogContext) => {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(context)}`;
};

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(`[info] ${message}${serialize(context)}`);
  },
  warn(message: string, context?: LogContext) {
    console.warn(`[warn] ${message}${serialize(context)}`);
  },
  error(message: string, context?: LogContext) {
    console.error(`[error] ${message}${serialize(context)}`);
  },
};
