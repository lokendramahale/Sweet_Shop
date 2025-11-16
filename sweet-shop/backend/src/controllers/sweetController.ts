import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';

export const createSweet = async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, price, quantity, description } = req.body;

    // Validation
    if (!name || !category || price === undefined || quantity === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO sweets (name, category, price, quantity, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, category, price, quantity, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create sweet error:', error);
    res.status(500).json({ error: 'Failed to create sweet' });
  }
};

export const getAllSweets = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM sweets ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get sweets error:', error);
    res.status(500).json({ error: 'Failed to fetch sweets' });
  }
};

export const searchSweets = async (req: AuthRequest, res: Response) => {
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
      query += ` AND category = $${paramCount}`;
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

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Search sweets error:', error);
    res.status(500).json({ error: 'Failed to search sweets' });
  }
};

export const updateSweet = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, price, quantity, description } = req.body;

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
      updates.push(`price = $${paramCount}`);
      params.push(price);
      paramCount++;
    }
    if (quantity !== undefined) {
      updates.push(`quantity = $${paramCount}`);
      params.push(quantity);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    const query = `
      UPDATE sweets 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sweet not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update sweet error:', error);
    res.status(500).json({ error: 'Failed to update sweet' });
  }
};

export const deleteSweet = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM sweets WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sweet not found' });
    }

    res.json({ message: 'Sweet deleted successfully' });
  } catch (error) {
    console.error('Delete sweet error:', error);
    res.status(500).json({ error: 'Failed to delete sweet' });
  }
};

export const purchaseSweet = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check current stock
      const checkResult = await client.query(
        'SELECT quantity FROM sweets WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Sweet not found' });
      }

      const currentQuantity = checkResult.rows[0].quantity;

      if (currentQuantity < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient stock' });
      }

      // Update quantity
      const updateResult = await client.query(
        'UPDATE sweets SET quantity = quantity - $1 WHERE id = $2 RETURNING *',
        [quantity, id]
      );

      await client.query('COMMIT');
      res.json(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Purchase sweet error:', error);
    res.status(500).json({ error: 'Failed to purchase sweet' });
  }
};

export const restockSweet = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const result = await pool.query(
      'UPDATE sweets SET quantity = quantity + $1 WHERE id = $2 RETURNING *',
      [quantity, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sweet not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Restock sweet error:', error);
    res.status(500).json({ error: 'Failed to restock sweet' });
  }
};