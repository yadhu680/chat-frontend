'use client';

import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [desiredName, setDesiredName] = useState('');
  const [myId, setMyId] = useState(null);
  const [myName, setMyName] = useState('');
  const [registered, setRegistered] = useState(false);

  const [users, setUsers] = useState([]); // {id, username, online}
  const [messages, setMessages] = useState([]); // message objects from server
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [privateTarget, setPrivateTarget] = useState('');
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function showErrorMsg(msg) {
    setError(msg);
  }

  // helper: build dynamic ws url
  function buildWsUrl() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const isLocal = ['localhost', '127.0.0.1'].includes(hostname);
    if (isLocal) {
      return `${protocol}://${hostname}:8080`;
    }
    return 'wss://whatsapp-clone-backend-lajh.onrender.com';
  }

  const register = () => {
    if (isJoining) return; // prevent double clicks

    if (!desiredName.trim()) {
      showErrorMsg('Enter your name first!');
      return;
    }
    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    const usernamePattern = /^[a-zA-Z0-9._]{3,20}$/;

    if (!usernamePattern.test(desiredName)) {
      showErrorMsg(
        'Invalid name! Only letters, numbers, underscore, or dot (3–20 chars) allowed.'
      );
      return;
    }

    setIsJoining(true); // lock the button

    ws.onopen = () => {
      ws.send(
        JSON.stringify({ type: 'register', username: desiredName.trim() })
      );
    };

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);

      if (data.type === 'error') {
        showErrorMsg(data.message || 'Error from server');
        return;
      } else if (data.type === 'registered') {
        setMyId(data.id);
        setMyName(data.username);
        setRegistered(true);
        sessionStorage.setItem('chat-user-id', data.id);
        sessionStorage.setItem('chat-username', data.username);
      } else if (data.type === 'history') {
        setMessages(data.messages || []);
      } else if (data.type === 'users') {
        setUsers(data.users || []);
      } else if (data.type === 'message') {
        setMessages((prev) => [...prev, data]);
        if (!data.self && data.id) {
          wsRef.current.send(
            JSON.stringify({
              type: 'read',
              messageId: data.id,
              readerId: myId,
            })
          );
        }
      } else if (data.type === 'read') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId ? { ...m, readBy: data.readBy } : m
          )
        );
      } else if (data.type === 'system') {
        setMessages((prev) => [
          ...prev,
          {
            id: 'sys-' + Date.now(),
            user: 'System',
            text: data.text,
            timestamp: data.timestamp,
          },
        ]);
      }
    };

    ws.onclose = () => {};
    // allow re-enable if needed (like error)
    setTimeout(() => setIsJoining(false), 2000);
  };

  useEffect(() => {
    const savedName = sessionStorage.getItem('chat-username');
    const savedId = sessionStorage.getItem('chat-user-id');
    if (savedName && savedId) {
      setDesiredName(savedName);
      register();
    }
  }, []);

  const handleUserClick = (user) => {
    if (privateTarget === user.username) {
      setPrivateTarget(null);
      // Remove @username from input if it exists
      setInput((prev) => prev.replace(new RegExp(`@${user.username}\\s*`), ''));
      return;
    }

    // Remove previous @username if any
    let newInput = input.replace(/@\w+\s*/, '');
    setPrivateTarget(user.username);
    setInput(`${newInput}`);
  };

  const handleSend = () => {
    if (
      !input.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    )
      return;
    wsRef.current.send(
      JSON.stringify({
        type: 'message',
        text: input.trim(),
        to: privateTarget || null,
      })
    );
    setInput('');
    setPrivateTarget('');
  };

  const handleLogout = () => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'logout' }));
        wsRef.current.close();
      }
    } catch {}
    sessionStorage.removeItem('chat-user-id');
    sessionStorage.removeItem('chat-username');
    setRegistered(false);
    setMyId(null);
    setMyName('');
    setMessages([]);
    setUsers([]);
    setInput('');
    setDesiredName('');
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!mounted) return null;

  if (!registered) {
    return (
      <main className="h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">
            Hello Friend! Join Chat
          </h2>

          <input
            className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-black placeholder-gray-400"
            placeholder="Enter your name.."
            value={desiredName}
            onChange={(e) => setDesiredName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') register();
            }}
          />

          <div className="flex gap-2">
            <button
              onClick={register}
              disabled={isJoining}
              className={`flex-1 bg-green-600 text-white py-2 
              rounded hover:bg-green-700 focus:outline-none 
              focus:ring-2 focus:ring-green-400 ${
                isJoining
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
              }`}
            >
              {isJoining ? 'Joining...' : 'Click here to join'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <p className="text-sm text-gray-500 mt-3">
            Already joined? enter the same name to rejoin.
          </p>
        </div>
      </main>
    );
  }

  // Sort users: online first
  const sortedUsers = [...users].sort((a, b) => {
    if (a.online === b.online) return 0;
    return a.online ? -1 : 1; // online first
  });

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}

      <aside className="w-80 bg-white border-r p-4 hidden sm:block">
        <div className="flex items-center justify-between mb-4 border-b pb-2">
          <span className="font-semibold text-black">Friends Online</span>
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
            {users.filter((u) => u.online).length}
          </span>
        </div>

        <div className="space-y-2">
          {sortedUsers.length === 0 && (
            <div className="text-gray-500">No users</div>
          )}
          <span className="text-md flex text-gray-500 mb-2">
            Click the user to chat privately
          </span>
          {sortedUsers.map((u) => {
            const isMe = u.username === myName;
            return (
              <div
                key={u.id}
                onClick={() => handleUserClick(u)}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                  privateTarget === u.username ? 'bg-green-50' : ''
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    u.online ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <div className={isMe ? 'font-semibold cursor-auto' : ''}>
                  {isMe ? 'You' : u.username}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <div className="sm:hidden bg-white border-b p-2">
          <span className="font-semibold text-black">Friends Online </span>
          <span className="text-md text-gray-500">
            (Click the user to chat privately)
          </span>
          <div className="flex flex-wrap gap-2 mt-2">
            {sortedUsers.map((u) => {
              const isMe = u.username === myName;
              return (
                <button
                  key={u.id}
                  onClick={() => handleUserClick(u)}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    privateTarget === u.username
                      ? 'bg-green-50 border-green-300'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      u.online ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <span
                    className={`whitespace-nowrap text-black ${
                      isMe ? 'font-semibold' : ''
                    }`}
                  >
                    {isMe ? 'You' : u.username}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-4 border-b flex items-center justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-semibold">
              <span className="font-semibold text-black">Chat as </span>
              <span className="text-green-600">{myName || 'You'}</span>
            </span>
            {privateTarget && (
              <div className="mb-1 flex items-center justify-between bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                <span className="inline-flex items-center gap-1">
                  Send private message to <strong>{privateTarget}</strong>
                </span>
                <button
                  onClick={() => handleUserClick({ username: privateTarget })}
                  className="ml-2 text-xs text-black-600 hover:underline"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-red-500 text-sm font-semibold hover:underline cursor-pointer"
          >
            Logout
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {messages.map((m, idx) => {
              const isSelf =
                m.self === true ||
                m.user === 'You' ||
                (m.user &&
                  myName &&
                  m.user.toLowerCase() === myName.toLowerCase());
              const amSender = isSelf;

              let showTicks = '';
              if (amSender) {
                if (!m.readBy || m.readBy.length === 0) showTicks = '✓'; // sent
                else if (m.readBy.length > 0) showTicks = '✓✓'; // read by recipient
              }

              return (
                <div
                  key={m.id || idx}
                  className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${
                      isSelf
                        ? 'bg-green-600 text-white rounded-br-none'
                        : 'bg-white text-gray-900 rounded-bl-none'
                    }`}
                  >
                    {!isSelf && (
                      <div className="text-xs font-semibold mb-1">{m.user}</div>
                    )}
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div className="mt-1 text-[11px] opacity-70 flex items-center gap-2">
                      <span>{formatTime(m.timestamp)}</span>
                      {showTicks && (
                        <span className="text-xs">{showTicks}</span>
                      )}
                      {m.private && (
                        <span className="text-xs">
                          ({isSelf ? 'to private' : 'private'})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 bg-white border-t p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              className="flex-1 border rounded px-3 py-2 text-black placeholder-gray-400"
              placeholder={
                privateTarget
                  ? `Message @${privateTarget} (private)`
                  : 'Type a message...'
              }
            />

            <button
              onClick={handleSend}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
