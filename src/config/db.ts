import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm-ivtex';

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`🌿[database]: MongoDB connected successfully: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error('❌[database]: MongoDB connection error:', error);
    console.error('💡 Tip: Ensure MongoDB is running (e.g., `brew services start mongodb-community` or `docker compose up -d mongodb`) or verify MONGODB_URI in .env');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️[database]: MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌[database]: MongoDB connection error:', err);
});
