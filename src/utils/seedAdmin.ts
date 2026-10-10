import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import {
  User,
  UserRole,
  Lead,
  LeadStatus,
  LeadSource,
  LeadPriority,
  Customer,
  CustomerStatus,
  Deal,
  DealStage,
  Activity,
  ActivityType,
  ActivityStatus,
  EntityType,
  TimelineLog,
  TimelineAction
} from '../models';
import { generateToken, generateRefreshToken } from './token';

const seedDatabase = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm-ivtex';

  try {
    console.log('📡 Connecting to database...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // ==========================================
    // 1. Seed Users (Admin, Manager, Executive)
    // ==========================================
    console.log('👤 Seeding Users...');
    let admin = await User.findOne({ role: UserRole.ADMIN });
    if (!admin) {
      admin = await User.create({
        name: 'Super Admin',
        email: 'admin@ivtex.com',
        password: 'adminPassword123',
        role: UserRole.ADMIN,
        phone: '+1-555-0100',
        isActive: true
      });
      console.log('   + Created Admin: admin@ivtex.com');
    } else {
      console.log(`   * Admin exists: ${admin.email}`);
    }

    let manager = await User.findOne({ role: UserRole.MANAGER });
    if (!manager) {
      manager = await User.create({
        name: 'Sameer Sharma',
        email: 'manager@ivtex.com',
        password: 'managerPassword123',
        role: UserRole.MANAGER,
        phone: '+1-555-0101',
        isActive: true
      });
      console.log('   + Created Manager: manager@ivtex.com');
    } else {
      console.log(`   * Manager exists: ${manager.email}`);
    }

    let executive = await User.findOne({ role: UserRole.EXECUTIVE });
    if (!executive) {
      executive = await User.create({
        name: 'Rahul Sharma',
        email: 'executive@ivtex.com',
        password: 'executivePassword123',
        role: UserRole.EXECUTIVE,
        managerId: manager._id,
        phone: '+1-555-0102',
        isActive: true
      });
      console.log('   + Created Executive: executive@ivtex.com');
    } else {
      console.log(`   * Executive exists: ${executive.email}`);
    }

    // Ensure tokens on primary admin
    const adminToken = generateToken({
      id: admin._id.toString(),
      role: admin.role,
      email: admin.email
    });
    const adminRefreshToken = generateRefreshToken({ id: admin._id.toString() });
    admin.refreshToken = adminRefreshToken;
    await admin.save();

    // ==========================================
    // 2. Seed Leads (Minimum 1 document)
    // ==========================================
    console.log('\n🎯 Seeding Leads...');
    const leadCount = await Lead.countDocuments();
    let sampleLead = await Lead.findOne();

    if (leadCount === 0) {
      sampleLead = await Lead.create({
        name: 'Sarah Connor',
        email: 'sarah.connor@cyberdyne.io',
        phone: '+1-555-0201',
        company: 'Cyberdyne Systems',
        source: LeadSource.WEBSITE,
        status: LeadStatus.QUALIFIED,
        priority: LeadPriority.HIGH,
        assignedTo: executive._id,
        createdBy: admin._id,
        description: 'Enterprise inquiry for CRM migration and automation.'
      });

      await Lead.create({
        name: 'Alex Murphy',
        email: 'alex.murphy@omnicorp.com',
        phone: '+1-555-0202',
        company: 'Omni Consumer Products',
        source: LeadSource.REFERRAL,
        status: LeadStatus.NEW,
        priority: LeadPriority.MEDIUM,
        assignedTo: executive._id,
        createdBy: manager._id,
        description: 'Referred by senior partner for team management modules.'
      });
      console.log('   + Created 2 initial Leads');
    } else {
      console.log(`   * Leads already populated (${leadCount} records found)`);
    }

    // ==========================================
    // 3. Seed Customers (Minimum 1 document)
    // ==========================================
    console.log('\n🏢 Seeding Customers...');
    const customerCount = await Customer.countDocuments();
    let sampleCustomer = await Customer.findOne();

    if (customerCount === 0) {
      sampleCustomer = await Customer.create({
        name: 'Bruce Wayne',
        email: 'bruce.wayne@waynecorp.com',
        phone: '+1-555-0301',
        company: 'Wayne Enterprises Inc.',
        address: {
          street: '1007 Mountain Drive',
          city: 'Gotham',
          state: 'NJ',
          postalCode: '07001',
          country: 'USA'
        },
        leadId: sampleLead?._id || null,
        assignedTo: executive._id,
        status: CustomerStatus.ACTIVE
      });
      console.log('   + Created initial Customer: Wayne Enterprises Inc.');
    } else {
      console.log(`   * Customers already populated (${customerCount} records found)`);
    }

    // ==========================================
    // 4. Seed Deals (Minimum 1 document)
    // ==========================================
    console.log('\n💼 Seeding Deals...');
    const dealCount = await Deal.countDocuments();
    let sampleDeal = await Deal.findOne();

    if (dealCount === 0) {
      const targetCustomer = sampleCustomer || (await Customer.findOne());
      if (targetCustomer) {
        sampleDeal = await Deal.create({
          name: 'Wayne Corp Enterprise CRM License',
          leadId: sampleLead?._id || null,
          customerId: targetCustomer._id,
          assignedTo: executive._id,
          value: 125000,
          probability: 100,
          expectedRevenue: 125000,
          stage: DealStage.WON,
          expectedCloseDate: new Date(),
          closedAt: new Date(),
          description: 'Enterprise license and SLA agreement.'
        });

        await Deal.create({
          name: 'Cyberdyne Systems Cloud Migration',
          leadId: sampleLead?._id || null,
          customerId: targetCustomer._id,
          assignedTo: executive._id,
          value: 75000,
          probability: 60,
          expectedRevenue: 45000,
          stage: DealStage.PROPOSAL,
          expectedCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          description: 'Custom proposal submitted for 50 executive seats.'
        });
        console.log('   + Created 2 initial Deals');
      }
    } else {
      console.log(`   * Deals already populated (${dealCount} records found)`);
    }

    // ==========================================
    // 5. Seed Activities (Minimum 1 document)
    // ==========================================
    console.log('\n📝 Seeding Activities...');
    const activityCount = await Activity.countDocuments();

    if (activityCount === 0) {
      const activeLead = sampleLead || (await Lead.findOne());
      const activeCustomer = sampleCustomer || (await Customer.findOne());
      const activeDeal = sampleDeal || (await Deal.findOne());

      if (activeLead) {
        await Activity.create({
          type: ActivityType.CALL,
          title: 'Initial Discovery Call',
          description: 'Discussed CRM requirements, seat requirements, and data migration needs.',
          content: 'Discussed CRM requirements, seat requirements, and data migration needs.',
          entityType: EntityType.LEAD,
          entityId: activeLead._id,
          assignedTo: executive._id,
          createdBy: admin._id,
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          status: ActivityStatus.PENDING
        });
      }

      if (activeDeal) {
        await Activity.create({
          type: ActivityType.MEETING,
          title: 'Proposal & Pricing Review',
          description: 'Walkthrough of customized pricing tiers and service level agreement.',
          content: 'Walkthrough of customized pricing tiers and service level agreement.',
          entityType: EntityType.DEAL,
          entityId: activeDeal._id,
          assignedTo: executive._id,
          createdBy: manager._id,
          dueDate: new Date(),
          status: ActivityStatus.COMPLETED,
          completedAt: new Date()
        });
      }

      if (activeCustomer) {
        await Activity.create({
          type: ActivityType.NOTE,
          title: 'Customer Onboarding Kickoff',
          description: 'Client completed onboarding prerequisites and assigned technical POC.',
          content: 'Client completed onboarding prerequisites and assigned technical POC.',
          entityType: EntityType.CUSTOMER,
          entityId: activeCustomer._id,
          assignedTo: executive._id,
          createdBy: executive._id,
          status: ActivityStatus.COMPLETED,
          completedAt: new Date()
        });
      }
      console.log('   + Created initial Activities (Call, Meeting, Note)');
    } else {
      console.log(`   * Activities already populated (${activityCount} records found)`);
    }

    // ==========================================
    // 6. Seed Timeline Logs (Minimum 1 document)
    // ==========================================
    console.log('\n📜 Seeding Timeline Logs...');
    const timelineCount = await TimelineLog.countDocuments();

    if (timelineCount === 0) {
      const targetLead = sampleLead || (await Lead.findOne());
      const targetDeal = sampleDeal || (await Deal.findOne());

      if (targetLead) {
        await TimelineLog.create({
          action: TimelineAction.LEAD_CREATED,
          entityType: EntityType.LEAD,
          entityId: targetLead._id,
          performedBy: admin._id,
          previousValue: null,
          newValue: { status: targetLead.status, assignedTo: targetLead.assignedTo },
          message: `Lead '${targetLead.name}' created by Super Admin`,
          description: `Lead '${targetLead.name}' created by Super Admin`
        });
      }

      if (targetDeal) {
        await TimelineLog.create({
          action: TimelineAction.DEAL_WON,
          entityType: EntityType.DEAL,
          entityId: targetDeal._id,
          performedBy: admin._id,
          previousValue: DealStage.NEGOTIATION,
          newValue: DealStage.WON,
          message: `Deal '${targetDeal.name}' closed won with value $${targetDeal.value}`,
          description: `Deal '${targetDeal.name}' closed won with value $${targetDeal.value}`
        });
      }
      console.log('   + Created initial Timeline Logs');
    } else {
      console.log(`   * Timeline logs already populated (${timelineCount} records found)`);
    }

    // ==========================================
    // Verification & Summary
    // ==========================================
    const [
      finalUsers,
      finalLeads,
      finalCustomers,
      finalDeals,
      finalActivities,
      finalTimelines
    ] = await Promise.all([
      User.countDocuments(),
      Lead.countDocuments(),
      Customer.countDocuments(),
      Deal.countDocuments(),
      Activity.countDocuments(),
      TimelineLog.countDocuments()
    ]);

    console.log('\n==================================================');
    console.log('📊 DATABASE SEEDING SUMMARY');
    console.log('==================================================');
    console.log(`• users collection:         ${finalUsers} documents`);
    console.log(`• leads collection:         ${finalLeads} documents`);
    console.log(`• customers collection:     ${finalCustomers} documents`);
    console.log(`• deals collection:         ${finalDeals} documents`);
    console.log(`• activities collection:    ${finalActivities} documents`);
    console.log(`• timelines collection:     ${finalTimelines} documents`);
    console.log('==================================================');

    console.log('\n🔑 SAMPLE CREDENTIALS FOR TESTING');
    console.log('--------------------------------------------------');
    console.log('1. Admin:');
    console.log('   Email:    admin@ivtex.com');
    console.log('   Password: adminPassword123');
    console.log('   Role:     admin');
    console.log('2. Manager:');
    console.log('   Email:    manager@ivtex.com');
    console.log('   Password: managerPassword123');
    console.log('   Role:     manager');
    console.log('3. Executive:');
    console.log('   Email:    executive@ivtex.com');
    console.log('   Password: executivePassword123');
    console.log('   Role:     executive');
    console.log('--------------------------------------------------');
    console.log(`Bearer Token (Admin):\n${adminToken}\n`);

    await mongoose.connection.close();
    console.log('🔒 Database connection closed. Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();
