import React, { useState, useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import "./App.css";
import { useAuth } from "react-oidc-context";
import { jwtDecode, type JwtPayload } from "jwt-decode";

// ------------------ EMAIL PARSING ------------------
function parseEmailToName(email: string | null | undefined): string {
  if (!email) return "You";

  // Check if email matches format: firstname.lastname@sjsu.edu
  const sjsuEmailPattern = /^([^.]+)\.([^@]+)@sjsu\.edu$/i;
  const match = email.match(sjsuEmailPattern);

  if (match) {
    const firstName = match[1];
    const lastName = match[2];
    // Capitalize first letter of each name
    const formattedFirstName =
      firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    const formattedLastName =
      lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    return `${formattedFirstName} ${formattedLastName}`;
  }

  // If not in expected format, return full email
  return email;
}

// ------------------ CHAT ------------------
type ChatEntry = {
  message: string;
  ts: number;
  self: boolean;
  senderEmail?: string;
};

interface CognitoIDPayload extends JwtPayload {
  email: string;
  "cognito:username": string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseMessage = (incoming: any): string => {
  if (!incoming) return "";
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

// ------------------ APP COMPONENT ------------------
export default function App() {
  const auth = useAuth();
  const hasAccessToken = !!auth.user?.access_token;

  const email = auth.user?.id_token
    ? (jwtDecode(auth.user.id_token) as CognitoIDPayload).email
    : "";

  // ------------------ WebSocket ------------------
  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(
    import.meta.env.VITE_WSS_URL || "",
    {
      share: true,
      // This is sus, but the lib doesn't provide any other way to put
      // token in the initial upgrade request
      queryParams: {
        token: auth.user?.access_token || "",
      },
      shouldReconnect: () => true,
      onError: (event) => console.error("WebSocket error:", event),
      reconnectAttempts: 3,
    },
    // Connect only when this is true
    hasAccessToken
  );

  const [messageHistory, setMessageHistory] = useState<ChatEntry[]>([]);
  const messageRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (lastMessage) {
      const messageText = parseMessage(lastMessage.data);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessageHistory((prev) => {
        // Check if this is a duplicate of the last self message
        const lastEntry = prev[prev.length - 1];
        if (lastEntry && lastEntry.self && lastEntry.message === messageText) {
          // Skip duplicate - this is likely an echo of our own message
          return prev;
        }
        return prev.concat({
          message: messageText,
          ts: Date.now(),
          self: false,
          senderEmail: "Chat Bot",
        });
      });
    }
  }, [lastMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageHistory]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = messageRef.current?.value?.trim();
    if (!text) return;

    sendJsonMessage({ action: "sendmessage", message: text });
    setMessageHistory((prev) =>
      prev.concat({
        message: text,
        ts: Date.now(),
        self: true,
        senderEmail: parseEmailToName(email),
      })
    );
    if (messageRef.current) messageRef.current.value = "";
  };

  const isConnected = readyState === ReadyState.OPEN;
  // WS only connects when user is auth so no need to check for auth
  const isChatEnabled = isConnected;

  // ------------------ RENDER ------------------
  return (
    <div className="pastel-app">
      <aside className="pastel-sidebar">
        <div className="sidebar-content">
          <h1>Serverless Chat Platform for Learners</h1>
          {email && <p className="user-email">Logged in as: {email}</p>}
          <div className="status-pill">
            <span
              className={`status-dot ${isConnected ? "online" : "offline"}`}
            />
            <div>
              <p className="status-title">
                {hasAccessToken
                  ? isConnected
                    ? "Connected"
                    : "Connecting..."
                  : "Disconnected"}
              </p>
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
          <h2>Serverless Chat Box</h2>
          <button
            type="button"
            className="auth-button"
            onClick={async () => {
              if (!hasAccessToken) {
                await auth.signinRedirect();
              } else
                await auth.signoutRedirect({
                  extraQueryParams: {
                    client_id: auth.settings.client_id,
                    logout_uri: import.meta.env.VITE_COGNITO_REDIRECT_URL || "",
                  },
                });
            }}
          >
            {hasAccessToken ? "Sign Out" : "Sign In"}
          </button>
        </header>

        <section className="chat-window">
          {!hasAccessToken && (
            <div className="chat-overlay">
              Please log in to use the chat service
            </div>
          )}
          {messageHistory.map((entry, idx) => (
            <article
              key={idx}
              className={`chat-bubble ${entry.self ? "self" : "bot"}`}
            >
              <div className="bubble-meta">
                <span className="sender-email">
                  {entry.senderEmail ||
                    (entry.self ? parseEmailToName(email) : "Chat Bot")}
                </span>
                <time>
                  {new Date(entry.ts).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p>{entry.message}</p>
            </article>
          ))}
          <div ref={messagesEndRef} />
        </section>

        <form className="chat-composer" onSubmit={handleSubmit}>
          <input
            type="text"
            ref={messageRef}
            placeholder="Write a message..."
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
