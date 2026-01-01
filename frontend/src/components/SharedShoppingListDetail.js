import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import '../index.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const SharedShoppingListDetail = () => {
  const { token } = useParams();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const listIdRef = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState({
    name: '',
    unit: '',
    amount: 1
  });

  useEffect(() => {
    fetchList();

    // Setup WebSocket connection for real-time updates (only once per token)
    // Socket.io needs the base server URL, not the API path
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const socketUrl = apiUrl.replace('/api', '') || 'http://localhost:5001';
    
    const socket = io(socketUrl, {
      auth: { shareToken: token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('shopping_list_updated', (data) => {
      if (listIdRef.current && data.listId === listIdRef.current) {
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

    socket.on('shopping_list_item_added', (data) => {
      if (listIdRef.current && data.listId === listIdRef.current) {
        // Add the new item to the list
        setList((prevList) => {
          if (!prevList) return prevList;
          // Check if item already exists (might have been added optimistically)
          const exists = prevList.items.some(item => item.id === data.item.id);
          if (exists) {
            return prevList;
          }
          return {
            ...prevList,
            items: [...prevList.items, data.item].sort((a, b) => {
              if (a.checked !== b.checked) return a.checked ? 1 : -1;
              return a.name.localeCompare(b.name);
            })
          };
        });
      }
    });

    socket.on('connect_error', (error) => {
      // Try to reconnect after a delay
      setTimeout(() => {
        if (socket.disconnected) {
          socket.connect();
        }
      }, 2000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // Update listIdRef when list changes
  useEffect(() => {
    if (list && list.id) {
      listIdRef.current = list.id;
    }
  }, [list]);

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

      // Update on server (WebSocket will handle the broadcast)
      await axios.patch(`${API_URL}/shared/shopping-lists/${token}/items/${itemId}`, {
        checked: !checked,
      });
    } catch (err) {
      setError('Failed to update item. Please try again.');
      // Revert optimistic update
      fetchList();
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setError('');

    if (!addFormData.name || !addFormData.unit) {
      setError('Please provide name and unit');
      return;
    }

    try {
      // Optimistically add to list
      const tempItem = {
        id: Date.now(),
        name: addFormData.name,
        unit: addFormData.unit,
        amount: parseFloat(addFormData.amount),
        checked: false
      };
      setList((prevList) => {
        if (!prevList) return prevList;
        return {
          ...prevList,
          items: [...prevList.items, tempItem].sort((a, b) => {
            if (a.checked !== b.checked) return a.checked ? 1 : -1;
            return a.name.localeCompare(b.name);
          })
        };
      });

      await axios.post(`${API_URL}/shared/shopping-lists/${token}/items`, {
        name: addFormData.name,
        unit: addFormData.unit,
        amount: parseFloat(addFormData.amount)
      });
      
      setShowAddForm(false);
      setAddFormData({ name: '', unit: '', amount: 1 });
      // Refresh to get the real item with correct ID
      fetchList();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add item');
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

        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          {!showAddForm ? (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              + Add Item
            </button>
          ) : (
            <div className="card" style={{ backgroundColor: '#f5f5f5' }}>
              <h3>Add Item to Shopping List</h3>
              <form onSubmit={handleAddItem}>
                <div className="form-group">
                  <label>Ingredient Name</label>
                  <input
                    type="text"
                    value={addFormData.name}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input
                    type="text"
                    value={addFormData.unit}
                    onChange={(e) => setAddFormData({ ...addFormData, unit: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addFormData.amount}
                    onChange={(e) => setAddFormData({ ...addFormData, amount: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  Add Item
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddFormData({ name: '', unit: '', amount: 1 });
                    setError('');
                  }}
                  style={{ marginLeft: '10px' }}
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>

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
