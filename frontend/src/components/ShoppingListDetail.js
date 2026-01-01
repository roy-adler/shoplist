import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import io from 'socket.io-client';
import '../index.css';

const ShoppingListDetail = () => {
  const { id } = useParams();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [shareToken, setShareToken] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    fetchList();
    fetchShareToken();

    // Setup WebSocket connection for real-time updates
    const token = localStorage.getItem('token');
    if (!token) return;

    // Socket.io needs the base server URL, not the API path
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const socketUrl = apiUrl.replace('/api', '') || 'http://localhost:5001';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      // Join the list room for real-time updates
      socket.emit('join_list', parseInt(id));
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

  const fetchShareToken = async () => {
    try {
      const response = await api.get(`/shopping-lists/${id}/share`);
      if (response.data.shareToken) {
        setShareToken(response.data.shareToken);
        const baseUrl = window.location.origin;
        setShareLink(`${baseUrl}/shared/shopping-lists/${response.data.shareToken}`);
      }
    } catch (err) {
      // Share token might not exist yet, that's okay
      console.log('No share token found');
    }
  };

  const generateShareLink = async () => {
    try {
      const response = await api.post(`/shopping-lists/${id}/share`);
      const token = response.data.shareToken;
      setShareToken(token);
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/shared/shopping-lists/${token}`;
      setShareLink(link);
      setShowShareModal(true);
    } catch (err) {
      setError('Failed to generate share link');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      alert('Share link copied to clipboard!');
    });
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="card-title">{list.name}</h2>
                <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
                  {checkedCount} / {totalCount} items checked
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={shareToken ? () => setShowShareModal(true) : generateShareLink}
                style={{ marginLeft: '10px' }}
              >
                {shareToken ? 'Share Link' : 'Generate Share Link'}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {showShareModal && shareLink && (
          <div className="card" style={{ marginTop: '20px', backgroundColor: '#f5f5f5' }}>
            <h3>Share this shopping list</h3>
            <p>Anyone with this link can view and edit the shopping list:</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <input
                type="text"
                value={shareLink}
                readOnly
                style={{ flex: 1, padding: '8px', fontSize: '14px' }}
              />
              <button className="btn btn-primary" onClick={copyToClipboard}>
                Copy
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowShareModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

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

