<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-11 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":53,"completion_tokens":1630,"total_tokens":1683,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1160,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 84s
 generated: 2026-06-12T03:50:24.242Z -->
# Local Development Setup

## Prerequisites
Before you begin, ensure your local environment meets the following requirements:
* **Node.js**: Version 20.x or higher is strictly required. Using a version manager like `nvm` (Node Version Manager) is highly recommended. You can install and use Node 20 by running `nvm install 20` followed by `nvm use 20`.
* **npm**: Version 9.x or higher (this is typically bundled automatically with Node 20).

## Installation Steps
1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/your-org/your-repo.git
   cd your-repo
   ```
2. Install the project dependencies:
   ```bash
   npm install
   ```

## Environment Variables
Create a `.env` file in the root directory of the project by copying the example environment file:
```bash
cp .env.example .env
```
Populate the `.env` file with the following required environment variables:

* `PORT` - The port the application runs on. Set this to `3012` for local development.
* `NODE_ENV` - The application environment. Set to `development`.
* `DATABASE_URL` - The connection string for your local database instance.
* `API_KEY` - Your third-party service API key for external requests.
* `SECRET_KEY` - The secret key used for signing authentication tokens.

## Building the Project
To compile the source code and build the project for production, run:
```bash
npm run build
```

## Running the Application
To start the local development server with hot-reloading, run:
```bash
npm run dev
```
For a standard production-style run, use:
```bash
npm start
```
By default, the application will start on **port 3012** (as specified in your `.env` file). Open your browser and navigate to `http://localhost:3012` to verify the application is running successfully.

## Running Tests
We use Jest for testing. The following commands are available:
* **Run all tests:**
  ```bash
  npm test
  ```
* **Run tests in watch mode during development:**
  ```bash
  npm run test:watch
  ```
* **Generate a test coverage report:**
  ```bash
  npm run test:coverage
  ```
