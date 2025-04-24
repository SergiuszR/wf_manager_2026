import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        webflowToken?: string;
        [key: string]: any;
      };
    }
  }
}

// Need to export something for TypeScript to recognize this as a module
export {}; 