import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import '../index.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const SharedShoppingListDetail = () => {
  const { token } = useParams();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchList();
  }, [token]);

  const fetchList = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/shared/shopping-lists/${token}`);
      setList(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load shopping list. The link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (itemId, checked) => {
    try {
      // Optimistically update UI
      setList((prevList) => ({
        ...prevList,
        items: prevList.items.map((item) =>
          item.id === itemId ? { ...item, checked: !checked } : item
        ),
      }));

      // Update on server
      await axios.patch(`${API_URL}/shared/shopping-lists/${token}/items/${itemId}`, {
        checked: !checked,
      });
    } catch (err) {
      setError('Failed to update item. Please try again.');
      // Revert optimistic update
      fetchList();
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !list) {
    return (
      <div className="container">
        <div className="card">
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="container">
        <div className="card">
          <p>Shopping list not found.</p>
        </div>
      </div>
    );
  }

  const checkedCount = list.items.filter((item) => item.checked).length;
  const totalCount = list.items.length;

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">{list.name}</h2>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
              {checkedCount} / {totalCount} items checked
            </p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div>
          {list.items.length === 0 ? (
            <p>No items in this shopping list.</p>
          ) : (
            <div>
              {list.items.map((item) => (
                <div
                  key={item.id}
                  className={`ingredient-item ${item.checked ? 'checked' : ''}`}
                >
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1 }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleItem(item.id, item.checked)}
                    />
                    <span>
                      {item.amount} {item.unit} {item.name}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedShoppingListDetail;
