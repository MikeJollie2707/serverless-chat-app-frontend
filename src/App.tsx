import React, { useState, useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import "./App.css";

// ------------------ CONFIG ------------------
const COGNITO_DOMAIN = "us-west-18viyeff6a.auth.us-west-1.amazoncognito.com";
const CLIENT_ID = "75j3nmcht7m5v97vvrvsqvi05h";
const REDIRECT_URI = "http://localhost:5173/";

// ------------------ PKCE HELPERS ------------------
function base64UrlEncode(arrayBuffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64UrlEncode(array.buffer);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );
  const codeChallenge = base64UrlEncode(digest);
  return { codeVerifier, codeChallenge };
}

// ------------------ AUTH FUNCTIONS ------------------
async function login() {
  const { codeVerifier, codeChallenge } = await generatePKCE();
  sessionStorage.setItem("pkce_verifier", codeVerifier);

  const url =
    `https://${COGNITO_DOMAIN}/oauth2/authorize?response_type=code` +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}` +
    `&scope=openid+email+profile`;

  window.location.href = url;
}

async function exchangeCode(code: string) {
  const verifier = sessionStorage.getItem("pkce_verifier");
  if (!verifier) return;

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("client_id", CLIENT_ID);
  params.append("code", code);
  params.append("redirect_uri", REDIRECT_URI);
  params.append("code_verifier", verifier);

  const res = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.id_token) sessionStorage.setItem("id_token", data.id_token);

  return data;
}

function logout() {
  sessionStorage.clear();
  window.location.href = "/";
}

function getIdToken() {
  return sessionStorage.getItem("id_token");
}

// ------------------ JWT DECODING ------------------
function parseJwt(token: string) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

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
    const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    const formattedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    return `${formattedFirstName} ${formattedLastName}`;
  }
  
  // If not in expected format, return full email
  return email;
}

// ------------------ CHAT ------------------
type ChatEntry = { message: string; ts: number; self: boolean; senderEmail?: string };

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
  const [signedIn, setSignedIn] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [readyToConnect, setReadyToConnect] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // Handle OAuth2 redirect
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    if (code) {
      exchangeCode(code).then((data) => {
        if (data?.id_token) {
          setIdToken(data.id_token);
          setSignedIn(true);
          setReadyToConnect(true);
          const decoded = parseJwt(data.id_token);
          if (decoded?.email) setEmail(decoded.email);
          window.history.replaceState({}, "", "/"); // Clean URL
        }
      });
    } else {
      const token = getIdToken();
      if (token) {
        setIdToken(token);
        setSignedIn(true);
        setReadyToConnect(true);
        const decoded = parseJwt(token);
        if (decoded?.email) setEmail(decoded.email);
      }
    }
  }, []);

  // ------------------ WebSocket ------------------
  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(
    readyToConnect && idToken
      ? `wss://ed0pa614ah.execute-api.us-west-1.amazonaws.com/production/?token=${idToken}`
      : null,
    {
      share: true,
      shouldReconnect: () => true,
      onError: (event) => console.error("WebSocket error:", event),
    }
  );

  const [messageHistory, setMessageHistory] = useState<ChatEntry[]>([]);
  const messageRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (lastMessage) {
      const messageText = parseMessage(lastMessage.data);
      setMessageHistory((prev) => {
        // Check if this is a duplicate of the last self message
        const lastEntry = prev[prev.length - 1];
        if (
          lastEntry &&
          lastEntry.self &&
          lastEntry.message === messageText
        ) {
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
  const isChatEnabled = signedIn && isConnected;

  // ------------------ RENDER ------------------
  return (
    <div className="pastel-app">
      <aside className="pastel-sidebar">
        <div className="sidebar-content">
          <h1>Serverless Chat Platform for Learners</h1>
          {email && <p className="user-email">Logged in as: {email}</p>}
          <div className="status-pill">
            <span className={`status-dot ${isChatEnabled ? "online" : "offline"}`} />
            <div>
              <p className="status-title">
                {signedIn ? (isConnected ? "Connected" : "Connecting...") : "Disconnected"}
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
            onClick={() => (signedIn ? logout() : login())}
          >
            {signedIn ? "Sign Out" : "Sign In"}
          </button>
        </header>

        <section className="chat-window">
          {!signedIn && <div className="chat-overlay">Please log in to use the chat service</div>}
          {messageHistory.map((entry, idx) => (
            <article key={idx} className={`chat-bubble ${entry.self ? "self" : "bot"}`}>
              <div className="bubble-meta">
                <span className="sender-email">{entry.senderEmail || (entry.self ? parseEmailToName(email) : "Chat Bot")}</span>
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
