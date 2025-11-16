// frontend/src/components/SearchBar.tsx
import React, { useState } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  onSearch: (params: {
    name?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  }) => void;
  onReset: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onReset }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params: any = {};
    if (name) params.name = name;
    if (category) params.category = category;
    if (minPrice) params.minPrice = parseFloat(minPrice);
    if (maxPrice) params.maxPrice = parseFloat(maxPrice);

    onSearch(params);
  };

  const handleReset = () => {
    setName('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    onReset();
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-inputs">
          <input
            type="text"
            placeholder="Search by name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="search-input"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="search-select"
          >
            <option value="">All Categories</option>
            <option value="Chocolate">Chocolate</option>
            <option value="Gummies">Gummies</option>
            <option value="Hard Candy">Hard Candy</option>
            <option value="Jelly">Jelly</option>
            <option value="Mints">Mints</option>
            <option value="Toffee">Toffee</option>
            <option value="Caramel">Caramel</option>
          </select>

          <div className="price-range">
            <input
              type="number"
              placeholder="Min price"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              step="0.01"
              min="0"
              className="price-input"
            />
            <span>-</span>
            <input
              type="number"
              placeholder="Max price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              step="0.01"
              min="0"
              className="price-input"
            />
          </div>
        </div>

        <div className="search-buttons">
          <button type="submit" className="btn-search">
            Search
          </button>
          <button type="button" onClick={handleReset} className="btn-reset">
            Reset
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchBar;