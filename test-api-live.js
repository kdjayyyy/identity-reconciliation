// test-api-live.js - Simple script to test the live API endpoints

const API_URL = "https://identity-reconciliation-9mwbwqejq-kinjal-das-projects.vercel.app";

async function testEndpoints() {
  console.log("🔍 Testing Live API Endpoints...\n");

  // Test 1: OPTIONS request to /identify (CORS preflight)
  console.log("📝 Test 1: OPTIONS request to /identify (CORS preflight)");
  try {
    const response1 = await fetch(`${API_URL}/identify`, {
      method: "OPTIONS"
    });
    console.log(`✅ Status: ${response1.status} ${response1.statusText}`);
    console.log("✅ Headers:", Object.fromEntries(response1.headers));
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  console.log("\n---\n");

  // Test 2: Create a new contact with POST /identify
  console.log("📝 Test 2: Create a new contact with POST /identify");
  try {
    const response2 = await fetch(`${API_URL}/identify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@example.com",
        phoneNumber: "1234567890"
      }),
    });
    const result2 = await response2.json();
    console.log("✅ Status:", response2.status);
    console.log("✅ Response:", JSON.stringify(result2, null, 2));
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  console.log("\n---\n");

  // Test 3: Get all contacts with GET /contacts
  console.log("📝 Test 3: Get all contacts with GET /contacts");
  try {
    const response3 = await fetch(`${API_URL}/contacts`);
    const result3 = await response3.json();
    console.log("✅ Status:", response3.status);
    console.log("✅ Response:", JSON.stringify(result3, null, 2));
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

// Run tests
testEndpoints();
