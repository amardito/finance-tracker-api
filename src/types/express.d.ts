declare global {
  namespace Express {
    interface Request {
      userId?: string;
      clawConnectionId?: string;
    }
  }
}

export {};
