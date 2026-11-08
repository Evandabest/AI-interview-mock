> Historical design reference: the PostgreSQL DDL and hosted deployment notes below describe the original implementation. The running app now uses SQLite, local sessions, and local file storage. See README.md and lib/local/database.ts for current setup and schema. No hosted Supabase service is required.

# BidBay Documentation

## Database Schema

### Enums

#### User Types (`user-type`)
- `visitor`: Basic browsing access
- `user`: Standard user privileges
- `super-user`: Administrative privileges
- `vip`: Premium user status

#### Issue Status (`issue-status`)
- `initiated`: New issue
- `under-review`: Issue being processed
- `resolved`: Issue closed

#### Post Status (`status`)
- `active`: Currently accepting bids
- `ending-soon`: Less than 24 hours remaining
- `ended`: Bidding period finished
- `completed`: Transaction finalized

### Database Tables

#### Users
Primary table for user management and authentication.

```sql
CREATE TABLE public."Users" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    username TEXT,
    email TEXT,
    rating REAL DEFAULT 5,
    profile_picture TEXT DEFAULT '""',
    type user-type DEFAULT 'visitor',
    balance DOUBLE PRECISION,
    suspended BOOLEAN DEFAULT false,
    suspended_times SMALLINT DEFAULT 0,
    bad_review SMALLINT DEFAULT 0,
    warning BOOLEAN DEFAULT false
)
```

**Key Features:**
- Rating system (1-5 scale)
- Account balance tracking
- Suspension management
- Warning system
- User type classification

#### Applications
Tracks visitor applications to become users.

```sql
CREATE TABLE public.application (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES "Users"(id),
    username TEXT,
    status issue-status DEFAULT 'initiated',
    email TEXT DEFAULT '""'
)
```

#### Posts
Manages auction listings.

```sql
CREATE TABLE public.post (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    poster_id UUID REFERENCES "Users"(id),
    title TEXT,
    starting_bid BIGINT,
    current_bid DOUBLE PRECISION,
    expire TIMESTAMPTZ,
    pictures TEXT DEFAULT '[]',
    description TEXT DEFAULT '""',
    status status DEFAULT 'active',
    highest_bidder UUID REFERENCES "Users"(id),
    comments JSONB DEFAULT '[]'
)
```

#### Bids
Tracks all bids made on posts.

```sql
CREATE TABLE public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT (now() at time zone 'utc'),
    post_id UUID REFERENCES post(id),
    bidder_id UUID REFERENCES "Users"(id),
    bid_amount DOUBLE PRECISION DEFAULT 0
)
```

#### Orders
Manages transactions between users.

```sql
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    buyer UUID REFERENCES "Users"(id),
    seller UUID REFERENCES "Users"(id),
    post UUID REFERENCES post(id),
    shipping_address TEXT
)
```

#### Issues
Handles user complaints and disputes.

```sql
CREATE TABLE public.issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    issuer UUID REFERENCES "Users"(id),
    issuee UUID REFERENCES "Users"(id),
    order_id UUID REFERENCES orders(id),
    comments TEXT DEFAULT '""',
    response TEXT DEFAULT '[]',
    status issue-status DEFAULT 'initiated'
)
```

## Business Rules

### User Management
1. **Visitor Registration**
   - Requires super-user approval
   
2. **User Suspension**
   - Rating < 2 from ≥3 users triggers suspension
   - Average rating <2 or >4 (with ≥3 ratings) triggers suspension
   - Reactivation requires $50 fine or super-user approval
   - Three suspensions result in permanent removal

3. **VIP Status**
   - Requirements:
     - Balance > $5,000
     - >5 completed transactions
     - No complaints
   - Benefits: 10% transaction discount
   - Revocation if requirements not met

### Transaction Rules
1. **Bidding**
   - Bidder must have sufficient balance
   - Bids are binding until auction ends
   - Owner decides final winner

2. **Ratings**
   - Only transaction participants can rate
   - Anonymous rating system (1-5 scale)
   - Ratings are irreversible

3. **Transaction Fees**
   - Sellers are charged a 10% service fee at the time of the purchase
   - Buyers are charged a 5% service fee at the time of the purchase 
   - In the event of a refund to the buyer, the seller must cover the 5% service fee the buyer was supposed to pay

## User Privileges

### Visitor (V)
- Browse listings
- View and make comments
- Apply for user status

### User (U)
- Manage account balance
- Create listings
- Place bids
- Complete transactions
- Rate transaction partners
- File complaints

### Super-user (S)
- Approve visitor applications
- Review complaints
- Manage user suspensions
- Override system actions

### VIP
- All User privileges
- 10% transaction discount
- Suspension immunity (downgrades to User)



## Technical Implementation

### Authentication Flow
1. **User Registration**
   - Email/password registration
   - Automatic visitor role assignment
   - Super-user approval workflow

2. **User Login**
   - JWT-based authentication
   - Role-based session management
   - Automatic VIP status check

### Authentication Endpoints
```typescript
POST /auth/register
- Body: { email, password, username }
- Returns: { user, session, token }

POST /auth/login
- Body: { email, password }
- Returns: { user, session, token }

POST /auth/logout
- Headers: { Authorization: Bearer token }
- Returns: { success: boolean }
```

### Real-time Features
- Live bid updates via Supabase Realtime
- Instant notifications for:
  - Bid status changes
  - Auction updates
  - Account status changes

### Smart Bid Analysis

#### Overview
The Smart Bid Analysis feature uses Google's Gemini AI to provide intelligent bidding recommendations based on:
- Item title
- Item description 
- Current bid amount

#### Implementation

##### Client-side Function (`/post/[id]`)
```typescript
const getSmartBidAnalysis = async () => {
  // Fetches AI-powered bid analysis
  // Sends post details to /api/smart-bid
  // Updates UI with recommendation
}
```

##### API Endpoint
```markdown
POST /api/smart-bid
Content-Type: application/json

Request body: {
  title: string,
  description: string,
  currentBid: number
}

Response: {
  analysis: string
}
```

## Security Measures

### User Protection
- Encrypted passwords using bcrypt
- Rate limiting on authentication attempts
- Session management
- Anti-fraud monitoring

### Data Security
- Row Level Security (RLS)
- Role-based access control
- Input validation
- SQL injection prevention

## Deployment Architecture

### Infrastructure
- Supabase
  - Authentication
  - Database
  - Real-time subscriptions
- Vercel (Frontend)

### Performance
- Connection pooling
- Query optimization
- Image optimization
- Caching strategy

## Monitoring

### System Health
- Error tracking
- Performance metrics
- User activity logs
- Transaction auditing

### Data Management
- Automated backups
- Transaction logs
- Recovery procedures


## Deployment Guide

### Prerequisites
- Node.js 18+
- Supabase CLI
- Git

### Local Development

# Install dependencies
```bash
npm install
```

# Set up environment variables

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_GEMINI_API_KEY=<your-gemini-api-key>
```


# Start development server
```
npm run dev
```

### Testing Strategy

#### Unit Tests
```typescript
// Auth Flow Tests
- Registration validation
- Login authentication
- Session management
- Role-based access

// Business Logic Tests
- Bid validation
- VIP status calculations
- Suspension triggers
- Rating system

// Smart Bid Analysis Tests
- API response validation
- Error handling
- Loading state management
- UI component rendering
```

#### Integration Tests
- Real-time subscriptions
- Authentication flow
- Transaction processing

### CI/CD Pipeline

#### Development
1. Code push
2. Automated tests
3. Preview deployment

#### Production
1. Main branch merge
2. Build verification
4. Production deployment

### Monitoring & Maintenance

#### Health Checks
- Database performance
- Authentication service
- Real-time connections

#### Backup Strategy For The Future
- Daily database snapshots
- Transaction logs
- Media storage backups
- Configuration backups


# Route Documentation

## Core Routes

### /bids
- Displays user's active and past bids
- Shows bid history and status
- Allows bid management
- Filters for won/lost/active bids

### /checkout
- `/checkout` - Cart summary and payment initiation
- `/checkout/[id]` - Specific item checkout process
  - Handles payment processing
  - Shipping details
  - Order confirmation

### /dashboard
- Main user control panel
- `/dashboard/applications/[id]` - Admin review of user applications
  - Application status management
  - User verification
  - Account approval/rejection
- `/dashboard/issues/[id]` - Issue management interface
  - Dispute resolution
  - User reports
  - Support tickets

### /home
- Landing page
- Featured items
- Category navigation

### /issues
- `/issues` - Support ticket listing
- `/issues/[id]` - Individual issue view
  - Issue details
  - Communication thread
  - Resolution status

### /order
- `/order` - Order management
- `/order/success/[id]` - Order confirmation page
  - Transaction details
  - Shipping information
  - Next steps

### /post
- `/post` - New listing creation
- `/post/[id]` - Individual item view
  - Bid placement
  - Item details
  - Seller information

### /profile
- User profile management
- Account settings
- Transaction history
- Rating overview

### /rating
- `/rating/[id]` - Individual transaction rating
  - Rating submission
  - Feedback form
  - Transaction review

## Authentication Routes

### /auth
- `/auth/confirm` - Email confirmation
- `/login` - User authentication
- `/user-sign-up` - New user registration
- `/reactivate` - Account reactivation

## Utility Routes

### /reload
- Reload Bid Bay account
- Withdraw from Bid Bay account

### /support
- Help center
- FAQs
- Contact forms

### /watchlist
- Saved items
- Price tracking
- Auction monitoring

# Libraries and Dependencies

## Frontend
- **Next.js 15** - React framework
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components
- **React Hook Form** - Form handling

## Backend & Database
- **Supabase** 
  - Authentication
  - PostgreSQL database
  - Real-time subscriptions
- **PostgreSQL** - Database

## Utilities
- **Date-fns** - Date manipulation
- **UUID** - ID generation
- **TypeScript** - Type checking
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Image Handling
- **Sharp** - Image optimization
- **Supabase Bucket storage** - Amazon s3 bucket under the hood

## Development Tools
- **Supabase CLI**
- **Vercel CLI** 
- **Node.js v18+**