# 🛍️ Tohay Kids E-Commerce - NestJS Backend

Production-ready NestJS + TypeScript + MongoDB + Mongoose backend service for **Tohay Kids Festive & Premium Kids Wear**.

---

## 📌 Technology Stack

- **Framework**: NestJS 10 (TypeScript)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) with Passport & Bcrypt password hashing
- **Authorization**: Role-Based Access Control (RBAC with `@Roles(Role.ADMIN)`)
- **API Documentation**: OpenAPI / Swagger UI at `/api/docs`
- **Validation**: Class-Validator & Class-Transformer with global `ValidationPipe`
- **Payment Gateway**: Razorpay SDK & HMAC-SHA256 signature verification + COD
- **Uploads**: Multer local disk storage with file filter validation

---

## 🛠️ Environment Setup

Copy `.env.example` to `.env`:

```bash
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/tohay-kids
JWT_SECRET=tohay_kids_super_secret_jwt_key_2026_festive
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
RAZORPAY_KEY_ID=rzp_test_tohay_kids_12345
RAZORPAY_KEY_SECRET=tohay_kids_razorpay_secret_key_12345
ADMIN_EMAIL=admin@tohaykids.com
ADMIN_PASSWORD=AdminPassword123!
```

---

## 🚀 Running the Server

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database with Initial Data
Populates Admin user, Sample Customer, products, categories, coupons, banners, and store settings:
```bash
npm run seed
```

### 3. Start Development Server
```bash
npm run start:dev
```

- **Base API URL**: `http://localhost:5000/api`
- **Swagger Documentation**: `http://localhost:5000/api/docs`

---

## 🔑 Default Development Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Master Admin** | `admin@tohaykids.com` | `AdminPassword123!` |
| **Sample Customer** | `ananya.sharma@gmail.com` | `CustomerPassword123!` |

---

## 📁 Architecture & Domain Modules

- `auth`: Customer & Admin authentication (`/api/auth/login`, `/api/auth/signup`, `/api/auth/admin/login`, `/api/auth/me`)
- `users`: Customer profiles, address books, Admin CRM metrics (`/api/users`)
- `products`: Product catalog CRUD, pagination, search, price & category filters (`/api/products`)
- `categories`: Product category hierarchy management (`/api/categories`)
- `brands`: Brand directory (`/api/brands`)
- `cart`: Server-side shopping cart recalculation, coupons, free shipping threshold (`/api/cart`)
- `wishlist`: Customer saved products (`/api/wishlist`)
- `addresses`: Delivery address manager (`/api/addresses`)
- `orders`: Order creation, inventory deduction, tracking timeline, invoice calculation (`/api/orders`)
- `inventory`: Low-stock tracking, manual stock adjustments audit logs (`/api/inventory`)
- `reviews`: Verified purchase customer reviews & admin moderation (`/api/reviews`)
- `coupons`: Promo coupon validator & admin creator (`/api/coupons`)
- `banners`: Homepage hero carousel & promotional banners (`/api/banners`)
- `returns`: Customer item return requests (`/api/returns`)
- `payments`: Razorpay order creation & signature verification (`/api/payments`)
- `analytics`: Dashboard KPIs, revenue breakdown & conversion funnels (`/api/admin/analytics`)
- `reports`: Sales summary & 5% GST tax reporting (`/api/admin/reports`)
- `settings`: Global store settings (`/api/settings`)
- `uploads`: Image upload endpoint (`/api/uploads/image`)
