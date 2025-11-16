import request from 'supertest';
import app from '../src/server';
import { pool } from '../src/config/database';

describe('Sweets API', () => {
  let authToken: string;
  let adminToken: string;
  let userId: number;
  let adminId: number;

  beforeAll(async () => {
    // Create tables
    await pool.query(`
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

    await pool.query(`
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        sweet_id INTEGER REFERENCES sweets(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Register and login regular user
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user', email: 'user@test.com', password: 'Pass123!' });
    userId = userRes.body.userId;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Pass123!' });
    authToken = loginRes.body.token;

    // Register admin user
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'admin', email: 'admin@test.com', password: 'Admin123!' });
    adminId = adminRes.body.userId;

    await pool.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [adminId]);

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin123!' });
    adminToken = adminLoginRes.body.token;
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS purchases CASCADE');
    await pool.query('DROP TABLE IF EXISTS sweets CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM purchases');
    await pool.query('DELETE FROM sweets');
  });

  describe('POST /api/sweets', () => {
    it('should create a new sweet when authenticated', async () => {
      const sweetData = {
        name: 'Chocolate Bar',
        category: 'Chocolate',
        price: 2.99,
        quantity: 100,
        description: 'Delicious milk chocolate'
      };

      const response = await request(app)
        .post('/api/sweets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sweetData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(sweetData.name);
      expect(parseFloat(response.body.price)).toBe(sweetData.price);
    });

    it('should reject creation without authentication', async () => {
      await request(app)
        .post('/api/sweets')
        .send({ name: 'Test', category: 'Test', price: 1, quantity: 10 })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/sweets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject negative price', async () => {
      const response = await request(app)
        .post('/api/sweets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test', category: 'Test', price: -1, quantity: 10 })
        .expect(400);

      expect(response.body.error).toContain('negative');
    });
  });

  describe('GET /api/sweets', () => {
    beforeEach(async () => {
      await pool.query(`
        INSERT INTO sweets (name, category, price, quantity)
        VALUES 
          ('Lollipop', 'Hard Candy', 0.99, 200),
          ('Gummy Worms', 'Gummies', 1.50, 150)
      `);
    });

    it('should return all sweets', async () => {
      const response = await request(app)
        .get('/api/sweets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('category');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/sweets')
        .expect(401);
    });
  });

  describe('GET /api/sweets/search', () => {
    beforeEach(async () => {
      await pool.query(`
        INSERT INTO sweets (name, category, price, quantity)
        VALUES 
          ('Dark Chocolate', 'Chocolate', 3.50, 80),
          ('Milk Chocolate', 'Chocolate', 2.99, 100),
          ('Gummy Bears', 'Gummies', 1.99, 120)
      `);
    });

    it('should search by name', async () => {
      const response = await request(app)
        .get('/api/sweets/search')
        .query({ name: 'chocolate' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toContain('Chocolate');
    });

    it('should search by category', async () => {
      const response = await request(app)
        .get('/api/sweets/search')
        .query({ category: 'Chocolate' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should search by price range', async () => {
      const response = await request(app)
        .get('/api/sweets/search')
        .query({ minPrice: 2.00, maxPrice: 3.00 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Milk Chocolate');
    });
  });

  describe('PUT /api/sweets/:id', () => {
    let sweetId: number;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO sweets (name, category, price, quantity)
        VALUES ('Test Sweet', 'Test', 1.00, 10)
        RETURNING id
      `);
      sweetId = result.rows[0].id;
    });

    it('should update a sweet', async () => {
      const updateData = { name: 'Updated Sweet', price: 2.00 };

      const response = await request(app)
        .put(`/api/sweets/${sweetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(parseFloat(response.body.price)).toBe(updateData.price);
    });

    it('should return 404 for non-existent sweet', async () => {
      await request(app)
        .put('/api/sweets/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /api/sweets/:id', () => {
    let sweetId: number;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO sweets (name, category, price, quantity)
        VALUES ('Delete Me', 'Test', 1.00, 10)
        RETURNING id
      `);
      sweetId = result.rows[0].id;
    });

    it('should allow admin to delete', async () => {
      await request(app)
        .delete(`/api/sweets/${sweetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const result = await pool.query('SELECT * FROM sweets WHERE id = $1', [sweetId]);
      expect(result.rows).toHaveLength(0);
    });

    it('should prevent non-admin from deleting', async () => {
      await request(app)
        .delete(`/api/sweets/${sweetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('POST /api/sweets/:id/purchase', () => {
    let sweetId: number;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO sweets (name, category, price, quantity)
        VALUES ('Purchase Me', 'Test', 2.00, 10)
        RETURNING id
      `);
      sweetId = result.rows[0].id;
    });

    it('should purchase sweet and decrease quantity', async () => {
      const response = await request(app)
        .post(`/api/sweets/${sweetId}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 3 })
        .expect(200);

      expect(response.body.sweet.quantity).toBe(7);
    });

    it('should prevent purchase when out of stock', async () => {
      await request(app)
        .post(`/api/sweets/${sweetId}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 15 })
        .expect(400);
    });

    it('should validate purchase quantity', async () => {
      await request(app)
        .post(`/api/sweets/${sweetId}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: -1 })
        .expect(400);
    });
  });

  describe('POST /api/sweets/:id/restock', () => {
    let sweetId: number;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO sweets (name, category, price, quantity)
        VALUES ('Restock Me', 'Test', 1.00, 5)
        RETURNING id
      `);
      sweetId = result.rows[0].id;
    });

    it('should allow admin to restock', async () => {
      const response = await request(app)
        .post(`/api/sweets/${sweetId}/restock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 50 })
        .expect(200);

      expect(response.body.sweet.quantity).toBe(55);
    });

    it('should prevent non-admin from restocking', async () => {
      await request(app)
        .post(`/api/sweets/${sweetId}/restock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 50 })
        .expect(403);
    });
  });
});