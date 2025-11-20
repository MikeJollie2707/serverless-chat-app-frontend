import React, { useState, useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import "./App.css";

export default function App() {
  const { sendJsonMessage, readyState, lastMessage } = useWebSocket(
    "wss://ed0pa614ah.execute-api.us-west-1.amazonaws.com/production/",
    {
      share: true,
    }
  );

  const messageRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);

  useEffect(() => {
    if (lastMessage !== null) {
      // try to parse JSON messages, but fall back to raw data
      let parsed: any = lastMessage.data;
      try {
        parsed = JSON.parse(lastMessage.data);
      } catch (e) {
        // not JSON
      }
      setMessageHistory((prev) => prev.concat({ ...parsed, _raw: lastMessage.data }));
    }
  }, [lastMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageHistory]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const handleClickSendMessage = () => {
    const text = messageRef.current?.value?.trim();
    if (!text) return;

    // send to server
    sendJsonMessage({ action: "sendmessage", message: text });

    // show optimistic local echo
    setMessageHistory((prev) => prev.concat({ message: text, self: true, ts: Date.now() }));

    if (messageRef.current) messageRef.current.value = "";
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleClickSendMessage();
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="title">Serverless Chat</div>
        <div className="status">
          <span className={`status-dot ${connectionStatus === "Open" ? "open" : "closed"}`}></span>
          <span className="status-text">{connectionStatus}</span>
        </div>
      </header>

      <main className="chat-card">
        <section className="messages" aria-live="polite">
          {messageHistory.length === 0 && (
            <div className="empty">No messages yet</div>
          )}

          {messageHistory.map((m, idx) => {
            const text = typeof m === "string" ? m : m.message ?? m._raw ?? String(m);
            const isSelf = !!m.self;
            return (
              <div key={idx} className={`message ${isSelf ? "me" : "them"}`}>
                <div className="bubble">{text}</div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </section>

        <form className="composer" onSubmit={(e) => e.preventDefault()}>
          <input
            className="input"
            type="text"
            placeholder="Type a message and press Enter..."
            ref={messageRef}
            onKeyDown={onKeyDown}
            aria-label="Message input"
          />
          <button type="button" className="send-button" onClick={handleClickSendMessage} aria-label="Send">
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
