# 🚀 INNOMCP User Workspace & Personalization System - Detailed TODO

**Created**: 2026-01-06
**Project**: INNOMCP Enhanced User Experience
**Status**: 🔄 IN PROGRESS

---

## 📋 PROJECT OVERVIEW

### Objectives
1. Enhanced UI/UX with modern 2026 design patterns
2. Complete user workspace management system
3. AI personalization with memory and learning
4. Enterprise-grade authentication (Thai ID support)
5. Docker-based scalable file storage
6. Professional testing and documentation

### Scope
- **Frontend**: Next.js UI improvements, new pages
- **Backend**: Node.js APIs, auth system, file management
- **Database**: MariaDB schema extensions
- **Infrastructure**: Docker containers, file storage
- **Testing**: E2E tests, integration tests
- **Documentation**: User guides, API docs, deployment guides

---

## ✅ PHASE 1: UI IMPROVEMENTS (COMPLETED)

### 1.1 Theme Toggle Position ✅
- [x] Move theme toggle from bottom-left to bottom-right
- [x] Update Header.tsx component
- [x] Test in both light/dark modes
- **Files**: `Header.tsx`
- **Status**: ✅ COMPLETE

### 1.2 Logo Swap ✅
- [x] Swap positions of InnoMCP and MDES logos
- [x] Update Header.tsx logo order
- [x] Verify responsive layout
- **Files**: `Header.tsx`
- **Status**: ✅ COMPLETE

### 1.3 Chat Panel Dynamic Position ✅
- [x] Add `isChatActive` state to ChatPage
- [x] Implement `bottom-4` when user interacts
- [x] Add onFocus/onBlur handlers to ChatInput
- [x] Test smooth transition animation
- **Files**: `ChatPage.tsx`, `ChatInput.tsx`
- **Status**: ✅ COMPLETE

### 1.4 Sidebar Optimization ✅
- [x] Reduce new chat button height (py-3 → py-2)
- [x] Reduce history item height (py-2.5 → py-1.5)
- [x] Test with 20+ conversations
- **Files**: `ChatSidebar.tsx`
- **Status**: ✅ COMPLETE

### 1.5 User Menu UI ✅
- [x] Create user avatar component
- [x] Add dropdown menu with options
- [x] Implement: Workspace Settings, Personalization, Settings, Help, Logout
- [x] Add Font Awesome icons
- [x] Style with theme colors
- **Files**: `ChatSidebar.tsx`
- **Status**: ✅ COMPLETE

---

## 🔄 PHASE 2: DOCKER FILE SYSTEM (IN PROGRESS)

### 2.1 Docker Container Setup ✅
- [x] Create `workspace-storage/docker-compose.yml`
- [x] Configure nginx for file serving
- [x] Create `nginx.conf` with CORS and security
- [x] Set up volume mappings
- [x] Add health check endpoint
- **Files**: `workspace-storage/docker-compose.yml`, `nginx.conf`
- **Status**: ✅ COMPLETE

### 2.2 Documentation ✅
- [x] Create comprehensive README.md
- [x] Document API endpoints
- [x] Add security guidelines
- [x] Include backup/restore procedures
- [x] Add monitoring and troubleshooting guides
- **Files**: `workspace-storage/README.md`
- **Status**: ✅ COMPLETE

### 2.3 Container Testing ⏳
- [ ] Start container: `docker-compose up -d`
- [ ] Test health endpoint
- [ ] Create test user directories
- [ ] Upload test files
- [ ] Test file access via HTTP
- [ ] Verify CORS headers
- [ ] Test volume persistence
- **Commands**:
  ```bash
  cd workspace-storage
  docker-compose up -d
  curl http://localhost:8090/health
  mkdir -p ./data/users/1/documents
  echo "test" > ./data/users/1/documents/test.txt
  curl http://localhost:8090/users/1/documents/test.txt
  ```
- **Status**: ⏳ PENDING

### 2.4 Network Integration ⏳
- [ ] Create `innomcp-network` if not exists
- [ ] Connect all containers to network
- [ ] Update backend to access workspace-fs
- [ ] Test inter-container communication
- **Commands**:
  ```bash
  docker network create innomcp-network
  docker network connect innomcp-network innomcp-node
  docker network connect innomcp-network innomcp-workspace-storage
  ```
- **Status**: ⏳ PENDING

---

## 📊 PHASE 3: DATABASE SCHEMA

### 3.1 Schema Creation ✅
- [x] Create `workspace_schema.sql`
- [x] Define 14 new tables:
  - user_workspaces
  - workspace_instructions
  - user_profiles
  - user_memory
  - user_characteristics
  - oauth_providers
  - password_reset_tokens
  - user_sessions
  - chat_conversations
  - chat_messages
  - user_files
  - user_preferences
  - user_activity_log
- [x] Add proper indexes and foreign keys
- [x] Include comprehensive comments
- **Files**: `mariadb/workspace_schema.sql`
- **Status**: ✅ COMPLETE

### 3.2 Schema Deployment ⏳
- [ ] Backup existing database
- [ ] Connect to MariaDB container
- [ ] Run workspace_schema.sql
- [ ] Verify tables created
- [ ] Check foreign key constraints
- [ ] Test sample insertions
- **Commands**:
  ```bash
  # Backup
  docker exec innomcp-mariadb mysqldump -u root -p innomcp-db > backup_$(date +%Y%m%d).sql
  
  # Deploy
  docker exec -i innomcp-mariadb mysql -u root -p innomcp-db < mariadb/workspace_schema.sql
  
  # Verify
  docker exec -it innomcp-mariadb mysql -u root -p -e "USE innomcp-db; SHOW TABLES;"
  ```
- **Status**: ⏳ PENDING

### 3.3 Database Migrations ⏳
- [ ] Create migration scripts directory
- [ ] Implement up/down migrations
- [ ] Add version tracking table
- [ ] Test rollback procedures
- **Directory**: `mariadb/migrations/`
- **Status**: ⏳ PENDING

---

## 🔐 PHASE 4: AUTHENTICATION BACKEND

### 4.1 JWT Authentication ⏳
- [ ] Install dependencies: `jsonwebtoken`, `bcryptjs`
- [ ] Create JWT utility module
- [ ] Implement token generation
- [ ] Add token verification middleware
- [ ] Configure token expiry and refresh
- **Files**: `innomcp-node/src/utils/jwt.ts`
- **Dependencies**:
  ```bash
  cd innomcp-node
  npm install jsonwebtoken bcryptjs @types/jsonwebtoken @types/bcryptjs
  ```
- **Status**: ⏳ PENDING

### 4.2 Login API ⏳
- [ ] Create `/api/auth/login` endpoint
- [ ] Implement email/password validation
- [ ] Hash password comparison
- [ ] Generate JWT on success
- [ ] Return user data and token
- [ ] Log login attempts
- **Files**: `innomcp-node/src/routes/api/auth/login.ts`
- **Status**: ⏳ PENDING

### 4.3 Register API ⏳
- [ ] Create `/api/auth/register` endpoint
- [ ] Validate email format and uniqueness
- [ ] Hash password with bcrypt (salt rounds: 12)
- [ ] Create user record in database
- [ ] Send verification email (optional)
- [ ] Return success message
- **Files**: `innomcp-node/src/routes/api/auth/register.ts`
- **Status**: ⏳ PENDING

### 4.4 Password Reset ⏳
- [ ] Create `/api/auth/forgot-password` endpoint
- [ ] Generate secure reset token
- [ ] Store token in `password_reset_tokens` table
- [ ] Send reset email with link
- [ ] Create `/api/auth/reset-password/:token` endpoint
- [ ] Validate token and update password
- [ ] Mark token as used
- **Files**: `innomcp-node/src/routes/api/auth/forgot-password.ts`, `reset-password.ts`
- **Status**: ⏳ PENDING

### 4.5 Thai ID OAuth Integration ⏳
- [ ] Research Thai ID Connect API
- [ ] Register application with Thai ID
- [ ] Implement OAuth flow
- [ ] Create `/api/auth/thaid/callback` endpoint
- [ ] Store OAuth tokens in `oauth_providers` table
- [ ] Link or create user account
- [ ] Handle token refresh
- **Files**: `innomcp-node/src/routes/api/auth/thaid.ts`
- **Documentation**: https://www.digital.go.th/thaiid/
- **Status**: ⏳ PENDING (Requires government registration)

### 4.6 Session Management ⏳
- [ ] Update session manager to use database
- [ ] Store sessions in `user_sessions` table
- [ ] Implement session cleanup (expired sessions)
- [ ] Add session validation middleware
- [ ] Track device info and IP
- **Files**: `innomcp-node/src/utils/sessionManager.ts`
- **Status**: ⏳ PENDING

---

## 🎨 PHASE 5: FRONTEND AUTH PAGES

### 5.1 Login Page ⏳
- [ ] Create `innomcp-next/src/app/login/page.tsx`
- [ ] Design form with email/password fields
- [ ] Add Thai ID login button
- [ ] Implement form validation
- [ ] Connect to `/api/auth/login`
- [ ] Store JWT in httpOnly cookie
- [ ] Redirect to home on success
- [ ] Show error messages
- [ ] Add "Forgot Password" link
- [ ] Add "Register" link
- **Files**: `innomcp-next/src/app/login/page.tsx`
- **Status**: ⏳ PENDING

### 5.2 Register Page ⏳
- [ ] Create `innomcp-next/src/app/register/page.tsx`
- [ ] Design form with required fields:
  - Email (with validation)
  - Password (strength meter)
  - Confirm Password
  - Display Name
  - Section (dropdown)
  - Agree to terms checkbox
- [ ] Implement client-side validation
- [ ] Connect to `/api/auth/register`
- [ ] Show success message
- [ ] Redirect to login
- [ ] Handle errors
- **Files**: `innomcp-next/src/app/register/page.tsx`
- **Status**: ⏳ PENDING

### 5.3 Forgot Password Page ⏳
- [ ] Create `innomcp-next/src/app/forgot-password/page.tsx`
- [ ] Design email input form
- [ ] Connect to `/api/auth/forgot-password`
- [ ] Show success message
- [ ] Add instructions
- [ ] Create reset password page
- [ ] Validate reset token
- [ ] Update password
- **Files**: `innomcp-next/src/app/forgot-password/page.tsx`, `reset-password/[token]/page.tsx`
- **Status**: ⏳ PENDING

### 5.4 Auth Context Update ⏳
- [ ] Update `AuthContext` to use new API
- [ ] Add workspace state
- [ ] Implement logout function
- [ ] Add token refresh logic
- [ ] Handle auth errors globally
- **Files**: `innomcp-next/src/app/context/AuthContext.tsx`
- **Status**: ⏳ PENDING

---

## 🏢 PHASE 6: WORKSPACE SETTINGS

### 6.1 Workspace API ⏳
- [ ] Create `/api/workspace` CRUD endpoints
- [ ] GET `/api/workspace/list` - Get user workspaces
- [ ] POST `/api/workspace/create` - Create new workspace
- [ ] PUT `/api/workspace/:id` - Update workspace
- [ ] DELETE `/api/workspace/:id` - Delete workspace
- [ ] GET `/api/workspace/:id/files` - List workspace files
- [ ] POST `/api/workspace/:id/upload` - Upload file
- [ ] Implement storage quota checks
- [ ] Update storage usage on file operations
- **Files**: `innomcp-node/src/routes/api/workspace/`
- **Status**: ⏳ PENDING

### 6.2 Workspace Settings Page ⏳
- [ ] Create `innomcp-next/src/app/workspace-settings/page.tsx`
- [ ] Design tabbed interface:
  - General (name, description, theme)
  - Storage (usage, quota, files)
  - Instructions (custom AI behavior)
  - Appearance (colors, layout)
- [ ] Implement workspace switcher
- [ ] Add file manager component
- [ ] Show storage usage chart
- [ ] Add custom instructions editor
- [ ] Save settings to database
- **Files**: `innomcp-next/src/app/workspace-settings/page.tsx`
- **Status**: ⏳ PENDING

### 6.3 File Manager Component ⏳
- [ ] Create file browser component
- [ ] Implement upload functionality
- [ ] Add download buttons
- [ ] Show file previews
- [ ] Implement delete with confirmation
- [ ] Add folder creation
- [ ] Show file metadata
- **Files**: `innomcp-next/src/app/components/workspace/FileManager.tsx`
- **Status**: ⏳ PENDING

---

## 🎭 PHASE 7: PERSONALIZATION

### 7.1 Personalization API ⏳
- [ ] Create `/api/personalization` endpoints
- [ ] GET `/api/personalization/profile` - Get user profile
- [ ] PUT `/api/personalization/profile` - Update profile
- [ ] GET `/api/personalization/memory` - Get user memories
- [ ] POST `/api/personalization/memory` - Add memory
- [ ] DELETE `/api/personalization/memory/:id` - Delete memory
- [ ] GET `/api/personalization/characteristics` - Get characteristics
- [ ] PUT `/api/personalization/characteristics` - Update characteristics
- **Files**: `innomcp-node/src/routes/api/personalization/`
- **Status**: ⏳ PENDING

### 7.2 Personalization Page ⏳
- [ ] Create `innomcp-next/src/app/personalization/page.tsx`
- [ ] Design sections:
  - **About You**: Nickname, Occupation, Bio
  - **Custom Instructions**: How AI should behave
  - **Characteristics**: Tone, formality, humor level
  - **Memory**: What AI should remember
  - **Preferences**: Language, response length, style
- [ ] Implement rich text editor for instructions
- [ ] Add characteristic sliders/toggles
- [ ] Show memory list with edit/delete
- [ ] Save all changes to database
- **Files**: `innomcp-next/src/app/personalization/page.tsx`
- **Status**: ⏳ PENDING

### 7.3 AI Memory Integration ⏳
- [ ] Update AI prompt builder to include:
  - User profile data
  - Active memories
  - Custom characteristics
  - Workspace instructions
- [ ] Implement memory learning from conversations
- [ ] Add confidence scoring for inferred memories
- [ ] Create memory cleanup (low confidence, old)
- [ ] Test personalized responses
- **Files**: `innomcp-node/src/utils/promptBuilder.ts`
- **Status**: ⏳ PENDING

---

## ⚙️ PHASE 8: SETTINGS & HELP

### 8.1 Settings Page ⏳
- [ ] Create `innomcp-next/src/app/settings/page.tsx`
- [ ] Implement sections:
  - Account (email, password change)
  - Privacy (data export, account deletion)
  - Notifications (email preferences)
  - API Keys (generate, manage)
  - Security (2FA, active sessions)
- [ ] Add change password form
- [ ] Implement data export
- [ ] Show active sessions list
- [ ] Add session revocation
- **Files**: `innomcp-next/src/app/settings/page.tsx`
- **Status**: ⏳ PENDING

### 8.2 Help Page ⏳
- [ ] Create `innomcp-next/src/app/help/page.tsx`
- [ ] Add FAQ section
- [ ] Include video tutorials
- [ ] Add search functionality
- [ ] Create contact form
- [ ] Link to documentation
- [ ] Add troubleshooting guides
- **Files**: `innomcp-next/src/app/help/page.tsx`
- **Status**: ⏳ PENDING

---

## 🧪 PHASE 9: TESTING

### 9.1 Unit Tests ⏳
- [ ] Backend API tests
  - Auth endpoints (login, register, reset)
  - Workspace CRUD
  - Personalization CRUD
  - File operations
- [ ] Frontend component tests
  - Login form validation
  - Workspace settings UI
  - Personalization UI
- [ ] Database tests
  - Schema integrity
  - Foreign key constraints
  - Data migrations
- **Tools**: Jest, React Testing Library
- **Directory**: `innomcp-node/tests/`, `innomcp-next/tests/`
- **Status**: ⏳ PENDING

### 9.2 Integration Tests ⏳
- [ ] End-to-end user flows
  - User registration → login → create workspace
  - Upload file → access file → delete file
  - Set personalization → chat with AI → verify behavior
  - Password reset flow
- [ ] Playwright E2E tests
- [ ] API integration tests
- **Files**: `tests/e2e/tests/user-workspace.spec.ts`
- **Status**: ⏳ PENDING

### 9.3 Performance Tests ⏳
- [ ] Load testing workspace API
- [ ] Concurrent file uploads
- [ ] Database query optimization
- [ ] File storage performance
- [ ] Session management scalability
- **Tools**: k6, Artillery
- **Status**: ⏳ PENDING

### 9.4 Security Tests ⏳
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF token validation
- [ ] JWT security
- [ ] File upload security (malware scan)
- [ ] Rate limiting
- **Tools**: OWASP ZAP, Burp Suite
- **Status**: ⏳ PENDING

---

## 📚 PHASE 10: DOCUMENTATION

### 10.1 User Guide ⏳
- [ ] Getting Started
- [ ] Creating Workspaces
- [ ] Personalizing AI
- [ ] Managing Files
- [ ] Security Best Practices
- [ ] Troubleshooting
- **File**: `docs/USER_GUIDE.md`
- **Status**: ⏳ PENDING

### 10.2 API Documentation ⏳
- [ ] Authentication endpoints
- [ ] Workspace API reference
- [ ] Personalization API reference
- [ ] File management API
- [ ] Request/response examples
- [ ] Error codes
- **Tool**: Swagger/OpenAPI
- **File**: `docs/API_REFERENCE.md`
- **Status**: ⏳ PENDING

### 10.3 Deployment Guide ⏳
- [ ] Prerequisites
- [ ] Docker setup
- [ ] Database setup
- [ ] Environment variables
- [ ] SSL/TLS configuration
- [ ] Backup procedures
- [ ] Monitoring setup
- [ ] Scaling guide
- **File**: `docs/DEPLOYMENT.md`
- **Status**: ⏳ PENDING

### 10.4 Developer Guide ⏳
- [ ] Project structure
- [ ] Development setup
- [ ] Coding standards
- [ ] Git workflow
- [ ] Testing guidelines
- [ ] Contributing guide
- **File**: `docs/DEVELOPER_GUIDE.md`
- **Status**: ⏳ PENDING

---

## 📝 PHASE 11: DOCUMENTATION UPDATES

### 11.1 Update TODO.md ⏳
- [ ] Add new features to main TODO
- [ ] Mark completed phases
- [ ] Update progress metrics
- [ ] Add new milestones
- **File**: `TODO.md`
- **Status**: ⏳ PENDING

### 11.2 Update TEST_PROBLEMS_LOG.txt ⏳
- [ ] Document test results
- [ ] Add new test cases
- [ ] Update success metrics
- [ ] Document known issues
- **File**: `tests/e2e/TEST_PROBLEMS_LOG.txt`
- **Status**: ⏳ PENDING

### 11.3 Create CHANGELOG Entry ⏳
- [ ] Document all changes
- [ ] Add migration notes
- [ ] List breaking changes
- [ ] Include version number
- **File**: `CHANGELOG/2026-01/2026-01-06-workspace-system.md`
- **Status**: ⏳ PENDING

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment ⏳
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Database backed up
- [ ] Environment variables set
- [ ] SSL certificates ready
- [ ] Docker images built
- [ ] Security audit passed

### Deployment Steps ⏳
- [ ] Deploy database schema
- [ ] Start Docker containers
- [ ] Deploy backend API
- [ ] Deploy frontend
- [ ] Configure reverse proxy
- [ ] Set up monitoring
- [ ] Test production environment
- [ ] Enable backups

### Post-Deployment ⏳
- [ ] Monitor logs
- [ ] Check performance metrics
- [ ] Verify user flows
- [ ] Test edge cases
- [ ] Collect user feedback
- [ ] Document issues

---

## 📊 SUCCESS METRICS

### Current Progress
- **Phase 1 (UI)**: ✅ 100% Complete (5/5 tasks)
- **Phase 2 (Docker)**: 🔄 50% Complete (2/4 tasks)
- **Phase 3 (Database)**: 🔄 33% Complete (1/3 tasks)
- **Phase 4 (Auth Backend)**: ⏳ 0% Complete (0/6 tasks)
- **Phase 5 (Auth Frontend)**: ⏳ 0% Complete (0/4 tasks)
- **Phase 6 (Workspace)**: ⏳ 0% Complete (0/3 tasks)
- **Phase 7 (Personalization)**: ⏳ 0% Complete (0/3 tasks)
- **Phase 8 (Settings)**: ⏳ 0% Complete (0/2 tasks)
- **Phase 9 (Testing)**: ⏳ 0% Complete (0/4 tasks)
- **Phase 10 (Documentation)**: ⏳ 0% Complete (0/4 tasks)
- **Phase 11 (Updates)**: ⏳ 0% Complete (0/3 tasks)

### Overall Progress
- **Total Tasks**: 58
- **Completed**: 8 (14%)
- **In Progress**: 2 (3%)
- **Pending**: 48 (83%)

### Time Estimates
- **Phase 1**: ✅ 4 hours (Complete)
- **Phase 2**: 🔄 6 hours (2 hours remaining)
- **Phase 3**: 4 hours
- **Phase 4**: 16 hours
- **Phase 5**: 12 hours
- **Phase 6**: 20 hours
- **Phase 7**: 16 hours
- **Phase 8**: 8 hours
- **Phase 9**: 24 hours
- **Phase 10**: 16 hours
- **Phase 11**: 4 hours

**Total Estimated Time**: ~130 hours (~3-4 weeks of development)

---

## 🎯 NEXT IMMEDIATE ACTIONS

1. ✅ **Complete Docker Testing** (Phase 2.3)
   - Start workspace-storage container
   - Test file access
   - Verify CORS

2. ✅ **Deploy Database Schema** (Phase 3.2)
   - Backup database
   - Run workspace_schema.sql
   - Verify tables

3. **Start Authentication Backend** (Phase 4.1)
   - Install JWT dependencies
   - Create JWT utility
   - Implement middleware

---

**Last Updated**: 2026-01-06 17:00
**Status**: 🔄 Active Development
**Next Review**: Daily standup
