import React, { useState, useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

export default function App() {
  const { sendJsonMessage, readyState, lastMessage } = useWebSocket(
    "wss://ed0pa614ah.execute-api.us-west-1.amazonaws.com/production/",
    {
      share: true,
    }
  );
  const messageRef = useRef<HTMLInputElement | null>(null);
  const [messageHistory, setMessageHistory] = useState<MessageEvent<any>[]>([]);

  useEffect(() => {
    if (lastMessage !== null) {
      setMessageHistory((prev) => prev.concat(lastMessage));
    }
  }, [lastMessage]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const handleClickSendMessage = () => {
    console.log(messageRef.current?.value);
    if (messageRef.current?.value) {
      sendJsonMessage({
        action: "sendmessage",
        message: messageRef.current.value,
      });
      messageRef.current.value = "";
    }
  };

  return (
    <div>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="text" ref={messageRef}></input>
        <button onClick={handleClickSendMessage}>Send</button>
      </form>
      <span>The WebSocket is currently {connectionStatus}</span>
      <ul>
        {messageHistory.map((message, idx) => (
          <span className="flex flex-col gap-2" key={idx}>
            {message ? message.data : null}
          </span>
        ))}
      </ul>
    </div>
  );
}
