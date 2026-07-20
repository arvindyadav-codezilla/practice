"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface NewsComment {
  author: string;
  text: string;
  timestamp: string;
}

interface NewsItem {
  id: string;
  title: string;
  link: string;
  description: string;
  imageUrl: string;
  pubDate: string;
  likes: number;
  comments: NewsComment[];
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeCommentBox, setActiveCommentBox] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(true);

  // Initialize the server URL on client-side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        setServerUrl(`${protocol}//127.0.0.1:8000/ws`);
      } else {
        setServerUrl(process.env.NEXT_PUBLIC_WS_SERVER_URL || "wss://practice-ihvr.onrender.com/ws");
      }
    }
  }, []);

  const getHttpUrl = (path: string) => {
    try {
      const url = new URL(serverUrl);
      const protocol = url.protocol === "wss:" ? "https:" : "http:";
      return `${protocol}//${url.host}${path}`;
    } catch {
      return "";
    }
  };

  const loadNews = async () => {
    const url = getHttpUrl("/api/news");
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setNews(data);
      }
    } catch (err) {
      console.error("Error loading news:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverUrl) {
      loadNews();
    }
  }, [serverUrl]);

  const handleLikeNews = async (id: string) => {
    const url = getHttpUrl(`/api/news/${id}/like`);
    if (!url) return;
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data.status === "ok") {
        setNews((prev) =>
          prev.map((item) => (item.id === id ? { ...item, likes: data.likes } : item))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const text = commentInput.trim();
    if (!text) return;
    const url = getHttpUrl(`/api/news/${id}/comment`);
    if (!url) return;

    let username = "Guest";
    if (typeof window !== "undefined") {
      username = localStorage.getItem("synapse_username") || "Guest";
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, username }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setNews((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, comments: [...item.comments, data.comment] }
              : item
          )
        );
        setCommentInput("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareNews = (link: string) => {
    navigator.clipboard.writeText(link);
    setToastMsg("Link copied to clipboard!");
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="news-page-container">
      <div className="news-page-header">
        <div className="news-page-title-group">
          <h1 className="news-page-title">Trending Tech News</h1>
          <p className="news-page-subtitle">Stay updated with the latest in tech, parsed directly via RSS.</p>
        </div>
        <Link href="/" className="back-to-chat-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Chat
        </Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
          <div className="message-media" style={{ minHeight: "150px", border: "none" }}>
            <span style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: 500 }}>Fetching latest feeds...</span>
          </div>
        </div>
      ) : (
        <div className="news-grid">
          {news.map((item) => (
            <div key={item.id} className="news-page-card">
              {item.imageUrl && (
                <div className="news-page-card-image">
                  <img src={item.imageUrl} alt={item.title} />
                </div>
              )}
              <div className="news-page-card-content">
                <h3 className="news-page-card-title">
                  <a href={item.link} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                </h3>
                <p className="news-page-card-desc">{item.description}</p>
                
                <div className="news-page-card-footer">
                  <div className="news-page-card-actions">
                    <button className="news-page-action-btn like" onClick={() => handleLikeNews(item.id)}>
                      <span>❤️</span> {item.likes}
                    </button>
                    <button className="news-page-action-btn comment" onClick={() => setActiveCommentBox(activeCommentBox === item.id ? null : item.id)}>
                      <span>💬</span> {item.comments.length}
                    </button>
                    <button className="news-page-action-btn share" onClick={() => handleShareNews(item.link)}>
                      <span>📤</span> Share
                    </button>
                  </div>

                  {activeCommentBox === item.id && (
                    <div className="news-page-comments-section">
                      <div className="news-page-comments-list">
                        {item.comments.length === 0 ? (
                          <div style={{ fontSize: "11px", color: "var(--text-dim)", padding: "4px 0" }}>No comments yet. Be the first!</div>
                        ) : (
                          item.comments.map((c, i) => (
                            <div key={i} className="news-page-comment-item">
                              <span className="news-page-comment-author">{c.author}:</span>
                              <span className="news-page-comment-text">{c.text}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <form onSubmit={(e) => handleAddComment(e, item.id)} className="news-page-comment-form">
                        <input
                          type="text"
                          placeholder="Write a comment..."
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          required
                        />
                        <button type="submit">Send</button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toastMsg && (
        <div className="toast-notification">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
