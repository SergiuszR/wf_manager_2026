import { IUser } from '../models/User';

// This is a placeholder that informs users that the in-memory store is removed
export const memoryStore = {
  // Keeping minimal interface for backward compatibility, but these methods will log warnings
  findUserByToken: (token: string) => {
    console.warn('Warning: In-memory store has been removed. Using MongoDB exclusively.');
    return null;
  },
  
  hasUser: (id: string) => {
    console.warn('Warning: In-memory store has been removed. Using MongoDB exclusively.');
    return false;
  },
  
  getUser: (id: string) => {
    console.warn('Warning: In-memory store has been removed. Using MongoDB exclusively.');
    return null;
  },
  
  setUser: (id: string, userData: Partial<IUser>) => {
    console.warn('Warning: In-memory store has been removed. Using MongoDB exclusively.');
    return null;
  },
  
  updateUser: (id: string, userData: Partial<IUser>) => {
    console.warn('Warning: In-memory store has been removed. Using MongoDB exclusively.');
    return false;
  },
  
  generateId: () => {
    console.warn('Warning: In-memory store has been removed. Using MongoDB exclusively.');
    return '';
  }
}; 