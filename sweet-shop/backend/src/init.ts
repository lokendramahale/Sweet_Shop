// backend/src/init.ts
// Run this file to initialize and seed the database
import { initializeDatabase, seedDatabase, testConnection, pool } from './config/database';

const init = async () => {
  try {
    console.log('🚀 Starting database initialization...\n');

    // Test connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Failed to connect to database. Please check your DATABASE_URL');
      process.exit(1);
    }

    // Initialize tables
    await initializeDatabase();

    // Ask if user wants to seed data
    console.log('\n📋 Would you like to seed the database with sample data?');
    console.log('   (You can manually add data later if you choose no)');
    
    // For automated initialization, seed by default
    const shouldSeed = process.env.SEED_DATABASE !== 'false';
    
    if (shouldSeed) {
      await seedDatabase();
    } else {
      console.log('⏭️  Skipping database seeding');
    }

    console.log('\n✨ Database initialization complete!');
    console.log('🎉 You can now start the server with: npm run dev\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    await pool.end();
    process.exit(1);
  }
};

init();