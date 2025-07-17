declare module 'config' {
  interface IConfig {
    server: {
      host: string;
      port: number;
    };
    redis: {
      host: string;
      port: number;
      enabled: boolean;
      url?: string;
      prefix?: string;
    };
    whisper: {
      model: string;
      modelPath: string;
      pythonPath: string;
      device: string;
      computeType: string;
      threads: number;
      language: string;
      task: string;
      vadFilter: boolean;
      wordTimestamps: boolean;
      maxConcurrent: number;
    };
    transcription: {
      maxConcurrent: number;
      timeout: number;
      maxRetries: number;
      retryDelay: number;
      chunkDuration: number;
    };
    audio: {
      format: string;
      sampleRate: number;
      channels: number;
      bitDepth: number;
      maxDuration: number;
      maxSize: number;
      tempDir: string;
    };
    database: {
      dialect: string;
      storage: string;
      logging: boolean;
    };
    ffmpeg: {
      path: string;
      timeout: number;
    };
    cache: {
      ttl: number;
      checkPeriod: number;
      maxKeys: number;
    };
    webhook: {
      timeout: number;
      maxRetries: number;
      retryDelay: number;
    };
    '3cx': {
      webhook: {
        enabled: boolean;
        path: string;
        secret: string;
      };
      pbxUrl: string;
      clientId: string;
      clientSecret: string;
    };
    ninjaone: {
      apiUrl: string;
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      defaultBoardId: number;
      defaultStatusId: number;
      defaultPriorityId: number;
    };
    security: {
      apiKey: string;
      corsOrigins: string[];
      rateLimit: {
        windowMs: number;
        max: number;
      };
    };
    cleanup: {
      enabled: boolean;
      interval: number;
      maxAge: number;
    };
    logging: {
      level: string;
      format: string;
    };
  }

  const config: IConfig;
  export = config;
  export function get<T>(key: string): T;
  export function has(key: string): boolean;
}