declare module 'config' {
  interface IConfig {
    get<T>(key: string): T;
    has(key: string): boolean;
  }
  const config: IConfig;
  export = config;
}