# 👕 Kastam | AI-Powered Custom Apparel Platform

A full-stack, enterprise-grade e-commerce and generative AI SaaS platform that allows users to design, render, and purchase custom streetwear. Kastam leverages a distributed AI pipeline, edge-compute tensor matting, and a mathematically secure creator economy ledger.

## 🚀 Live Demo
* **Frontend:** [kastam-ai-studio.vercel.app](https://kastam-ai-studio.vercel.app/)
* **Backend API:** Hosted on Render

---

## 🏗️ System Architecture & Key Features

### 1. Distributed Gen-AI Pipeline
* **AI Art Director:** Utilizes **Groq LPUs** for sub-second intent parsing and prompt enhancement.
* **Image Diffusion:** Routes requests through **Cloudflare Flux** for high-resolution generative image synthesis.
* **Edge Compute Matting:** Bypasses Node.js server bottlenecks by offloading background removal directly to the user's browser via **WebGPU** (`@imgly/background-removal`).

### 2. Dynamic 3D Garment Rendering
* **CSS Compositing:** Generates photorealistic mockups dynamically using `mix-blend-multiply` lighting maps over blank `.png` templates, avoiding the need to pre-render static images.
* **Interactive UI:** Features Amazon-style live color swapping, authentic screen-printed inner neck labels, and real-time DOM rasterization via `html-to-image` for high-quality mockup downloads.

### 3. The Creator Economy Ledger (FinTech Core)
* **Cryptographic Verification:** Integrates **Razorpay** with server-side **HMAC SHA-256** signature hashing to authenticate transactions and prevent client-side price manipulation.
* **Automated Royalties:** MongoDB `$inc` operators automatically distribute virtual royalty credits (₹150) to the original designer upon successful payment webhook verification.
* **Economic Guardrails:** Algorithmic backend logic enforces a "Hard Floor" to protect base manufacturing costs during discount applications and prevents "Double-Dipping" of virtual credits.

### 4. Security & Authentication
* **JWT Isolation:** Custom JSON Web Token architecture with bcrypt password hashing for secure user sessions and isolated private wardrobes.
* **Infrastructure Protection:** Implements **Express Rate Limiting** to defend Groq/Cloudflare billing limits from DDoS attacks and protect authentication routes from brute-force credential stuffing.

---

## 💻 Tech Stack

* **Frontend:** React.js, Vite, Tailwind CSS
* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas, Mongoose
* **AI / ML:** Groq API, Cloudflare API
* **Edge Computing:** WebGPU, `@imgly/background-removal`
* **Payments:** Razorpay Server SDK
* **Cloud / Storage:** Cloudinary (CDN), Vercel (Frontend), Render (Backend)

---

## 🛠️ Local Development Setup

### Prerequisites
* Node.js (v18+)
* MongoDB Atlas Cluster
* API Keys for Groq, Cloudflare, Cloudinary, and Razorpay (Test Mode)

### 1. Clone the Repository
```bash
git clone https://github.com/PrasunTellakula/kastam-ai-studio.git
```

### 2. Backend Setup
```bash
cd ai-apparel-backend
npm install
```
Create a `.env` file in the backend root:
```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
GROQ_API_KEY=your_groq_key
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_id
CLOUDFLARE_API_TOKEN=your_cloudflare_token
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```
Start the server:
```bash
npm run dev
```

### 3. Frontend Setup
Open a new terminal and navigate to the frontend directory:
```bash
cd ai-apparel-frontend
npm install
```
Create a `.env` file in the frontend root:
```env
VITE_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=rzp_test_your_key
```
Start the Vite development server:
```bash
npm run dev
```

---

## 👨‍💻 Author
**Prasoon Tellakula (Prasun)**
* Electrical Engineering Undergrad at **IIT (ISM) Dhanbad**
* Focused on Full-Stack Software Engineering & Distributed Systems
