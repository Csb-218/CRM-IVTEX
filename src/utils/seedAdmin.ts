import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User, UserRole } from '../models/user.model';
import { generateToken, generateRefreshToken } from './token';

const seedAdmin = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm-ivtex';

  try {
    console.log('Connecting to database...');
    await mongoose.connect(mongoURI);

    const existingAdmin = await User.findOne({ role: UserRole.ADMIN });
    if (existingAdmin) {
      console.log(`\n✅ Admin already exists: ${existingAdmin.email}`);
      const token = generateToken({
        id: existingAdmin._id.toString(),
        role: existingAdmin.role,
        email: existingAdmin.email
      });
      console.log(`🔑 Sample JWT Token for existing Admin:\nBearer ${token}\n`);
      process.exit(0);
    }

    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@ivtex.com',
      password: 'adminPassword123',
      role: UserRole.ADMIN,
      phone: '+1-555-0100',
      isActive: true
    });

    const token = generateToken({
      id: admin._id.toString(),
      role: admin.role,
      email: admin.email
    });

    const refreshToken = generateRefreshToken({
      id: admin._id.toString()
    });

    admin.refreshToken = refreshToken;
    await admin.save();

    console.log('\n🎉 Initial Admin created successfully!');
    console.log('-------------------------------------------');
    console.log(`Email:    admin@ivtex.com`);
    console.log(`Password: adminPassword123`);
    console.log(`Role:     admin`);
    console.log('-------------------------------------------');
    console.log(`🔑 Sample JWT Token:\nBearer ${token}\n`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin:', error);
    process.exit(1);
  }
};

seedAdmin();
