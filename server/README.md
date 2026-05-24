Social Chatter - Server

Quick start:

```bash
cd server
npm install
npm run dev
```

Endpoints:
- POST `/api/register` { user, pass }
- POST `/api/login` { user, pass }
- POST `/api/upload/song` multipart/form-data `song` file

Socket.IO events:
- client emits `join` with username
- client emits `private_message` with { from, to, content, songPath }
- server broadcasts `private_message` and `public_message`
