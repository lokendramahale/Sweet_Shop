// frontend/src/components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { sweetsAPI } from '../services/api';
import { Sweet } from '../types';
import SweetCard from './SweetCard';
import SearchBar from './SearchBar';
import AddSweetModal from './AddSweetModal';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const [sweets, setSweets] = useState<Sweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const loadSweets = async () => {
    try {
      setLoading(true);
      const data = await sweetsAPI.getAll();
      setSweets(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load sweets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSweets();
  }, []);

  const handleSearch = async (params: any) => {
    try {
      setLoading(true);
      const data = await sweetsAPI.search(params);
      setSweets(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (id: number, quantity: number) => {
    try {
      await sweetsAPI.purchase(id, quantity);
      await loadSweets(); // Reload to get updated quantities
      alert('Purchase successful!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Purchase failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this sweet?')) {
      return;
    }

    try {
      await sweetsAPI.delete(id);
      await loadSweets();
      alert('Sweet deleted successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleRestock = async (id: number, quantity: number) => {
    try {
      await sweetsAPI.restock(id, quantity);
      await loadSweets();
      alert('Restock successful!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Restock failed');
    }
  };

  const handleAddSweet = async (sweetData: any) => {
    try {
      await sweetsAPI.create(sweetData);
      await loadSweets();
      setShowAddModal(false);
      alert('Sweet added successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add sweet');
    }
  };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>🍭 Sweet Shop</h1>
        </div>
        <div className="navbar-user">
          <span>Welcome, {user?.username}!</span>
          {isAdmin && <span className="admin-badge">Admin</span>}
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Available Sweets</h2>
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              + Add New Sweet
            </button>
          )}
        </div>

        <SearchBar onSearch={handleSearch} onReset={loadSweets} />

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Loading sweets...</div>
        ) : sweets.length === 0 ? (
          <div className="no-sweets">
            <p>No sweets available at the moment.</p>
            {isAdmin && (
              <button onClick={() => setShowAddModal(true)} className="btn-primary">
                Add Your First Sweet
              </button>
            )}
          </div>
        ) : (
          <div className="sweets-grid">
            {sweets.map((sweet) => (
              <SweetCard
                key={sweet.id}
                sweet={sweet}
                isAdmin={isAdmin}
                onPurchase={handlePurchase}
                onDelete={handleDelete}
                onRestock={handleRestock}
                onUpdate={loadSweets}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddSweetModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddSweet}
        />
      )}
    </div>
  );
};

export default Dashboard;