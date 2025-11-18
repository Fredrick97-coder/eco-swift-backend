import { Request } from 'express';

export interface Context {
  req: Request;
  // Add user, etc. as needed
  // user?: User;
}

