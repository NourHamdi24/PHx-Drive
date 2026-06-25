const {
  handleLogin,
  handleAutoLogin,
  handleLogout,
} = require("./src/auth/authHandler");

async function test() {
  console.log("Testing login...");
  const result = await handleLogin("nour24hamdi@gmail.com", "Welcome@2026");
  console.log("Login result:", result);

  console.log("Testing autoLogin...");
  const autoResult = await handleAutoLogin();
  console.log("AutoLogin result:", autoResult);

  console.log("Testing logout...");
  const logoutResult = handleLogout();
  console.log("Logout result:", logoutResult);
}

test().catch(console.error);
