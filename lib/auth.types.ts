import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'VEHICLE_MEMBER' | 'FINANCE_READONLY';
      username: string;
      name: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    username: string;
    name: string;
    role: 'ADMIN' | 'VEHICLE_MEMBER' | 'FINANCE_READONLY';
  }
}

