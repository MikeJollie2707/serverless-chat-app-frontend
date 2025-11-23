# serverless-chat-app-frontend

The frontend for a WebSocket chat app.

## Dependencies

- React
- react-use-websocket
- react-oidc-context + oidc-client-ts
- jwt-decode

## Environment Variables

- `VITE_WSS_URL`: The Websocket URL (`wss://<api id>.execute-api.<region>.amazonaws.com/<stage>`)
- `VITE_COGNITO_AUTHORITY`: Cognito URL (`https://cognito-idp.<region>.amazonaws.com/<user pool id>`)
- `VITE_COGNITO_CLIENT_ID`: The app client ID.
- `VITE_COGNITO_REDIRECT_URL`: The domain name of this site.

## Setup

```sh
mkdir project && cd project
git clone https://github.com/MikeJollie2707/serverless-chat-app-frontend.git .
npm i
npm run dev
```

## Usage


1. Not signed in — initial landing / sign-in prompt

![On the left side, the title "Serverless Chat Platform for Learners. Under it is a "Disconnected" text, showing the WebSocket is not open. A "Please log in to use the chat service" overlay is on top of the chat menu. The "Send" button is disabled.](./screenshots/1_not_signed_in.png)

2. Signed in (Cognito) — authenticated view

![The sign in interface of AWS Cognito with Email address and Password fields.](./screenshots/2_signed_in_cognito.png)

3. App interface — main chat layout

![Similar to Not signed in, but now WebSocket is showing "Connected" and the overlay doesn't exist. The "Send" button is enabled.](./screenshots/3_app_interface.png)

4. Messaging in action — sending/receiving messages

![Two messages, one from current client and another from a different user is shown.](./screenshots/4_messaging_in_action.png)
