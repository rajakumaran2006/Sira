# Sira - Inventory and Asset Verification System

Sira is a web-based, mobile-friendly inventory and asset verification system designed to streamline the auditing and reconciliation of physical items (such as books, equipment, or assets) against CSV/XLSX lists. The system integrates barcode scanner capabilities, including live camera-based scanning and support for physical USB/Bluetooth HID readers.

## Key Features

- Dynamic Dashboard
  - Centralized dashboard to view, create, and delete verification batches.
  - High-level progress tracking with statistics cards for overall verification rates.
  - Automatic database seeding of default inventory data if no batches exist.

- Verification Room
  - Split-screen workspace layout on desktop interfaces and adaptive tabbed view on mobile devices.
  - Dual Scanner Integration: Use a mobile device camera to scan barcodes/QR codes, or utilize the manual scanner simulator for testing.
  - USB/Bluetooth HID Reader Support: Direct hardware keyboard wedge scanner listener for immediate processing of scanned physical labels.
  - Live Search and Filter Controls: Filter lists instantly by status (All, Verified, Outstanding, Not in CSV) or search by title, author, and access number.
  - Bulk and Single Record Deletion: Select and delete multiple records simultaneously with safety validation confirmation.
  - Dynamic CSV Export: Export reports dynamically filtered by the currently active view tab.

- Robust API and Models
  - Mongoose schemas for User, Batch, and Item records.
  - Fully atomic API endpoints for inventory operations, status changes, and bulk deletions.

## Technology Stack

- Core Framework: Next.js (App Router)
- Frontend Logic: React with Hooks and Context
- Styling: TailwindCSS and custom CSS design tokens
- Icons: Lucide React
- Database: MongoDB via Mongoose ORM
- Barcode Reader: html5-qrcode library

## Project Structure

- src/app: Next.js App Router folders containing pages, layouts, and API routes.
- src/components: Reusable UI components including modals, navigation bar, camera scanner, and simulators.
- src/views: Dedicated views for the Dashboard, Batch Details (Verification Room), and Login page.
- src/utils: API wrappers and frontend utility functions.
- server: Database connection logic, models, and authorization helpers.
- public: Assets including icons and default avatar images.

## Setup and Installation

### Prerequisites

- Node.js (v18 or higher recommended)
- MongoDB (local instance or MongoDB Atlas URI)

### Installation Steps

1. Clone the repository and navigate to the project directory:
   ```bash
   cd Sira
   ```

2. Install the package dependencies:
   ```bash
   npm install
   ```

3. Create a .env.local file in the root directory and configure the environment variables:
   ```env
   MONGODB_URI=your_mongodb_connection_uri
   JWT_SECRET=your_jwt_signing_secret
   ```
   Note: Replace the placeholders with your actual MongoDB URI and secure token signature. Do not hardcode or commit credentials.

4. Start the application in development mode:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 in your browser to view the application.

5. Build the application for production:
   ```bash
   npm run build
   npm run start
   ```

## Database Initialization and Seeding

The application automatically seeds a default batch ("DL-CSE Book List") and a default administrator user upon first connection if no records exist in the database.

For security, the default credentials initialized during the database seeding process should be updated immediately in production. Refer to the server/db.js file to review the database seeding setup.
