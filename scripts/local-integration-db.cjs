const path = require("path");
const { createRequire } = require("module");

const COMPANY_ID = "000000000000000000000001";
const USER_ID = "000000000000000000000002";

const [, , backendDirArg, action] = process.argv;

if (!backendDirArg || !action) {
  console.error(
    "Usage: node local-integration-db.cjs <backendDir> <seed|cleanup>",
  );
  process.exit(1);
}

const backendDir = path.resolve(backendDirArg);
const backendRequire = createRequire(path.join(backendDir, "package.json"));
const mongoose = backendRequire("mongoose");
const bcrypt = backendRequire("bcrypt");

const dbString =
  process.env.DB_STRING || "mongodb://localhost:27017/taliho-integration";
const apiKey = process.env.TEST_API_KEY || "integration-test-api-key";
const adminEmail =
  process.env.E2E_TEST_ADMIN_EMAIL || "e2e-admin@testcompany.com";
const adminPassword =
  process.env.E2E_TEST_ADMIN_PASSWORD || "E2ETestPassword123!";
const adminFirstName = process.env.E2E_TEST_ADMIN_FIRST_NAME || "E2E";
const adminLastName = process.env.E2E_TEST_ADMIN_LAST_NAME || "Admin";
const companyName = process.env.E2E_TEST_COMPANY_NAME || "E2E Test Company";
const companyAddress =
  process.env.E2E_TEST_COMPANY_ADDRESS || "123 Test Street";
const companyCity = process.env.E2E_TEST_COMPANY_CITY || "San Francisco";
const companyState = process.env.E2E_TEST_COMPANY_STATE || "CA";
const companyZip = process.env.E2E_TEST_COMPANY_ZIP || "94102";

async function connect() {
  await mongoose.connect(dbString);
  return mongoose.connection.db;
}

async function seed() {
  const db = await connect();
  const now = new Date();
  const companyId = new mongoose.Types.ObjectId(COMPANY_ID);
  const userId = new mongoose.Types.ObjectId(USER_ID);
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await db.collection("apikeys").deleteMany({ apikey: apiKey });
  await db.collection("apikeys").insertOne({
    apikey: apiKey,
    type: "internal-api",
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("companies").deleteMany({ _id: companyId });
  await db.collection("companies").insertOne({
    _id: companyId,
    companyName,
    companyAddress,
    companyCity,
    companyState,
    companyZIP: companyZip,
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
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("users").deleteMany({ email: adminEmail });
  await db.collection("users").insertOne({
    _id: userId,
    email: adminEmail,
    password: hashedPassword,
    firstName: adminFirstName,
    lastName: adminLastName,
    company: companyId,
    permission: "admin",
    isVerified: true,
    loginCount: 0,
    lastLoggedIn: now,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Seeded integration test data in ${dbString}`);
}

async function cleanup() {
  const db = await connect();
  await db.dropDatabase();
  console.log(`Dropped integration test database at ${dbString}`);
}

async function main() {
  try {
    if (action === "seed") {
      await seed();
    } else if (action === "cleanup") {
      await cleanup();
    } else {
      throw new Error(`Unsupported action: ${action}`);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main();
