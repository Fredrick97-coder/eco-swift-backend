# Eco Swift Backend

GraphQL backend for Eco Swift e-commerce application.

## Setup

1. Install dependencies:
```bash
npm install
```

## Deployment

For instructions on deploying this backend to Vercel (matching the `sanctum` project workflow), see [`docs/VERCEL_DEPLOYMENT.md`](docs/VERCEL_DEPLOYMENT.md).

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Make sure MongoDB is running locally:
```bash
# Start MongoDB with custom data directory
mongod --dbpath ~/data/db

# Or if you have MongoDB installed via Homebrew, you can use:
# brew services start mongodb-community
```

4. Run the development server:
```bash
npm run dev
```

5. Generate GraphQL types:
```bash
npm run codegen
```

## Project Structure

```
backend/
├── src/
│   ├── database/       # MongoDB connection
│   ├── models/         # Mongoose models
│   ├── resolvers/      # GraphQL resolvers
│   ├── schema/         # GraphQL schema files
│   ├── types/          # TypeScript types
│   └── index.ts        # Entry point
├── codegen.yml         # GraphQL codegen config
└── package.json
```

# eco-swift-backend
