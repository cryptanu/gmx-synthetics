import log4js from "log4js";

log4js.configure({
  appenders: {
    console: { type: "console" }, // Logs to console
    file: { 
      type: "file",
      filename: "logs/keeper.log",
      maxLogSize: 10485760, backups: 3, 
      compress: true , layout: {
        type: "pattern",
        pattern: "%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m"
      }}
  },
  categories: {
    default: { appenders: ["console", "file"], level: "info" } // Default log level: INFO
  }
});

export function getLogger(name: string){
    return log4js.getLogger("keeper");
}