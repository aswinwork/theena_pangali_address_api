# User Directory — Backend

Node.js + Express API backed by MongoDB Atlas (free tier). Stores users
(name, email, phone, address) with an optional photo saved to the server's
local disk and served over HTTP.

## 1. Create a free MongoDB Atlas database

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up (free).
2. Create a new **free M0 cluster** (any cloud/region is fine).
3. Under **Database Access**, add a database user with a username/password.
4. Under **Network Access**, add an IP entry `0.0.0.0/0` (allow access from
   anywhere) — fine for development; tighten this for production.
5. Click **Connect > Drivers**, choose Node.js, and copy the connection
   string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Add a database name before the `?`, e.g. `.../user_directory?retryWrites=true...`

## 2. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

- `MONGODB_URI` — the connection string from step 1.
- `PORT` — defaults to 4000.
- `BASE_URL` — set this to your computer's **LAN IP**, e.g.
  `http://192.168.1.23:4000`, not `localhost`. The mobile app (running on
  your phone or an emulator) needs a real network address to load images
  and reach the API. Find your LAN IP with `ipconfig` (Windows) or
  `ifconfig`/`ip addr` (Mac/Linux).

## 3. Install and run

```bash
npm install
npm run dev     # auto-restarts on changes (nodemon)
# or
npm start
```

The server starts on `http://localhost:4000` (or your chosen `PORT`) and
logs `Connected to MongoDB` once Atlas is reachable.

## API reference

| Method | Endpoint            | Body (multipart/form-data)                  | Description            |
|--------|----------------------|----------------------------------------------|-------------------------|
| GET    | `/api/users`         | —                                              | List all users          |
| GET    | `/api/users/:id`     | —                                              | Get one user            |
| POST   | `/api/users`         | `name`, `email`, `phone`, `address`, `image`  | Create a user           |
| PUT    | `/api/users/:id`     | any of the above fields, `image` optional     | Update a user           |
| DELETE | `/api/users/:id`     | —                                              | Delete a user           |

`image` is an optional file field (jpeg/png/webp/heic, max 8MB). Uploaded
files are saved under `backend/uploads/` and served at
`BASE_URL/uploads/<filename>`; each user response includes a ready-to-use
`imageUrl`.

## Troubleshooting

- **"Missing MONGODB_URI"** — you haven't created `.env` from `.env.example`.
- **Connection timeout to Atlas** — check Network Access allows your IP
  (or `0.0.0.0/0`), and that the password in the URI doesn't contain
  characters that need URL-encoding (e.g. `@`, `#`, `%`).
- **Phone can't load images / API calls fail** — `BASE_URL` (backend) and
  the API URL configured in the mobile app must both point to your
  computer's LAN IP, and your phone must be on the same Wi-Fi network as
  your computer.
