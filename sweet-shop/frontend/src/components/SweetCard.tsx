// frontend/src/components/SweetCard.tsx
import React, { useState } from 'react';
import { Sweet } from '../types';
import EditSweetModal from './EditSweetModal';
import './SweetCard.css';

interface SweetCardProps {
  sweet: Sweet;
  isAdmin: boolean;
  onPurchase: (id: number, quantity: number) => void;
  onDelete: (id: number) => void;
  onRestock: (id: number, quantity: number) => void;
  onUpdate: () => void;
}

const SweetCard: React.FC<SweetCardProps> = ({
  sweet,
  isAdmin,
  onPurchase,
  onDelete,
  onRestock,
  onUpdate,
}) => {
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [restockQuantity, setRestockQuantity] = useState(10);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRestockInput, setShowRestockInput] = useState(false);

  const handlePurchase = () => {
    if (purchaseQuantity > 0 && purchaseQuantity <= sweet.quantity) {
      onPurchase(sweet.id, purchaseQuantity);
      setPurchaseQuantity(1);
    } else {
      alert('Invalid quantity');
    }
  };

  const handleRestock = () => {
    if (restockQuantity > 0) {
      onRestock(sweet.id, restockQuantity);
      setRestockQuantity(10);
      setShowRestockInput(false);
    } else {
      alert('Invalid quantity');
    }
  };

  const isOutOfStock = sweet.quantity === 0;
  const isLowStock = sweet.quantity > 0 && sweet.quantity <= 10;

  return (
    <>
      <div className={`sweet-card ${isOutOfStock ? 'out-of-stock' : ''}`}>
        <div className="sweet-image">
          {sweet.image_url ? (
            <img src={sweet.image_url} alt={sweet.name} />
          ) : (
            <div className="sweet-placeholder">🍬</div>
          )}
          {isOutOfStock && <div className="stock-badge out">Out of Stock</div>}
          {isLowStock && <div className="stock-badge low">Low Stock</div>}
        </div>

        <div className="sweet-content">
          <h3>{sweet.name}</h3>
          <span className="sweet-category">{sweet.category}</span>

          {sweet.description && (
            <p className="sweet-description">{sweet.description}</p>
          )}

          <div className="sweet-info">
            <div className="sweet-price">${parseFloat(sweet.price.toString()).toFixed(2)}</div>
            <div className="sweet-stock">
              Stock: <strong>{sweet.quantity}</strong>
            </div>
          </div>

          {!isAdmin ? (
            <div className="purchase-section">
              <div className="quantity-selector">
                <button
                  onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                  disabled={isOutOfStock}
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={sweet.quantity}
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(parseInt(e.target.value) || 1)}
                  disabled={isOutOfStock}
                />
                <button
                  onClick={() =>
                    setPurchaseQuantity(Math.min(sweet.quantity, purchaseQuantity + 1))
                  }
                  disabled={isOutOfStock}
                >
                  +
                </button>
              </div>
              <button
                onClick={handlePurchase}
                className="btn-purchase"
                disabled={isOutOfStock}
              >
                {isOutOfStock ? 'Out of Stock' : 'Purchase'}
              </button>
            </div>
          ) : (
            <div className="admin-actions">
              <button onClick={() => setShowEditModal(true)} className="btn-edit">
                Edit
              </button>
              <button
                onClick={() => setShowRestockInput(!showRestockInput)}
                className="btn-restock"
              >
                Restock
              </button>
              <button onClick={() => onDelete(sweet.id)} className="btn-delete">
                Delete
              </button>

              {showRestockInput && (
                <div className="restock-section">
                  <input
                    type="number"
                    min="1"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 10)}
                    placeholder="Quantity"
                  />
                  <button onClick={handleRestock} className="btn-confirm">
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowRestockInput(false)}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <EditSweetModal
          sweet={sweet}
          onClose={() => setShowEditModal(false)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
};

export default SweetCard;