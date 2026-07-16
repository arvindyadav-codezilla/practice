"use client";

import React, { useState, useEffect, useRef } from "react";

interface ChatMessage {
  type: "message" | "system";
  username?: string;
  text?: string;
  content?: string;
  timestamp: string;
}

export default function GroupChat() {
  // Connection states
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("Dev Lounge");
  const [customRoom, setCustomRoom] = useState("");
  
  // Advanced WS Server Connection Configuration
  const [serverUrl, setServerUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Chatting states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const [activeTyping, setActiveTyping] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Suggested popular rooms
  const popularRooms = ["Dev Lounge", "Quantum Lab", "Design Hub", "General Space"];

  // Initialize the server URL on the client-side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Avoid IPv6 resolution issue (localhost resolving to ::1 while backend runs on 127.0.0.1)
      const hostname = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
      setServerUrl(`${protocol}//${hostname}:8000/ws`);
    }
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTyping]);

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Connect to websocket server
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalUsername = username.trim();
    const finalRoom = (customRoom.trim() || room).trim();

    if (!finalUsername || !finalRoom) {
      setErrorMsg("Please enter both username and room name.");
      return;
    }

    if (finalUsername.includes("Nova AI")) {
      setErrorMsg("Username cannot contain 'Nova AI'. That is reserved.");
      return;
    }

    setErrorMsg(null);
    
    try {
      const ws = new WebSocket(serverUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setSocketConnected(true);
        // Send join event
        ws.send(
          JSON.stringify({
            type: "join",
            username: finalUsername,
            room: finalRoom,
          })
        );
        setJoined(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "system") {
          setMessages((prev) => [
            ...prev,
            {
              type: "system",
              content: data.content,
              timestamp: data.timestamp,
            },
          ]);
          if (data.users) {
            setUsers(data.users);
          }
        } else if (data.type === "message") {
          setMessages((prev) => [
            ...prev,
            {
              type: "message",
              username: data.username,
              text: data.text,
              timestamp: data.timestamp,
            },
          ]);
        } else if (data.type === "typing") {
          if (data.isTyping) {
            setActiveTyping(data.username);
          } else {
            setActiveTyping((current) => (current === data.username ? null : current));
          }
        }
      };

      ws.onclose = () => {
        setSocketConnected(false);
        setJoined(false);
        setMessages([]);
        setUsers([]);
        setErrorMsg("Disconnected from server. Please check the backend log or URL.");
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setErrorMsg(`Failed to connect to backend at ${serverUrl}. Is the backend running?`);
      };

    } catch (err) {
      console.error(err);
      setErrorMsg("Invalid WebSocket server URL configured.");
    }
  };

  const handleLeave = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    setJoined(false);
    setMessages([]);
    setUsers([]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socketRef.current || !socketConnected) return;

    // Send chat message
    socketRef.current.send(
      JSON.stringify({
        type: "message",
        text: inputText.trim(),
      })
    );

    // Reset typing status immediately
    sendTypingStatus(false);
    setInputText("");
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (!socketRef.current || !socketConnected) return;
    socketRef.current.send(
      JSON.stringify({
        type: "typing",
        isTyping,
      })
    );
    isTypingRef.current = isTyping;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Handle typing indicator
    if (!isTypingRef.current) {
      sendTypingStatus(true);
    }

    // Reset the typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 1500);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Get initials for profile avatar
  const getInitials = (name: string) => {
    return name.substring(0, 2);
  };

  // Safe client-side markdown formatter
  const renderMessageText = (text: string) => {
    if (!text) return "";
    
    let html = text;
    
    // Escape HTML entities to prevent XSS
    html = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Bullet lists (lines starting with - )
    const lines = html.split("\n").map(line => {
      if (line.trim().startsWith("- ")) {
        return `• ${line.trim().substring(2)}`;
      }
      return line;
    });
    
    return lines.map((str, index) => (
      <React.Fragment key={index}>
        {index > 0 && <br />}
        <span dangerouslySetInnerHTML={{ __html: str }} />
      </React.Fragment>
    ));
  };

  const insertAITrigger = () => {
    if (!inputText.startsWith("@nova")) {
      setInputText((prev) => "@nova " + prev);
    }
  };

  return (
    <div className="app-container">
      {!joined ? (
        /* Lobby Join Form */
        <div className="lobby-container glass-card">
          <div className="lobby-logo">
            <svg viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
            </svg>
          </div>
          
          <h1 className="lobby-title">Synapse Chat</h1>
          <p className="lobby-subtitle">Connect in real-time, instantly.</p>

          <form onSubmit={handleJoin}>
            <div className="form-group">
              <label className="form-label">Choose your Handle</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. cyber_knight"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={15}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Select Group Room</label>
              <div className="room-chips">
                {popularRooms.map((r) => (
                  <div
                    key={r}
                    className={`room-chip ${room === r && !customRoom ? "active" : ""}`}
                    onClick={() => {
                      setRoom(r);
                      setCustomRoom("");
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Or create/enter custom room name..."
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                maxLength={20}
              />
            </div>

            {/* Advanced Configuration Toggle */}
            <div style={{ textAlign: "left", marginBottom: "20px" }}>
              <div 
                style={{ 
                  fontSize: "12px", 
                  color: "var(--text-dim)", 
                  cursor: "pointer", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "4px",
                  fontWeight: 600,
                  userSelect: "none"
                }}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>{showAdvanced ? "▼" : "▶"} Advanced Server Settings</span>
              </div>
              
              {showAdvanced && (
                <div style={{ marginTop: "12px" }}>
                  <label className="form-label" style={{ fontSize: "11px" }}>WebSocket Server URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="ws://127.0.0.1:8000/ws"
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px", display: "block" }}>
                    If you are using port-forwarding or a proxy, enter the external URL here.
                  </span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div style={{ color: "#ef4444", fontSize: "14px", marginBottom: "16px", fontWeight: 500 }}>
                {errorMsg}
              </div>
            )}

            <button type="submit" className="primary-btn">
              <span>Enter Room</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </form>
        </div>
      ) : (
        /* Chat Dashboard */
        <div className="chat-dashboard glass-card">
          {/* Sidebar */}
          <div className="chat-sidebar">
            <div className="sidebar-header">
              <div className="app-badge">
                <svg viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
                </svg>
              </div>
              <span className="app-name">Synapse</span>
            </div>

            <div className="sidebar-section">
              <div className="section-title">
                <span>Room Members</span>
                <span className="badge-count">{users.length}</span>
              </div>
              <div className="users-list">
                {users.map((user, idx) => {
                  const isAI = user.startsWith("Nova AI");
                  return (
                    <div
                      key={idx}
                      className={`user-item ${user === username ? "me" : ""}`}
                    >
                      <div className={`user-avatar ${isAI ? "avatar-ai" : idx % 2 === 0 ? "" : "avatar-alt"}`}>
                        {isAI ? "AI" : getInitials(user)}
                      </div>
                      <span>{isAI ? "Nova AI" : user}</span>
                      {user === username && <span style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: "4px" }}>(you)</span>}
                      {isAI && <span className="ai-badge">Agent</span>}
                      <div className={`status-dot ${isAI ? "ai-status" : ""}`}></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sidebar-footer">
              <div className="my-profile">
                <div className="user-avatar" style={{ width: "36px", height: "36px", background: "var(--primary-gradient)" }}>
                  {getInitials(username)}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{username}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Online</div>
                </div>
              </div>
              <button className="leave-btn" onClick={handleLeave} title="Leave room">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="chat-main">
            {/* Header */}
            <div className="chat-header">
              <div className="room-info">
                <div className="room-title"># {customRoom.trim() || room}</div>
                <div className="room-desc">
                  <div className="room-desc-dot"></div>
                  <span>{users.length} users active in room</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {messages.map((msg, idx) => {
                if (msg.type === "system") {
                  return (
                    <div key={idx} className="message-system">
                      {msg.content}
                    </div>
                  );
                }

                const isMe = msg.username === username;
                const isAI = msg.username?.startsWith("Nova AI");
                return (
                  <div
                    key={idx}
                    className={`message-wrapper ${isMe ? "sent" : isAI ? "received ai" : "received"}`}
                  >
                    <div className="message-meta">
                      <span className="message-sender">
                        {isAI ? "Nova AI" : msg.username}
                        {isAI && <span className="ai-badge">Agent</span>}
                      </span>
                      <span>{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="message-bubble">{renderMessageText(msg.text || "")}</div>
                  </div>
                );
              })}
              
              {/* Other users typing */}
              {activeTyping && (
                <div className="message-wrapper received" style={{ animation: "none" }}>
                  <div className="message-meta">
                    <span className="message-sender">{activeTyping}</span>
                  </div>
                  <div className="message-bubble" style={{ padding: "10px 14px" }}>
                    <div className="typing-indicator">
                      <span>typing</span>
                      <div className="typing-dots">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Footer */}
            <form onSubmit={handleSendMessage} className="chat-footer">
              <div className="input-bar">
                <button type="button" className="ai-trigger-btn" onClick={insertAITrigger}>
                  <span>✨ Ask AI</span>
                </button>
                <input
                  type="text"
                  className="chat-input"
                  placeholder={`Message #${customRoom.trim() || room}...`}
                  value={inputText}
                  onChange={handleInputChange}
                  maxLength={500}
                />
                <button type="submit" className="send-btn">
                  <svg viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
