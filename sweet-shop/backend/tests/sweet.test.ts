import request from 'supertest';
import app from '../src/server';
import { pool } from '../src/config/database';

describe('Sweets API', () => {
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sweets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Register and login users for testing
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user', email: 'user@test.com', password: 'Pass123!' });
    
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Pass123!' });
    
    authToken = loginRes.body.token;

    // Create admin user
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'admin', email: 'admin@test.com', password: 'Admin123!' });
    
    // Manually set admin role (in real app, this would be done differently)
    await pool.query('UPDATE users SET is_admin = TRUE WHERE email = $1', ['admin@test.com']);
    
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin123!' });
    
    adminToken = adminLoginRes.body.token;
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS sweets');
    await pool.query('DROP TABLE IF EXISTS users');
    await pool.end();
  });

  beforeEach(async () => {
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
      expect(response.body.price).toBe(sweetData.price);
    });

    it('should reject creation without authentication', async () => {
      const sweetData = {
        name: 'Gummy Bears',
        category: 'Gummies',
        price: 1.99,
        quantity: 50
      };

      await request(app)
        .post('/api/sweets')
        .send(sweetData)
        .expect(401);
    });
  });

  describe('GET /api/sweets', () => {
    beforeEach(async () => {
      // Insert test data
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
      const updateData = {
        name: 'Updated Sweet',
        price: 2.00
      };

      const response = await request(app)
        .put(`/api/sweets/${sweetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.price).toBe(updateData.price);
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

    it('should allow admin to delete a sweet', async () => {
      await request(app)
        .delete(`/api/sweets/${sweetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it's deleted
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

    it('should purchase a sweet and decrease quantity', async () => {
      const response = await request(app)
        .post(`/api/sweets/${sweetId}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 3 })
        .expect(200);

      expect(response.body.quantity).toBe(7);
    });

    it('should prevent purchase when out of stock', async () => {
      await request(app)
        .post(`/api/sweets/${sweetId}/purchase`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 15 })
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

      expect(response.body.quantity).toBe(55);
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
