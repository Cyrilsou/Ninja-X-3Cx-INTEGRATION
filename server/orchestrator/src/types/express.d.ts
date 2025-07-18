import { Request } from 'express';
import { Agent } from '../services/database';

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
      agent?: Agent;
    }
  }
}