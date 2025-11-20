import React, { useState, useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import "./App.css";

type ChatEntry = {
  message: string;
  ts: number;
  self: boolean;
};

const parseMessage = (incoming: any): string => {
  if (incoming == null) return "";

  if (typeof incoming === "string") {
    try {
      const parsed = JSON.parse(incoming);
      return parseMessage(parsed);
    } catch {
      return incoming;
    }
  }

  if (typeof incoming === "object") {
    if (incoming.message) return String(incoming.message);
    try {
      return JSON.stringify(incoming);
    } catch {
      return String(incoming);
    }
  }

  return String(incoming);
};

export default function App() {
  const { sendJsonMessage, readyState, lastMessage } = useWebSocket(
    "wss://ed0pa614ah.execute-api.us-west-1.amazonaws.com/production/",
    {
      share: true,
    }
  );

  const messageRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [messageHistory, setMessageHistory] = useState<ChatEntry[]>([]);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (lastMessage !== null) {
      const messageText = parseMessage(lastMessage.data);

      setMessageHistory((prev) => {
        if (
          prev.length > 0 &&
          prev[prev.length - 1].self &&
          prev[prev.length - 1].message === messageText
        ) {
          return prev;
        }

        return prev.concat({
          message: messageText,
          ts: Date.now(),
          self: false,
        });
      });
    }
  }, [lastMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageHistory]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Connected",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Disconnected",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const isConnected = readyState === ReadyState.OPEN;
  const isChatEnabled = signedIn && isConnected;
  const resolvedStatus = signedIn
    ? isConnected
      ? "Connected"
      : connectionStatus
    : "Disconnected";
  const statusDotClass = isChatEnabled ? "online" : "offline";
  const toggleAuth = () => setSignedIn((prev) => !prev);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = messageRef.current?.value?.trim();
    if (!text) return;

    sendJsonMessage({ action: "sendmessage", message: text });

    setMessageHistory((prev) =>
      prev.concat({ message: text, ts: Date.now(), self: true })
    );

    if (messageRef.current) {
      messageRef.current.value = "";
    }
  };

  return (
    <div className="pastel-app">
      <aside className="pastel-sidebar">
        <div className="sidebar-content">
          <h1>Serverless Chat Platform for Learners</h1>

          <div className="status-pill">
            <span className={`status-dot ${statusDotClass}`} />
            <div>
              <p className="status-title">{resolvedStatus}</p>
              <p className="status-subtitle">WebSocket connection</p>
            </div>
          </div>
        </div>
        <div className="sidebar-footer">
          <p>Developed by Aaron, Bach, and Sean</p>
        </div>
      </aside>

      <main className="chat-surface">
        <header className="chat-heading">
          <div>
            <h2>Serverless Chat Box</h2>
          </div>
          <button
            type="button"
            className="auth-button"
            onClick={toggleAuth}
            aria-pressed={signedIn}
          >
            {signedIn ? "Sign Out" : "Sign In"}
          </button>
        </header>

        <section className="chat-window" aria-live="polite">
          {!signedIn && (
            <div className="chat-overlay">
              Please log in to use the chat service
            </div>
          )}
          {messageHistory.length === 0 ? (
            <div className="empty-state">
              Welcome to Serverless Chat Platform for Learners! Please start the
              conversation now!
            </div>
          ) : (
            messageHistory.map((entry, index) => (
              <article
                className={`chat-bubble ${entry.self ? "self" : "bot"}`}
                key={index}
              >
                <div className="bubble-meta">
                  <span>{entry.self ? "You" : "Chat Bot"}</span>
                  <time>
                    {new Date(entry.ts).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p>{entry.message}</p>
              </article>
            ))
          )}
          <div ref={messagesEndRef} />
        </section>

        <form className="chat-composer" onSubmit={handleSubmit}>
          <input
            type="text"
            ref={messageRef}
            placeholder="Share a thought or ask for help..."
            disabled={!isChatEnabled}
          />
          <button type="submit" disabled={!isChatEnabled}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
