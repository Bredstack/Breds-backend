# Breds Backend Server

This is the Express.js backend server for the Breds lead generation platform.

## Setup Instructions

1. **Install Dependencies**
   \`\`\`bash
   cd backend
   npm install
   \`\`\`

2. **Environment Variables**
   Create a `.env` file in the backend directory with the provided environment variables.

3. **Start the Server**
   \`\`\`bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   \`\`\`

4. **Health Check**
   Visit `http://localhost:3001/health` to verify the server is running.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/signin` - Sign in user
- `POST /api/auth/signout` - Sign out user
- `GET /api/auth/me` - Get current user info

### Leads
- `GET /api/leads/browse` - Get all public leads
- `GET /api/leads/browse/:id` - Get single lead by ID

## Architecture

The backend follows this flow:
Frontend → Backend → Supabase → Backend → Frontend

This ensures:
- All sensitive keys stay on the backend
- Better security and rate limiting
- Centralized business logic
- Easier monitoring and logging

## Security Features

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- JWT token authentication
- Input validation
- Error handling
#   B r e d s - b a c k e n d  
 