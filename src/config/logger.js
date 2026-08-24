const format = (level, message) =>
  `${new Date().toISOString()} ${level} ${message instanceof Error ? message.message : message}`;

export const logger = {
  info: (message) => console.log(format('INFO', message)),
  error: (message) => console.error(format('ERROR', message)),
};
