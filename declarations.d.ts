declare module '*.css';

declare module '*.sql' {
  const content: string;
  export default content;
}

declare module '@/db/migrations/migrations' {
  const migrations: {
    journal: {
      entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
    };
    migrations: Record<string, string>;
  };
  export default migrations;
}
