// backend/src/routes/sweets.ts
import express from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/sweets - Get all sweets
router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sweets ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get all sweets error:', error);
    res.status(500).json({ error: 'Failed to fetch sweets' });
  }
});

// GET /api/sweets/search - Search sweets
router.get('/search', async (req: AuthRequest, res) => {
  try {
    const { name, category, minPrice, maxPrice } = req.query;

    let query = 'SELECT * FROM sweets WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (name) {
      query += ` AND LOWER(name) LIKE LOWER($${paramCount})`;
      params.push(`%${name}%`);
      paramCount++;
    }

    if (category) {
      query += ` AND LOWER(category) = LOWER($${paramCount})`;
      params.push(category);
      paramCount++;
    }

    if (minPrice) {
      query += ` AND price >= $${paramCount}`;
      params.push(minPrice);
      paramCount++;
    }

    if (maxPrice) {
      query += ` AND price <= $${paramCount}`;
      params.push(maxPrice);
      paramCount++;
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Search sweets error:', error);
    res.status(500).json({ error: 'Failed to search sweets' });
  }
});

// GET /api/sweets/:id - Get single sweet
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM sweets WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sweet not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get sweet error:', error);
    res.status(500).json({ error: 'Failed to fetch sweet' });
  }
});

// POST /api/sweets - Create new sweet
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, category, price, quantity, description, image_url } = req.body;

    // Validation
    if (!name || !category || price === undefined || quantity === undefined) {
      return res.status(400).json({ 
        error: 'Name, category, price, and quantity are required' 
      });
    }

    if (price < 0) {
      return res.status(400).json({ error: 'Price cannot be negative' });
    }

    if (quantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }

    const result = await pool.query(
      `INSERT INTO sweets (name, category, price, quantity, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, category, price, quantity, description || null, image_url || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create sweet error:', error);
    res.status(500).json({ error: 'Failed to create sweet' });
  }
});

// PUT /api/sweets/:id - Update sweet
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, quantity, description, image_url } = req.body;

    // Check if sweet exists
    const existingSweet = await pool.query(
      'SELECT * FROM sweets WHERE id = $1',
      [id]
    );

    if (existingSweet.rows.length === 0) {
      return res.status(404).json({ error: 'Sweet not found' });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      params.push(name);
      paramCount++;
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount}`);
      params.push(category);
      paramCount++;
    }
    if (price !== undefined) {
      if (price < 0) {
        return res.status(400).json({ error: 'Price cannot be negative' });
      }
      updates.push(`price = $${paramCount}`);
      params.push(price);
      paramCount++;
    }
    if (quantity !== undefined) {
      if (quantity < 0) {
        return res.status(400).json({ error: 'Quantity cannot be negative' });
      }
      updates.push(`quantity = $${paramCount}`);
      params.push(quantity);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount}`);
      params.push(image_url);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE sweets 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update sweet error:', error);
    res.status(500).json({ error: 'Failed to update sweet' });
  }
});

// DELETE /api/sweets/:id - Delete sweet (Admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM sweets WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sweet not found' });
    }

    res.json({ 
      message: 'Sweet deleted successfully',
      deletedSweet: result.rows[0]
    });
  } catch (error) {
    console.error('Delete sweet error:', error);
    res.status(500).json({ error: 'Failed to delete sweet' });
  }
});

// POST /api/sweets/:id/purchase - Purchase sweet
router.post('/:id/purchase', async (req: AuthRequest, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Validation
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    if (!Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Quantity must be an integer' });
    }

    await client.query('BEGIN');

    // Lock the row for update
    const sweetResult = await client.query(
      'SELECT * FROM sweets WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (sweetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sweet not found' });
    }

    const sweet = sweetResult.rows[0];

    if (sweet.quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient stock',
        available: sweet.quantity,
        requested: quantity
      });
    }

    // Update quantity
    const updateResult = await client.query(
      'UPDATE sweets SET quantity = quantity - $1 WHERE id = $2 RETURNING *',
      [quantity, id]
    );

    // Record purchase (optional - if you have purchases table)
    const totalPrice = parseFloat(sweet.price) * quantity;
    await client.query(
      `INSERT INTO purchases (user_id, sweet_id, quantity, total_price)
       VALUES ($1, $2, $3, $4)`,
      [req.user!.userId, id, quantity, totalPrice]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Purchase successful',
      sweet: updateResult.rows[0],
      purchaseDetails: {
        quantity,
        totalPrice,
        remainingStock: updateResult.rows[0].quantity
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Purchase sweet error:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  } finally {
    client.release();
  }
});

// POST /api/sweets/:id/restock - Restock sweet (Admin only)
router.post('/:id/restock', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Validation
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    if (!Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Quantity must be an integer' });
    }

    // Check if sweet exists
    const existingSweet = await pool.query(
      'SELECT * FROM sweets WHERE id = $1',
      [id]
    );

    if (existingSweet.rows.length === 0) {
      return res.status(404).json({ error: 'Sweet not found' });
    }

    const result = await pool.query(
      'UPDATE sweets SET quantity = quantity + $1 WHERE id = $2 RETURNING *',
      [quantity, id]
    );

    res.json({
      message: 'Restock successful',
      sweet: result.rows[0],
      addedQuantity: quantity,
      newStock: result.rows[0].quantity
    });
  } catch (error) {
    console.error('Restock sweet error:', error);
    res.status(500).json({ error: 'Failed to restock sweet' });
  }
});

export default router;