import './types/express';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { connectDB } from './config/db';
import apiRoutes from './routes';
import { errorHandler, notFoundHandler } from './middleware';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health Check / Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Express TypeScript Server is running smoothly!',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (_req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'OK',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Mount Routes (/users and /api/users)
app.use('/', apiRoutes);
app.use('/api', apiRoutes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server and Database
const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please specify another PORT in .env`);
    } else {
      console.error('❌ Server error:', err);
    }
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      await mongoose.connection.close();
      console.log('🔒 MongoDB connection closed. Process terminated.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

startServer();
