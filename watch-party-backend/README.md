# Watch Party Backend

This is the real-time synchronization server for the Watch Party application.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run the Development Server**
   ```bash
   npm run dev
   ```
   The server will start on port 3001 and watch for file changes.

3. **Production Run**
   ```bash
   npm start
   ```

## Deployment
This project is configured to be easily deployable on platforms like Railway or Vercel. 
The `/health` endpoint is available for platform health checks.
