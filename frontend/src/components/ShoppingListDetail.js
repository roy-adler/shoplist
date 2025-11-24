import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import io from 'socket.io-client';
import '../index.css';

const ShoppingListDetail = () => {
  const { id } = useParams();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchList();

    // Setup WebSocket connection for real-time updates
    const token = localStorage.getItem('token');
    if (!token) return;

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
    const socket = io(apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('shopping_list_updated', (data) => {
      if (data.listId === parseInt(id)) {
        // Update the specific item
        setList((prevList) => {
          if (!prevList) return prevList;
          return {
            ...prevList,
            items: prevList.items.map((item) =>
              item.id === data.itemId
                ? { ...item, checked: data.checked }
                : item
            ),
          };
        });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  const fetchList = async () => {
    try {
      const response = await api.get(`/shopping-lists/${id}`);
      setList(response.data);
    } catch (err) {
      setError('Failed to fetch shopping list');
    }
  };

  const handleToggleItem = async (itemId, checked) => {
    try {
      await api.patch(`/shopping-lists/${id}/items/${itemId}`, {
        checked: !checked,
      });
      // The WebSocket will handle the update
      setList((prevList) => ({
        ...prevList,
        items: prevList.items.map((item) =>
          item.id === itemId ? { ...item, checked: !checked } : item
        ),
      }));
    } catch (err) {
      setError('Failed to update item');
    }
  };

  if (!list) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const checkedCount = list.items.filter((item) => item.checked).length;
  const totalCount = list.items.length;

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <div>
            <Link to="/shopping-lists" style={{ marginBottom: '10px', display: 'block' }}>
              ← Back to Shopping Lists
            </Link>
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

export default ShoppingListDetail;

