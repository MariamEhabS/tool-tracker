#!/usr/bin/env bash
# =========================================================================
# TALIHO V3 - LOCAL INTEGRATION TEST RUNNER (Bash)
# =========================================================================
#
# This script mirrors the GitHub Actions integration-tests.yml workflow
# for local debugging and development.
#
# Prerequisites:
#   - Docker Desktop running (for MongoDB)
#   - Node.js 20+ installed
#   - Backend repo at: ../backend (override with --backend-dir)
#
# Usage:
#   ./scripts/run-integration-local.sh                    # Full test run
#   ./scripts/run-integration-local.sh --test-mode smoke  # Smoke tests only
#   ./scripts/run-integration-local.sh --skip-build       # Skip backend build
#   ./scripts/run-integration-local.sh --keep-running     # Keep servers running after tests
#   ./scripts/run-integration-local.sh --debug            # Enable debug logging
#
# =========================================================================

set -e

# ─────────────────────────────────────────────────────────────────────────
# ARGUMENT PARSING
# ─────────────────────────────────────────────────────────────────────────

TEST_MODE="full"
SKIP_BUILD=false
KEEP_RUNNING=false
DEBUG_MODE=false
SKIP_DOCKER=false
RETRIES=0
BACKEND_PORT=8100
FRONTEND_PORT=8173
BACKEND_DIR_OVERRIDE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --test-mode)
            TEST_MODE="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --keep-running)
            KEEP_RUNNING=true
            shift
            ;;
        --debug)
            DEBUG_MODE=true
            shift
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --retries)
            RETRIES="$2"
            shift 2
            ;;
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        --backend-dir)
            BACKEND_DIR_OVERRIDE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --test-mode MODE    Test mode: smoke, full, desktop-only, mobile-only (default: full)"
            echo "  --skip-build        Skip backend build step"
            echo "  --keep-running      Keep services running after tests"
            echo "  --debug             Enable debug logging"
            echo "  --skip-docker       Skip Docker startup (use existing MongoDB)"
            echo "  --retries N         Number of test retries (default: 0)"
            echo "  --backend-port N    Backend port (default: 8100)"
            echo "  --frontend-port N   Frontend port (default: 8173)"
            echo "  --backend-dir PATH  Backend directory (default: ../backend)"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ─────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
DEFAULT_BACKEND_DIR="$(dirname "$FRONTEND_DIR")/backend"
BACKEND_DIR="${BACKEND_DIR_OVERRIDE:-$DEFAULT_BACKEND_DIR}"
ROOT_DIR="$(dirname "$FRONTEND_DIR")"

# Environment Variables (matching CI workflow)
export NODE_ENV=test
export PORT="$BACKEND_PORT"
export DB_STRING="mongodb://localhost:27017/taliho-integration"
export JWT_SECRET="integration-test-jwt-secret-key-32chars"
export PASSWORD_ENCRYPTION_KEY="integration-test-encrypt-key-32ch"
export TALIHO_CLIENT_URL="http://localhost:$FRONTEND_PORT"
export APP_BASE_URL="http://localhost:$BACKEND_PORT"
export APP_GUARD_BYPASS_WHEN_NO_KEYS="true"
export TEST_API_KEY="integration-test-api-key"

# E2E Test Credentials
export E2E_TEST_ADMIN_EMAIL="e2e-admin@testcompany.com"
export E2E_TEST_ADMIN_PASSWORD="E2ETestPassword123!"
export E2E_TEST_ADMIN_FIRST_NAME="E2E"
export E2E_TEST_ADMIN_LAST_NAME="Admin"
export E2E_TEST_COMPANY_NAME="E2E Test Company"

# AWS S3 (stub values)
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="test-access-key-id"
export AWS_SECRET_ACCESS_KEY="test-secret-access-key"
export AWS_BUCKET_NAME="test-integration-bucket"

# External APIs (stub values)
export ZOHO_API_ACCOUNTS_URL="https://accounts.zoho.com"
export SENDGRID_API_KEY="SG.integration-test-key-placeholder"

# Frontend Configuration
export FRONTEND_PORT="$FRONTEND_PORT"
export PLAYWRIGHT_PORT="$FRONTEND_PORT"
export BASE_URL="http://localhost:$FRONTEND_PORT"
export PLAYWRIGHT_TEST_BASE_URL="http://localhost:$FRONTEND_PORT"
export VITE_BACKEND_URL="http://localhost:$BACKEND_PORT"
export PLAYWRIGHT_BACKEND_URL="http://localhost:$BACKEND_PORT"
export VITE_ENVIRONMENT="test"
export VITE_TALIHO_API_KEY="integration-test-api-key"
export VITE_PROCORE_BASE_URL="https://sandbox.procore.com"

# Stripe Test IDs
export VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER="prod_test_early_adopter"
export VITE_STRIPE_PRODUCT_ID_STANDARD="prod_test_standard"
export VITE_STRIPE_PRODUCT_ID_PROFESSIONAL="prod_test_professional"
export VITE_STRIPE_PRODUCT_ID_BUSINESS="prod_test_business"
export VITE_STRIPE_PRICE_STANDARD_MONTHLY="price_test_standard_monthly"
export VITE_STRIPE_PRICE_STANDARD_ANNUAL="price_test_standard_annual"
export VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY="price_test_professional_monthly"
export VITE_STRIPE_PRICE_PROFESSIONAL_ANNUAL="price_test_professional_annual"
export VITE_STRIPE_PRICE_BUSINESS_MONTHLY="price_test_business_monthly"
export VITE_STRIPE_PRICE_BUSINESS_ANNUAL="price_test_business_annual"
export VITE_STRIPE_STORAGE_ADDON_PRICE="19"

# Process tracking
BACKEND_PID=""
DOCKER_STARTED=false

# ─────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════${NC}"
}

print_step() {
    echo ""
    echo -e "${YELLOW}─── $1 ───${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

wait_for_endpoint() {
    local url="$1"
    local timeout="${2:-60}"
    local name="${3:-Service}"

    local attempt=0
    local start_time=$(date +%s)

    while true; do
        attempt=$((attempt + 1))
        current_time=$(date +%s)
        elapsed=$((current_time - start_time))

        if [ $elapsed -ge $timeout ]; then
            print_error "$name failed to start within $timeout seconds"
            return 1
        fi

        if curl -sf "$url" > /dev/null 2>&1; then
            print_success "$name is ready (attempt $attempt)"
            return 0
        fi

        echo "Waiting for $name... (attempt $attempt)"
        sleep 1
    done
}

cleanup() {
    print_header "CLEANUP"

    # Stop backend server
    if [ -n "$BACKEND_PID" ]; then
        print_info "Stopping backend server (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    # Kill any orphaned node processes
    pkill -f "node.*dist/main" 2>/dev/null || true
    pkill -f "nest" 2>/dev/null || true

    if [ "$KEEP_RUNNING" = false ]; then
        if [ "$DOCKER_STARTED" = true ]; then
            print_info "Stopping Docker services..."
            cd "$FRONTEND_DIR"
            docker-compose -f docker-compose.integration.yml down -v --remove-orphans 2>/dev/null || true
        fi

        # Cleanup test database
        print_info "Cleaning up test database..."
        docker exec taliho-mongodb mongosh --quiet \
            --eval "db.getSiblingDB('taliho-integration').dropDatabase()" 2>/dev/null || true

    else
        print_info "Keeping services running (--keep-running specified)"
        print_info "  Backend: http://localhost:$BACKEND_PORT"
        print_info "  MongoDB: mongodb://localhost:27017"
    fi

    print_success "Cleanup complete"
}

# Register cleanup on exit
trap cleanup EXIT

# ─────────────────────────────────────────────────────────────────────────
# MAIN SCRIPT
# ─────────────────────────────────────────────────────────────────────────

print_header "TALIHO V3 - LOCAL INTEGRATION TESTS"

echo ""
echo "Configuration:"
echo "  Test Mode:    $TEST_MODE"
echo "  Skip Build:   $SKIP_BUILD"
echo "  Keep Running: $KEEP_RUNNING"
echo "  Debug:        $DEBUG_MODE"
echo "  Retries:      $RETRIES"
echo "  Backend Port: $BACKEND_PORT"
echo "  Frontend Port:$FRONTEND_PORT"
echo ""
echo "Directories:"
echo "  Frontend:     $FRONTEND_DIR"
echo "  Backend:      $BACKEND_DIR"

# ─────────────────────────────────────────────────────────────────────────
# PREREQUISITES CHECK
# ─────────────────────────────────────────────────────────────────────────

print_step "Checking Prerequisites"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_success "Node.js: $(node --version)"

# Check Docker
if [ "$SKIP_DOCKER" = false ]; then
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Install Docker Desktop or use --skip-docker flag"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker Desktop"
        exit 1
    fi
    print_success "Docker is running"
fi

# Check backend directory
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory not found at: $BACKEND_DIR"
    exit 1
fi
print_success "Backend directory found"

# ─────────────────────────────────────────────────────────────────────────
# START DOCKER SERVICES (MongoDB)
# ─────────────────────────────────────────────────────────────────────────

if [ "$SKIP_DOCKER" = false ]; then
    print_step "Starting Docker Services (MongoDB)"

    # Check if docker-compose file exists, create if not
    DOCKER_COMPOSE_FILE="$FRONTEND_DIR/docker-compose.integration.yml"
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_info "Creating docker-compose.integration.yml..."
        cat > "$DOCKER_COMPOSE_FILE" << 'EOF'
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: taliho-mongodb
    ports:
      - "27017:27017"
    healthcheck:
      test: mongosh --eval 'db.runCommand({ping:1})' --quiet
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
EOF
    fi

    cd "$FRONTEND_DIR"
    docker-compose -f docker-compose.integration.yml up -d --remove-orphans
    DOCKER_STARTED=true

    # Wait for MongoDB
    print_info "Waiting for MongoDB to be ready..."
    for i in $(seq 1 30); do
        health=$(docker inspect --format='{{.State.Health.Status}}' taliho-mongodb 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            print_success "MongoDB is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "MongoDB failed to start"
            exit 1
        fi
        echo "  MongoDB health check... ($i/30)"
        sleep 2
    done

fi

# ─────────────────────────────────────────────────────────────────────────
# INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────

print_step "Installing Dependencies"

# Frontend
print_info "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    npm ci
else
    print_info "Frontend node_modules exists, skipping install"
fi

# Backend
print_info "Installing backend dependencies..."
cd "$BACKEND_DIR"
if [ ! -d "node_modules" ]; then
    npm ci --legacy-peer-deps
else
    print_info "Backend node_modules exists, skipping install"
fi

print_success "Dependencies installed"

# ─────────────────────────────────────────────────────────────────────────
# BUILD BACKEND
# ─────────────────────────────────────────────────────────────────────────

if [ "$SKIP_BUILD" = false ]; then
    print_step "Building Backend"

    cd "$BACKEND_DIR"
    npm run build

    print_success "Backend built successfully"
else
    print_info "Skipping backend build (--skip-build specified)"
fi

# ─────────────────────────────────────────────────────────────────────────
# SEED TEST DATABASE
# ─────────────────────────────────────────────────────────────────────────

print_step "Seeding Test Database"

# Generate bcrypt password hash
print_info "Generating password hash..."
cd "$BACKEND_DIR"
HASHED_PASSWORD=$(node -e "const b=require('bcrypt');b.hash(process.env.E2E_TEST_ADMIN_PASSWORD,10).then(h=>process.stdout.write(h))")

if [ -z "$HASHED_PASSWORD" ]; then
    print_error "Failed to generate password hash"
    exit 1
fi
print_success "Password hash generated"

# Seed the database
print_info "Creating test API key..."
docker exec taliho-mongodb mongosh "mongodb://localhost:27017/taliho-integration" --quiet --eval "
db.apikeys.deleteMany({ apikey: '$TEST_API_KEY' });
db.apikeys.insertOne({
    apikey: '$TEST_API_KEY',
    type: 'internal-api',
    createdAt: new Date(),
    updatedAt: new Date()
});
print('API key created');
"

print_info "Creating test company..."
docker exec taliho-mongodb mongosh "mongodb://localhost:27017/taliho-integration" --quiet --eval "
db.companies.deleteMany({ _id: ObjectId('000000000000000000000001') });
db.companies.insertOne({
    _id: ObjectId('000000000000000000000001'),
    companyName: '$E2E_TEST_COMPANY_NAME',
    companyAddress: '123 Test Street',
    companyCity: 'San Francisco',
    companyState: 'CA',
    companyZIP: '94102',
    paidAccount: false,
    freeTrialActive: true,
    deactivated: false,
    projectsCount: 0,
    documentsCount: 0,
    qrCodesCount: 0,
    qrGroupsCount: 0,
    usersCount: 1,
    qrScansCount: 0,
    documentStorageUsed: 0,
    qrCodeStorageUsed: 0,
    documentStorageCapacity: 53687091200,
    qrCodeStorageCapacity: 10737418240,
    createdAt: new Date(),
    updatedAt: new Date()
});
print('Company created');
"

print_info "Creating test user..."
docker exec taliho-mongodb mongosh "mongodb://localhost:27017/taliho-integration" --quiet --eval "
db.users.deleteMany({ email: '$E2E_TEST_ADMIN_EMAIL' });
db.users.insertOne({
    _id: ObjectId('000000000000000000000002'),
    email: '$E2E_TEST_ADMIN_EMAIL',
    password: '$HASHED_PASSWORD',
    firstName: '$E2E_TEST_ADMIN_FIRST_NAME',
    lastName: '$E2E_TEST_ADMIN_LAST_NAME',
    company: ObjectId('000000000000000000000001'),
    permission: 'admin',
    isVerified: true,
    loginCount: 0,
    lastLoggedIn: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
});
print('User created');
"

print_success "Database seeded successfully"

# ─────────────────────────────────────────────────────────────────────────
# START BACKEND SERVER
# ─────────────────────────────────────────────────────────────────────────

print_step "Starting Backend Server"

cd "$BACKEND_DIR"

# Start backend in background
BACKEND_LOG="$ROOT_DIR/backend-local.log"
node dist/main > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

print_info "Backend PID: $BACKEND_PID"
print_info "Backend logs: $BACKEND_LOG"

# Wait for backend health
if ! wait_for_endpoint "http://localhost:$BACKEND_PORT/health" 60 "Backend"; then
    print_error "Backend failed to start. Check logs at: $BACKEND_LOG"
    tail -50 "$BACKEND_LOG"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────────────
# RUN PLAYWRIGHT TESTS
# ─────────────────────────────────────────────────────────────────────────

print_step "Running Playwright Integration Tests"

# Determine test projects based on mode
case "$TEST_MODE" in
    smoke)
        TEST_PROJECTS='["Desktop Chrome"]'
        ;;
    desktop-only)
        TEST_PROJECTS='["Desktop Chrome"]'
        ;;
    mobile-only)
        TEST_PROJECTS='["Mobile Safari", "Mobile Chrome"]'
        ;;
    full|*)
        TEST_PROJECTS='["Desktop Chrome", "Mobile Safari"]'
        ;;
esac

print_info "Test projects: $TEST_PROJECTS"

cd "$FRONTEND_DIR"

# Install Playwright browsers if needed
print_info "Ensuring Playwright browsers are installed..."
npx playwright install chromium webkit

# Build project arguments
ARGS=()
while IFS= read -r project; do
    ARGS+=("--project=$project")
done < <(echo "$TEST_PROJECTS" | jq -r '.[]')

# Set test environment variables
export CI=true
export BASE_URL="http://localhost:$FRONTEND_PORT"
export PLAYWRIGHT_TEST_BASE_URL="http://localhost:$FRONTEND_PORT"

if [ "$DEBUG_MODE" = true ]; then
    export DEBUG="pw:api"
fi

# Run tests
print_info "Running: npx playwright test --config=playwright.real-backend.config.ts ${ARGS[*]} --retries=$RETRIES"

set +e
npx playwright test --config=playwright.real-backend.config.ts "${ARGS[@]}" --retries="$RETRIES"
TEST_EXIT_CODE=$?
set -e

# ─────────────────────────────────────────────────────────────────────────
# RESULTS
# ─────────────────────────────────────────────────────────────────────────

print_header "TEST RESULTS"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_success "All integration tests passed!"
else
    print_error "Integration tests failed with exit code: $TEST_EXIT_CODE"
    print_info "Check the Playwright report: $FRONTEND_DIR/playwright-report/real-backend/index.html"
fi

exit $TEST_EXIT_CODE
