import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

function Dashboard({ name, email, onLogout }) {
  // Message board state
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  // Load the newest messages from the server
  const loadMessages = async () => {
    try {
      const response = await axios.get('/messages');
      setMessages(response.data.messages || []);
    } catch (error) {
      setError('Error loading messages: ' + (error.response?.data?.message || error.message));
    }
  };

  // Load messages once, when the dashboard first appears
  useEffect(() => {
    loadMessages();
  }, []);

  // Post a new message, then clear the text box and refresh the list
  const handlePost = async (e) => {
    e.preventDefault();

    try {
      await axios.post('/messages', { name, text });
      setText('');
      setError('');
      loadMessages();
    } catch (error) {
      setError('Error posting message: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="dashboard">
      <h2>Welcome to Your Dashboard</h2>
      <div className="user-greeting">
        <h3>Hello, {name}! </h3>
        <p>You've successfully logged in with: {email}</p>
      </div>
      <div className="dashboard-content">
        <p>You're looking handsome today, love ya!</p>
      </div>

      <div className="message-board">
        <form onSubmit={handlePost}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message..."
          />
          <button type="submit">Post</button>
        </form>
        {error && <p className="message">{error}</p>}
        <ul>
          {messages.map((msg) => (
            <li key={msg.id}>
              <strong>{msg.name}:</strong> {msg.text}
            </li>
          ))}
        </ul>
      </div>

      <button className="logout-btn" onClick={onLogout}>
        Log Out
      </button>
    </div>
  );
}

export default Dashboard;
