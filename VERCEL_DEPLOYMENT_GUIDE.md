# Deploy RentKhata to Vercel

## What You Need

- A GitHub account
- A Vercel account
- A free Neon PostgreSQL database

## 1. Create the Database

1. Open https://neon.tech and create an account.
2. Create a new project named `rentkhata`.
3. Copy the PostgreSQL connection string.
4. Keep the connection string private.

The connection string looks similar to:

```text
postgresql://username:password@host/database?sslmode=require
```

## 2. Upload the Project to GitHub

1. Extract the downloaded ZIP.
2. Create a new private GitHub repository.
3. Upload all files from the extracted project folder.
4. Do not upload a real `.env.local` file.

## 3. Import the Project into Vercel

1. Open https://vercel.com/new.
2. Select the GitHub repository.
3. Vercel should detect **Next.js** automatically.
4. Keep the default build settings.

## 4. Add the Database Connection

Before deploying, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `DATABASE_URL` | Your Neon PostgreSQL connection string |

Enable it for Production, Preview, and Development if you want all environments
to use the database.

## 5. Deploy

Select **Deploy**. After deployment finishes:

1. Open the generated Vercel URL.
2. RentKhata creates its tables automatically.
3. Add your first room, shop, or hall.
4. Add an occupant and create a test bill.
5. Open `/api/health` after your domain to confirm the database connection.

Example:

```text
https://your-project.vercel.app/api/health
```

A working response is:

```json
{"status":"ok","database":"connected"}
```

## Important Security Note

The application stores private occupant and payment information. Do not share
the deployment URL publicly. Use Vercel deployment protection or add an
authentication system before allowing broader access.

## Updating the Application

Push changes to the connected GitHub repository. Vercel will build and deploy
the updated version automatically.
