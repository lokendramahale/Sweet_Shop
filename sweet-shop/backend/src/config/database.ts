// backend/src/config/database.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Connection event handlers
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

// Initialize database tables
export const initializeDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Initializing database tables...');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sweets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sweets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT positive_price CHECK (price >= 0),
        CONSTRAINT positive_quantity CHECK (quantity >= 0)
      )
    `);

    // Create purchases table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        sweet_id INTEGER REFERENCES sweets(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sweets_category ON sweets(category);
      CREATE INDEX IF NOT EXISTS idx_sweets_name ON sweets(name);
      CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_sweet ON purchases(sweet_id);
    `);

    // Create or replace update trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create triggers
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at 
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_sweets_updated_at ON sweets;
      CREATE TRIGGER update_sweets_updated_at 
      BEFORE UPDATE ON sweets
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Seed initial data (optional - for development)
export const seedDatabase = async () => {
  const client = await pool.connect();
  
  try {
    // Check if data already exists
    const sweetsCount = await client.query('SELECT COUNT(*) FROM sweets');
    
    if (parseInt(sweetsCount.rows[0].count) > 0) {
      console.log('📊 Database already contains data. Skipping seed.');
      return;
    }

    console.log('🌱 Seeding initial data...');

    // Insert sample sweets
    await client.query(`
      INSERT INTO sweets (name, category, price, quantity, description) VALUES
      ('Milk Chocolate Bar', 'Chocolate', 2.50, 100, 'Creamy milk chocolate bar'),
      ('Dark Chocolate', 'Chocolate', 3.00, 80, 'Rich dark chocolate with 70% cocoa'),
      ('Gummy Bears', 'Gummies', 1.99, 150, 'Colorful fruity gummy bears'),
      ('Sour Gummy Worms', 'Gummies', 2.25, 120, 'Tangy sour gummy worms'),
      ('Classic Lollipop', 'Hard Candy', 0.99, 200, 'Traditional swirl lollipop'),
      ('Fruit Lollipops', 'Hard Candy', 1.25, 180, 'Assorted fruit-flavored lollipops'),
      ('Jelly Beans', 'Jelly', 3.50, 80, 'Assorted flavored jelly beans'),
      ('Peppermint Drops', 'Mints', 1.50, 120, 'Refreshing peppermint drops'),
      ('Butter Toffee', 'Toffee', 3.75, 60, 'Smooth butter toffee pieces'),
      ('Caramel Chews', 'Caramel', 2.99, 90, 'Soft caramel chews')
    `);

    console.log('✅ Database seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Test database connection
export const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection test successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};