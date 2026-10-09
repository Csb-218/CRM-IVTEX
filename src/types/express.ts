import { IUser } from '../models/user.model';
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export {};
